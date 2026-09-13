// ============================================================================
// JARVIS STANDALONE — Paso 2: WiFi + Pantalla + Sensor (sin IA todavía)
// ESP32-S3 DevKitC-1
// ============================================================================
// Objetivo de esta etapa: confirmar que el hardware base funciona antes de
// sumar Gemini Live, el enchufe Tuya y el audio. Nada de esto depende de
// internet excepto la conexión WiFi.
//
// DECISIÓN DE DISEÑO — por qué el sensor va en su propio core:
// El DHT22 se lee con bit-banging de timing crítico: la librería Adafruit_DHT
// desactiva las interrupciones (noInterrupts()/interrupts()) del core que
// ejecuta la lectura durante ~5ms para poder medir los pulsos del sensor con
// precisión de microsegundos. Eso NO son "interrupciones que manda el
// sensor" (el DHT22 no genera IRQs hacia la CPU) — es al revés: es una
// lectura tan sensible al timing que necesita que NADA la interrumpa a ELLA
// durante esos 5ms, y de paso bloquea brevemente cualquier otra cosa que
// dependa de interrupciones en ese mismo core (por ejemplo, el WebSocket o
// el I2S de audio que vamos a sumar en los próximos pasos).
//
// La solución real no es "más cores por las dudas", es "aislar lo que tiene
// timing crítico de lo que también tiene timing crítico". El ESP32-S3 tiene
// 2 cores, y el framework Arduino ya usa uno para algo puntual:
//   - Core 0 (PRO_CPU): acá corre el stack WiFi de bajo nivel por defecto en
//     el framework Arduino de ESP32 — esto no lo elegimos nosotros, así
//     viene de fábrica. Nada nuestro debería competir por CPU acá.
//   - Core 1 (APP_CPU): acá corre setup()/loop() por defecto. Es donde vive
//     todo lo nuestro: sensor, pantalla, y en los próximos pasos WebSocket/I2S.
//
// CORRECCIÓN (post primera versión): al principio pusimos la tarea del
// sensor en el Core 0 pensando en "aislarla" — pero eso hacía que sus ~5ms
// de interrupciones desactivadas (cada 8s) compitieran directamente con el
// procesamiento de paquetes WiFi entrantes, justo en el peor lugar posible.
// Causó fallos reales controlando el enchufe Tuya (la respuesta del enchufe
// se perdía si llegaba en esa ventana). Corregido: el sensor va en el Core 1,
// junto con todo lo demás. El Core 0 queda intocado, exclusivo para WiFi.
//
// NOTA A FUTURO: si migrás a un SHT30 (I2C), esto importa mucho menos — el
// driver I2C ya es "educado" con el scheduler y no necesita desactivar
// interrupciones. Por ahora, con el DHT22, hay que tener cuidado con esto.
// ============================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <DHT.h>
#include "driver/i2s.h"
#include "mbedtls/aes.h"
#include "mbedtls/md.h"
#include "mbedtls/base64.h"
#include "freertos/stream_buffer.h"
#include "esp_heap_caps.h"
#include "secrets.h"

// Prueba A/B equivalente al script Python: no inicializa ni captura/reproduce
// audio. Envía automáticamente un turno de texto y sólo diagnostica la
// recepción de la respuesta AUDIO por WebSocket.
static const bool DIAGNOSTIC_TRANSPORT_ONLY = false;
static const bool DIAGNOSTIC_PLAY_SPEAKER = true;
bool diagnosticTurnSent = false;

