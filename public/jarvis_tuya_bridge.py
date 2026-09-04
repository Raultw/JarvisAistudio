#!/usr/bin/env python3
"""
=============================================================================
JARVIS LOCAL BRIDGE - TUYA LAN v3.4 (GF-SMSOCKET)
=============================================================================
Este script se ejecuta en tu computadora (o Raspberry Pi) conectada a la misma
red Wi-Fi que tu enchufe GF-SMSOCKET (192.168.0.28).

Actúa como puente de ultrabaja latencia (15 ms):
1. Escucha las órdenes enviadas por la Web de Jarvis y por voz a través de MQTT.
2. Conmuta instantáneamente el relé físico del enchufe por LAN local usando tinytuya.
3. No depende de la nube de Tuya ni de servidores exteriores.

REQUISITOS:
pip install paho-mqtt tinytuya

EJECUCIÓN:
python jarvis_tuya_bridge.py
=============================================================================
"""

import sys
import json
import time

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("❌ Falta la librería paho-mqtt. Instálala ejecutando: pip install paho-mqtt")
    sys.exit(1)

try:
    import tinytuya
except ImportError:
    print("❌ Falta la librería tinytuya. Instálala ejecutando: pip install tinytuya")
    sys.exit(1)

# Parámetros exactos de tu enchufe GF-SMSOCKET
DEVICE_ID = "ebd1e90786fec509a8pngp"
DEVICE_IP = "192.168.0.28"
LOCAL_KEY = "PvCBXhovwQg!Dq+*"
DEVICE_VER = 3.4

# Parámetros MQTT de Jarvis
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
TOPIC_POWER = "jarvis_raul_s3/velador/power"
TOPIC_CMD = "jarvis_raul_s3/tuya/command"
TOPIC_STATUS = "jarvis_raul_s3/velador/state"

print("=======================================================")
print("🤖 INICIANDO PUENTE LOCAL DE JARVIS PARA TUYA (LAN 3.4)")
print(f"🔌 Enchufe: GRALF GF-SMSOCKET @ {DEVICE_IP}")
print(f"🔑 ID: {DEVICE_ID}")
print("=======================================================")

# Inicializar cliente Tuya Local
plug = tinytuya.OutletDevice(DEVICE_ID, DEVICE_IP, LOCAL_KEY)
plug.set_version(DEVICE_VER)
plug.set_socketPersistent(True)

def set_plug_state(state: bool):
    t0 = time.time()
    try:
        res = plug.set_status(state)
        latency_ms = int((time.time() - t0) * 1000)
        status_txt = "ENCENDIDO [ON]" if state else "APAGADO [OFF]"
        print(f"⚡ [LAN {latency_ms}ms] Relé físico conmutado a: {status_txt} -> {res}")
        return True, latency_ms
    except Exception as e:
        print(f"⚠️ Error enviando comando local: {e}")
        # Intento de reconexión rápida de socket
        try:
            plug.set_socketPersistent(False)
            plug.set_status(state)
            plug.set_socketPersistent(True)
            return True, 30
        except Exception as e2:
            print(f"❌ Falló segundo intento: {e2}")
            return False, 0

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Conectado exitosamente al broker MQTT de Jarvis!")
        client.subscribe(TOPIC_POWER)
        client.subscribe(TOPIC_CMD)
        print(f"📡 Escuchando órdenes en: {TOPIC_POWER}")
        print(f"📡 Escuchando órdenes en: {TOPIC_CMD}")
        print("\n✨ ¡Listo! Prueba hacer clic en la web de Jarvis o hablarle por voz...")
    else:
        print(f"❌ Error al conectar a MQTT. Código: {rc}")

def on_message(client, userdata, msg):
    payload_str = msg.payload.decode('utf-8', errors='ignore').strip()
    print(f"\n📩 [Mensaje recibido en {msg.topic}]: {payload_str}")

    target_state = None

    # Si es JSON estructurado
    if payload_str.startswith("{"):
        try:
            data = json.loads(payload_str)
            if "state" in data:
                target_state = str(data["state"]).upper() in ("ON", "TRUE", "1")
            elif "dps" in data and "1" in data["dps"]:
                target_state = bool(data["dps"]["1"])
        except Exception:
            pass

    # Si es texto plano (ON / OFF)
    if target_state is None:
        target_state = payload_str.upper() == "ON"

    success, lat = set_plug_state(target_state)

    # Notificar estado de vuelta a Jarvis
    feedback = {
        "device": "GF-SMSOCKET",
        "state": "ON" if target_state else "OFF",
        "latency_ms": lat,
        "success": success,
        "source": "TuyaLocalBridge_PC"
    }
    client.publish(TOPIC_STATUS, json.dumps(feedback), qos=0)

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

try:
    print(f"🔗 Conectando a {MQTT_BROKER}:{MQTT_PORT}...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()
except KeyboardInterrupt:
    print("\n👋 Puente detenido por el usuario.")
except Exception as e:
    print(f"❌ Error crítico: {e}")
