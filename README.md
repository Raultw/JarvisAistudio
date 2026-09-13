# JARVIS ESP32-S3

Asistente de voz standalone para ESP32-S3 con Gemini Live, micrófono I2S,
salida de audio I2S, pantalla ST7735 y control local de un enchufe Tuya.

## Configuración

1. Instalá VS Code y PlatformIO.
2. Copiá `include/secrets.example.h` como `include/secrets.h`.
3. Completá Wi-Fi, Gemini y Tuya en `include/secrets.h`.
4. Conectá el ESP32-S3 y ejecutá **PlatformIO: Upload**.
5. Abrí **PlatformIO: Monitor** a 115200 baud para ver el diagnóstico.

`lib/ArduinoWebsocketsPatched` contiene los arreglos necesarios para TLS y
para recibir frames grandes de audio de Gemini Live. No la reemplaces por
ArduinoWebsockets 0.5.4 sin esos parches.

## Seguridad

`include/secrets.h` no se versiona. Revocá cualquier credencial que haya sido
publicada o compartida anteriormente y generá una nueva.
