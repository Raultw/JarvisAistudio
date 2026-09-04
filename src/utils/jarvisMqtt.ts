/**
 * Jarvis MQTT Cloud Client (WebSockets over TLS)
 * Permite controlar el ESP32 desde fuera de casa (4G/5G) con latencia ultrabaja (<50ms).
 */
import mqtt, { MqttClient } from 'mqtt';

export interface MqttTelemetryData {
  temperature?: number;
  humidity?: number;
  ip?: string;
  rssi?: number;
  freeHeap?: number;
  updatedAt: string;
}

export interface MqttConfig {
  brokerUrl: string; // e.g. wss://broker.hivemq.com:8884/mqtt or wss://broker.emqx.io:8084/mqtt
  esp32BrokerHost: string; // e.g. broker.hivemq.com
  esp32BrokerPort: number; // e.g. 1883
  topicPrefix: string; // e.g. jarvis_raul
}

const DEFAULT_CONFIG: MqttConfig = {
  brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
  esp32BrokerHost: 'broker.hivemq.com',
  esp32BrokerPort: 1883,
  topicPrefix: 'jarvis_raul_s3'
};

class JarvisMqttManager {
  private client: MqttClient | null = null;
  private config: MqttConfig;
  private isConnected: boolean = false;
  private listeners: ((telemetry: MqttTelemetryData) => void)[] = [];
  private statusListeners: ((connected: boolean) => void)[] = [];
  private plugListeners: ((state: boolean, meta?: any) => void)[] = [];

  constructor() {
    const saved = localStorage.getItem('jarvis_mqtt_config');
    if (saved) {
      try {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch {
        this.config = DEFAULT_CONFIG;
      }
    } else {
      this.config = DEFAULT_CONFIG;
    }
  }

  getConfig(): MqttConfig {
    return { ...this.config };
  }

  saveConfig(newConfig: Partial<MqttConfig>) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('jarvis_mqtt_config', JSON.stringify(this.config));
    this.reconnect();
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  connect() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {}
    }

    try {
      const clientId = `jarvis_web_${Math.random().toString(16).substring(2, 8)}`;
      this.client = mqtt.connect(this.config.brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.notifyStatus(true);

        // Suscribirse a la telemetría del ESP32 y estado del enchufe
        const telemetryTopic = `${this.config.topicPrefix}/telemetry`;
        const statusTopic = `${this.config.topicPrefix}/status`;
        const veladorStateTopic = `${this.config.topicPrefix}/velador/state`;
        this.client?.subscribe([telemetryTopic, statusTopic, veladorStateTopic], (err) => {
          if (!err) {
            console.log(`[MQTT] Suscrito con éxito a telemetría y velador/state`);
          }
        });
      });

      this.client.on('message', (topic: string, message: Buffer) => {
        try {
          const payloadStr = message.toString();
          const data = JSON.parse(payloadStr);

          if (topic.endsWith('/telemetry')) {
            const telemetry: MqttTelemetryData = {
              temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
              humidity: typeof data.humidity === 'number' ? data.humidity : undefined,
              ip: data.ip,
              rssi: data.rssi,
              freeHeap: data.freeHeap,
              updatedAt: new Date().toISOString()
            };
            this.notifyTelemetry(telemetry);
          } else if (topic.endsWith('/velador/state')) {
            const stateBool = data.state === 'ON' || data.state === true;
            this.notifyPlugState(stateBool, data);
          }
        } catch (e) {
          console.warn('[MQTT] Error parseando mensaje entrante:', e);
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.notifyStatus(false);
      });

      this.client.on('error', (err) => {
        console.warn('[MQTT] Error en cliente:', err);
        this.isConnected = false;
        this.notifyStatus(false);
      });
    } catch (e) {
      console.error('[MQTT] Fallo al inicializar cliente:', e);
      this.isConnected = false;
      this.notifyStatus(false);
    }
  }

  reconnect() {
    this.connect();
  }

  /**
   * Envía cambio de estado/expresión facial al ESP32 por MQTT
   */
  sendMood(mood: string, message: string): boolean {
    if (!this.client || !this.isConnected) {
      return false;
    }
    const topic = `${this.config.topicPrefix}/cmd`;
    const payload = JSON.stringify({
      action: 'mood',
      mood,
      message,
      timestamp: Date.now()
    });
    this.client.publish(topic, payload, { qos: 0 });
    return true;
  }

  /**
   * Envía orden de relé inteligente al ESP32 por MQTT
   */
  sendRelay(gpio: number, state: boolean): boolean {
    if (!this.client || !this.isConnected) {
      return false;
    }
    const topic = `${this.config.topicPrefix}/cmd`;
    const payload = JSON.stringify({
      action: 'relay',
      gpio,
      state: state ? 1 : 0,
      timestamp: Date.now()
    });
    this.client.publish(topic, payload, { qos: 0 });
    return true;
  }

  /**
   * Envía comando de encendido/apagado directo al enchufe GF-SMSOCKET (Smart Life / Tuya o ESP32 Bridge)
   */
  sendSonoffPower(customTopic?: string, state: boolean = false): boolean {
    if (!this.client || !this.isConnected) {
      return false;
    }
    // Tópico estándar de control del velador y puente Smart Life / Tuya
    const targetTopic = customTopic || `${this.config.topicPrefix}/velador/power`;
    const payload = state ? 'ON' : 'OFF';
    
    // 1. Publicación directa en tópico principal de potencia
    this.client.publish(targetTopic, payload, { qos: 0 });
    
    // 2. Publicación en tópico de GF-SMSOCKET
    this.client.publish(`${this.config.topicPrefix}/gf_smsocket/power`, payload, { qos: 0 });

    // 3. Notificación estructurada en tópico general de comandos y tópico Tuya
    const tuyaCommandPayload = {
      action: 'smart_plug',
      device: 'velador',
      model: 'GF-SMSOCKET',
      ecosystem: 'Smart Life / Tuya',
      protocol: 'Tuya_v3.4',
      ip: '192.168.0.28',
      deviceId: 'ebd1e90786fec509a8pngp',
      localKey: 'PvCBXhovwQg!Dq+*',
      port: 6668,
      dps: { '1': state },
      state: state ? 'ON' : 'OFF',
      timestamp: Date.now()
    };

    this.client.publish(`${this.config.topicPrefix}/tuya/command`, JSON.stringify(tuyaCommandPayload), { qos: 0 });
    this.client.publish(`${this.config.topicPrefix}/cmd`, JSON.stringify(tuyaCommandPayload), { qos: 0 });

    return true;
  }

  onTelemetry(cb: (t: MqttTelemetryData) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  onStatusChange(cb: (connected: boolean) => void): () => void {
    this.statusListeners.push(cb);
    cb(this.isConnected);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  onPlugStateChange(cb: (state: boolean, meta?: any) => void): () => void {
    this.plugListeners.push(cb);
    return () => {
      this.plugListeners = this.plugListeners.filter(l => l !== cb);
    };
  }

  private notifyTelemetry(t: MqttTelemetryData) {
    this.listeners.forEach(cb => cb(t));
  }

  private notifyStatus(c: boolean) {
    this.statusListeners.forEach(cb => cb(c));
  }

  private notifyPlugState(state: boolean, meta?: any) {
    this.plugListeners.forEach(cb => cb(state, meta));
  }
}

export const jarvisMqtt = new JarvisMqttManager();