// ---------------------------------------------------------------------------
// CONFIGURACIÓN — ajustá esto a tu red
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enchufe Tuya (protocolo LAN v3.4 — este dispositivo confirmamos que SOLO
// habla v3.4; no tiene sentido mantener un fallback a v3.3 que le reportaría
// "éxito" sin que el enchufe realmente lo entienda)
// ---------------------------------------------------------------------------
const int   TUYA_PORT      = 6668;

// ---------------------------------------------------------------------------
// Gemini Live API — solo texto en este paso, sin audio todavía.
// ---------------------------------------------------------------------------
const char* GEMINI_MODEL   = "gemini-3.1-flash-live-preview";
const char* GEMINI_HOST    = "generativelanguage.googleapis.com";
const int   GEMINI_PORT    = 443;

// Persona de Jarvis — versión mínima para este paso. La ampliamos con
// tools (control_plug, update_display, read_sensor) en el paso 6.
const char* JARVIS_SYSTEM_PROMPT =
  "Sos JARVIS, respondes en espanol rioplatense, breve.";

// ---------------------------------------------------------------------------
// Audio — INMP441 (mic, entrada 16kHz que espera Gemini) y MAX98357A
// (parlante, salida 24kHz que Gemini nos devuelve). Pipeline de mejora ya
// validado en el test standalone: extracción de bits correcta + pasa-altos
// + AGC + limitador suave, aplicado en tiempo real a cada chunk capturado.
// ---------------------------------------------------------------------------
#define MIC_BCLK   1
#define MIC_WS     2
#define MIC_SD     42

#define SPK_BCLK   15
#define SPK_LRC    16
#define SPK_DIN    17

#define MIC_SAMPLE_RATE 16000  // formato exacto que espera Gemini Live de entrada
#define SPK_SAMPLE_RATE 24000  // formato en el que Gemini nos devuelve el audio
#define AUDIO_CHUNK_SAMPLES 320 // 20ms @ 16kHz por chunk enviado a Gemini

// ---------------------------------------------------------------------------
// Pantalla ST7735 0.96" 80x160 IPS (mismos pines que ya usás en el proyecto)
// ---------------------------------------------------------------------------
#define TFT_CS    7
#define TFT_RST   5
#define TFT_DC    6
#define TFT_MOSI  11
#define TFT_SCLK  12
#define TFT_BLK   10

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

// ---------------------------------------------------------------------------
// Sensor DHT22 — COMENTADO: no está físicamente conectado en el hardware
// actual, y sus mensajes de error llenaban la consola sin aportar nada.
// Para reactivarlo: descomentar todo este bloque, la tarea en setup(), y
// las 2 líneas que usan getSensorData() en handleSerialCommand().
// ---------------------------------------------------------------------------
/*
#define DHTPIN  4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

struct SensorData {
  float temperature;
  float humidity;
  bool  valid;
};

static SensorData sharedSensorData = {0.0f, 0.0f, false};
static portMUX_TYPE sensorMux = portMUX_INITIALIZER_UNLOCKED;

void setSensorData(float t, float h, bool valid) {
  portENTER_CRITICAL(&sensorMux);
  sharedSensorData.temperature = t;
  sharedSensorData.humidity = h;
  sharedSensorData.valid = valid;
  portEXIT_CRITICAL(&sensorMux);
}

SensorData getSensorData() {
  SensorData copy;
  portENTER_CRITICAL(&sensorMux);
  copy = sharedSensorData;
  portEXIT_CRITICAL(&sensorMux);
  return copy;
}

void sensorTask(void* pvParameters) {
  dht.begin();
  const TickType_t delayTicks = pdMS_TO_TICKS(8000);
  for (;;) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (isnan(h) || isnan(t)) {
      Serial.println("[Sensor] ⚠ Lectura DHT22 fallida (timing/checksum) — reintento en el próximo ciclo");
      setSensorData(0, 0, false);
    } else {
      setSensorData(t, h, true);
      Serial.printf("[Sensor] ✓ %.1f°C, %.0f%% HR  (ejecutando en core %d)\n", t, h, xPortGetCoreID());
    }
    vTaskDelay(delayTicks);
  }
}
*/

// ---------------------------------------------------------------------------
// Enchufe Tuya — protocolo LAN v3.4 (handshake de 3 pasos + HMAC-SHA256)
// Esta es la versión ya corregida (bug de "length" sin footer + bug del
// header de versión sin cifrar) que confirmamos que funciona en el hardware
// real. La dejamos tal cual, solo trasplantada a este proyecto.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Enchufe Tuya — protocolo LAN v3.4 (handshake de 3 pasos + HMAC-SHA256)
//
// EL BUG REAL QUE NOS TUVO BLOQUEADOS: PKCS7 SIEMPRE agrega un bloque
// entero de padding, incluso cuando el input ya es múltiplo exacto de 16
// bytes (si no lo hiciera, el padding dejaría de ser reversible sin
// ambigüedad). Nuestra versión anterior "optimizaba" salteando el padding
// para el nonce (16 bytes, paso 1) y el HMAC de FINISH (32 bytes, paso 3)
// por estar ya alineados a 16 — el enchufe esperaba ese bloque extra de
// padding y, al no encontrarlo, directamente ignoraba el paquete entero.
// Por eso llegaban siempre 0 bytes de respuesta: no era un error de
// protocolo que el enchufe pudiera reportar, era un paquete que ni
// siquiera reconocía como válido.
//
// Segundo fix, de yapa: la respuesta del enchufe incluye 4 bytes de
// "retcode" entre el header y el payload cifrado (algo que los paquetes
// que NOSOTROS mandamos no tienen) — hay que saltarlos antes de
// desencriptar, si no el nonce remoto y el HMAC quedan corridos 4 bytes
// y todo lo que sigue se calcula mal.
//
// Y de yapa también: usamos un número de secuencia real e incremental por
// paquete (reiniciado en cada conexión nueva), no fijo en 0.
// ---------------------------------------------------------------------------
uint32_t tuyaSeqNo = 1;

void tuyaHmacSha256(const uint8_t* key, size_t keyLen, const uint8_t* data, size_t dataLen, uint8_t* output) {
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, key, keyLen);
  mbedtls_md_hmac_update(&ctx, data, dataLen);
  mbedtls_md_hmac_finish(&ctx, output);
  mbedtls_md_free(&ctx);
}

void tuyaAesEcb(const uint8_t* key, const uint8_t* input, size_t len, uint8_t* output, int mode) {
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  if (mode == MBEDTLS_AES_ENCRYPT) mbedtls_aes_setkey_enc(&aes, key, 128);
  else mbedtls_aes_setkey_dec(&aes, key, 128);
  for (size_t i = 0; i < len; i += 16) mbedtls_aes_crypt_ecb(&aes, mode, input + i, output + i);
  mbedtls_aes_free(&aes);
}

// Padding PKCS7 completo y correcto — SIEMPRE agrega un bloque entero,
// incluso si rawLen ya es múltiplo de 16. Esta es la función que antes nos
// faltaba usar de forma consistente.
size_t tuyaAesEncryptPad(const uint8_t* key, const uint8_t* raw, size_t rawLen, uint8_t* outBuf) {
  size_t padBytes = 16 - (rawLen % 16);
  size_t totalLen = rawLen + padBytes;
  uint8_t* temp = (uint8_t*)malloc(totalLen);
  memcpy(temp, raw, rawLen);
  memset(temp + rawLen, (uint8_t)padBytes, padBytes);
  tuyaAesEcb(key, temp, totalLen, outBuf, MBEDTLS_AES_ENCRYPT);
  free(temp);
  return totalLen;
}

void sendTuyaFramedPacket(WiFiClient& client, uint32_t cmd, const uint8_t* payload, size_t payloadLen, const uint8_t* hmacKey) {
  uint32_t seq = tuyaSeqNo++;
  uint32_t declaredLen = payloadLen + 32 + 4; // payload + HMAC(32) + footer(4)
  size_t totalLen = 16 + payloadLen + 32 + 4;
  uint8_t* packet = (uint8_t*)malloc(totalLen);

  packet[0] = 0x00; packet[1] = 0x00; packet[2] = 0x55; packet[3] = 0xAA;
  packet[4] = (seq >> 24) & 0xFF; packet[5] = (seq >> 16) & 0xFF;
  packet[6] = (seq >> 8) & 0xFF;  packet[7] = seq & 0xFF;
  packet[8] = (cmd >> 24) & 0xFF; packet[9] = (cmd >> 16) & 0xFF;
  packet[10] = (cmd >> 8) & 0xFF; packet[11] = cmd & 0xFF;
  packet[12] = (declaredLen >> 24) & 0xFF; packet[13] = (declaredLen >> 16) & 0xFF;
  packet[14] = (declaredLen >> 8) & 0xFF;  packet[15] = declaredLen & 0xFF;

  if (payloadLen > 0) memcpy(packet + 16, payload, payloadLen);

  uint8_t hmac[32];
  tuyaHmacSha256(hmacKey, 16, packet, 16 + payloadLen, hmac);
  memcpy(packet + 16 + payloadLen, hmac, 32);

  packet[totalLen - 4] = 0x00; packet[totalLen - 3] = 0x00;
  packet[totalLen - 2] = 0xAA; packet[totalLen - 1] = 0x55;

  client.write(packet, totalLen);
  free(packet);
}

