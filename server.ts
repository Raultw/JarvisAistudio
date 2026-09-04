import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';
import {
  DisplayMood,
  DisplayState,
  SensorData,
  RelayItem,
  SonoffDevice,
  IRCommandItem,
  HardwareHeartbeat,
  MdDocument,
  SystemEventLog
} from './src/types.ts';
import { TuyaLocalClient } from './server/tuyaLocal.ts';

dotenv.config();

// In-Memory state for Jarvis Hardware & Orchestrator
let displayState: DisplayState = {
  mood: 'NEUTRAL',
  message: 'JARVIS ONLINE\nESP32-S3 READY',
  updatedAt: new Date().toISOString()
};

let sensorData: SensorData = {
  temperature: 23.8,
  humidity: 47.5,
  heatIndex: 24.1,
  updatedAt: new Date().toISOString(),
  source: 'DHT22 @ GPIO 4 (ESP32-S3)'
};

// Único actuador físico real de potencia: Enchufe GF-SMSOCKET (Smart Life / Tuya)
let sonoffDevice: SonoffDevice = {
  id: 'velador',
  name: 'GRALF - Enchufe (Velador)',
  model: 'GF-SMSOCKET',
  ecosystem: 'Smart Life / Tuya',
  state: false,
  ip: '192.168.0.28',
  deviceId: 'ebd1e90786fec509a8pngp',
  localKey: 'PvCBXhovwQg!Dq+*',
  webhookUrl: '',
  mqttTopic: 'jarvis_raul_s3/velador/power',
  version: '3.4',
  mode: 'TUYA_LOCAL',
  updatedAt: new Date().toISOString()
};

// Mantenido para retrocompatibilidad mínima de lectura si fuera necesario
let relays: Record<string, RelayItem> = {
  velador: { id: 'velador', room: 'dormitorio', label: 'GRALF - Enchufe (Velador)', state: false, gpio: 0 }
};

let irQueue: IRCommandItem[] = [
  {
    id: 'ir-init-1',
    device: 'ac',
    command: 'temp_24_cool',
    protocol: 'NEC',
    hexCode: '0x28C8807F',
    timestamp: new Date().toISOString(),
    executed: true
  }
];

let hardwareHeartbeat: HardwareHeartbeat = {
  connected: true,
  lastPing: new Date().toISOString(),
  ip: '192.168.1.142',
  rssi: -54,
  chip: 'ESP32-S3-WROOM-1 (N16R8)',
  freeHeap: 234120
};

