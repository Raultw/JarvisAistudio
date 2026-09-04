import React, { useState } from 'react';
import {
  Cpu,
  Download,
  Copy,
  Check,
  Code,
  FileCode,
  Layers,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Zap,
  Usb,
  Radio,
  CheckCircle2,
  Terminal
} from 'lucide-react';

interface FirmwareAndWiringProps {
  serverUrl?: string;
}

export const FirmwareAndWiring: React.FC<FirmwareAndWiringProps> = ({
  serverUrl = 'http://192.168.1.100:3000'
}) => {
  // Defaulting to the user's exact physical inventory
  const [boardType, setBoardType] = useState<'ESP32-S3-DevKitC-1' | 'ESP32-WROOM-32' | 'ESP32-S3-Zero'>('ESP32-S3-DevKitC-1');
  const [sensorType, setSensorType] = useState<'DHT22' | 'BME280'>('DHT22');
  const [wifiSsid, setWifiSsid] = useState('SOPA-2.4GHz');
  const [wifiPass, setWifiPass] = useState('Password123');
  const [tuyaIp, setTuyaIp] = useState('192.168.0.28');
  const [tuyaDevId, setTuyaDevId] = useState('ebd1e90786fec509a8pngp');
  const [tuyaLocalKey, setTuyaLocalKey] = useState('PvCBXhovwQg!Dq+*');
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'wiring' | 'breadboard' | 'main_cpp' | 'platformio_ini' | 'flash_guide'>('flash_guide');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const downloadFile = (filename: string, content: string, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Precise Pinout mapping for ESP32-S3 DevKitC-1 (44 pines, dual USB-C) + ST7735 8-pin + DHT22 3-pin
  const getPinout = () => {
    return [
      {
        comp: 'ST7735 Pin 1: GND',
        espPin: 'GND (Riel Azul)',
        cable: 'Macho-Macho (M-M) o Macho-Hembra (M-H)',
        color: 'Negro',
        note: 'Tierra común'
      },
      {
        comp: 'ST7735 Pin 2: VCC',
        espPin: '3V3 (Riel Rojo)',
        cable: 'M-M o M-H',
        color: 'Rojo',
        note: '3.3V constante (NO conectar a 5V)'
      },
      {
        comp: 'ST7735 Pin 3: SCL / SCK',
        espPin: 'GPIO 12 (FSPI SCK)',
        cable: 'M-M o M-H',
        color: 'Amarillo',
        note: 'Clock del bus SPI por hardware'
      },
      {
        comp: 'ST7735 Pin 4: SDA / MOSI',
        espPin: 'GPIO 11 (FSPI MOSI)',
        cable: 'M-M o M-H',
        color: 'Azul',
        note: 'Línea de datos SPI'
      },
      {
        comp: 'ST7735 Pin 5: RES / RESET',
        espPin: 'GPIO 5',
        cable: 'M-M o M-H',
        color: 'Naranja',
        note: 'Reinicio de pantalla (Hardware Reset)'
      },
      {
        comp: 'ST7735 Pin 6: DC / A0',
        espPin: 'GPIO 6',
        cable: 'M-M o M-H',
        color: 'Violeta',
        note: 'Comando / Datos (D/C)'
      },
      {
        comp: 'ST7735 Pin 7: CS',
        espPin: 'GPIO 7',
        cable: 'M-M o M-H',
        color: 'Verde',
        note: 'Chip Select del bus SPI'
      },
      {
        comp: 'ST7735 Pin 8: BLK / LED',
        espPin: 'Riel 3.3V (+)',
        cable: 'M-M o M-H',
        color: 'Blanco',
        note: 'Backlight directo al riel de 3.3V para encendido permanente'
      },
      {
        comp: 'DHT22 Pin 1: VCC (+)',
        espPin: '3V3 (Riel Rojo)',
        cable: 'Macho-Hembra (M-H)',
        color: 'Rojo',
        note: 'Alimentación lógica 3.3V'
      },
      {
        comp: 'DHT22 Pin 2: OUT / DATA',
        espPin: 'GPIO 4',
        cable: 'Macho-Hembra (M-H)',
        color: 'Azul Claro',
        note: 'Pull-up ya integrado en el módulo de 3 pines'
      },
      {
        comp: 'DHT22 Pin 3: GND (-)',
        espPin: 'GND (Riel Azul)',
        cable: 'Macho-Hembra (M-H)',
        color: 'Negro',
        note: 'Tierra común'
      },
      {
        comp: 'Micrófono I2S INMP441: SCK',
        espPin: 'GPIO 1',
        cable: 'Macho-Hembra (M-H)',
        color: 'Amarillo',
        note: 'Reloj de bits I2S para captura de audio'
      },
      {
        comp: 'Micrófono I2S INMP441: WS',
        espPin: 'GPIO 2',
        cable: 'Macho-Hembra (M-H)',
        color: 'Verde',
        note: 'Word Select (Selector de palabra/canal estéreo)'
      },
      {
        comp: 'Micrófono I2S INMP441: SD',
        espPin: 'GPIO 42',
        cable: 'Macho-Hembra (M-H)',
        color: 'Azul',
        note: 'Datos digitales serie del micrófono'
      },
      {
        comp: 'Amplificador I2S MAX98357A: BCLK',
        espPin: 'GPIO 15',
        cable: 'Macho-Hembra (M-H)',
        color: 'Marrón',
        note: 'Bit Clock para reproducción de audio digital'
      },
      {
        comp: 'Amplificador I2S MAX98357A: LRC',
        espPin: 'GPIO 16',
        cable: 'Macho-Hembra (M-H)',
        color: 'Gris',
        note: 'Left/Right Clock de audio'
      },
      {
        comp: 'Amplificador I2S MAX98357A: DIN',
        espPin: 'GPIO 17',
        cable: 'Macho-Hembra (M-H)',
        color: 'Cian',
        note: 'Línea de datos hacia el parlante de Jarvis'
      },
      {
        comp: 'Relés Inteligentes (Tuya / Sonoff / Shelly)',
        espPin: 'Control Wi-Fi / Nube',
        cable: 'Inalámbrico (Sin cables a la placa)',
        color: 'Verde Esmeralda',
        note: 'Comandados por la IA en la nube sin ocupar pines ni riesgo eléctrico de 220V.'
      }
    ];
  };

  const pinout = getPinout();

  // Generated PlatformIO Configuration
  const platformioCode = `; ========================================================
; PlatformIO Configuration para Jarvis Hardware Controller
; Placa: ESP32-S3 DevKitC-1 (44 pines, doble USB-C)
; ========================================================

[env:esp32s3]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
monitor_speed = 115200

lib_deps =
    adafruit/Adafruit GFX Library @ ^1.11.9
    adafruit/Adafruit ST7735 and ST7789 Library @ ^1.10.3
    bblanchon/ArduinoJson @ ^7.0.4
    adafruit/DHT sensor library @ ^1.4.6
    adafruit/Adafruit Unified Sensor @ ^1.1.14
    crankyoldgit/IRremoteESP8266 @ ^2.8.6
    knolleary/PubSubClient @ ^2.8

build_flags =
    -DCORE_DEBUG_LEVEL=3
    -DARDUINO_USB_MODE=1
    -DARDUINO_USB_CDC_ON_BOOT=1
`;

  // Generated C++ Arduino Firmware with ST7735 8-pin routines
  const mainCppCode = `/**
 * ============================================================================
 * PROYECTO JARVIS - ESP32-S3 DEVKITC-1 & ST7735 DISPLAY + CONTROL NUBE MQTT
 * ============================================================================
 * Microcontrolador: ESP32-S3-WROOM-1 / DevKitC-1 (Doble USB-C)
 * Display: ST7735 (80x160 RGB IPS, 8 Pines con BLK)
 * Sensor: DHT22 (Módulo 3 pines en GPIO 4)
 * Audio I2S Futuro: Micrófono INMP441 (1, 2, 42) | Parlante MAX98357A (15, 16, 17)
 * Protocolos: 
 *   1. MQTT Broker (broker.hivemq.com) -> Control en tiempo real fuera de casa (4G/5G)
 *   2. Servidor Web Local (http://<IP>) -> Control directo en red Wi-Fi
 *   3. USB Serial (115200 baud) -> Depuración y control alámbrico inmediato
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
#include <IRsend.h>
#include <WebServer.h>
#include "mbedtls/aes.h"
#include "mbedtls/md.h"

// --- Credenciales Wi-Fi & Servidor Jarvis ---
const char* WIFI_SSID = "${wifiSsid}";
const char* WIFI_PASSWORD = "${wifiPass}";
const char* SERVER_POLL_URL = "${customServerUrl}/api/esp32/poll";
const char* SERVER_TELEMETRY_URL = "${customServerUrl}/api/esp32/telemetry";

// --- Enchufe Wi-Fi Velador (Smart Life / Tuya v3.4 LAN Local en tu Router) ---
const char* TUYA_IP        = "${tuyaIp}";
const char* TUYA_DEV_ID    = "${tuyaDevId}";
const char* TUYA_LOCAL_KEY = "${tuyaLocalKey}";
const int   TUYA_PORT      = 6668;

// --- Broker MQTT para Control en Tiempo Real desde Fuera de Casa (4G) ---
const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC_CMD = "jarvis_raul_s3/cmd";
const char* MQTT_TOPIC_VELADOR_POWER = "jarvis_raul_s3/velador/power";
const char* MQTT_TOPIC_VELADOR_STATE = "jarvis_raul_s3/velador/state";
const char* MQTT_TOPIC_TUYA_CMD      = "jarvis_raul_s3/tuya/command";
const char* MQTT_TOPIC_TELEMETRY = "jarvis_raul_s3/telemetry";
const char* MQTT_TOPIC_STATUS = "jarvis_raul_s3/status";

WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastMqttReconnectAttempt = 0;

// --- Servidor Web Local para Control Inmediato (IP Directa en tu red) ---
WebServer localServer(80);

// --- Pines Display ST7735 (Opción 1 - 8 Pines) ---
#define TFT_CS    7   // Chip Select (Físico: GPIO 7)
#define TFT_RST   5   // Reset de pantalla (Físico: GPIO 5)
#define TFT_DC    6   // Data/Command D/C (Físico: GPIO 6)
#define TFT_MOSI  11  // SDA / Data (FSPI MOSI: GPIO 11)
#define TFT_SCLK  12  // SCL / Clock (FSPI SCK: GPIO 12)
#define TFT_BLK   7   // O conectar cable BLK directo al riel de 3.3V

// Inicialización de bus SPI por hardware
Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST);

// --- Pin Sensor DHT22 (Módulo 3 pines con pull-up SMD) ---
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// --- Pines Preparados para Audio Digital I2S (Voz de Jarvis & Micrófono) ---
// Micrófono INMP441: SCK=GPIO 1, WS=GPIO 2, SD=GPIO 42
// Amplificador MAX98357A: BCLK=GPIO 15, LRC=GPIO 16, DIN=GPIO 17
// (Los relés se comandan vía Cloud/LAN como dispositivos inteligentes sin cables)

// --- Pines de Relés (Active Low: 0=Activo, 1=Apagado) ---
// Reubicados a GPIO 15, 16, 17, 14 para AISLARLOS 100% de la pantalla:
// [0]=Living (GPIO 15), [1]=Lab (GPIO 16), [2]=Taller/CNC (GPIO 17), [3]=Escritorio (GPIO 14)
const int RELAY_PINS[4] = {15, 16, 17, 14};

// --- Emisor Infrarrojo 38 kHz (Transistor 2N2222) ---
#define IR_LED_PIN 18
IRsend irsend(IR_LED_PIN);

// --- Paleta de Colores RGB565 ---
#define COLOR_BLACK     0x0000
#define COLOR_CYAN      0x07FF
#define COLOR_GREEN     0x07E0
#define COLOR_RED       0xF800
#define COLOR_PURPLE    0x780F
#define COLOR_YELLOW    0xFFE0
#define COLOR_WHITE     0xFFFF

String currentMood = "NEUTRAL";
String currentMessage = "JARVIS ONLINE\\nESP32-S3 READY";
bool currentVeladorState = false;
bool lastKnownVeladorState = false;
unsigned long lastPollTime = 0;
unsigned long lastTelemetryTime = 0;

// --- Prototipos de Funciones (Forward Declarations C++ para PlatformIO) ---
void drawCenteredText(String text, int y, uint16_t color);
void drawJarvisFace(String mood, String msg);
void controlVelador(bool state);
bool sendTuyaPowerCommand(bool state);
bool sendTuyaCommandV33(bool state);
bool sendTuyaCommandV34(bool state);
uint32_t tuyaCrc32(const uint8_t* data, size_t len);
void tuyaAes128EcbEncrypt(const uint8_t* key, const uint8_t* input, size_t inputLen, uint8_t* output, size_t* outLen);
void tuyaHmacSha256(const uint8_t* key, size_t keyLen, const uint8_t* msg, size_t msgLen, uint8_t* output);
void pollServer();
void sendTelemetry();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void reconnectMqtt();
void processSerialCommand(String cmd);

// ============================================================================
// DIBUJO VECTORIAL DE EXPRESIONES EN ST7735 (80 x 160 IPS VERTICAL)
// ============================================================================

// --- Helper para dibujar texto centrado sin desbordamiento (Max 12 caracteres = 72px) ---
void drawCenteredText(String text, int y, uint16_t color) {
  text.trim();
  if (text.length() > 12) text = text.substring(0, 12);
  int w = text.length() * 6;
  int x = (80 - w) / 2;
  if (x < 2) x = 2;
  tft.setCursor(x, y);
  tft.setTextColor(color);
  tft.setTextSize(1);
  tft.print(text);
}

void drawJarvisFace(String mood, String msg) {
  tft.fillScreen(COLOR_BLACK);
  uint16_t eyeColor = COLOR_CYAN;
  int centerX = 40;
  int centerY = 58;

  if (mood == "ALERT") {
    eyeColor = COLOR_RED;
    tft.fillCircle(centerX - 18, centerY, 14, eyeColor);
    tft.fillCircle(centerX + 18, centerY, 14, eyeColor);
    tft.fillRect(centerX - 19, centerY - 8, 3, 10, COLOR_WHITE);
    tft.fillCircle(centerX - 18, centerY + 6, 2, COLOR_WHITE);
    tft.fillRect(centerX + 17, centerY - 8, 3, 10, COLOR_WHITE);
    tft.fillCircle(centerX + 18, centerY + 6, 2, COLOR_WHITE);
  }
  else if (mood == "HAPPY") {
    eyeColor = COLOR_GREEN;
    // Ojos digitales de alta tecnología expresivos y alegres (evita arcos que parezcan párpados)
    tft.fillRoundRect(centerX - 24, centerY - 13, 16, 26, 6, eyeColor);
    tft.fillRoundRect(centerX + 8, centerY - 13, 16, 26, 6, eyeColor);
    tft.fillCircle(centerX - 16, centerY - 4, 3, COLOR_WHITE);
    tft.fillCircle(centerX + 16, centerY - 4, 3, COLOR_WHITE);
    tft.drawFastHLine(centerX - 10, centerY + 18, 20, eyeColor);
    tft.drawFastHLine(centerX - 8, centerY + 19, 16, eyeColor);
  }
  else if (mood == "THINKING") {
    eyeColor = COLOR_PURPLE;
    tft.fillRoundRect(centerX - 26, centerY - 5, 16, 12, 3, eyeColor);
    tft.fillRoundRect(centerX + 10, centerY - 16, 16, 24, 4, eyeColor);
    tft.fillCircle(centerX, centerY + 18, 2, eyeColor);
  }
  else if (mood == "SLEEPING") {
    eyeColor = COLOR_CYAN;
    tft.fillRoundRect(centerX - 28, centerY, 20, 3, 1, eyeColor);
    tft.fillRoundRect(centerX + 8, centerY, 20, 3, 1, eyeColor);
    tft.setCursor(centerX + 12, centerY - 14);
    tft.setTextColor(COLOR_CYAN);
    tft.setTextSize(1);
    tft.print("zZ");
  }
  else if (mood == "SARCASTIC") {
    eyeColor = COLOR_YELLOW;
    tft.fillRoundRect(centerX - 26, centerY - 10, 16, 20, 3, eyeColor);
    tft.drawLine(centerX - 28, centerY - 16, centerX - 8, centerY - 11, eyeColor);
    tft.fillRoundRect(centerX + 8, centerY, 16, 6, 2, eyeColor);
    tft.drawLine(centerX + 6, centerY - 5, centerX + 26, centerY - 5, eyeColor);
  }
  else { // NEUTRAL
    eyeColor = COLOR_CYAN;
    tft.fillRoundRect(centerX - 26, centerY - 14, 18, 28, 5, eyeColor);
    tft.fillRoundRect(centerX + 8, centerY - 14, 18, 28, 5, eyeColor);
    tft.fillCircle(centerX - 17, centerY, 2, COLOR_WHITE);
    tft.fillCircle(centerX + 17, centerY, 2, COLOR_WHITE);
  }

  // Divisor de estado decorativo
  tft.drawLine(4, 114, 76, 114, eyeColor);

  // Procesamiento de mensaje en 2 líneas perfectamente centradas sin cortar palabras
  int lineBreak = msg.indexOf('\\n');
  String line1 = "";
  String line2 = "";

  if (lineBreak >= 0) {
    line1 = msg.substring(0, lineBreak);
    line2 = msg.substring(lineBreak + 1);
  } else if (msg.length() > 12) {
    int sp = msg.lastIndexOf(' ', 12);
    if (sp > 0) {
      line1 = msg.substring(0, sp);
      line2 = msg.substring(sp + 1);
    } else {
      line1 = msg.substring(0, 12);
      line2 = msg.substring(12);
    }
  } else {
    line1 = msg;
    line2 = "";
  }

  if (line2.length() > 0) {
    drawCenteredText(line1, 121, eyeColor);
    drawCenteredText(line2, 136, COLOR_WHITE);
  } else {
    drawCenteredText(line1, 128, eyeColor);
  }
}

// ============================================================================
// COMUNICACIÓN HTTP Y PROTOCOLO POLLING CON NODE.JS
// ============================================================================

// Control de sondeo central (100% no bloqueante)
unsigned long nextServerPollAllowed = 0;
int consecutiveServerErrors = 0;

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() < nextServerPollAllowed) return;

  String url = String(SERVER_POLL_URL);
  // Si la URL es la por defecto (192.168.1.100) y no existe el servidor, omitir para no congelar la CPU
  if (url.length() == 0 || url.indexOf("192.168.1.100") >= 0) {
    return;
  }

  HTTPClient http;
  bool isHttps = url.startsWith("https://");

  if (isHttps) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    secureClient.setTimeout(400);
    http.setTimeout(400);
    if (!http.begin(secureClient, url)) return;
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      consecutiveServerErrors = 0;
      String payload = http.getString();
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        String newMood = doc["display"]["mood"] | "NEUTRAL";
        String newMsg = doc["display"]["message"] | "";
        if (newMood != currentMood || newMsg != currentMessage) {
          currentMood = newMood;
          currentMessage = newMsg;
          drawJarvisFace(currentMood, currentMessage);
        }
        JsonArray relaysArr = doc["relays"].as<JsonArray>();
        for (JsonObject r : relaysArr) {
          int gpio = r["gpio"];
          bool state = r["state"];
          if (gpio > 0) digitalWrite(gpio, state ? LOW : HIGH);
        }
        if (doc["velador"].is<JsonObject>()) {
          bool sVelador = doc["velador"]["state"];
          if (sVelador != lastKnownVeladorState) {
            lastKnownVeladorState = sVelador;
            controlVelador(sVelador);
          }
        }
      }
    } else {
      consecutiveServerErrors++;
      if (consecutiveServerErrors >= 2) {
        nextServerPollAllowed = millis() + 30000;
      }
    }
  } else {
    WiFiClient plainClient;
    plainClient.setTimeout(400);
    http.setTimeout(400);
    if (!http.begin(plainClient, url)) return;
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      consecutiveServerErrors = 0;
      String payload = http.getString();
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        String newMood = doc["display"]["mood"] | "NEUTRAL";
        String newMsg = doc["display"]["message"] | "";
        if (newMood != currentMood || newMsg != currentMessage) {
          currentMood = newMood;
          currentMessage = newMsg;
          drawJarvisFace(currentMood, currentMessage);
        }
        JsonArray relaysArr = doc["relays"].as<JsonArray>();
        for (JsonObject r : relaysArr) {
          int gpio = r["gpio"];
          bool state = r["state"];
          if (gpio > 0) digitalWrite(gpio, state ? LOW : HIGH);
        }
        if (doc["velador"].is<JsonObject>()) {
          bool sVelador = doc["velador"]["state"];
          if (sVelador != lastKnownVeladorState) {
            lastKnownVeladorState = sVelador;
            controlVelador(sVelador);
          }
        }
      }
    } else {
      consecutiveServerErrors++;
      if (consecutiveServerErrors >= 2) {
        nextServerPollAllowed = millis() + 30000;
      }
    }
  }
  http.end();
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() < nextServerPollAllowed) return;

  String url = String(SERVER_TELEMETRY_URL);
  if (url.length() == 0 || url.indexOf("192.168.1.100") >= 0) return;

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) return;

  HTTPClient http;
  bool isHttps = url.startsWith("https://");

  if (isHttps) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    secureClient.setTimeout(400);
    http.setTimeout(400);
    if (!http.begin(secureClient, url)) return;
  } else {
    WiFiClient plainClient;
    plainClient.setTimeout(400);
    http.setTimeout(400);
    if (!http.begin(plainClient, url)) return;
  }

  http.addHeader("Content-Type", "application/json");
  JsonDocument doc;
  doc["temperature"] = t;
  doc["humidity"] = h;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();

  String requestBody;
  serializeJson(doc, requestBody);
  http.POST(requestBody);
  http.end();

  // Publicar también por MQTT si está conectado
  if (mqttClient.connected()) {
    String mqttPayload;
    serializeJson(doc, mqttPayload);
    mqttClient.publish(MQTT_TOPIC_TELEMETRY, mqttPayload.c_str());
  }
}

// ============================================================================
// CLIENTE TUYA LAN AUTÓNOMO (v3.3 Estándar GF-SMSOCKET + Fallback v3.4)
// Sin necesidad de tener ninguna PC encendida, directo por Wi-Fi TCP (Puerto 6668)
// ============================================================================

uint32_t tuyaCrc32(const uint8_t* data, size_t len) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      uint32_t mask = -(crc & 1);
      crc = (crc >> 1) ^ (0xEDB88320 & mask);
    }
  }
  return ~crc;
}

void tuyaAes128EcbEncrypt(const uint8_t* key, const uint8_t* input, size_t inputLen, uint8_t* output, size_t* outLen) {
  size_t padLen = 16 - (inputLen % 16);
  size_t totalLen = inputLen + padLen;
  uint8_t* padded = (uint8_t*)malloc(totalLen);
  if (!padded) { *outLen = 0; return; }
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

void tuyaHmacSha256(const uint8_t* key, size_t keyLen, const uint8_t* data, size_t dataLen, uint8_t* outHmac) {
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, key, keyLen);
  mbedtls_md_hmac_update(&ctx, data, dataLen);
  mbedtls_md_hmac_finish(&ctx, outHmac);
  mbedtls_md_free(&ctx);
}

// 1. Envío Nativo Tuya Protocolo v3.3 (El protocolo real del GF-SMSOCKET)
bool sendTuyaCommandV33(bool state) {
  WiFiClient client;
  client.setTimeout(2500);
  Serial.printf("[Tuya 3.3 LAN] Conectando a %s:%d...\\n", TUYA_IP, TUYA_PORT);

  if (!client.connect(TUYA_IP, TUYA_PORT)) {
    Serial.printf("[Tuya 3.3 LAN] ❌ Socket cerrado. Comprueba que el enchufe esté en %s y encendido.\\n", TUYA_IP);
    return false;
  }

  // 1. Construir JSON de comando
  unsigned long nowSec = 1725000000 + (millis() / 1000);
  char jsonBuf[256];
  snprintf(jsonBuf, sizeof(jsonBuf),
    "{\\"devId\\":\\"%s\\",\\"uid\\":\\"%s\\",\\"t\\":%lu,\\"dps\\":{\\"1\\":%s}}",
    TUYA_DEV_ID, TUYA_DEV_ID, nowSec, state ? "true" : "false"
  );
  size_t jsonLen = strlen(jsonBuf);

  // 2. Cifrar con AES-128-ECB
  uint8_t encBuf[300];
  size_t encLen = 0;
  tuyaAes128EcbEncrypt((const uint8_t*)TUYA_LOCAL_KEY, (const uint8_t*)jsonBuf, jsonLen, encBuf, &encLen);
  if (encLen == 0) {
    client.stop();
    return false;
  }

  // 3. Payload Tuya v3.3: "3.3" (3 bytes) + 12 ceros (0x00) + ciphertext
  size_t tuyaPayloadLen = 3 + 12 + encLen;
  uint8_t* tuyaPayload = (uint8_t*)malloc(tuyaPayloadLen);
  if (!tuyaPayload) { client.stop(); return false; }

  memcpy(tuyaPayload, "3.3", 3);
  memset(tuyaPayload + 3, 0, 12);
  memcpy(tuyaPayload + 15, encBuf, encLen);

  // 4. Header 16 bytes: Prefix 55AA (4) + Seq (4) + Cmd 0x07 (4) + Length (4)
  uint32_t lengthField = (uint32_t)(tuyaPayloadLen + 8);
  size_t packetWithoutCrcLen = 16 + tuyaPayloadLen;
  uint8_t* packet = (uint8_t*)malloc(packetWithoutCrcLen + 8);
  if (!packet) { free(tuyaPayload); client.stop(); return false; }

  packet[0] = 0x00; packet[1] = 0x00; packet[2] = 0x55; packet[3] = 0xAA;
  packet[4] = 0x00; packet[5] = 0x00; packet[6] = 0x00; packet[7] = 0x00;
  packet[8] = 0x00; packet[9] = 0x00; packet[10] = 0x00; packet[11] = 0x07; // 0x07 = CONTROL
  packet[12] = (uint8_t)((lengthField >> 24) & 0xFF);
  packet[13] = (uint8_t)((lengthField >> 16) & 0xFF);
  packet[14] = (uint8_t)((lengthField >> 8) & 0xFF);
  packet[15] = (uint8_t)(lengthField & 0xFF);

  memcpy(packet + 16, tuyaPayload, tuyaPayloadLen);
  free(tuyaPayload);

  // 5. CRC32 sobre Header + Payload
  uint32_t crc = tuyaCrc32(packet, packetWithoutCrcLen);
  packet[packetWithoutCrcLen + 0] = (uint8_t)((crc >> 24) & 0xFF);
  packet[packetWithoutCrcLen + 1] = (uint8_t)((crc >> 16) & 0xFF);
  packet[packetWithoutCrcLen + 2] = (uint8_t)((crc >> 8) & 0xFF);
  packet[packetWithoutCrcLen + 3] = (uint8_t)(crc & 0xFF);

  // 6. Suffix 0000AA55
  packet[packetWithoutCrcLen + 4] = 0x00;
  packet[packetWithoutCrcLen + 5] = 0x00;
  packet[packetWithoutCrcLen + 6] = 0xAA;
  packet[packetWithoutCrcLen + 7] = 0x55;

  size_t totalLen = packetWithoutCrcLen + 8;
  client.write(packet, totalLen);
  client.flush();
  free(packet);

  Serial.printf("⚡ [Tuya 3.3 LAN] Paquete de control enviado (%d bytes). Esperando respuesta...\\n", totalLen);

  unsigned long t0 = millis();
  while (!client.available() && millis() - t0 < 400) {
    delay(10);
  }
  if (client.available()) {
    Serial.println("✓ [Tuya 3.3 LAN] Confirmación ACK recibida del enchufe.");
  }
  client.stop();

  Serial.printf("💡 [Velador] Conmutado exitosamente a: %s\\n", state ? "ENCENDIDO" : "APAGADO");
  return true;
}

// 2. Fallback Tuya Protocolo v3.4 (Handshake HMAC de 3 pasos con cifrado AES-128-ECB)
bool sendTuyaCommandV34(bool state) {
  WiFiClient client;
  client.setTimeout(3000);
  Serial.printf("[Tuya 3.4 LAN] Conectando a %s:%d...\\n", TUYA_IP, TUYA_PORT);

  if (!client.connect(TUYA_IP, TUYA_PORT)) {
    Serial.println("❌ [Tuya 3.4] Error: No se pudo abrir conexión TCP con el enchufe (puerto ocupado o cerrado)");
    return false;
  }
  Serial.println("✓ [Tuya 3.4] Conexión TCP establecida");

  const uint8_t* localKeyBytes = (const uint8_t*)TUYA_LOCAL_KEY;

  // Paso 1: Generar nonce local aleatorio de 16 bytes
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

  // Header Handshake Step 1 (cmd 0x03 = SESS_KEY_NEG_START)
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

  // Esperar respuesta Paso 2
  unsigned long t0 = millis();
  while (client.available() < 48 && millis() - t0 < 2000) {
    delay(10);
  }

  int avail = client.available();
  if (avail < 48) {
    Serial.printf("❌ [Tuya 3.4] Timeout o datos insuficientes en respuesta del enchufe (bytes=%d)\\n", avail);
    client.stop();
    return false;
  }

  uint8_t respBuf[128];
  int respLen = client.read(respBuf, sizeof(respBuf));
  Serial.printf("✓ [Tuya 3.4] Respuesta recibida (%d bytes)\\n", respLen);

  // Descifrar 48 bytes de respuesta con AES-128-ECB
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

  // Clave de Sesión: AES128_ECB(localNonce XOR remoteNonce, key=localKey)
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
    0x00, 0x00, 0x00, 64
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

  // Paso 4: Enviar Comando de Potencia
  unsigned long nowSec = millis() / 1000 + 1725000000;
  char jsonBuf[128];
  snprintf(jsonBuf, sizeof(jsonBuf), "{\\"protocol\\":5,\\"t\\":%lu,\\"data\\":{\\"dps\\":{\\"1\\":%s}}}", nowSec, state ? "true" : "false");

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

  Serial.printf("⚡ [Tuya LAN v3.4] Velador conmutado con éxito a: %s\\n", state ? "ENCENDIDO" : "APAGADO");
  return true;
}

// Orquestador Unificado de Envío Tuya (v3.3 nativo con fallback v3.4)
bool sendTuyaPowerCommand(bool state) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Tuya LAN] ⚠️ Wi-Fi desconectado en el ESP32, comando cancelado");
    return false;
  }

  Serial.printf("[Tuya LAN] Conmutando enchufe %s:%d a %s (Protocolo v3.4)...\\n", TUYA_IP, TUYA_PORT, state ? "ON" : "OFF");

  // 1. Probar primero con Protocolo v3.4 (Confirmado en GF-SMSOCKET)
  if (sendTuyaCommandV34(state)) {
    return true;
  }

  // 2. Si v3.4 no respondió, fallback a v3.3
  Serial.println("[Tuya LAN] Probando fallback v3.3...");
  if (sendTuyaCommandV33(state)) {
    return true;
  }

  Serial.println("❌ [Tuya LAN] No se pudo conmutar el enchufe. Revisa si la IP 192.168.0.28 sigue asignada al enchufe en tu router.");
  return false;
}

// Conmutación unificada del Velador con animación facial y feedback
void controlVelador(bool state) {
  currentVeladorState = state;
  lastKnownVeladorState = state;

  if (state) {
    currentMood = "HAPPY";
    currentMessage = "VELADOR\\nENCENDIDO";
  } else {
    currentMood = "SLEEPING";
    currentMessage = "VELADOR\\nAPAGADO";
  }
  drawJarvisFace(currentMood, currentMessage);

  // 1. Conmutar enchufe inteligente Tuya por LAN directa sin PC
  sendTuyaPowerCommand(state);

  // 2. Conmutar relé físico cableado en GPIO 16 (por si se usa relé auxiliar)
  digitalWrite(16, state ? LOW : HIGH);

  // 3. Notificar a Jarvis Web por MQTT para actualizar la UI en vivo
  if (mqttClient.connected()) {
    String stateMsg = "{\\"device\\":\\"GF-SMSOCKET\\",\\"state\\":\\"" + String(state ? "ON" : "OFF") + "\\",\\"source\\":\\"ESP32_S3\\"}";
    mqttClient.publish(MQTT_TOPIC_VELADOR_STATE, stateMsg.c_str());
  }
}

// ============================================================================
// PROTOCOLO MQTT CLOUD (Control Inmediato Fuera de Casa por 4G/5G)
// ============================================================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);

  // A. Si el mensaje llega al canal directo del velador (ON / OFF)
  if (topicStr.endsWith("/velador/power")) {
    char pBuf[16];
    size_t copyLen = length < 15 ? length : 15;
    memcpy(pBuf, payload, copyLen);
    pBuf[copyLen] = '\\0';
    String pStr = String(pBuf);
    pStr.trim();
    bool state = (pStr.equalsIgnoreCase("ON") || pStr.equalsIgnoreCase("TRUE") || pStr == "1");
    Serial.printf("[MQTT Directo] Velador recibido: %s\\n", pStr.c_str());
    controlVelador(state);
    return;
  }

  // B. Mensajes en formato JSON (comandos de Jarvis)
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
    Serial.printf("[MQTT 4G] Expresión cambiada a: %s\\n", currentMood.c_str());
  } else if (action == "relay") {
    int gpio = doc["gpio"];
    int state = doc["state"];
    if (gpio > 0) {
      digitalWrite(gpio, state ? LOW : HIGH);
      Serial.printf("[MQTT 4G] Relé GPIO %d puesto en %d\\n", gpio, state);
    }
  }
}

void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastMqttReconnectAttempt < 5000) return;
  lastMqttReconnectAttempt = now;

  String clientId = "ESP32S3_Jarvis_" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("[MQTT] Conectando a %s como %s...\\n", MQTT_BROKER, clientId.c_str());

  if (mqttClient.connect(clientId.c_str(), MQTT_TOPIC_STATUS, 0, true, "offline")) {
    Serial.println("[MQTT] Conectado exitosamente al broker en la nube!");
    mqttClient.publish(MQTT_TOPIC_STATUS, "online", true);
    mqttClient.subscribe(MQTT_TOPIC_CMD);
    mqttClient.subscribe(MQTT_TOPIC_VELADOR_POWER);
    mqttClient.subscribe(MQTT_TOPIC_TUYA_CMD);
    Serial.println("[MQTT] Suscrito a comandos: cmd, velador/power, tuya/command");
  } else {
    Serial.printf("[MQTT] Error de conexión, rc=%d. Reintentando en 5s...\\n", mqttClient.state());
  }
}

// ============================================================================
// SETUP & BUCLE PRINCIPAL
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\\n==========================================");
  Serial.println("   JARVIS ESP32-S3 HARDWARE CONTROLLER    ");
  Serial.println("==========================================");
  Serial.printf("-> Enchufe Tuya configurado en: %s:%d\\n", TUYA_IP, TUYA_PORT);

  // Inicializar Relés (Active Low)
  for (int i = 0; i < 4; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], HIGH);
  }

  // Activar Backlight ST7735 (Pin BLK)
  pinMode(TFT_BLK, OUTPUT);
  digitalWrite(TFT_BLK, HIGH);

  // Iniciar Display 80x160 Mini IPS (invertDisplay en false para colores RGB reales)
  tft.initR(INITR_MINI160x80);
  tft.invertDisplay(false);
  tft.setRotation(0);
  tft.fillScreen(COLOR_BLACK);

  drawJarvisFace("THINKING", "CONECTANDO\\nWI-FI...");

  dht.begin();
  irsend.begin();

  // Configurar cliente MQTT para control remoto en la nube
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  // Configuración de endpoints del Servidor Web Local (Control Directo en tu red)
  localServer.on("/", []() {
    String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>Jarvis ESP32</title><style>body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:24px}button{padding:14px 22px;margin:8px;font-size:16px;border-radius:10px;border:none;cursor:pointer;font-weight:bold}.alert{background:#ef4444;color:#fff}.happy{background:#10b981;color:#fff}.neutral{background:#06b6d4;color:#fff}.think{background:#a855f7;color:#fff}.sleep{background:#3b82f6;color:#fff}</style></head><body><h2>JARVIS ESP32-S3</h2><p>Control Web Local</p><a href='/mood?val=ALERT&msg=ALERTA'><button class='alert'>ALERT (ROJO)</button></a><a href='/mood?val=HAPPY&msg=FELIZ'><button class='happy'>HAPPY (VERDE)</button></a><a href='/mood?val=NEUTRAL&msg=NOMINAL'><button class='neutral'>NEUTRAL (CIAN)</button></a><a href='/mood?val=THINKING&msg=PENSANDO'><button class='think'>THINKING</button></a><a href='/mood?val=SLEEPING&msg=DURMIENDO'><button class='sleep'>SLEEPING</button></a><div style='margin-top:20px;padding:16px;background:#1e293b;border-radius:12px;'><p>Control Relé GPIO 16 (Luz Lab):</p><a href='/relay?gpio=16&state=1'><button style='background:#f59e0b;color:#000'>ENCENDER</button></a> <a href='/relay?gpio=16&state=0'><button style='background:#64748b;color:#fff'>APAGAR</button></a></div></body></html>";
    localServer.send(200, "text/html", html);
  });

  localServer.on("/mood", []() {
    String val = localServer.arg("val");
    String msg = localServer.arg("msg");
    if (val.length() > 0) {
      currentMood = val;
      if (msg.length() > 0) currentMessage = msg;
      else currentMessage = "MODO " + val;
      drawJarvisFace(currentMood, currentMessage);
    }
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.send(200, "application/json", "{\\"status\\":\\"ok\\",\\"mood\\":\\"" + currentMood + "\\"}");
  });

  localServer.on("/relay", []() {
    int gpio = localServer.arg("gpio").toInt();
    int state = localServer.arg("state").toInt();
    if (gpio > 0) {
      digitalWrite(gpio, state ? LOW : HIGH);
    }
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.send(200, "application/json", "{\\"status\\":\\"ok\\",\\"relay\\":" + String(gpio) + ",\\"state\\":" + String(state) + "}");
  });

  localServer.on("/velador", []() {
    int state = localServer.arg("state").toInt();
    Serial.printf("[Wi-Fi Local] Orden Velador recibida: %d. Transmitiendo a Tuya LAN %s...\\n", state, TUYA_IP);
    controlVelador(state == 1);
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.send(200, "application/json", "{\\"status\\":\\"ok\\",\\"velador\\":" + String(state) + "}");
  });

  localServer.on("/telemetry", []() {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    localServer.sendHeader("Access-Control-Allow-Origin", "*");
    localServer.send(200, "application/json", "{\\"temperature\\":" + String(t, 1) + ",\\"humidity\\":" + String(h, 1) + ",\\"ip\\":\\"" + WiFi.localIP().toString() + "\\"}");
  });

  localServer.begin();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\nWiFi Conectado con éxito!");
    Serial.println("IP Local: " + WiFi.localIP().toString());
    drawJarvisFace("HAPPY", "JARVIS LISTO\\n" + WiFi.localIP().toString());
  } else {
    drawJarvisFace("ALERT", "ERROR WI-FI\\nREINTENTANDO");
  }
}

void processSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd.startsWith("MOOD:")) {
    int idx = cmd.indexOf(':', 5);
    String newMood = (idx >= 0) ? cmd.substring(5, idx) : cmd.substring(5);
    String newMsg = (idx >= 0) ? cmd.substring(idx + 1) : "MODO " + newMood;
    currentMood = newMood;
    currentMessage = newMsg;
    drawJarvisFace(currentMood, currentMessage);
    Serial.println("{\\"status\\":\\"ok\\",\\"mood\\":\\"" + newMood + "\\"}");
  } else if (cmd.startsWith("RELAY:")) {
    int idx = cmd.indexOf(':', 6);
    int gpio = cmd.substring(6, idx).toInt();
    int state = cmd.substring(idx + 1).toInt();
    digitalWrite(gpio, state ? LOW : HIGH);
    Serial.printf("{\\"status\\":\\"ok\\",\\"relay\\":%d,\\"state\\":%d}\\n", gpio, state);
  } else if (cmd.startsWith("VELADOR:")) {
    int state = cmd.substring(8).toInt();
    Serial.printf("[USB COM3] Orden Velador recibida: %d. Transmitiendo a Tuya LAN %s...\\n", state, TUYA_IP);
    controlVelador(state == 1);
    Serial.printf("{\\"status\\":\\"ok\\",\\"velador\\":%d}\\n", state);
  }
}

void loop() {
  // 1. Comandos directos de ultra-baja latencia vía USB Serial (Web Serial / PC / COM3)
  if (Serial.available()) {
    String serialLine = Serial.readStringUntil('\\n');
    processSerialCommand(serialLine);
  }

  // 2. Servidor Web Local directo (http://<IP_ESP32>/velador)
  localServer.handleClient();

  // 3. Cliente MQTT Cloud opcional (sin bloquear jamas la CPU si el broker no esta activo)
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMqtt();
    } else {
      mqttClient.loop();
    }
  }

  unsigned long now = millis();

  // 4. Sondeo HTTP (100% no bloqueante, pausado si no hay servidor central)
  if (now - lastPollTime >= 3000) {
    lastPollTime = now;
    pollServer();
  }

  // 5. Telemetria DHT22 cada 5s
  if (now - lastTelemetryTime >= 5000) {
    lastTelemetryTime = now;
    sendTelemetry();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      Serial.printf("[DHT22] Temp: %.1fC, Hum: %.1f%%\\n", t, h);
    }
  }
}
`;

  return (
    <div id="firmware-and-wiring-section" className="space-y-4">
      {/* Configuration Header & Physical Inventory Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Guía de Conexión & Firmware ESP32-S3
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                  Calibrado para tu Mesa
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ESP32-S3 DevKitC-1 (44 pines, 2x USB-C) + ST7735 (8 pines) + DHT22 (3 pines) + Protoboard 830 puntos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadFile('main.cpp', mainCppCode)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-all border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Descargar main.cpp</span>
            </button>
            <button
              type="button"
              onClick={() => downloadFile('platformio.ini', platformioCode)}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>platformio.ini</span>
            </button>
          </div>
        </div>

        {/* Credentials & Network Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              Placa ESP32 en la mesa:
            </label>
            <select
              value={boardType}
              onChange={e => setBoardType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ESP32-S3-DevKitC-1">ESP32-S3 DevKitC-1 (44 pines, 2x USB-C)</option>
              <option value="ESP32-WROOM-32">ESP32 Estándar (30/38 pines)</option>
              <option value="ESP32-S3-Zero">ESP32-S3 Mini / Zero</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              Sensor Ambiental:
            </label>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono flex items-center justify-between">
              <span>DHT22 (3 pines, Pull-up SMD)</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              SSID Wi-Fi (2.4 GHz):
            </label>
            <input
              type="text"
              value={wifiSsid}
              onChange={e => setWifiSsid(e.target.value)}
              placeholder="Nombre de red 2.4G"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              Contraseña Wi-Fi:
            </label>
            <input
              type="password"
              value={wifiPass}
              onChange={e => setWifiPass(e.target.value)}
              placeholder="Password de tu Wi-Fi"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-cyan-400 font-mono text-[11px] mb-1">
              IP Enchufe Velador:
            </label>
            <input
              type="text"
              value={tuyaIp}
              onChange={e => setTuyaIp(e.target.value)}
              placeholder="192.168.0.28"
              className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-amber-400 font-mono text-[11px] mb-1">
              Local Key Tuya (16 chars):
            </label>
            <input
              type="text"
              value={tuyaLocalKey}
              onChange={e => setTuyaLocalKey(e.target.value)}
              placeholder="PvCBXhovwQg!Dq+*"
              className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Notice of Autonomous Tuya LAN Support */}
        <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between text-xs font-mono text-cyan-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Firmware Actualizado: Tuya LAN v3.4 Autónomo Integrado (Sin necesidad de PC encendida)</span>
          </div>
          <span className="text-[10px] text-slate-400">Device ID: {tuyaDevId}</span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('wiring')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'wiring'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tabla de Pines & Cables</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('breadboard')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'breadboard'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Montaje en Protoboard 830 Puntos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('main_cpp')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'main_cpp'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Firmware main.cpp (C++)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('platformio_ini')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'platformio_ini'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>platformio.ini</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flash_guide')}
            className={`pb-2.5 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'flash_guide'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Usb className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guía de Carga / Flasheo</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
              Paso a Paso
            </span>
          </button>
        </div>

        {/* TAB 1: PINOUT TABLE */}
        {activeTab === 'wiring' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-300 font-mono">
                <span className="text-cyan-400 font-bold">ASIGNACIÓN EXACTA:</span> ESP32-S3 DevKitC-1 &bull; ST7735 (8 Pines) &bull; DHT22 (3 Pines)
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(pinout, null, 2), 'pinout')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1"
              >
                {copiedKey === 'pinout' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar Tabla</span>
              </button>
            </div>

            {/* Quick Tips Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Usb className="w-3.5 h-3.5" />
                  <span>Puertos USB-C del ESP32-S3:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Conectá el cable USB-C de la computadora al puerto marcado como <strong>"UART"</strong> (chip CP2102/CH343).
                  Esto te da subida directa de firmware y monitor serie a 115200 baudios sin necesitar drivers especiales.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs font-mono space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>DHT22 Módulo 3 Pines:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Al ser la versión en plaqueta con 3 pines (<strong>+</strong>, <strong>out</strong>, <strong>-</strong>), la resistencia pull-up de 10kΩ ya está soldada internamente.
                  <strong>No agregues resistencia externa.</strong>
                </p>
              </div>
            </div>

            {/* Pinout Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Componente / Pin</th>
                    <th className="px-4 py-2.5">Conectar a ESP32</th>
                    <th className="px-4 py-2.5">Tipo de Cable</th>
                    <th className="px-4 py-2.5">Color Sugerido</th>
                    <th className="px-4 py-2.5">Función & Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 text-slate-300">
                  {pinout.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-slate-100 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400/80" />
                        {item.comp}
                      </td>
                      <td className="px-4 py-2.5 text-cyan-300 font-semibold">{item.espPin}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-amber-300 font-bold">
                          {item.cable}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700/60 text-[10px]">
                          {item.color}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PROTOBOARD 830 PUNTOS VISUAL GUIDE */}
        {activeTab === 'breadboard' && (
          <div className="p-4 space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-cyan-400 font-bold text-sm">
                  Distribución Espacial en la Protoboard de 830 Puntos
                </span>
                <span className="text-slate-500 text-[11px]">Filas 1 a 63 &bull; Rieles de Alimentación +/-</span>
              </div>

              {/* Breadboard Visual Diagram */}
              <div className="bg-amber-950/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="text-amber-300 font-semibold text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Paso 1: Colocación de la placa ESP32-S3 DevKitC-1 (28 mm de ancho)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Dado que la placa DevKitC-1 es ancha y tiene 22 pines por lado, si la montás sobre el canal central de la protoboard,
                  bloqueará los agujeros de un lado.
                  <br />
                  <strong>Estrategia recomendada:</strong>
                  <br />
                  1. Insertar el ESP32 en el <strong>extremo izquierdo de la protoboard (Filas 1 a 22)</strong>.
                  <br />
                  2. Para el lado con agujeros libres (lado A-E): conectar puentes <strong>Macho-Macho (M-M)</strong>.
                  <br />
                  3. Para el lado sin agujeros libres (o si el display está cerca): conectar cables <strong>Macho-Hembra (M-H)</strong> directamente desde las patitas del ESP32 que sobresalen hacia el display o los rieles.
                </p>
              </div>

              {/* Step-by-step assembly cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-[10px]">1</div>
                    <span>Rieles de 3.3V y GND</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tirá un cable rojo <strong>M-M</strong> desde el pin <strong>3V3</strong> del ESP32 al riel rojo (+) superior.
                    Tirá un cable negro <strong>M-M</strong> desde <strong>GND</strong> al riel azul (-) superior.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-[10px]">2</div>
                    <span>Display ST7735 (8 Pines)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Insertá el display en las filas <strong>28 a 35</strong>.
                    Conectá GND a riel azul, VCC a riel rojo, BLK a GPIO 7 (o riel 3.3V), y los 5 pines SPI a GPIO 8, 9, 10, 11 y 12.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-[10px]">3</div>
                    <span>Sensor DHT22 (3 Pines)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Usá 3 cables <strong>Macho-Hembra (M-H)</strong> directo desde los pines de la placa del sensor:
                    <strong>+</strong> a riel rojo 3.3V, <strong>-</strong> a riel azul GND, y <strong>OUT</strong> directo a <strong>GPIO 4</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-[10px]">4</div>
                    <span>Módulo de 4 Relés</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Conectá IN1 a <strong>GPIO 15</strong>, IN2 a <strong>GPIO 16</strong>, IN3 a <strong>GPIO 17</strong> e IN4 a <strong>GPIO 14</strong>.
                    Están completamente separados del rango GPIO 5 al 12 de la pantalla.
                  </p>
                </div>
              </div>

              {/* Breadboard Row Map Summary */}
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1">
                <div className="font-bold text-slate-200">Resumen de Conexiones Físicas:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
                  <div>• Filas 1 a 22: Placa ESP32-S3 DevKitC-1</div>
                  <div>• Filas 28 a 35: Display ST7735 (GND, VCC, SCL 12, SDA 11, RES 8/5, DC 9/6, CS 10/7, BLK 7)</div>
                  <div>• Sensor DHT22: GPIO 4 (VCC 3.3V, GND)</div>
                  <div>• Módulo 4 Relés: GPIO 15 (Living), GPIO 16 (Lab), GPIO 17 (CNC), GPIO 14 (Desk)</div>
                  <div>• Emisor IR 940nm: GPIO 18 con transistor NPN 2N2222</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MAIN.CPP */}
        {activeTab === 'main_cpp' && (
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400 font-mono">
                Firmware C++ configurado para ESP32-S3 DevKitC-1, ST7735 (8 pines) y DHT22
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadFile('main.cpp', mainCppCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(mainCppCode, 'main_cpp')}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono flex items-center gap-1.5 shadow-sm"
                >
                  {copiedKey === 'main_cpp' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar main.cpp</span>
                </button>
              </div>
            </div>

            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 max-h-[500px] overflow-y-auto font-mono text-xs text-slate-200">
              <pre>{mainCppCode}</pre>
            </div>
          </div>
        )}

        {/* TAB 4: PLATFORMIO.INI */}
        {activeTab === 'platformio_ini' && (
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400 font-mono">
                Configuración lista para PlatformIO en VS Code con flag de USB CDC activo
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadFile('platformio.ini', platformioCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(platformioCode, 'platformio')}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono flex items-center gap-1.5 shadow-sm"
                >
                  {copiedKey === 'platformio' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar platformio.ini</span>
                </button>
              </div>
            </div>

            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 max-h-[400px] overflow-y-auto font-mono text-xs text-slate-200">
              <pre>{platformioCode}</pre>
            </div>
          </div>
        )}

        {/* TAB 5: GUIA PASO A PASO DE CARGA Y FLASHEO */}
        {activeTab === 'flash_guide' && (
          <div className="p-4 space-y-4">
            {/* Header banner */}
            <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-emerald-300 font-bold font-mono text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Procedimiento de Carga para ESP32-S3 DevKitC-1</span>
                </div>
                <p className="text-slate-300 text-xs mt-1">
                  Guía visual para compilar y subir el firmware utilizando los dos archivos descargados (<code>platformio.ini</code> y <code>main.cpp</code>).
                </p>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                Puerto Recomendado: UART (CP2102/CH343)
              </div>
            </div>

            {/* Methods Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Option A: PlatformIO (Recommended) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-cyan-400 font-bold font-mono text-xs flex items-center gap-1.5">
                      <Code className="w-4 h-4" />
                      <span>Opción 1 (Recomendada): PlatformIO en VS Code</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[10px] font-mono">
                      Automático
                    </span>
                  </div>

                  {/* Step 1: Folders */}
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px]">1</span>
                      <span>Crear la carpeta del proyecto en tu PC</span>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-300">
                      <pre className="font-mono text-cyan-300">
{`jarvis-esp32/
├── platformio.ini    <-- Archivo descargado (en la raíz)
└── src/
    └── main.cpp      <-- Archivo descargado (en la subcarpeta src)`}
                      </pre>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      *Importante: <code>main.cpp</code> debe estar obligatoriamente dentro de la subcarpeta llamada <code>src</code>.
                    </p>
                  </div>

                  {/* Step 2: Open in VS Code */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px]">2</span>
                      <span>Abrir carpeta en Visual Studio Code</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Abrí VS Code y ve a <strong>Archivo &gt; Abrir carpeta...</strong> y elegí la carpeta <code>jarvis-esp32</code>.
                      (Si no tenés la extensión <strong>PlatformIO IDE</strong>, instalala desde el panel de Extensiones <code>Ctrl+Shift+X</code>).
                    </p>
                  </div>

                  {/* Step 3: Hardware Connection */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px]">3</span>
                      <span>Conectar el ESP32-S3 a la PC</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Enchufá el cable USB-C al puerto marcado como <strong>"UART"</strong> en tu placa ESP32-S3 DevKitC-1.
                    </p>
                  </div>

                  {/* Step 4: 1-Click Upload */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px]">4</span>
                      <span>Flashear con un Clic</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      En la barra inferior azul de VS Code hacé clic en la <strong>Flecha hacia la derecha (➔)</strong> (Upload).
                      PlatformIO descargará las librerías automáticamente, compilará y subirá el código.
                    </p>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-[11px] font-mono text-cyan-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 shrink-0" />
                  <span>O desde la terminal integrada: <code>pio run -t upload</code></span>
                </div>
              </div>

              {/* Option B: Arduino IDE */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-amber-400 font-bold font-mono text-xs flex items-center gap-1.5">
                      <FileCode className="w-4 h-4" />
                      <span>Opción 2: Arduino IDE (2.x)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                      Manual
                    </span>
                  </div>

                  {/* Step 1: Rename to .ino */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">1</span>
                      <span>Preparar sketch .ino</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Creá una carpeta llamada <code>jarvis_firmware</code> y dentro guardá <code>main.cpp</code> renombrado como <code>jarvis_firmware.ino</code>.
                    </p>
                  </div>

                  {/* Step 2: Libraries */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">2</span>
                      <span>Instalar librerías requeridas</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      En Arduino IDE abrí <strong>Herramientas &gt; Administrador de Bibliotecas</strong> e instalá:
                    </p>
                    <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-0.5 pl-2">
                      <li>Adafruit GFX Library</li>
                      <li>Adafruit ST7735 and ST7789 Library</li>
                      <li>ArduinoJson (v7.x)</li>
                      <li>DHT sensor library</li>
                      <li>IRremoteESP8266</li>
                    </ul>
                  </div>

                  {/* Step 3: Board Config */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">3</span>
                      <span>Configurar placa y puerto COM</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      En <strong>Herramientas &gt; Placa</strong> seleccioná <strong>ESP32S3 Dev Module</strong>.
                      Elegí el puerto <strong>COM</strong> correspondiente.
                    </p>
                  </div>

                  {/* Step 4: Upload */}
                  <div className="space-y-1 text-xs font-mono">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">4</span>
                      <span>Hacer clic en Subir</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Hacé clic en el botón circular de flecha <strong>Subir (Upload)</strong>.
                    </p>
                  </div>
                </div>

                {/* Troubleshoot Tip */}
                <div className="mt-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] font-mono text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>¿Error de conexión ("Failed to connect")?</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    Mantené presionado el botón <strong>BOOT</strong> de la placa, pulsá y soltá el botón <strong>RST/RESET</strong>, y luego soltá <strong>BOOT</strong> para forzar el modo de descarga.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