bool sendTuyaCommandV34(bool state) {
  WiFiClient client;
  client.setTimeout(3500);
  tuyaSeqNo = 1; // reiniciar el seqno en cada conexión nueva

  Serial.printf("[Tuya 3.4] Conectando a %s:%d...\n", TUYA_IP, TUYA_PORT);
  if (!client.connect(TUYA_IP, TUYA_PORT)) {
    Serial.println("❌ [Tuya 3.4] No se pudo abrir conexión TCP con el enchufe");
    return false;
  }
  Serial.println("✓ [Tuya 3.4] TCP conectado, enviando handshake...");

  uint8_t localKeyBytes[16];
  memset(localKeyBytes, 0, 16);
  size_t kLen = strlen(TUYA_LOCAL_KEY);
  memcpy(localKeyBytes, TUYA_LOCAL_KEY, kLen > 16 ? 16 : kLen);

  uint8_t localNonce[16];
  for (int i = 0; i < 16; i++) localNonce[i] = (uint8_t)esp_random();

  // Paso 1: SESS_KEY_NEG_START — el nonce (16B) sale con padding PKCS7
  // completo → 32 bytes cifrados resultantes (antes mandábamos 16 sin pad).
  uint8_t encNonce[32];
  size_t encNonceLen = tuyaAesEncryptPad(localKeyBytes, localNonce, 16, encNonce);
  sendTuyaFramedPacket(client, 0x03, encNonce, encNonceLen, localKeyBytes);

  unsigned long t0 = millis();
  while (client.available() < 48 && millis() - t0 < 3000) delay(10);
  int avail = client.available();
  if (avail < 48) {
    Serial.printf("❌ [Tuya 3.4] Timeout — llegaron %d bytes (se esperaban 48)\n", avail);
    client.stop();
    return false;
  }

  uint8_t resp[256];
  int rLen = client.read(resp, sizeof(resp));

  // FIX: saltar los 4 bytes de "retcode" que trae la respuesta del enchufe
  // (header 16B + retcode 4B) antes de desencriptar el payload.
  size_t encPayloadLen = rLen - 20 - 36; // 20 = header+retcode; 36 = hmac(32)+footer(4)
  uint8_t decResp[64];
  tuyaAesEcb(localKeyBytes, resp + 20, encPayloadLen, decResp, MBEDTLS_AES_DECRYPT);

  uint8_t remoteNonce[16];
  memcpy(remoteNonce, decResp, 16);

  uint8_t expectedHmac[32];
  tuyaHmacSha256(localKeyBytes, 16, localNonce, 16, expectedHmac);
  if (memcmp(expectedHmac, decResp + 16, 32) != 0) {
    Serial.println("❌ [Tuya 3.4] HMAC no coincide (local_key incorrecta o enchufe repareado)");
    client.stop();
    return false;
  }

  uint8_t xorNonce[16];
  for (int i = 0; i < 16; i++) xorNonce[i] = localNonce[i] ^ remoteNonce[i];
  uint8_t sessionKey[16];
  tuyaAesEcb(localKeyBytes, xorNonce, 16, sessionKey, MBEDTLS_AES_ENCRYPT);

  // Paso 3: SESS_KEY_NEG_FINISH — el HMAC (32B, ya alineado) también lleva
  // su bloque de padding completo → 48 bytes cifrados resultantes.
  uint8_t rkeyHmac[32];
  tuyaHmacSha256(localKeyBytes, 16, remoteNonce, 16, rkeyHmac);
  uint8_t encFinish[48];
  size_t encFinishLen = tuyaAesEncryptPad(localKeyBytes, rkeyHmac, 32, encFinish);
  sendTuyaFramedPacket(client, 0x05, encFinish, encFinishLen, localKeyBytes);
  delay(30);

  // Paso 4: CONTROL_NEW (cmd 0x0D) — header de versión + JSON cifrados
  // juntos como un solo bloque (esto ya lo teníamos bien).
  unsigned long nowSec = millis() / 1000 + 1725000000;
  char jsonBuf[128];
  snprintf(jsonBuf, sizeof(jsonBuf), "{\"protocol\":5,\"t\":%lu,\"data\":{\"dps\":{\"1\":%s}}}", nowSec, state ? "true" : "false");
  size_t jsonLen = strlen(jsonBuf);

  uint8_t rawCommand[160];
  memcpy(rawCommand, "3.4", 3);
  memset(rawCommand + 3, 0, 12);
  memcpy(rawCommand + 15, jsonBuf, jsonLen);
  size_t rawCmdLen = 15 + jsonLen;

  uint8_t encCommand[192];
  size_t encCmdLen = tuyaAesEncryptPad(sessionKey, rawCommand, rawCmdLen, encCommand);
  sendTuyaFramedPacket(client, 0x0D, encCommand, encCmdLen, sessionKey);

  t0 = millis();
  while (client.available() < 20 && millis() - t0 < 2000) delay(10);
  bool gotConfirmation = client.available() > 0;
  if (gotConfirmation) {
    uint8_t confirmBuf[128];
    client.read(confirmBuf, sizeof(confirmBuf));
  }
  client.stop();

  if (gotConfirmation) {
    Serial.printf("⚡ [Tuya v3.4] Enchufe conmutado a: %s (confirmado)\n", state ? "ENCENDIDO" : "APAGADO");
  } else {
    Serial.printf("⚡ [Tuya v3.4] Comando enviado a: %s (sin confirmación explícita del enchufe)\n", state ? "ENCENDIDO" : "APAGADO");
  }
  return true; // el handshake completo + HMAC validado ya prueba que la sesión es legítima
}