let documents: MdDocument[] = [
  {
    filename: 'proyecto_jarvis.md',
    title: 'Informe de Estado: Proyecto Jarvis',
    content: `# Informe de Estado: Proyecto Jarvis (Transición a Hardware Real)

El desarrollo pasa formalmente de la fase de simulación por consola a la integración física con microcontroladores, actuadores y visualización gráfica.

## 1. Arquitectura
- Google AI Studio (Gemini Flash LLM)
- Backend Central (Node.js Express)
- Controlador Físico (ESP32-S3)
- Display TFT ST7735 (80x160 RGB IPS)
- Sensores DHT22, Relés de Potencia, Emisor IR 940nm con NPN 2N2222.

## 2. Pinout Asignado
- ST7735 SCL/SCK: GPIO 12
- ST7735 SDA/MOSI: GPIO 11
- ST7735 CS: GPIO 7
- ST7735 DC: GPIO 6
- ST7735 RES: GPIO 5
- ST7735 BLK: Riel 3.3V (o GPIO)
- DHT22 (DATA): GPIO 4
- Relés (4 Canales): GPIO 15 (Living), GPIO 16 (Lab), GPIO 17 (CNC), GPIO 14 (Desk)
- IR LED: GPIO 18 (Base 2N2222)
`,
    updatedAt: new Date().toISOString()
  },
  {
    filename: 'diagnostico_sensores.md',
    title: 'Registro de Calibración DHT22',
    content: `# Registro de Calibración de Sensores
- Sensor: DHT22 / AM2302
- Rango Temperatura: -40°C a 80°C (+-0.5°C)
- Rango Humedad: 0% a 100% (+-2% RH)
- Pull-up recomendado: Resistencia de 4.7k a 10k entre VCC y DATA.
- Estado: Lecturas estables a 0.5Hz.
`,
    updatedAt: new Date().toISOString()
  },
  {
    filename: 'guia_montaje_esp32s3_830pts.md',
    title: 'Guía de Montaje: ESP32-S3 DevKitC-1 + ST7735 (8 pines) + DHT22',
    content: `# Guía de Montaje en Protoboard 830 Puntos

## Hardware Identificado en Mesa
- Microcontrolador: ESP32-S3 DevKitC-1 (44 pines, 22 por lado, doble USB-C).
- Pantalla: ST7735 0.96" 80x160 RGB IPS (8 Pines con BLK).
- Sensor: DHT22 Módulo blanco de 3 pines (+, out, - con pull-up SMD integrado).
- Protoboard: 830 puntos con rieles de alimentación divididos.
- Cables: Jumper Macho-Macho (M-M) y Macho-Hembra (M-H).

## 1. Posicionamiento en la Protoboard de 830 Puntos
El ESP32-S3 DevKitC-1 tiene un ancho de 28 mm. Al insertarlo a caballo sobre la ranura central, ocupará casi todo el ancho disponible entre las filas A-E y F-J.
- Recomendación: Insertar la placa en el extremo izquierdo de la protoboard (filas 1 a 22).
- Para las filas donde no quede espacio libre para jumpers Macho-Macho, utilizar cables Macho-Hembra (M-H) conectados directamente a los pines superiores de la placa ESP32.

## 2. Asignación Pin a Pin y Tipo de Cable
1. ST7735 GND -> Riel Azul GND (Cable M-M o M-H Negro)
2. ST7735 VCC -> Riel Rojo 3.3V (Cable M-M o M-H Rojo)
3. ST7735 SCL/SCK -> ESP32 GPIO 12 (Cable M-M o M-H Amarillo)
4. ST7735 SDA/MOSI -> ESP32 GPIO 11 (Cable M-M o M-H Azul)
5. ST7735 RES/RESET -> ESP32 GPIO 5 (Cable Naranja)
6. ST7735 DC/A0 -> ESP32 GPIO 6 (Cable Violeta)
7. ST7735 CS -> ESP32 GPIO 7 (Cable Verde)
8. ST7735 BLK -> Riel 3.3V (Cable Blanco)

9. DHT22 VCC (+) -> Riel Rojo 3.3V (Cable M-H Rojo)
10. DHT22 DATA (OUT) -> ESP32 GPIO 4 (Cable M-H Azul Claro)
11. DHT22 GND (-) -> Riel Azul GND (Cable M-H Negro)
* NOTA: Al ser el módulo de 3 pines, NO requiere resistencia externa porque ya viene soldada en su plaqueta.

## 3. Conexión USB-C
- La placa tiene dos puertos: 'USB' y 'UART'.
- Para flashear desde VS Code/PlatformIO sin configuraciones adicionales, conectar el cable USB-C a la PC en el puerto marcado como 'UART'.
`,
    updatedAt: new Date().toISOString()
  },
  {
    filename: 'procedimiento_flasheo_firmware.md',
    title: 'Procedimiento Paso a Paso: Flasheo de Firmware en ESP32-S3',
    content: `# Procedimiento Paso a Paso: Carga de Firmware en ESP32-S3 DevKitC-1

## Opción A (Recomendada): Usando PlatformIO en VS Code

### Paso 1: Estructura de Carpetas del Proyecto
En tu computadora crea una carpeta para el proyecto, por ejemplo:
\`\`\`text
jarvis-esp32/
├── platformio.ini    <-- (El archivo que descargaste)
└── src/
    └── main.cpp      <-- (El archivo que descargaste)
\`\`\`
*Nota: Es imprescindible que \`main.cpp\` esté dentro de una subcarpeta llamada \`src\`.*

### Paso 2: Abrir en Visual Studio Code
1. Abre VS Code.
2. Si no lo tienes instalado, ve a la pestaña de Extensiones (\`Ctrl + Shift + X\`) y busca **PlatformIO IDE**. Haz clic en **Install**.
3. En el menú superior: \`Archivo\` -> \`Abrir Carpeta...\` y selecciona la carpeta \`jarvis-esp32\`.
4. PlatformIO detectará el archivo \`platformio.ini\` y descargará automáticamente las librerías (\`Adafruit_GFX\`, \`Adafruit_ST7735\`, \`ArduinoJson\`, \`DHT\`, etc.).

### Paso 3: Configurar Credenciales en main.cpp
Abre \`src/main.cpp\` y revisa las primeras líneas:
- \`WIFI_SSID\`: El nombre exacto de tu red Wi-Fi 2.4 GHz.
- \`WIFI_PASSWORD\`: La clave de tu red Wi-Fi.
- \`SERVER_POLL_URL\` y \`SERVER_TELEMETRY_URL\`: La IP local de tu servidor (ej. \`http://192.168.1.50:3000/api/esp32/poll\`).

### Paso 4: Conectar la Placa a la Computadora
1. Conecta el cable USB-C a tu PC y el otro extremo al puerto marcado como **"UART"** en el ESP32-S3.
2. Si Windows o tu SO emite el sonido de dispositivo conectado, ya tienes puerto COM asignado.

### Paso 5: Compilar y Flashear (1 Clic)
En la barra inferior azul de VS Code verás los iconos de PlatformIO:
1. Icono de **Check (✓)**: Compilar (Build).
2. Icono de **Flecha hacia la derecha (➔)**: Subir firmware (Upload).
   * Haz clic en la **flecha (➔)**. PlatformIO compilará y subirá el código al ESP32-S3 automáticamente.
3. Icono de **Enchufe eléctrico**: Monitor Serie (Serial Monitor). Haz clic para ver los mensajes a 115200 baudios.

---

## Opción B: Usando Arduino IDE (2.x)

1. Renombra \`main.cpp\` a \`jarvis_firmware.ino\` y colócalo dentro de una carpeta llamada \`jarvis_firmware\`.
2. En Arduino IDE -> \`Herramientas\` -> \`Placa\` -> Seleccionar **ESP32S3 Dev Module**.
3. En \`Herramientas\` -> \`Administrador de Bibliotecas\` busca e instala:
   - Adafruit GFX Library
   - Adafruit ST7735 and ST7789 Library
   - ArduinoJson (versión 7.x)
   - DHT sensor library
   - IRremoteESP8266
4. Conecta al puerto COM (USB UART) y haz clic en la flecha **Subir (Upload)**.
`,
    updatedAt: new Date().toISOString()
  },
  {
    filename: 'pasos_validacion_puesta_en_marcha.md',
    title: 'Guía de Puesta en Marcha: Validación en Vivo con ESP32-S3',
    content: `# Pasos a Seguir tras Cargar el Firmware

## 1. Abrir el Monitor Serie (115200 baudios)
En VS Code / PlatformIO, haz clic en el icono del enchufe eléctrico (Serial Monitor) o presiona \`Ctrl+Alt+S\`:
- Verifica que el ESP32 imprima los puntos de conexión Wi-Fi.
- Debe mostrar: \`WiFi Conectado con éxito!\` seguido de la IP local asignada (por ejemplo: \`192.168.1.142\`).

## 2. Inspección Visual de la Pantalla ST7735
Mira la pantalla física en la protoboard:
- Durante el arranque: Expresión [THINKING] en color violeta con el texto "CONECTANDO WI-FI...".
- Al conectarse: Expresión [HAPPY] en verde brillante con el texto "SISTEMA ONLINE / IP: xxx".
- Si muestra [ALERT] en rojo ("ERROR WI-FI"): Revisa en \`main.cpp\` que el SSID sea de una red 2.4 GHz y que la contraseña no tenga errores de tipeo.

## 3. Comprobación del Enlace en la Interfaz Web
1. En la barra superior, observa el estado del ESP32-S3 Bridge.
2. En la pestaña "Telemetría & Eventos", verás los paquetes de telemetría emitidos cada 3 segundos por tu DHT22.
3. En la tarjeta "ESP32-S3 BRIDGE", se reflejará la IP real de tu placa, la potencia de señal Wi-Fi (RSSI) y la memoria RAM libre.

## 4. Prueba del Bucle Interactivo con Jarvis
Escribe en el chat de Jarvis (o pulsa el botón del micrófono):
- *"Jarvis, ¿cuál es la temperatura en el laboratorio?"* -> Leerá la sonda DHT22 física en GPIO 4.
- *"Jarvis, pasá a modo alerta"* -> Cambiará los ojos a rojo en la pantalla física ST7735 en menos de un segundo.
- *"Jarvis, encendé la luz del banco de trabajo"* -> Conmutará el relé en GPIO 16.
`,
    updatedAt: new Date().toISOString()
  }
];

