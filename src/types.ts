export type DisplayMood = 'NEUTRAL' | 'THINKING' | 'HAPPY' | 'ALERT' | 'SLEEPING' | 'SARCASTIC';

export interface DisplayState {
  mood: DisplayMood;
  message: string;
  updatedAt: string;
}

export interface SensorData {
  temperature: number;
  humidity: number;
  heatIndex: number;
  updatedAt: string;
  source: string;
}

export interface RelayItem {
  id: string;
  room: string;
  label: string;
  state: boolean;
  gpio: number;
}

export interface SonoffDevice {
  id: string;
  name: string;
  model: string;
  ecosystem: 'Smart Life / Tuya' | 'Sonoff / eWeLink';
  state: boolean;
  ip: string;
  deviceId?: string;
  localKey?: string;
  webhookUrl?: string;
  mqttTopic: string;
  version?: '3.4' | '3.3' | '3.1';
  mode: 'SMARTLIFE_CLOUD' | 'TUYA_LOCAL' | 'MQTT' | 'WEBHOOK';
  updatedAt: string;
}

export interface IRCommandItem {
  id: string;
  device: string;
  command: string;
  protocol?: string;
  hexCode?: string;
  timestamp: string;
  executed: boolean;
}

export interface HardwareHeartbeat {
  connected: boolean;
  lastPing: string | null;
  ip: string;
  rssi: number;
  chip: string;
  freeHeap: number;
}

export interface MdDocument {
  filename: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface SystemEventLog {
  id: string;
  timestamp: string;
  source: 'GEMINI_FUNCTION' | 'ESP32_TELEMETRY' | 'USER_ACTION' | 'SYSTEM' | 'TUYA_LOCAL';
  title: string;
  details: string;
  meta?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'jarvis' | 'system';
  text: string;
  timestamp: string;
  mood?: DisplayMood;
  functionCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export interface FullHardwareState {
  display: DisplayState;
  sensors: SensorData;
  sonoff?: SonoffDevice;
  relays: Record<string, RelayItem>;
  irQueue: IRCommandItem[];
  heartbeat: HardwareHeartbeat;
  documents: MdDocument[];
  logs: SystemEventLog[];
  geminiConnected: boolean;
}