// ---------------------------------------------------------------------------
// Audio — inicialización I2S
// ---------------------------------------------------------------------------
void setupMicI2S() {
  i2s_config_t i2sConfig = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = MIC_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    // Estéreo real: el modo "un solo canal" del driver I2S legacy de ESP32
    // es poco confiable (ya lo comprobamos). El INMP441 con L/R a GND solo
    // llena el slot izquierdo con datos reales.
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 256,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  i2s_pin_config_t pinConfig = {
    .bck_io_num = MIC_BCLK,
    .ws_io_num = MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = MIC_SD
  };
  i2s_driver_install(I2S_NUM_0, &i2sConfig, 0, nullptr);
  i2s_set_pin(I2S_NUM_0, &pinConfig);
}

void setupSpeakerI2S() {
  i2s_config_t i2sConfig = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SPK_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    // El MAX98357A en modo mono espera stream estéreo completo (promedia
    // L+R internamente) — mandamos estéreo duplicado.
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };
  i2s_pin_config_t pinConfig = {
    .bck_io_num = SPK_BCLK,
    .ws_io_num = SPK_LRC,
    .data_out_num = SPK_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };
  i2s_driver_install(I2S_NUM_1, &i2sConfig, 0, nullptr);
  i2s_set_pin(I2S_NUM_1, &pinConfig);
}

// ---------------------------------------------------------------------------
// Pipeline DSP del mic — mismo que ya validamos en el test standalone:
// pasa-altos (~90-100Hz) -> AGC (ganancia adaptativa) -> limitador suave.
// ---------------------------------------------------------------------------
float hpAlpha = 0.965f;
int16_t hpPrevX = 0;
float hpPrevY = 0;

int16_t highPassFilter(int16_t x) {
  float y = hpAlpha * (hpPrevY + x - hpPrevX);
  hpPrevX = x;
  hpPrevY = y;
  return (int16_t)y;
}

float agcEnvelope = 0.0f;
float agcGain = 1.0f;
const float AGC_TARGET = 9000.0f;
const float AGC_ATTACK = 0.06f;
const float AGC_RELEASE = 0.0006f;
const float AGC_GAIN_SMOOTH = 0.015f;
const float AGC_MAX_GAIN = 25.0f;
const float AGC_MIN_GAIN = 1.0f;

float applyAGC(int16_t x) {
  float absX = fabsf((float)x);
  if (absX > agcEnvelope) agcEnvelope += (absX - agcEnvelope) * AGC_ATTACK;
  else                    agcEnvelope += (absX - agcEnvelope) * AGC_RELEASE;

  if (agcEnvelope > 15.0f) {
    float desiredGain = AGC_TARGET / agcEnvelope;
    agcGain += (desiredGain - agcGain) * AGC_GAIN_SMOOTH;
    if (agcGain > AGC_MAX_GAIN) agcGain = AGC_MAX_GAIN;
    if (agcGain < AGC_MIN_GAIN) agcGain = AGC_MIN_GAIN;
  }
  return (float)x * agcGain;
}

int16_t softLimiter(float x) {
  float norm = x / 32768.0f;
  float limited = tanhf(norm);
  float out = limited * 32767.0f;
  if (out > 32767.0f) out = 32767.0f;
  if (out < -32768.0f) out = -32768.0f;
  return (int16_t)out;
}

// ---------------------------------------------------------------------------
// Envío de audio a Gemini (realtimeInput) — base64 de cada chunk PCM
// ---------------------------------------------------------------------------
volatile bool jarvisSpeaking = false; // true mientras recibimos/reproducimos la respuesta
unsigned long jarvisSpeakingSince = 0; // para la salvaguarda de timeout (ver audioCaptureTask)
extern websockets::WebsocketsClient geminiWs; // declarado más abajo

// La captura sólo deposita PCM acá. Únicamente loop() toca geminiWs y TLS.
// Esto evita usar el mismo WiFiClientSecure desde dos tareas FreeRTOS.
static const size_t MIC_STREAM_BYTES = 8192;
StreamBufferHandle_t micUploadStream = nullptr;

void sendAudioChunkToGemini(const int16_t* pcmSamples, size_t numSamples) {
  static uint8_t b64Buf[2048];
  size_t b64Len = 0;
  int ret = mbedtls_base64_encode(b64Buf, sizeof(b64Buf), &b64Len,
                                   (const unsigned char*)pcmSamples, numSamples * sizeof(int16_t));
  if (ret != 0) {
    Serial.println("[Gemini] ⚠ Error codificando audio en base64 (buffer chico?)");
    return;
  }

  JsonDocument doc;
  JsonObject ri = doc["realtimeInput"].to<JsonObject>();
  JsonObject audio = ri["audio"].to<JsonObject>();
  audio["mimeType"] = "audio/pcm;rate=16000";
  audio["data"] = String((char*)b64Buf, b64Len);

  String out;
  serializeJson(doc, out);

  geminiWs.send(out);
}

// ---------------------------------------------------------------------------
// Reproducción del audio que devuelve Gemini (24kHz) — decodifica cada
// chunk base64 apenas llega y lo escribe al parlante en estéreo duplicado,
// para no esperar el turno completo antes de empezar a sonar.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Reproducción del audio de Gemini — DESACOPLADA de la recepción de red.
// FIX: hacíamos el i2s_write() (bloqueante) directamente adentro del
// callback de WebSocket, mientras sosteníamos el mutex de red. Si el
// parlante tardaba en tener lugar en su buffer, eso frenaba por completo
// la lectura de la red durante ese tiempo — coincide exactamente con el
// patrón de "se corta siempre apenas arranca a hablar" que viste. Ahora el
// callback de red solo decodifica y encola (rápido); una tarea aparte hace
// la reproducción real, sin que le importe a nadie más si se bloquea.
// ---------------------------------------------------------------------------
// Buffer fijo: evita la fragmentación y los picos de heap que producía una
// cola de 8 malloc() de hasta 24 KB cada uno. 32 KB equivalen a ~680 ms de
// PCM mono a 24 kHz; si se llena se descarta audio, pero nunca se bloquea el
// callback de red ni se pone en riesgo la conexión WebSocket.
static const size_t PLAYBACK_STREAM_BYTES = 262144;
StreamBufferHandle_t audioPlaybackStream = nullptr;
StaticStreamBuffer_t audioPlaybackStreamControl;
uint8_t* audioPlaybackStorage = nullptr;
volatile bool geminiTurnEnded = true;
unsigned long lastPlaybackOverflowLog = 0;

