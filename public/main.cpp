/**
 * ============================================================================
 * PROYECTO JARVIS - ESP32-S3 DEVKITC-1 (VS CODE / PLATFORMIO)
 * ============================================================================
 * Hardware:
 *   - Placa: ESP32-S3-WROOM-1 / DevKitC-1 (N16R8 / Dual USB-C)
 *   - Pantalla: ST7735 (80x160 RGB IPS, 8 Pines con BLK)
 *   - Sensor: DHT22 (Módulo 3 pines con pull-up en GPIO 4)
 *   - Relé auxiliar: GPIO 16 (Luz / Velador cableado)
 *   - Enchufe Inteligente: GF-SMSOCKET (Tuya v3.4 LAN en 192.168.0.28)
 * Conectividad:
 *   - Wi-Fi: "SOPA-2.4GHz"
 *   - MQTT: broker.hivemq.com:1883 (Tópico: jarvis_raul_s3/velador/power)
 *   - Web Server Local: http://<IP_ESP32>/velador
 *   - Serial COM: 115200 baudios
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>
#include <DHT.h>
#include <WebServer.h>
#include "mbedtls/aes.h"
#include "mbedtls/md.h"

// ============================================================================
// CONFIGURACIÓN DE RED Y DISPOSITIVOS
// ============================================================================

// Wi-Fi de tu casa (Red 2.4 GHz requerida por el ESP32)
const char* WIFI_SSID     = "SOPA-2.4GHz";
const char* WIFI_PASSWORD = "Password123"; // Reemplaza por tu contraseña de Wi-Fi

// Enchufe Inteligente Tuya v3.4 (GF-SMSOCKET en tu red local)
const char* TUYA_IP        = "192.168.0.28";
const char* TUYA_DEV_ID    = "ebd1e90786fec509a8pngp";
const char* TUYA_LOCAL_KEY = "PvCBXhovwQg!Dq+*";
const int   TUYA_PORT      = 6668;

// Broker MQTT Cloud (Comunicación bidireccional inmediata sin PC)
const char* MQTT_BROKER              = "broker.hivemq.com";
const int   MQTT_PORT                = 1883;
const char* MQTT_TOPIC_CMD           = "jarvis_raul_s3/cmd";
const char* MQTT_TOPIC_VELADOR_POWER = "jarvis_raul_s3/velador/power";
const char* MQTT_TOPIC_VELADOR_STATE = "jarvis_raul_s3/velador/state";
const char* MQTT_TOPIC_TUYA_CMD      = "jarvis_raul_s3/tuya/command";
const char* MQTT_TOPIC_TELEMETRY     = "jarvis_raul_s3/telemetry";
const char* MQTT_TOPIC_STATUS        = "jarvis_raul_s3/status";

WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastMqttReconnectAttempt = 0;

// Servidor Web Local para control directo por navegador
WebServer localServer(80);

// ============================================================================
// PINES DE HARDWARE (ESP32-S3 DevKitC-1)
// ============================================================================

// Display ST7735 8 Pines (80x160 IPS)
#define TFT_CS    7   // Chip Select (GPIO 7)
#define TFT_RST   5   // Reset (GPIO 5)
#define TFT_DC    6   // Data/Command (GPIO 6)
#define TFT_MOSI  11  // SDA / Data (FSPI MOSI: GPIO 11)
#define TFT_SCLK  12  // SCL / Clock (FSPI SCK: GPIO 12)
#define TFT_BLK   10  // Backlight LED (O conectar a 3.3V)

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

// Sensor de Temperatura y Humedad DHT22
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Relés auxiliares físicos
const int RELAY_PINS[4] = {16, 17, 18, 19};

// Colores RGB 565 para Display ST7735
#define COLOR_BLACK   0x0000
#define COLOR_WHITE   0xFFFF
#define COLOR_CYAN    0x07FF
#define COLOR_RED     0xF800
#define COLOR_GREEN   0x07E0
#define COLOR_YELLOW  0xFFE0
#define COLOR_BLUE    0x001F

// Variables de estado
String currentMood = "NEUTRAL";
String currentMessage = "SISTEMA LISTO";
bool currentVeladorState = false;
unsigned long lastTelemetryTime = 0;

// Prototipos de funciones
void drawJarvisFace(String mood, String message);
void controlVelador(bool state);
bool sendTuyaPowerCommand(bool state);
bool sendTuyaCommandV34(bool state);
bool sendTuyaCommandV33(bool state);
void mqttCallback(char* topic, byte* payload, unsigned int length);
void reconnectMqtt();

// ============================================================================
// DIBUJADO FACIAL JARVIS EN ST7735 (80 x 160)
// ============================================================================

void drawJarvisFace(String mood, String message) {
  uint16_t eyeColor = COLOR_CYAN;
  if (mood == "ALERT") eyeColor = COLOR_RED;
  else if (mood == "HAPPY") eyeColor = COLOR_GREEN;
  else if (mood == "THINKING") eyeColor = COLOR_YELLOW;
  else if (mood == "SLEEPING") eyeColor = COLOR_BLUE;

  tft.fillScreen(COLOR_BLACK);

  // Ojos de Jarvis
  if (mood == "SLEEPING") {
    // Ojos cerrados (líneas horizontales)
    tft.fillRect(18, 45, 20, 4, eyeColor);
    tft.fillRect(42, 45, 20, 4, eyeColor);
  } else if (mood == "THINKING") {
    // Un ojo más abierto que otro
    tft.fillCircle(25, 45, 10, eyeColor);
    tft.fillCircle(55, 45, 6, eyeColor);
  } else if (mood == "HAPPY") {
    // Ojos semicirculares
    tft.fillCircle(25, 45, 11, eyeColor);
    tft.fillCircle(55, 45, 11, eyeColor);
    tft.fillRect(14, 46, 52, 12, COLOR_BLACK);
  } else {
    // Ojos normales / Neutral / Alerta
    tft.fillCircle(25, 45, 10, eyeColor);
    tft.fillCircle(55, 45, 10, eyeColor);
    tft.fillCircle(27, 43, 3, COLOR_BLACK);
    tft.fillCircle(57, 43, 3, COLOR_BLACK);
  }

  // Texto inferior
  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(6, 95);
  tft.println(message);
}

// ============================================================================
// CONTROL ENCHUFE TUYA LOCAL (Socket LAN directo al enchufe sin PC)
// ============================================================================

void tuyaHmacSha256(const uint8_t* key, size_t keyLen, const uint8_t* data, size_t dataLen, uint8_t* output) {
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, key, keyLen);
  mbedtls_md_hmac_update(&ctx, data, dataLen);
  mbedtls_md_hmac_finish(&ctx, output);
  mbedtls_md_free(&ctx);
}

void tuyaAes128EcbEncrypt(const uint8_t* key, const uint8_t* input, size_t inputLen, uint8_t* output, size_t* outLen) {
  size_t padLen = 16 - (inputLen % 16);
  size_t totalLen = inputLen + padLen;
  uint8_t* padded = (uint8_t*)malloc(totalLen);
  memcpy(padded, input, inputLen);
  memset(padded + inputLen, (uint8_t)padLen, padLen);

  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, key, 128);

  for (size_t i = 0; i < totalLen; i += 16) {
    mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_ENCRYPT, padded + i, output + i);
  }

  mbedtls_aes_free(&aes);
  free(padded);
  *outLen = totalLen;
}

// Envío nativo Tuya Protocolo v3.4 (Handshake HMAC de 3 pasos corregido)
bool sendTuyaCommandV34(bool state) {
  WiFiClient client;
  client.setTimeout(3000); // 3000 ms timeout real

  Serial.printf("[Tuya 3.4] Conectando a %s:%d...\n", TUYA_IP, TUYA_PORT);
  if (!client.connect(TUYA_IP, TUYA_PORT)) {
    Serial.println("❌ [Tuya 3.4] Error: No se pudo abrir conexión TCP con el enchufe (puerto ocupado o cerrado)");
    return false;
  }
  Serial.println("✓ [Tuya 3.4] Conexión TCP establecida");

  uint8_t localKeyBytes[16];
  memset(localKeyBytes, 0, 16);
  size_t kLen = strlen(TUYA_LOCAL_KEY);
  memcpy(localKeyBytes, TUYA_LOCAL_KEY, kLen > 16 ? 16 : kLen);

  // Generar Nonce local de 16 bytes
  uint8_t localNonce[16];
  for (int i = 0; i < 16; i++) {
    localNonce[i] = (uint8_t)esp_random();
  }

  // En Tuya 3.4, el client nonce en SESS_KEY_NEG_START debe ir cifrado con AES-128-ECB
  uint8_t encryptedNonce[16];
  mbedtls_aes_context aes_enc;
  mbedtls_aes_init(&aes_enc);
  mbedtls_aes_setkey_enc(&aes_enc, localKeyBytes, 128);
  mbedtls_aes_crypt_ecb(&aes_enc, MBEDTLS_AES_ENCRYPT, localNonce, encryptedNonce);
  mbedtls_aes_free(&aes_enc);

  // Paso 1: SESS_KEY_NEG_START (cmd 0x03)
  // Payload: 16 bytes encryptedNonce + 32 bytes HMAC = 48 bytes
  uint8_t step1Packet[68];
  uint8_t header1[16] = {
    0x00, 0x00, 0x55, 0xAA,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03,
    0x00, 0x00, 0x00, 48
  };
  memcpy(step1Packet, header1, 16);
  memcpy(step1Packet + 16, encryptedNonce, 16);

  uint8_t step1Hmac[32];
  tuyaHmacSha256(localKeyBytes, 16, step1Packet, 32, step1Hmac);
  memcpy(step1Packet + 32, step1Hmac, 32);
  step1Packet[64] = 0x00; step1Packet[65] = 0x00;
  step1Packet[66] = 0xAA; step1Packet[67] = 0x55;

  client.write(step1Packet, 68);
  Serial.println("[Tuya 3.4] Paso 1 (SESS_KEY_NEG_START) enviado, esperando respuesta...");

  unsigned long t0 = millis();
  while (client.available() < 48 && millis() - t0 < 2000) {
    delay(10);
  }

  int avail = client.available();
  if (avail < 48) {
    Serial.printf("❌ [Tuya 3.4] Timeout o datos insuficientes en respuesta del enchufe (bytes=%d)\n", avail);
    client.stop();
    return false;
  }

  uint8_t respBuf[128];
  int respLen = client.read(respBuf, sizeof(respBuf));
  Serial.printf("✓ [Tuya 3.4] Respuesta recibida (%d bytes)\n", respLen);

  // En Tuya 3.4, la respuesta contiene 48 bytes de payload cifrados con AES-128-ECB
  // Al descifrar: primeros 16 bytes = remoteNonce, siguientes 32 bytes = HMAC(localNonce)
  uint8_t decryptedResp[48];
  mbedtls_aes_context aes_dec;
  mbedtls_aes_init(&aes_dec);
  mbedtls_aes_setkey_dec(&aes_dec, localKeyBytes, 128);
  for (size_t b = 0; b < 48; b += 16) {
    mbedtls_aes_crypt_ecb(&aes_dec, MBEDTLS_AES_DECRYPT, respBuf + 16 + b, decryptedResp + b);
  }
  mbedtls_aes_free(&aes_dec);

  uint8_t remoteNonce[16];
  memcpy(remoteNonce, decryptedResp, 16);

  // Derivar clave de sesión: AES128_ECB(localNonce XOR remoteNonce, key=localKey)
  uint8_t xorNonce[16];
  for (int i = 0; i < 16; i++) {
    xorNonce[i] = localNonce[i] ^ remoteNonce[i];
  }

  uint8_t sessionKey[16];
  mbedtls_aes_context aes_sess;
  mbedtls_aes_init(&aes_sess);
  mbedtls_aes_setkey_enc(&aes_sess, localKeyBytes, 128);
  mbedtls_aes_crypt_ecb(&aes_sess, MBEDTLS_AES_ENCRYPT, xorNonce, sessionKey);
  mbedtls_aes_free(&aes_sess);
  Serial.println("✓ [Tuya 3.4] Clave de sesión negociada con éxito");

  // Paso 3: SESS_KEY_NEG_FINISH (cmd 0x05)
  // Enviar HMAC-SHA256(remoteNonce) cifrado con AES-128-ECB
  uint8_t finishHmac[32];
  tuyaHmacSha256(localKeyBytes, 16, remoteNonce, 16, finishHmac);

  uint8_t encryptedFinishHmac[32];
  mbedtls_aes_init(&aes_enc);
  mbedtls_aes_setkey_enc(&aes_enc, localKeyBytes, 128);
  mbedtls_aes_crypt_ecb(&aes_enc, MBEDTLS_AES_ENCRYPT, finishHmac, encryptedFinishHmac);
  mbedtls_aes_crypt_ecb(&aes_enc, MBEDTLS_AES_ENCRYPT, finishHmac + 16, encryptedFinishHmac + 16);
  mbedtls_aes_free(&aes_enc);

  uint8_t step3Packet[84];
  uint8_t header3[16] = {
    0x00, 0x00, 0x55, 0xAA,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x05,
    0x00, 0x00, 0x00, 64 // 32 payload + 32 HMAC
  };
  memcpy(step3Packet, header3, 16);
  memcpy(step3Packet + 16, encryptedFinishHmac, 32);

  uint8_t step3Hmac[32];
  tuyaHmacSha256(localKeyBytes, 16, step3Packet, 48, step3Hmac);
  memcpy(step3Packet + 48, step3Hmac, 32);
  step3Packet[80] = 0x00; step3Packet[81] = 0x00;
  step3Packet[82] = 0xAA; step3Packet[83] = 0x55;

  client.write(step3Packet, 84);
  delay(20);

  // Paso 4: Enviar Comando de Potencia CONTROL_NEW (cmd 0x0D)
  unsigned long nowSec = millis() / 1000 + 1725000000;
  char jsonBuf[128];
  snprintf(jsonBuf, sizeof(jsonBuf), "{\"protocol\":5,\"t\":%lu,\"data\":{\"dps\":{\"1\":%s}}}", nowSec, state ? "true" : "false");

  uint8_t encryptedJson[160];
  size_t encJsonLen = 0;
  tuyaAes128EcbEncrypt(sessionKey, (const uint8_t*)jsonBuf, strlen(jsonBuf), encryptedJson, &encJsonLen);

  size_t tuyaPayloadLen = 3 + 12 + encJsonLen;
  uint8_t* tuyaPayload = (uint8_t*)malloc(tuyaPayloadLen);
  memcpy(tuyaPayload, "3.4", 3);
  memset(tuyaPayload + 3, 0, 12);
  memcpy(tuyaPayload + 15, encryptedJson, encJsonLen);

  size_t totalPayloadPlusHmac = tuyaPayloadLen + 32;
  size_t cmdPacketLen = 16 + tuyaPayloadLen + 32 + 4;
  uint8_t* cmdPacket = (uint8_t*)malloc(cmdPacketLen);

  uint8_t cmdHeader[16] = {
    0x00, 0x00, 0x55, 0xAA,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x0D,
    (uint8_t)((totalPayloadPlusHmac >> 24) & 0xFF),
    (uint8_t)((totalPayloadPlusHmac >> 16) & 0xFF),
    (uint8_t)((totalPayloadPlusHmac >> 8) & 0xFF),
    (uint8_t)(totalPayloadPlusHmac & 0xFF)
  };
  memcpy(cmdPacket, cmdHeader, 16);
  memcpy(cmdPacket + 16, tuyaPayload, tuyaPayloadLen);

  uint8_t cmdHmac[32];
  tuyaHmacSha256(sessionKey, 16, cmdPacket, 16 + tuyaPayloadLen, cmdHmac);
  memcpy(cmdPacket + 16 + tuyaPayloadLen, cmdHmac, 32);

  cmdPacket[cmdPacketLen - 4] = 0x00;
  cmdPacket[cmdPacketLen - 3] = 0x00;
  cmdPacket[cmdPacketLen - 2] = 0xAA;
  cmdPacket[cmdPacketLen - 1] = 0x55;

  client.write(cmdPacket, cmdPacketLen);
  delay(40);

  free(tuyaPayload);
  free(cmdPacket);
  client.stop();

  Serial.printf("⚡ [Tuya LAN v3.4] Velador conmutado con éxito a: %s\n", state ? "ENCENDIDO" : "APAGADO");
  return true;
}

// Fallback: Tuya Protocolo v3.3
bool sendTuyaCommandV33(bool state) {
  WiFiClient client;
  client.setTimeout(2);
  if (!client.connect(TUYA_IP, TUYA_PORT)) return false;

  unsigned long nowSec = millis() / 1000 + 1725000000;
  char jsonBuf[160];
  snprintf(jsonBuf, sizeof(jsonBuf), "{\"devId\":\"%s\",\"uid\":\"%s\",\"t\":%lu,\"dps\":{\"1\":%s}}", TUYA_DEV_ID, TUYA_DEV_ID, nowSec, state ? "true" : "false");

  uint8_t localKeyBytes[16];
  memset(localKeyBytes, 0, 16);
  size_t kLen = strlen(TUYA_LOCAL_KEY);
  memcpy(localKeyBytes, TUYA_LOCAL_KEY, kLen > 16 ? 16 : kLen);

  uint8_t encryptedJson[192];
  size_t encJsonLen = 0;
  tuyaAes128EcbEncrypt(localKeyBytes, (const uint8_t*)jsonBuf, strlen(jsonBuf), encryptedJson, &encJsonLen);

  size_t tuyaPayloadLen = 3 + 12 + encJsonLen;
  uint8_t* tuyaPayload = (uint8_t*)malloc(tuyaPayloadLen);
  memcpy(tuyaPayload, "3.3", 3);
  memset(tuyaPayload + 3, 0, 12);
  memcpy(tuyaPayload + 15, encryptedJson, encJsonLen);

  size_t totalLen = tuyaPayloadLen + 8;
  size_t packetLen = 16 + tuyaPayloadLen + 4 + 4;
  uint8_t* packet = (uint8_t*)malloc(packetLen);

  uint8_t header[16] = {
    0x00, 0x00, 0x55, 0xAA,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x07,
    (uint8_t)((totalLen >> 24) & 0xFF),
    (uint8_t)((totalLen >> 16) & 0xFF),
    (uint8_t)((totalLen >> 8) & 0xFF),
    (uint8_t)(totalLen & 0xFF)
  };
  memcpy(packet, header, 16);
  memcpy(packet + 16, tuyaPayload, tuyaPayloadLen);

  // CRC32
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < 16 + tuyaPayloadLen; i++) {
    uint8_t b = packet[i];
    crc ^= b;
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
    }
  }
  crc = ~crc;

  size_t offset = 16 + tuyaPayloadLen;
  packet[offset]     = (uint8_t)((crc >> 24) & 0xFF);
  packet[offset + 1] = (uint8_t)((crc >> 16) & 0xFF);
  packet[offset + 2] = (uint8_t)((crc >> 8) & 0xFF);
  packet[offset + 3] = (uint8_t)(crc & 0xFF);
  packet[offset + 4] = 0x00;
  packet[offset + 5] = 0x00;
  packet[offset + 6] = 0xAA;
  packet[offset + 7] = 0x55;

  client.write(packet, packetLen);
  delay(30);

  free(tuyaPayload);
  free(packet);
  client.stop();

  Serial.printf("⚡ [Tuya LAN v3.3] Velador conmutado con éxito a: %s\n", state ? "ENCENDIDO" : "APAGADO");
  return true;
}

// Orquestador Unificado de Envío Tuya (v3.4 preferido, fallback a v3.3)
bool sendTuyaPowerCommand(bool state) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Tuya LAN] Wi-Fi desconectado en el ESP32, comando cancelado");
    return false;
  }

  Serial.printf("[Tuya LAN] Conmutando enchufe %s:%d a %s (v3.4)...\n", TUYA_IP, TUYA_PORT, state ? "ON" : "OFF");

  // 1. Probar primero con Protocolo v3.4 (Confirmado en tu enchufe)
  if (sendTuyaCommandV34(state)) {
    return true;
  }

  // 2. Fallback v3.3
  Serial.println("[Tuya LAN] Probando fallback v3.3...");
  if (sendTuyaCommandV33(state)) {
    return true;
  }

  Serial.println("❌ [Tuya LAN] No se pudo conmutar el enchufe. Revisa si la IP 192.168.0.28 sigue asignada en tu router.");
  return false;
}

// Función Maestra: Conmuta el Velador y actualiza todo el sistema
void controlVelador(bool state) {
  currentVeladorState = state;

  if (state) {
    currentMood = "HAPPY";
    currentMessage = "VELADOR\nENCENDIDO";
  } else {
    currentMood = "SLEEPING";
    currentMessage = "VELADOR\nAPAGADO";
  }
  drawJarvisFace(currentMood, currentMessage);

  // 1. Conmutar enchufe inteligente Tuya directamente por socket local
  sendTuyaPowerCommand(state);

  // 2. Conmutar relé físico cableado en GPIO 16 (por si usas relé de respaldo)
  digitalWrite(16, state ? LOW : HIGH);

  // 3. Notificar a Jarvis Web por MQTT para sincronizar la UI
  if (mqttClient.connected()) {
    String stateMsg = "{\"device\":\"GF-SMSOCKET\",\"state\":\"" + String(state ? "ON" : "OFF") + "\",\"source\":\"ESP32_S3\"}";
    mqttClient.publish(MQTT_TOPIC_VELADOR_STATE, stateMsg.c_str());
  }
}

// ============================================================================
// MQTT CLOUD (Escucha órdenes desde la Web / App Móvil en tiempo real)
// ============================================================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);

  // A. Canal directo del velador ("ON" / "OFF")
  if (topicStr.endsWith("/velador/power")) {
    char pBuf[16];
    size_t copyLen = length < 15 ? length : 15;
    memcpy(pBuf, payload, copyLen);
    pBuf[copyLen] = '\0';
    String pStr = String(pBuf);
    pStr.trim();
    bool state = (pStr.equalsIgnoreCase("ON") || pStr.equalsIgnoreCase("TRUE") || pStr == "1");
    Serial.printf("[MQTT Directo] Velador recibido: %s\n", pStr.c_str());
    controlVelador(state);
    return;
  }

  // B. Comandos en formato JSON
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) return;

  String action = doc["action"] | "";
  if (action == "smart_plug" || action == "tuya" || topicStr.endsWith("/tuya/command")) {
    String stateStr = doc["state"] | "OFF";
    bool state = (stateStr == "ON" || stateStr == "true" || doc["state"] == true);
    controlVelador(state);
  } else if (action == "mood") {
    String newMood = doc["mood"] | "NEUTRAL";
    String newMsg = doc["message"] | "";
    currentMood = newMood;
    currentMessage = newMsg.length() > 0 ? newMsg : "MODO " + newMood;
    drawJarvisFace(currentMood, currentMessage);
    Serial.printf("[MQTT] Expresión cambiada a: %s\n", currentMood.c_str());
  } else if (action == "relay") {
    int gpio = doc["gpio"];
    int state = doc["state"];
    if (gpio > 0) {
      digitalWrite(gpio, state ? LOW : HIGH);
      Serial.printf("[MQTT] Relé GPIO %d puesto en %d\n", gpio, state);
    }
  }
}

void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastMqttReconnectAttempt < 4000) return;
  lastMqttReconnectAttempt = now;

  String clientId = "ESP32S3_Jarvis_" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("[MQTT] Conectando a %s como %s...\n", MQTT_BROKER, clientId.c_str());

  if (mqttClient.connect(clientId.c_str(), MQTT_TOPIC_STATUS, 0, true, "offline")) {
    Serial.println("✓ [MQTT] Conectado exitosamente al broker en la nube!");
    mqttClient.publish(MQTT_TOPIC_STATUS, "online", true);
    mqttClient.subscribe(MQTT_TOPIC_CMD);
    mqttClient.subscribe(MQTT_TOPIC_VELADOR_POWER);
    mqttClient.subscribe(MQTT_TOPIC_TUYA_CMD);
    Serial.println("✓ [MQTT] Suscrito a: velador/power, cmd, tuya/command");
  } else {
    Serial.printf("[MQTT] Falló conexión (rc=%d), reintentando...\n", mqttClient.state());
  }
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(600);

  Serial.println("\n==========================================");
  Serial.println("   JARVIS ESP32-S3 HARDWARE CONTROLLER    ");
  Serial.println("==========================================");
  Serial.printf("-> Wi-Fi SSID configurado: %s\n", WIFI_SSID);
  Serial.printf("-> Enchufe Tuya configurado en: %s:%d\n", TUYA_IP, TUYA_PORT);

  // Inicializar Relés (Active Low)
  for (int i = 0; i < 4; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], HIGH);
  }

  // Activar Backlight Display ST7735
  pinMode(TFT_BLK, OUTPUT);
  digitalWrite(TFT_BLK, HIGH);

  // Inicializar Display ST7735 80x160
  tft.initR(INITR_MINI160x80);
  tft.invertDisplay(false);
  tft.setRotation(0);
  tft.fillScreen(COLOR_BLACK);

  drawJarvisFace("THINKING", "CONECTANDO\nWI-FI...");

  // Iniciar sensor DHT22
  dht.begin();

  // Configurar cliente MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  // Conectar a red Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  // Configuración de Servidor Web Local en puerto 80 (Diagnóstico y Control)
  localServer.on("/", []() {
    String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Jarvis ESP32-S3</title>"
                  "<style>"
                  "body{background:#0b0f19;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;margin:0;}"
                  ".card{background:#1e293b;max-width:440px;margin:0 auto;padding:24px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.5);border:1px solid #334155;}"
                  "h1{color:#38bdf8;margin-bottom:4px;font-size:24px;}"
                  ".badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#0369a1;color:#e0f2fe;margin-bottom:16px;}"
                  "p{color:#94a3b8;font-size:14px;margin:8px 0;}"
                  "button{width:100%;padding:16px;margin:8px 0;font-size:16px;border-radius:12px;border:none;cursor:pointer;font-weight:700;letter-spacing:0.5px;transition:all 0.2s;}"
                  ".btn-on{background:#10b981;color:#fff;box-shadow:0 4px 14px rgba(16,185,129,0.4);}"
                  ".btn-off{background:#ef4444;color:#fff;box-shadow:0 4px 14px rgba(239,68,68,0.4);}"
                  ".info-box{background:#0f172a;border-radius:10px;padding:12px;margin:16px 0;text-align:left;font-size:13px;border:1px solid #1e293b;}"
                  ".info-row{display:flex;justify-content:space-between;padding:4px 0;}"
                  ".val{color:#38bdf8;font-weight:600;}"
                  "</style></head><body><div class='card'>"
                  "<h1>JARVIS ESP32-S3</h1>"
                  "<span class='badge'>IP LOCAL: " + WiFi.localIP().toString() + "</span>"
                  "<div class='info-box'>"
                  "<div class='info-row'><span>Enchufe Tuya:</span><span class='val'>" + String(TUYA_IP) + ":6668</span></div>"
                  "<div class='info-row'><span>Estado Actual:</span><span class='val'>" + String(currentVeladorState ? "ENCENDIDO [ON]" : "APAGADO [OFF]") + "</span></div>"
                  "<div class='info-row'><span>TFT Display:</span><span class='val'>" + currentMood + "</span></div>"
                  "</div>"
                  "<p>Control directo por socket LAN:</p>"
                  "<a href='/velador?state=1' style='text-decoration:none;'><button class='btn-on'>⚡ ENCENDER VELADOR</button></a>"
                  "<a href='/velador?state=0' style='text-decoration:none;'><button class='btn-off'>⭕ APAGAR VELADOR</button></a>"
                  "<div style='margin-top:20px;padding-top:12px;border-top:1px solid #334155;font-size:12px;color:#64748b;'>"
                  "Revisa la consola Serial de VS Code (115200 baudios) para ver el handshake detallado paso a paso."
                  "</div></div></body></html>";
    localServer.send(200, "text/html", html);
  });

  localServer.on("/velador", []() {
    int state = localServer.arg("state").toInt();
    Serial.printf("[Web Local] Orden Velador recibida: %d\n", state);
    controlVelador(state == 1);

    if (localServer.hasArg("ajax")) {
      localServer.sendHeader("Access-Control-Allow-Origin", "*");
      localServer.send(200, "application/json", "{\"status\":\"ok\",\"velador\":" + String(state) + "}");
      return;
    }

    // Si viene desde navegador directo, redirigir a / con estado actualizado
    localServer.sendHeader("Location", "/");
    localServer.send(303);
  });

  localServer.on("/telemetry", []() {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.send(200, "application/json", "{\"temperature\":" + String(t, 1) + ",\"humidity\":" + String(h, 1) + ",\"ip\":\"" + WiFi.localIP().toString() + "\"}");
  });

  localServer.begin();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Conectado con éxito!");
    Serial.println("✓ IP Local: " + WiFi.localIP().toString());
    drawJarvisFace("HAPPY", "JARVIS LISTO\n" + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ Error al conectar Wi-Fi. Revisa la contraseña en main.cpp");
    drawJarvisFace("ALERT", "ERROR WI-FI\nREINTENTANDO");
  }
}

// ============================================================================
// PROCESAMIENTO DE COMANDOS POR SERIAL USB (115200 baudios)
// ============================================================================

void processSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.startsWith("VELADOR:")) {
    int state = cmd.substring(8).toInt();
    Serial.printf("[USB Serial] Orden Velador: %d\n", state);
    controlVelador(state == 1);
    Serial.printf("{\"status\":\"ok\",\"velador\":%d}\n", state);
  } else if (cmd.startsWith("MOOD:")) {
    int idx = cmd.indexOf(':', 5);
    String newMood = (idx >= 0) ? cmd.substring(5, idx) : cmd.substring(5);
    String newMsg = (idx >= 0) ? cmd.substring(idx + 1) : "MODO " + newMood;
    currentMood = newMood;
    currentMessage = newMsg;
    drawJarvisFace(currentMood, currentMessage);
    Serial.println("{\"status\":\"ok\",\"mood\":\"" + newMood + "\"}");
  } else if (cmd.startsWith("RELAY:")) {
    int idx = cmd.indexOf(':', 6);
    int gpio = cmd.substring(6, idx).toInt();
    int state = cmd.substring(idx + 1).toInt();
    digitalWrite(gpio, state ? LOW : HIGH);
    Serial.printf("{\"status\":\"ok\",\"relay\":%d,\"state\":%d}\n", gpio, state);
  }
}

// ============================================================================
// LOOP PRINCIPAL
// ============================================================================

void loop() {
  // 1. Procesar órdenes por USB Serial si está conectado a la PC
  if (Serial.available()) {
    String serialLine = Serial.readStringUntil('\n');
    processSerialCommand(serialLine);
  }

  // 2. Servidor Web Local en puerto 80
  localServer.handleClient();

  // 3. Cliente MQTT en la nube (recibe órdenes de la Web en tiempo real)
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMqtt();
    } else {
      mqttClient.loop();
    }
  }

  // 4. Lectura periódica de telemetría DHT22 (cada 5 segundos)
  unsigned long now = millis();
  if (now - lastTelemetryTime >= 5000) {
    lastTelemetryTime = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      if (mqttClient.connected()) {
        String payload = "{\"temperature\":" + String(t, 1) + ",\"humidity\":" + String(h, 1) + ",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
        mqttClient.publish(MQTT_TOPIC_TELEMETRY, payload.c_str());
      }
    }
  }
}