let systemLogs: SystemEventLog[] = [
  {
    id: 'log-1',
    timestamp: new Date().toISOString(),
    source: 'SYSTEM',
    title: 'Jarvis Node.js Server Booted',
    details: 'HTTP & Hardware bridge ready on port 3000. ESP32 polling enabled.'
  }
];

function addLog(source: SystemEventLog['source'], title: string, details: string, meta?: Record<string, unknown>) {
  const newLog: SystemEventLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source,
    title,
    details,
    meta
  };
  systemLogs.unshift(newLog);
  if (systemLogs.length > 50) systemLogs.pop();
}

// Calculate Heat Index in Celsius
function calculateHeatIndex(T: number, RH: number): number {
  const c1 = -8.78469475556;
  const c2 = 1.61139411;
  const c3 = 2.33854883889;
  const c4 = -0.14611605;
  const c5 = -0.012308094;
  const c6 = -0.0164248277778;
  const c7 = 0.002211732;
  const c8 = 0.00072546;
  const c9 = -0.000003582;
  const hi = c1 + c2 * T + c3 * RH + c4 * T * RH + c5 * T * T + c6 * RH * RH + c7 * T * T * RH + c8 * T * RH * RH + c9 * T * T * RH * RH;
  return Number(hi.toFixed(1));
}

// Tool declarations for Gemini
const updateSt7735DisplayTool: FunctionDeclaration = {
  name: 'update_st7735_display',
  description: 'Actualiza la pantalla del ESP32 cambiando la expresion facial y mostrando un mensaje corto de dos lineas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      mood: {
        type: Type.STRING,
        description: 'Expresion facial: NEUTRAL, THINKING, HAPPY, ALERT, SLEEPING, SARCASTIC'
      },
      message: {
        type: Type.STRING,
        description: 'Mensaje en pantalla (maximo 20 caracteres por linea)'
      }
    },
    required: ['mood', 'message']
  }
};

const readEnvironmentSensorsTool: FunctionDeclaration = {
  name: 'read_environment_sensors',
  description: 'Obtiene la lectura actual de temperatura y humedad desde el sensor fisico conectado al ESP32.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      includeHistory: {
        type: Type.BOOLEAN,
        description: 'Si es true, incluye detalles de indice termico y sensor'
      }
    }
  }
};

const controlVeladorTool: FunctionDeclaration = {
  name: 'control_velador',
  description: 'Enciende o apaga el enchufe inteligente GF-SMSOCKET (Smart Life / Tuya) conectado a la Luz del Velador.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      state: {
        type: Type.BOOLEAN,
        description: 'true para encender la luz del velador, false para apagarla'
      }
    },
    required: ['state']
  }
};