void playGeminiAudioChunk(const char* base64Data, size_t base64Len) {
  static const size_t DECODE_SCRATCH_BYTES = 49152;
  static uint8_t* decodeScratch = nullptr;
  if (!decodeScratch) decodeScratch = (uint8_t*)ps_malloc(DECODE_SCRATCH_BYTES);
  if (!decodeScratch) {
    Serial.println("[Gemini] ⚠ Sin PSRAM para decodificar audio");
    return;
  }
  size_t pcmLen = 0;
  int ret = mbedtls_base64_decode(decodeScratch, DECODE_SCRATCH_BYTES, &pcmLen,
                                   (const unsigned char*)base64Data, base64Len);
  if (ret != 0) {
    Serial.printf("[Gemini] ⚠ Error decodificando audio base64 (base64Len=%u, buffer=%u)\n",
                  (unsigned)base64Len, (unsigned)DECODE_SCRATCH_BYTES);
    return;
  }

  // PCM16 siempre debe conservar pares de bytes completos.
  size_t available = xStreamBufferSpacesAvailable(audioPlaybackStream) & ~(size_t)1;
  size_t toWrite = min(pcmLen & ~(size_t)1, available);
  size_t written = toWrite > 0
                     ? xStreamBufferSend(audioPlaybackStream, decodeScratch, toWrite, 0)
                     : 0;
  if (written < pcmLen && millis() - lastPlaybackOverflowLog > 1000) {
    Serial.printf("[Audio] ⚠ Buffer lleno: descartados %u bytes (heap libre=%u)\n",
                  (unsigned)(pcmLen - written), (unsigned)ESP.getFreeHeap());
    lastPlaybackOverflowLog = millis();
  }
}