const manageMdDocumentTool: FunctionDeclaration = {
  name: 'manage_md_document',
  description: 'Crea, lee, lista o actualiza documentos Markdown en /data.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: 'Accion a realizar: list, read, write, delete'
      },
      filename: {
        type: Type.STRING,
        description: 'Nombre del archivo .md (ej: notas.md)'
      },
      content: {
        type: Type.STRING,
        description: 'Contenido del documento Markdown (en caso de write)'
      }
    },
    required: ['action']
  }
};

const jarvisTools = [
  {
    functionDeclarations: [
      updateSt7735DisplayTool,
      readEnvironmentSensorsTool,
      controlVeladorTool,
      manageMdDocumentTool
    ]
  }
];

const JARVIS_SYSTEM_INSTRUCTION = `Sos el asistente personal de IA para tu creador. Tu nombre temporal es Jarvis.
Personalidad: Inspirada en el Jarvis de Iron Man: formal, altamente eficiente, estilo refinado, humor seco, irónico y sutil, siempre leal. Respuestas habladas directas y sin rodeos. En español, con un toque distinguido y elegante.
* Capacidades Físicas Reales:
* Pantalla TFT ST7735 (0.96", 80x160 RGB IPS): Actualizás tu cara (NEUTRAL, THINKING, HAPPY, ALERT, SLEEPING, SARCASTIC) y mostrás texto corto con la herramienta 'update_st7735_display'. Siempre que el usuario te hable o respondas, sincronizá tu expresión y mensaje en la pantalla.
* Único Actuador Domótico Real: Controlás el enchufe inteligente GF-SMSOCKET (Smart Life / Tuya) que enciende/apaga la "Luz del Velador" con la herramienta 'control_velador'. No existen relés simulados ni controles artificiales.
* Sensor Ambiental Físico: Leés la temperatura y humedad física con la sonda DHT22 conectada en GPIO 4 mediante 'read_environment_sensors'.
* Archivos locales: Creás y consultás notas Markdown en /data con 'manage_md_document'.

Regla de Oro: Siempre que el usuario te pida ejecutar una acción en el mundo real (encender o apagar la luz del velador, consultar temperatura, o cambiar la cara del display), llamá a la función correspondiente de inmediato.`;

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Function execution handler
function executeJarvisFunction(name: string, args: Record<string, any>): { result: any; uiUpdate?: string } {
  if (name === 'update_st7735_display') {
    const rawMood = String(args.mood || 'NEUTRAL').toUpperCase();
    const validMoods: DisplayMood[] = ['NEUTRAL', 'THINKING', 'HAPPY', 'ALERT', 'SLEEPING', 'SARCASTIC'];
    const mood: DisplayMood = validMoods.includes(rawMood as DisplayMood) ? (rawMood as DisplayMood) : 'NEUTRAL';
    const message = String(args.message || '').slice(0, 42); // 2 lines

    displayState = {
      mood,
      message,
      updatedAt: new Date().toISOString()
    };
    addLog('GEMINI_FUNCTION', `TFT Display Updated: ${mood}`, message, { mood, message });
    return {
      result: { status: 'success', display: displayState },
      uiUpdate: `Pantalla ST7735 actualizada a expresión [${mood}] con mensaje "${message}".`
    };
  }

  if (name === 'read_environment_sensors') {
    addLog('GEMINI_FUNCTION', 'Sensor Read Requested', `${sensorData.temperature}°C / ${sensorData.humidity}%`, { sensorData });
    return {
      result: {
        temperature: sensorData.temperature,
        humidity: sensorData.humidity,
        heatIndex: sensorData.heatIndex,
        sensor: 'DHT22',
        pin: 'GPIO 4',
        status: 'OK',
        timestamp: sensorData.updatedAt
      }
    };
  }

  if (name === 'control_velador' || name === 'control_light') {
    const state = Boolean(args.state);
    sonoffDevice.state = state;
    sonoffDevice.updatedAt = new Date().toISOString();
    if (relays.velador) relays.velador.state = state;

    // Disparar comando local Tuya si están los datos configurados
    if (sonoffDevice.deviceId && sonoffDevice.localKey && sonoffDevice.ip) {
      TuyaLocalClient.setPower({
        ip: sonoffDevice.ip,
        deviceId: sonoffDevice.deviceId,
        localKey: sonoffDevice.localKey,
        version: sonoffDevice.version || '3.4'
      }, state).then(res => {
        addLog('TUYA_LOCAL', `Tuya LAN (${res.driver || 'v3.4'}): ${res.success ? 'ÉXITO' : 'FALLO'} (${res.latencyMs}ms)`, res.message);
      }).catch(e => {
        console.warn('[TuyaLocal Error]', e?.message);
      });
    }

    // Disparar webhook de Smart Life si estuviera configurado
    if (sonoffDevice.webhookUrl) {
      try {
        const targetUrl = sonoffDevice.webhookUrl.replace('{state}', state ? 'on' : 'off');
        fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: state ? 'ON' : 'OFF', device: 'GF-SMSOCKET' }) })
          .catch(e => console.warn('[SmartLife Webhook] Error:', e?.message));
      } catch (e) {}
    }

    addLog('GEMINI_FUNCTION', `Enchufe GF-SMSOCKET (Smart Life / Tuya)`, state ? 'ENCENDIDO (ON)' : 'APAGADO (OFF)', {
      smartPlug: sonoffDevice
    });

    return {
      result: {
        status: 'success',
        device: 'Luz del Velador (GF-SMSOCKET - Smart Life / Tuya)',
        state: state ? 'ON' : 'OFF',
        mqttTopic: sonoffDevice.mqttTopic,
        mode: sonoffDevice.mode
      },
      uiUpdate: `Enchufe GF-SMSOCKET (Smart Life) [Luz del Velador] puesto en estado ${state ? 'ENCENDIDO' : 'APAGADO'}.`
    };
  }

  if (name === 'manage_md_document') {
    const action = String(args.action || 'list').toLowerCase();
    const filename = String(args.filename || '').trim();
    const content = args.content ? String(args.content) : '';

    if (action === 'list') {
      const list = documents.map(d => ({ filename: d.filename, title: d.title, updatedAt: d.updatedAt }));
      return { result: { documents: list } };
    }

    if (action === 'read') {
      const doc = documents.find(d => d.filename.toLowerCase() === filename.toLowerCase());
      if (doc) {
        return { result: { filename: doc.filename, title: doc.title, content: doc.content, updatedAt: doc.updatedAt } };
      }
      return { result: { status: 'not_found', message: `El documento ${filename} no existe en /data.` } };
    }

    if (action === 'write') {
      let doc = documents.find(d => d.filename.toLowerCase() === filename.toLowerCase());
      const title = content.split('\n')[0].replace(/^#+\s*/, '') || filename;
      if (doc) {
        doc.content = content;
        doc.title = title;
        doc.updatedAt = new Date().toISOString();
      } else {
        doc = {
          filename: filename.endsWith('.md') ? filename : `${filename}.md`,
          title,
          content,
          updatedAt: new Date().toISOString()
        };
        documents.unshift(doc);
      }
      addLog('GEMINI_FUNCTION', `Documento Guardado: ${doc.filename}`, `Tamaño: ${content.length} bytes`, { filename: doc.filename });
      return { result: { status: 'success', filename: doc.filename, message: 'Documento guardado exitosamente en /data.' } };
    }

    if (action === 'delete') {
      const index = documents.findIndex(d => d.filename.toLowerCase() === filename.toLowerCase());
      if (index !== -1) {
        const removed = documents.splice(index, 1)[0];
        addLog('GEMINI_FUNCTION', `Documento Eliminado: ${removed.filename}`, 'Eliminado de /data');
        return { result: { status: 'success', message: `Documento ${removed.filename} eliminado.` } };
      }
      return { result: { status: 'not_found', message: `No se encontró ${filename}.` } };
    }
  }

  return { result: { status: 'unsupported_tool', tool: name } };
}