// Tarea dedicada, exclusivamente para escribir al I2S del parlante. Puede
// bloquearse todo lo que necesite sin afectar la recepción de red.
void audioPlaybackTask(void* pvParameters) {
  const int CHUNK = 256;
  static int16_t monoChunk[CHUNK];
  static int16_t stereoChunk[CHUNK * 2];

  for (;;) {
    size_t bytesRead = xStreamBufferReceive(audioPlaybackStream, monoChunk,
                                             sizeof(monoChunk), pdMS_TO_TICKS(20));
    int n = bytesRead / sizeof(int16_t);
    if (n > 0) {
      for (int i = 0; i < n; i++) {
        stereoChunk[i * 2]     = monoChunk[i];
        stereoChunk[i * 2 + 1] = monoChunk[i];
      }
      size_t bytesWritten;
      i2s_write(I2S_NUM_1, stereoChunk, n * 2 * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
    } else if (geminiTurnEnded) {
      // Recién habilitamos el mic cuando también terminó de sonar el buffer.
      jarvisSpeaking = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Detección de voz local (VAD) por energía — FIX: mandar audio sin parar
// cada 20ms (incluso en silencio) le gana demasiado tiempo de CPU/mutex a
// la tarea de audio (prioridad alta) por sobre loop() (prioridad normal),
// que necesita correr seguido para procesar los PONG del heartbeat a
// tiempo. Si loop() no llega, NUESTRO PROPIO cliente cree que el server
// murió y cierra la conexión — coincide con las desconexiones que vimos
// incluso sin haber hablado. Con el gate, solo mandamos cuando hay señal
// real, liberando mucho más tiempo para el resto.
// ---------------------------------------------------------------------------
const float VAD_THRESHOLD = 500.0f;      // RMS antes del AGC; evita disparos por ruido ambiente
const int VAD_HANGOVER_CHUNKS = 25;      // ~500ms de margen tras que baja la energía (20ms/chunk)
const int VAD_MIN_UTTERANCE_CHUNKS = 8;  // ignora pulsos de ruido menores a ~160 ms
int vadHangoverCounter = 0;
volatile bool micStreamEndPending = false;

// ---------------------------------------------------------------------------
// Tarea dedicada a la captura de audio — corre en su propia tarea de
// FreeRTOS porque el enchufe Tuya bloquea ~1-2s por llamada y no podemos
// permitir que eso corte el streaming de audio. Comparte el Core 1 con
// loop() (el Core 0 sigue exclusivo para WiFi), con prioridad más alta.
//
// Por ahora manda audio de forma continua mientras la sesión esté lista y
// no estemos reproduciendo la respuesta de Gemini (para no generar
// feedback — el mic no debería escuchar al propio Jarvis hablando). El
// gating local por energía (para no gastar ancho de banda/costo en
// silencio) queda como refinamiento del próximo paso.
// ---------------------------------------------------------------------------
extern bool geminiSetupComplete; // declarado más abajo junto al resto de Gemini

void audioCaptureTask(void* pvParameters) {
  int32_t rawBuf[AUDIO_CHUNK_SAMPLES * 2]; // estéreo
  int16_t processedBuf[AUDIO_CHUNK_SAMPLES];

  for (;;) {
    size_t bytesRead;
    i2s_read(I2S_NUM_0, rawBuf, sizeof(rawBuf), &bytesRead, portMAX_DELAY);
    int wordsRead = bytesRead / sizeof(int32_t);

    int n = 0;
    uint64_t rawEnergy = 0;
    for (int i = 0; i < wordsRead && n < AUDIO_CHUNK_SAMPLES; i += 2) {
      int16_t raw16 = (int16_t)(rawBuf[i] >> 16);
      int16_t filtered = highPassFilter(raw16);
      rawEnergy += (int32_t)filtered * (int32_t)filtered;
      float amplified = applyAGC(filtered);
      processedBuf[n++] = softLimiter(amplified);
    }

    // VAD por energía: solo mandamos si hay señal real (con margen de
    // hangover para no cortar mitad de palabra en una pausa corta).
    float rawRms = n > 0 ? sqrtf((float)rawEnergy / n) : 0.0f;
    if (rawRms > VAD_THRESHOLD) {
      vadHangoverCounter = VAD_HANGOVER_CHUNKS;
    } else if (vadHangoverCounter > 0) {
      vadHangoverCounter--;
    }
    static bool wasVoiceActive = false;
    static int utteranceChunks = 0;
    bool voiceActive = vadHangoverCounter > 0;
    if (wasVoiceActive && !voiceActive) {
      if (utteranceChunks >= VAD_MIN_UTTERANCE_CHUNKS) micStreamEndPending = true;
      utteranceChunks = 0;
    }
    wasVoiceActive = voiceActive;

    if (geminiSetupComplete && !jarvisSpeaking && voiceActive && n > 0) {
      size_t bytes = n * sizeof(int16_t);
      // No bloquear: la red puede demorarse, pero la captura I2S no debe
      // invadir ni ejecutar el objeto WebSocket desde esta tarea.
      if (xStreamBufferSend(micUploadStream, processedBuf, bytes, 0) > 0) {
        utteranceChunks++;
      }
    }
  }
}


enum JarvisMood { MOOD_NEUTRAL, MOOD_HAPPY, MOOD_THINKING, MOOD_ALERT, MOOD_LISTENING };

uint16_t moodColor(JarvisMood mood) {
  switch (mood) {
    case MOOD_HAPPY:     return tft.color565(0x6B, 0xD6, 0x8B); // verde
    case MOOD_THINKING:  return tft.color565(0xFF, 0xB4, 0x54); // ámbar
    case MOOD_ALERT:     return tft.color565(0xFF, 0x6B, 0x6B); // rojo
    case MOOD_LISTENING: return tft.color565(0x4F, 0xD8, 0xE8); // cian
    default:             return tft.color565(0x4F, 0xD8, 0xE8); // cian (neutral)
  }
}

void drawJarvisFace(JarvisMood mood, const char* subtitle = nullptr) {
  uint16_t color = moodColor(mood);
  tft.fillScreen(ST77XX_BLACK);

  int eyeY = 40, eyeH = 20;
  if (mood == MOOD_THINKING)  eyeH = 14;
  if (mood == MOOD_HAPPY)     eyeH = 10;
  if (mood == MOOD_ALERT)     eyeH = 26;
  if (mood == MOOD_LISTENING) eyeH = 24;

  tft.fillRoundRect(18, eyeY, 14, eyeH, 6, color);
  tft.fillRoundRect(48, eyeY, 14, eyeH, 6, color);

  int mouthY = 75;
  if (mood == MOOD_HAPPY) {
    tft.drawLine(15, mouthY, 40, mouthY + 12, color);
    tft.drawLine(40, mouthY + 12, 65, mouthY, color);
  } else if (mood == MOOD_ALERT) {
    tft.drawLine(20, mouthY + 6, 40, mouthY - 4, color);
    tft.drawLine(40, mouthY - 4, 60, mouthY + 6, color);
  } else {
    tft.drawLine(20, mouthY, 60, mouthY, color);
  }

  if (subtitle) {
    tft.setTextSize(1);
    tft.setTextColor(color);
    tft.setCursor(4, 100);
    tft.print(subtitle);
  }
}

// ---------------------------------------------------------------------------
// Gemini Live — cliente WebSocket (solo texto en este paso)
// ---------------------------------------------------------------------------
using namespace websockets;
WebsocketsClient geminiWs;
bool geminiSetupComplete = false;
String pendingModelReply = "";

// geminiWs no es thread-safe. En esta versión solamente loop() y los
// callbacks síncronos disparados por loop() lo usan. La captura I2S se
// comunica con loop() mediante micUploadStream.
String geminiResumptionHandle = ""; // guardado entre desconexiones para retomar la sesión
String fragmentedGeminiMessage;
bool collectingGeminiFragments = false;

void sendGeminiSetup() {
  JsonDocument doc;
  JsonObject setup = doc["setup"].to<JsonObject>();
  setup["model"] = String("models/") + GEMINI_MODEL;

  // FIX confirmado con test real: "responseModalities" NO es un campo
  // directo de "setup" (el server devuelve "Unknown name responseModalities
  // at 'setup': Cannot find field"). Va anidado dentro de "generationConfig".
  JsonObject genConfig = setup["generationConfig"].to<JsonObject>();
  JsonArray modalities = genConfig["responseModalities"].to<JsonArray>();
  modalities.add("AUDIO");

  setup["outputAudioTranscription"].to<JsonObject>(); // objeto vacío = activarla con defaults

  // Session resumption: los cortes 1008/1011 en mitad de la respuesta son
  // un problema conocido y reportado de esta API (confirmado por varios
  // equipos de producción en el foro oficial). La mitigación documentada
  // por Google no es "evitar el corte" sino reconectar retomando el
  // contexto con un handle, en vez de arrancar de cero cada vez.
  JsonObject resumption = setup["sessionResumption"].to<JsonObject>();
  if (geminiResumptionHandle.length() > 0) {
    resumption["handle"] = geminiResumptionHandle;
    Serial.println("[Gemini] Retomando sesión anterior con resumption handle");
  }

  JsonObject sysInst = setup["systemInstruction"].to<JsonObject>();
  JsonArray sysParts = sysInst["parts"].to<JsonArray>();
  JsonObject sysPart = sysParts.add<JsonObject>();
  sysPart["text"] = JARVIS_SYSTEM_PROMPT;

  String out;
  serializeJson(doc, out);
  Serial.printf("[DIAG] SETUP JSON (%u bytes): %s\n", (unsigned)out.length(), out.c_str());
  geminiWs.send(out);
  Serial.println("[Gemini] Setup enviado, esperando confirmación...");
}

void sendGeminiTextTurn(const String& text) {
  if (!geminiSetupComplete) {
    Serial.println("[Gemini] ⚠ Todavía no terminó el setup, esperá un segundo y probá de nuevo");
    return;
  }
  JsonDocument doc;
  JsonObject clientContent = doc["clientContent"].to<JsonObject>();
  JsonArray turns = clientContent["turns"].to<JsonArray>();
  JsonObject turn = turns.add<JsonObject>();
  turn["role"] = "user";
  turn["parts"][0]["text"] = text;
  clientContent["turnComplete"] = true;

  String out;
  serializeJson(doc, out);
  geminiWs.send(out);

  drawJarvisFace(MOOD_THINKING, "pensando...");
  Serial.printf("[Gemini] → Enviado: \"%s\"\n", text.c_str());
}

void handleGeminiMessage(uint8_t* payload, size_t length) {
  Serial.printf("[DIAG] RX=%u heap=%u largest=%u\n", (unsigned)length,
                (unsigned)ESP.getFreeHeap(),
                (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_8BIT));
  if (length <= 1024) {
    Serial.print("[DIAG] JSON: ");
    Serial.write(payload, length);
    Serial.println();
  }
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[Gemini] ⚠ Error parseando JSON: %s\n", err.c_str());
    return;
  }

  if (doc["setupComplete"].is<JsonObject>()) {
    geminiSetupComplete = true;
    Serial.println("[Gemini] ✓ Setup confirmado — sesión lista");
    drawJarvisFace(MOOD_HAPPY, "gemini listo");
    if (DIAGNOSTIC_TRANSPORT_ONLY && !diagnosticTurnSent) {
      diagnosticTurnSent = true;
      sendGeminiTextTurn("Hola, quien sos y que podes hacer?");
    }
    return;
  }

  // Guardar el handle de resumption apenas Gemini nos lo actualiza, para
  // poder retomar la conversación si la sesión se corta.
  if (doc["sessionResumptionUpdate"].is<JsonObject>()) {
    JsonObject sru = doc["sessionResumptionUpdate"];
    if (sru["resumable"].is<bool>() && sru["resumable"].as<bool>() && sru["newHandle"].is<const char*>()) {
      geminiResumptionHandle = String((const char*)sru["newHandle"]);
      Serial.println("[Gemini] ✓ Resumption handle actualizado");
    }
    return;
  }

  if (doc["serverContent"].is<JsonObject>()) {
    JsonObject serverContent = doc["serverContent"];

    // Texto de lo que Jarvis está diciendo (vía transcripción del audio de
    // salida, ya que responseModalities tiene que ser AUDIO en estos modelos)
    if (serverContent["outputTranscription"].is<JsonObject>() &&
        serverContent["outputTranscription"]["text"].is<const char*>()) {
      pendingModelReply += serverContent["outputTranscription"]["text"].as<const char*>();
    }

    // Audio real de Gemini (inline_data) — lo reproducimos apenas llega,
    // chunk por chunk, para no esperar el turno completo.
    if (serverContent["modelTurn"].is<JsonObject>()) {
      JsonArray parts = serverContent["modelTurn"]["parts"];
      for (JsonObject part : parts) {
        if (part["inlineData"].is<JsonObject>() && part["inlineData"]["data"].is<const char*>()) {
          if (!jarvisSpeaking) {
            jarvisSpeaking = true;
            geminiTurnEnded = false;
            jarvisSpeakingSince = millis();
            drawJarvisFace(MOOD_HAPPY, "hablando...");
          }
          const char* b64Data = part["inlineData"]["data"];
          Serial.printf("[DIAG] audio base64=%u bytes\n", (unsigned)strlen(b64Data));
          if (DIAGNOSTIC_PLAY_SPEAKER) {
            playGeminiAudioChunk(b64Data, strlen(b64Data));
          }
        }
      }
    }

    if (serverContent["turnComplete"].is<bool>() && serverContent["turnComplete"].as<bool>()) {
      Serial.printf("[Gemini] ← Jarvis dice: \"%s\"\n", pendingModelReply.c_str());
      geminiTurnEnded = true;
      drawJarvisFace(MOOD_NEUTRAL, "listo");
      pendingModelReply = "";
    }
  }
}

void geminiWsMessage(WebsocketsMessage message) {
  const std::string& raw = message.rawData();
  handleGeminiMessage((uint8_t*)raw.data(), raw.size());
}

void geminiWsEvent(WebsocketsEvent event, String data) {
  switch (event) {
    case WebsocketsEvent::ConnectionOpened:
      Serial.println("✓ [Gemini] WebSocket conectado");
      sendGeminiSetup();
      break;
    case WebsocketsEvent::ConnectionClosed:
      Serial.printf("❌ [Gemini] WebSocket desconectado: %s\n", data.c_str());
      geminiSetupComplete = false;
      diagnosticTurnSent = false;
      geminiTurnEnded = true;
      jarvisSpeaking = false;
      if (audioPlaybackStream) xStreamBufferReset(audioPlaybackStream);
      break;
    case WebsocketsEvent::GotPing:
    case WebsocketsEvent::GotPong:
      break;
  }
}

void connectGeminiLive() {
  String path = String("/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=") + GEMINI_API_KEY;
  geminiWs.setInsecure();
  geminiWs.onMessage(geminiWsMessage);
  geminiWs.onEvent(geminiWsEvent);
  if (!geminiWs.connectSecure(GEMINI_HOST, GEMINI_PORT, path)) {
    Serial.println("❌ [Gemini] No se pudo abrir WebSocket alternativo");
  }
}


void connectWiFi() {
  Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] ✓ Conectado, IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] ❌ No se pudo conectar en 15s — revisá SSID/password");
  }
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n==========================================");
  Serial.println("   JARVIS ESP32-S3 — Paso 6: audio real     ");
  Serial.println("==========================================");
  Serial.printf("[Main] setup() corriendo en core %d\n", xPortGetCoreID());
  Serial.println("[DIAG] Transporte: ArduinoWebsockets alternativo");
  Serial.printf("[DIAG] PSRAM=%s, libre=%u bytes\n",
                psramFound() ? "SI" : "NO", (unsigned)ESP.getFreePsram());

  pinMode(TFT_BLK, OUTPUT);
  digitalWrite(TFT_BLK, HIGH);
  tft.initR(INITR_MINI160x80); // panel 0.96" 80x160
  tft.setRotation(1);
  drawJarvisFace(MOOD_NEUTRAL, "iniciando...");

  if (DIAGNOSTIC_PLAY_SPEAKER) {
    setupSpeakerI2S();
    audioPlaybackStorage = (uint8_t*)ps_malloc(PLAYBACK_STREAM_BYTES + 1);
    if (audioPlaybackStorage) {
      audioPlaybackStream = xStreamBufferCreateStatic(
        PLAYBACK_STREAM_BYTES, 2, audioPlaybackStorage,
        &audioPlaybackStreamControl);
    }
    if (!audioPlaybackStream) {
      Serial.println("❌ [Main] No se pudo crear el buffer PSRAM del parlante");
      while (true) delay(1000);
    }
  }

  if (!DIAGNOSTIC_TRANSPORT_ONLY) {
    setupMicI2S();
    micUploadStream = xStreamBufferCreate(MIC_STREAM_BYTES, 2);
    if (!micUploadStream) {
      Serial.println("❌ [Main] No se pudo crear el buffer del micrófono");
      while (true) delay(1000);
    }
  }

  connectWiFi();
  drawJarvisFace(WiFi.status() == WL_CONNECTED ? MOOD_HAPPY : MOOD_ALERT,
                 WiFi.status() == WL_CONNECTED ? "wifi ok" : "sin wifi");

  if (WiFi.status() == WL_CONNECTED) {
    connectGeminiLive();
  }

  // FIX: el Core 0 es donde corre el stack WiFi de bajo nivel por defecto en
  // el framework Arduino de ESP32 (confirmado por Espressif). Habíamos puesto
  // el sensor ahí pensando en "aislarlo", pero es exactamente lo contrario de
  // lo que queríamos: cada ~5ms que el DHT22 desactiva interrupciones puede
  // pisar el procesamiento de un paquete de WiFi entrante (como la respuesta
  // del enchufe). Lo movemos al Core 1, junto con todo lo demás, y dejamos
  // el Core 0 exclusivo para el WiFi.
  // Tarea del sensor DESACTIVADA — DHT22 no conectado físicamente (ver
  // comentario grande donde está el bloque comentado más arriba).
  /*
  xTaskCreatePinnedToCore(
    sensorTask,
    "SensorTask",
    4096,
    nullptr,
    1,      // prioridad baja: no es urgente, solo no queremos que se muera de hambre
    nullptr,
    1       // Core 1 (antes: 0 — ese era el bug)
  );
  */

  // La captura de audio necesita prioridad más alta que el resto: el
  // enchufe Tuya bloquea ~1-2s por llamada y no puede cortar el streaming.
  // FIX: subimos el stack de 4096 a 8192 — los buffers locales (rawBuf +
  // processedBuf, ~3.2KB) más las operaciones TLS de sendTXT() (mbedTLS es
  // conocido por consumir bastante stack) se quedaban cortos con 4096,
  // consistente con el crash de stack corrupto que vimos.
  if (DIAGNOSTIC_PLAY_SPEAKER) {
    xTaskCreatePinnedToCore(audioPlaybackTask, "AudioPlaybackTask", 4096,
                            nullptr, 2, nullptr, 1);
  }
  if (!DIAGNOSTIC_TRANSPORT_ONLY) {
    xTaskCreatePinnedToCore(audioCaptureTask, "AudioCaptureTask", 8192,
                            nullptr, 3, nullptr, 1);
  }

  Serial.printf("[Main] loop() va a correr en core %d\n", xPortGetCoreID());
}