// Fallback logic for when GEMINI_API_KEY is not configured yet
function generateSimulatedJarvisResponse(prompt: string): { text: string; mood: DisplayMood; executedTools: any[] } {
  const p = prompt.toLowerCase();
  const executedTools: any[] = [];
  let reply = '';
  let mood: DisplayMood = 'NEUTRAL';

  if (p.includes('luz') || p.includes('velador') || p.includes('lampara') || p.includes('lámpara') || p.includes('enchufe') || p.includes('encender') || p.includes('apagar')) {
    const turnOn = !p.includes('apagar') && !p.includes('apaga');

    const toolResult = executeJarvisFunction('control_velador', { state: turnOn });
    executedTools.push({ name: 'control_velador', args: { state: turnOn }, result: toolResult.result });

    mood = turnOn ? 'HAPPY' : 'NEUTRAL';
    const dispResult = executeJarvisFunction('update_st7735_display', {
      mood,
      message: `VELADOR: ${turnOn ? 'ON' : 'OFF'}\nENCHUFE SONOFF`
    });
    executedTools.push({ name: 'update_st7735_display', args: { mood, message: `VELADOR: ${turnOn ? 'ON' : 'OFF'}` }, result: dispResult.result });

    reply = `Comando ejecutado, señor. He ${turnOn ? 'encendido' : 'apagado'} la luz del velador a través del enchufe inteligente Sonoff. La orden ha sido despachada por el protocolo correspondiente.`;
  } else if (p.includes('temperatura') || p.includes('humedad') || p.includes('sensor') || p.includes('calor') || p.includes('clima')) {
    const toolResult = executeJarvisFunction('read_environment_sensors', { includeHistory: true });
    executedTools.push({ name: 'read_environment_sensors', args: {}, result: toolResult.result });

    mood = 'THINKING';
    const dispResult = executeJarvisFunction('update_st7735_display', {
      mood,
      message: `TEMP: ${sensorData.temperature}C\nHUM: ${sensorData.humidity}%`
    });
    executedTools.push({ name: 'update_st7735_display', args: { mood, message: `TEMP: ${sensorData.temperature}C` }, result: dispResult.result });

    reply = `Según las lecturas en tiempo real de la sonda DHT22 en el GPIO 4, la temperatura actual del laboratorio es de ${sensorData.temperature}°C con una humedad relativa del ${sensorData.humidity}%. El índice térmico calculado se sitúa en ${sensorData.heatIndex}°C. Condiciones dentro de los parámetros operativos normales.`;
  } else if (p.includes('tv') || p.includes('tele') || p.includes('aire') || p.includes('ac') || p.includes('infrarrojo') || p.includes('ir')) {
    const device = p.includes('aire') || p.includes('ac') ? 'ac' : 'tv';
    const command = p.includes('apagar') ? 'power_off' : 'power_toggle';
    const toolResult = executeJarvisFunction('send_ir_command', { device, command });
    executedTools.push({ name: 'send_ir_command', args: { device, command }, result: toolResult.result });

    mood = 'HAPPY';
    const dispResult = executeJarvisFunction('update_st7735_display', {
      mood,
      message: `IR: ${device.toUpperCase()}\nCMD: ${command.toUpperCase()}`
    });
    executedTools.push({ name: 'update_st7735_display', args: { mood, message: `IR: ${device.toUpperCase()}` }, result: dispResult.result });

    reply = `Señal infrarroja modulada a 38 kHz enviada al transistor 2N2222 para el ${device.toUpperCase()}. El paquete de datos (${toolResult.result.hexCode}) ha sido transmitido con éxito al electrodoméstico.`;
  } else if (p.includes('pantalla') || p.includes('cara') || p.includes('display') || p.includes('st7735') || p.includes('expresion') || p.includes('expresión')) {
    let newMood: DisplayMood = 'SARCASTIC';
    if (p.includes('feliz') || p.includes('happy')) newMood = 'HAPPY';
    else if (p.includes('alerta') || p.includes('alert')) newMood = 'ALERT';
    else if (p.includes('dormir') || p.includes('sleep')) newMood = 'SLEEPING';
    else if (p.includes('pensar') || p.includes('thinking')) newMood = 'THINKING';
    else if (p.includes('neutral')) newMood = 'NEUTRAL';

    const dispResult = executeJarvisFunction('update_st7735_display', {
      mood: newMood,
      message: `MODO ${newMood}\nSISTEMA NOMINAL`
    });
    executedTools.push({ name: 'update_st7735_display', args: { mood: newMood, message: `MODO ${newMood}` }, result: dispResult.result });
    mood = newMood;

    reply = `He sincronizado los vectores de la pantalla ST7735 a la expresión [${newMood}]. Como siempre, señor, mis circuitos reflejan fielmente mi dedicación, o al menos el algoritmo de cortesía programado.`;
  } else if (p.includes('documento') || p.includes('nota') || p.includes('md') || p.includes('informe')) {
    const toolResult = executeJarvisFunction('manage_md_document', { action: 'list' });
    executedTools.push({ name: 'manage_md_document', args: { action: 'list' }, result: toolResult.result });
    mood = 'NEUTRAL';
    reply = `He consultado el directorio local /data. Actualmente disponemos de ${documents.length} documentos registrados, incluyendo el informe de migración física y la calibración del DHT22. Todo listo para añadir anotaciones adicionales si lo requiere.`;
  } else {
    mood = 'NEUTRAL';
    const dispResult = executeJarvisFunction('update_st7735_display', {
      mood: 'HAPPY',
      message: 'JARVIS ACTIVO\nA LA ESPERA'
    });
    executedTools.push({ name: 'update_st7735_display', args: { mood: 'HAPPY', message: 'JARVIS ACTIVO' }, result: dispResult.result });
    reply = `A su entera disposición, señor. El controlador ESP32-S3 está sincronizado mediante el bus SPI y los periféricos de telemetría se encuentran en línea. ¿Qué orden desea ejecutar a continuación?`;
  }

  return { text: reply, mood, executedTools };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Hardware State API
  app.get('/api/hardware/state', (req, res) => {
    res.json({
      display: displayState,
      sensors: sensorData,
      sonoff: sonoffDevice,
      relays,
      irQueue,
      heartbeat: hardwareHeartbeat,
      documents,
      logs: systemLogs,
      geminiConnected: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // Enchufe inteligente GF-SMSOCKET (Smart Life / Tuya) - Luz del Velador
  app.get('/api/hardware/sonoff', (req, res) => {
    res.json({ sonoff: sonoffDevice });
  });

  app.post('/api/hardware/sonoff', (req, res) => {
    const { state, ip, mqttTopic, mode, deviceId, localKey, webhookUrl } = req.body;
    if (typeof state === 'boolean') {
      sonoffDevice.state = state;
      sonoffDevice.updatedAt = new Date().toISOString();
      if (relays.velador) relays.velador.state = state;

      // Disparar comando local Tuya si están los datos configurados
      const targetDevId = deviceId || sonoffDevice.deviceId;
      const targetKey = localKey || sonoffDevice.localKey;
      const targetIp = ip || sonoffDevice.ip;
      const targetVersion = req.body.version || sonoffDevice.version || '3.4';

      if (targetDevId && targetKey && targetIp) {
        TuyaLocalClient.setPower({
          ip: targetIp,
          deviceId: targetDevId,
          localKey: targetKey,
          version: targetVersion
        }, state).then(res => {
          addLog('TUYA_LOCAL', `Tuya LAN (${res.driver || targetVersion}): ${res.success ? 'ÉXITO' : 'FALLO'} (${res.latencyMs}ms)`, res.message);
        }).catch(e => {
          console.warn('[TuyaLocal Error]', e?.message);
        });
      }

      // Disparar Webhook si está configurado
      const targetUrl = webhookUrl || sonoffDevice.webhookUrl;
      if (targetUrl) {
        try {
          const finalUrl = targetUrl.replace('{state}', state ? 'on' : 'off');
          fetch(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: state ? 'ON' : 'OFF', device: 'GF-SMSOCKET' })
          }).catch(e => console.warn('[SmartLife Webhook POST]', e?.message));
        } catch (e) {}
      }

      addLog('USER_ACTION', `GF-SMSOCKET (Smart Life): ${state ? 'ENCENDIDO' : 'APAGADO'}`, `Modo: ${mode || sonoffDevice.mode}`);
    }
    if (ip !== undefined) sonoffDevice.ip = ip;
    if (mqttTopic !== undefined) sonoffDevice.mqttTopic = mqttTopic;
    if (mode !== undefined) sonoffDevice.mode = mode;
    if (deviceId !== undefined) sonoffDevice.deviceId = deviceId;
    if (localKey !== undefined) sonoffDevice.localKey = localKey;
    if (webhookUrl !== undefined) sonoffDevice.webhookUrl = webhookUrl;
    if (req.body.version !== undefined) sonoffDevice.version = req.body.version;
    res.json({ status: 'ok', sonoff: sonoffDevice });
  });

  // Test de conexión Tuya Local LAN directo (TinyTuya / Native Socket)
  app.post('/api/hardware/tuya-test', async (req, res) => {
    try {
      const { ip, deviceId, localKey, version, state = true } = req.body;
      const targetIp = ip || sonoffDevice.ip;
      const targetDevId = deviceId || sonoffDevice.deviceId;
      const targetKey = localKey || sonoffDevice.localKey;
      const targetVer = version || sonoffDevice.version || '3.4';

      if (!targetIp || !targetDevId || !targetKey) {
        return res.status(400).json({
          success: false,
          error: 'Faltan datos requeridos (IP, Device ID o Local Key)'
        });
      }

      const result = await TuyaLocalClient.setPower({
        ip: targetIp,
        deviceId: targetDevId,
        localKey: targetKey,
        version: targetVer
      }, Boolean(state), 3000);

      addLog('TUYA_LOCAL', `Test Tuya LAN (${result.driver || targetVer}): ${result.success ? 'CONECTADO' : 'FALLO'}`, result.message);

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Síntesis de voz con voces neurales diferenciadas
  app.post('/api/voice/synthesize', async (req, res) => {
    try {
      const { text, voiceId } = req.body;
      const ai = getGenAI();
      if (!ai) {
        return res.status(400).json({ error: 'GEMINI_API_KEY no disponible para síntesis neural' });
      }

      const voiceMapping: Record<string, string> = {
        charon: 'Charon',
        fenrir: 'Fenrir',
        puck: 'Puck',
        aoede: 'Aoede',
        kore: 'Kore',
        elevenlabs_jarvis: 'Charon'
      };
      const voiceName = voiceMapping[voiceId] || 'Charon';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: text || 'Sistemas en línea, señor.' }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        }
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (base64Audio) {
        return res.json({ success: true, base64Audio, mimeType, voiceName });
      }
      return res.status(500).json({ error: 'No se generaron datos de audio' });
    } catch (err: any) {
      console.error('Error generando audio TTS:', err?.message || err);
      return res.status(500).json({ error: err?.message || 'Error en síntesis de audio' });
    }
  });

  // Manual display update
  app.post('/api/hardware/display', (req, res) => {
    const { mood, message } = req.body;
    const result = executeJarvisFunction('update_st7735_display', { mood, message });
    res.json(result);
  });

  // Sensor update (from UI slider or test bench)
  app.post('/api/hardware/sensors', (req, res) => {
    const { temperature, humidity } = req.body;
    if (typeof temperature === 'number') sensorData.temperature = Number(temperature.toFixed(1));
    if (typeof humidity === 'number') sensorData.humidity = Number(humidity.toFixed(1));
    sensorData.heatIndex = calculateHeatIndex(sensorData.temperature, sensorData.humidity);
    sensorData.updatedAt = new Date().toISOString();
    sensorData.source = 'DHT22 Telemetry (ESP32-S3 / Manual Bench)';

    addLog('ESP32_TELEMETRY', 'Lectura de Sensores Actualizada', `${sensorData.temperature}°C / ${sensorData.humidity}% RH`, { sensorData });
    res.json({ status: 'ok', sensorData });
  });

  // Relay toggle
  app.post('/api/hardware/relays', (req, res) => {
    const { id, state } = req.body;
    if (relays[id]) {
      relays[id].state = Boolean(state);
      addLog('USER_ACTION', `Relé Conmutado: ${relays[id].label}`, state ? 'ON' : 'OFF', { relay: relays[id] });
      res.json({ status: 'ok', relay: relays[id] });
    } else {
      res.status(404).json({ error: 'Relay no encontrado' });
    }
  });

  // IR emit
  app.post('/api/hardware/ir', (req, res) => {
    const { device, command } = req.body;
    const result = executeJarvisFunction('send_ir_command', { device, command });
    res.json(result);
  });

  // Document management
  app.post('/api/hardware/documents', (req, res) => {
    const { action, filename, content } = req.body;
    const result = executeJarvisFunction('manage_md_document', { action, filename, content });
    res.json(result);
  });

  // ESP32 Microcontroller Polling Endpoint (WiFi Client)
  // This is what the real ESP32-S3 calls every ~1000ms
  app.get('/api/esp32/poll', (req, res) => {
    hardwareHeartbeat.connected = true;
    hardwareHeartbeat.lastPing = new Date().toISOString();

    // Check query params if ESP32 sends telemetry in poll
    if (req.query.temp) sensorData.temperature = parseFloat(String(req.query.temp));
    if (req.query.hum) sensorData.humidity = parseFloat(String(req.query.hum));
    if (req.query.ip) hardwareHeartbeat.ip = String(req.query.ip);
    if (req.query.rssi) hardwareHeartbeat.rssi = parseInt(String(req.query.rssi), 10);

    const pendingIR = irQueue.filter(i => !i.executed);
    // Mark as dispatched
    pendingIR.forEach(i => (i.executed = true));

    res.json({
      display: {
        mood: displayState.mood,
        message: displayState.message
      },
      velador: {
        state: sonoffDevice.state,
        ip: sonoffDevice.ip,
        deviceId: sonoffDevice.deviceId,
        localKey: sonoffDevice.localKey
      },
      relays: Object.values(relays).map(r => ({
        id: r.id,
        gpio: r.gpio,
        state: r.state
      })),
      pendingIR: pendingIR.map(i => ({
        id: i.id,
        device: i.device,
        command: i.command,
        hexCode: i.hexCode,
        protocol: i.protocol
      })),
      serverTimestamp: Date.now()
    });
  });

  // ESP32 Telemetry Push Endpoint
  app.post('/api/esp32/telemetry', (req, res) => {
    const { temperature, humidity, ip, rssi, freeHeap } = req.body;
    if (typeof temperature === 'number') sensorData.temperature = Number(temperature.toFixed(1));
    if (typeof humidity === 'number') sensorData.humidity = Number(humidity.toFixed(1));
    sensorData.heatIndex = calculateHeatIndex(sensorData.temperature, sensorData.humidity);
    sensorData.updatedAt = new Date().toISOString();
    sensorData.source = 'ESP32-S3 Hardware Push';

    if (ip) hardwareHeartbeat.ip = ip;
    if (typeof rssi === 'number') hardwareHeartbeat.rssi = rssi;
    if (typeof freeHeap === 'number') hardwareHeartbeat.freeHeap = freeHeap;
    hardwareHeartbeat.connected = true;
    hardwareHeartbeat.lastPing = new Date().toISOString();

    res.json({ status: 'telemetry_received', timestamp: Date.now() });
  });

  // Chat Endpoint with Gemini Function Calling
  app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Mensaje requerido' });
      return;
    }

    const ai = getGenAI();

    // If Gemini API Key is not set or SDK error, use smart simulation
    if (!ai) {
      const simulated = generateSimulatedJarvisResponse(message);
      res.json({
        reply: simulated.text,
        mood: simulated.mood,
        functionCalls: simulated.executedTools,
        state: {
          display: displayState,
          sensors: sensorData,
          relays,
          irQueue
        }
      });
      return;
    }

    try {
      // Build conversation contents
      const contents: any[] = [];

      if (Array.isArray(history)) {
        for (const h of history.slice(-6)) {
          contents.push({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      // Call Gemini Flash with function calling
      let response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
          tools: jarvisTools,
          temperature: 0.7
        }
      });

      const functionCalls = response.functionCalls;
      const executedFunctionRecords: Array<{ name: string; args: any; result: any }> = [];

      // If function calls are requested, execute them and send function response back to Gemini
      if (functionCalls && functionCalls.length > 0) {
        const functionResponseParts: any[] = [];

        for (const fc of functionCalls) {
          const { result } = executeJarvisFunction(fc.name, fc.args as Record<string, any>);
          executedFunctionRecords.push({
            name: fc.name,
            args: fc.args,
            result
          });

          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: result
            }
          });
        }

        // Add model's tool call turn and the tool response turn
        const toolCallContent = response.candidates?.[0]?.content;
        const secondTurnContents = [
          ...contents,
          toolCallContent,
          {
            role: 'tool',
            parts: functionResponseParts
          }
        ];

        // Second call to get Gemini's verbal response based on tool results
        const finalResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: secondTurnContents,
          config: {
            systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
            temperature: 0.7
          }
        });

        res.json({
          reply: finalResponse.text || 'Orden ejecutada puntualmente, señor.',
          mood: displayState.mood,
          functionCalls: executedFunctionRecords,
          state: {
            display: displayState,
            sensors: sensorData,
            relays,
            irQueue
          }
        });
      } else {
        // No function calls, pure text
        res.json({
          reply: response.text || 'A la espera de sus instrucciones, señor.',
          mood: displayState.mood,
          functionCalls: [],
          state: {
            display: displayState,
            sensors: sensorData,
            relays,
            irQueue
          }
        });
      }
    } catch (err: any) {
      console.error('Error calling Gemini API:', err);
      // Fall back gracefully to local Jarvis engine so the user never gets an error
      const fallback = generateSimulatedJarvisResponse(message);
      res.json({
        reply: `${fallback.text} (Nota: procesado en motor local de respaldo)`,
        mood: fallback.mood,
        functionCalls: fallback.executedTools,
        state: {
          display: displayState,
          sensors: sensorData,
          relays,
          irQueue
        }
      });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jarvis Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