// ---------------------------------------------------------------------------
// LOOP (Core 1)
// ---------------------------------------------------------------------------
// NOTA DIAGNÓSTICO: cambiamos el timer automático por un disparador manual
// vía Serial ("on" / "off") para poder controlar exactamente cuándo se
// manda cada intento — clave para probar "reiniciar el enchufe y probar UNA
// sola vez" sin que el timer automático dispare otro intento encima.
bool plugState = false;

void handleSerialCommand() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  String cmdLower = cmd;
  cmdLower.toLowerCase();

  if (cmdLower == "on" || cmdLower == "off") {
    plugState = (cmdLower == "on");
    drawJarvisFace(MOOD_THINKING, "conmutando...");
    bool ok = sendTuyaCommandV34(plugState);

    // Sensor desactivado — subtítulo simplificado sin datos de temp/humedad.
    char subtitle[32];
    snprintf(subtitle, sizeof(subtitle), "enchufe: %s", plugState ? "ON" : "OFF");
    drawJarvisFace(ok ? (plugState ? MOOD_HAPPY : MOOD_NEUTRAL) : MOOD_ALERT, ok ? subtitle : "error enchufe");
  } else if (cmd.length() > 0) {
    // Cualquier otro texto se manda como turno de conversación a Gemini
    sendGeminiTextTurn(cmd);
  }
}

void loop() {
  // Regla estricta: sólo esta tarea puede tocar geminiWs/WiFiClientSecure.
  static unsigned long lastReconnectAttempt = 0;
  if (geminiWs.available()) {
    geminiWs.poll();
  } else if (WiFi.status() == WL_CONNECTED && millis() - lastReconnectAttempt >= 5000) {
    lastReconnectAttempt = millis();
    connectGeminiLive();
  }

  if (!DIAGNOSTIC_TRANSPORT_ONLY && jarvisSpeaking) {
    // Descartar cualquier resto capturado justo antes de comenzar la
    // respuesta, para no reenviarlo como una intervención tardía.
    xStreamBufferReset(micUploadStream);
  }

  if (!DIAGNOSTIC_TRANSPORT_ONLY && micStreamEndPending &&
      geminiSetupComplete && !jarvisSpeaking) {
    micStreamEndPending = false;
    geminiWs.send("{\"realtimeInput\":{\"audioStreamEnd\":true}}");
    Serial.println("[Gemini] → Fin de voz enviado");
  }

  // Drenar como máximo 3 chunks por pasada. Normalmente habrá uno; el límite
  // evita monopolizar loop() si hubo una demora breve.
  static int16_t uploadChunk[AUDIO_CHUNK_SAMPLES];
  for (int i = 0; !DIAGNOSTIC_TRANSPORT_ONLY && i < 3 &&
       geminiSetupComplete && !jarvisSpeaking; i++) {
    size_t got = xStreamBufferReceive(micUploadStream, uploadChunk,
                                      sizeof(uploadChunk), 0);
    got &= ~(size_t)1;
    if (got == 0) break;
    sendAudioChunkToGemini(uploadChunk, got / sizeof(int16_t));
    geminiWs.poll();
  }
  handleSerialCommand();
  delay(1);
}
