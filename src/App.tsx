import React, { useState, useEffect, useCallback } from 'react';
import {
  DisplayMood,
  DisplayState,
  SensorData,
  RelayItem,
  SonoffDevice,
  IRCommandItem,
  HardwareHeartbeat,
  MdDocument,
  SystemEventLog,
  ChatMessage,
  FullHardwareState
} from './types';
import { St7735Display } from './components/St7735Display';
import { JarvisChat } from './components/JarvisChat';
import { HardwareDashboard } from './components/HardwareDashboard';
import { FirmwareAndWiring } from './components/FirmwareAndWiring';
import { DocumentsManager } from './components/DocumentsManager';
import { EventLogViewer } from './components/EventLogViewer';
import { MqttAndVoiceSettings } from './components/MqttAndVoiceSettings';
import {
  Cpu,
  Bot,
  Layers,
  FileText,
  Activity,
  Sliders,
  CheckCircle2,
  Wifi,
  Sparkles,
  Terminal,
  RefreshCw,
  Usb,
  Globe,
  Radio,
  Volume2,
  ExternalLink
} from 'lucide-react';
import { webSerial } from './utils/webSerial';
import { esp32Wifi, Esp32WifiTelemetry } from './utils/esp32Wifi';
import { jarvisMqtt, MqttTelemetryData } from './utils/jarvisMqtt';

export default function App() {
  const [activeTab, setActiveTab] = useState<'control' | 'firmware' | 'docs' | 'logs' | 'cloud_voice'>('control');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mqttConnected, setMqttConnected] = useState<boolean>(false);

  // Initial State Defaults
  const [display, setDisplay] = useState<DisplayState>({
    mood: 'NEUTRAL',
    message: 'JARVIS ONLINE\nESP32-S3 READY',
    updatedAt: new Date().toISOString()
  });

  const [sensors, setSensors] = useState<SensorData>({
    temperature: 23.2,
    humidity: 56.1,
    heatIndex: 23.8,
    updatedAt: new Date().toISOString(),
    source: 'DHT22 Físico @ GPIO 4'
  });

  const [sonoff, setSonoff] = useState<SonoffDevice>({
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
  });

  const [relays, setRelays] = useState<Record<string, RelayItem>>({
    velador: { id: 'velador', room: 'dormitorio', label: 'GRALF - Enchufe (Velador)', state: false, gpio: 0 }
  });

  const [irQueue, setIrQueue] = useState<IRCommandItem[]>([]);
  const [heartbeat, setHeartbeat] = useState<HardwareHeartbeat>({
    connected: true,
    lastPing: new Date().toISOString(),
    ip: '192.168.0.69',
    rssi: -54,
    chip: 'ESP32-S3-WROOM-1',
    freeHeap: 234120
  });

  const [documents, setDocuments] = useState<MdDocument[]>([]);
  const [logs, setLogs] = useState<SystemEventLog[]>([]);
  const [geminiConnected, setGeminiConnected] = useState(true);
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [usbIframeBlocked, setUsbIframeBlocked] = useState(false);

  // Wi-Fi Local ESP32 State
  const [espIp, setEspIp] = useState<string>(esp32Wifi.getIp() || '192.168.0.69');
  const [wifiOnline, setWifiOnline] = useState<boolean>(true);
  const [mixedContentWarning, setMixedContentWarning] = useState<boolean>(false);

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'jarvis',
      text: 'Buenos días, señor. Proyecto Jarvis en línea y sincronizado con el microcontrolador ESP32-S3. El display ST7735 de 0.96 pulgadas está configurado en el bus SPI y los sensores de telemetría responden con normalidad. ¿En qué puedo asistirle hoy?',
      timestamp: new Date().toISOString(),
      mood: 'NEUTRAL'
    }
  ]);

  // Hook Web Serial Telemetry
  useEffect(() => {
    const unsubTelem = webSerial.onTelemetry(data => {
      if (data.temperature !== undefined && data.humidity !== undefined) {
        setSensors(prev => ({
          ...prev,
          temperature: data.temperature!,
          humidity: data.humidity!,
          source: 'DHT22 Físico (USB COM3)',
          updatedAt: new Date().toISOString()
        }));

        // Sincronizar inmediatamente con el servidor Node.js
        fetch('/api/esp32/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: data.temperature,
            humidity: data.humidity,
            ip: data.ip
          })
        }).catch(() => {});
      }
      if (data.ip) {
        setHeartbeat(prev => ({ ...prev, ip: data.ip! }));
      }
    });

    return () => {
      unsubTelem();
    };
  }, []);

  // Hook Wi-Fi Local Direct Telemetry (ESP32 en cargador o red local)
  useEffect(() => {
    esp32Wifi.startAutoPoll(3500);
    const unsubWifi = esp32Wifi.onTelemetry((data: Esp32WifiTelemetry) => {
      if (data.temperature !== undefined && data.humidity !== undefined) {
        setSensors(prev => ({
          ...prev,
          temperature: data.temperature!,
          humidity: data.humidity!,
          source: `DHT22 Físico (Wi-Fi ${data.ip || espIp})`,
          updatedAt: new Date().toISOString()
        }));
      }
      if (data.online) {
        setWifiOnline(true);
        setHeartbeat(prev => ({ ...prev, ip: data.ip || espIp, connected: true }));
      }
      if (data.mixedContentBlocked) {
        setMixedContentWarning(true);
      }
    });

    return () => {
      unsubWifi();
      esp32Wifi.stopAutoPoll();
    };
  }, [espIp]);

  // Hook MQTT Cloud Telemetry & Status (Control fuera de casa 4G/5G)
  useEffect(() => {
    jarvisMqtt.connect();

    const unsubStatus = jarvisMqtt.onStatusChange((connected) => {
      setMqttConnected(connected);
    });

    const unsubTelem = jarvisMqtt.onTelemetry((data: MqttTelemetryData) => {
      if (data.temperature !== undefined && data.humidity !== undefined) {
        setSensors(prev => ({
          ...prev,
          temperature: data.temperature!,
          humidity: data.humidity!,
          source: 'DHT22 Físico (MQTT Cloud 4G)',
          updatedAt: data.updatedAt
        }));
      }
      if (data.ip) {
        setHeartbeat(prev => ({ ...prev, ip: data.ip!, connected: true }));
      }
    });

    const unsubPlug = jarvisMqtt.onPlugStateChange((state: boolean) => {
      setSonoff(prev => ({
        ...prev,
        state,
        updatedAt: new Date().toISOString()
      }));
    });

    return () => {
      unsubStatus();
      unsubTelem();
      unsubPlug();
    };
  }, []);

  const handleToggleUsb = async () => {
    setUsbError(null);
    setUsbIframeBlocked(false);
    if (usbConnected) {
      await webSerial.disconnect();
      setUsbConnected(false);
    } else {
      try {
        const res = await webSerial.connect();
        if (res.success) {
          setUsbConnected(true);
          webSerial.sendMood(display.mood, display.message);
        } else if (res.isIframe) {
          setUsbIframeBlocked(true);
          setUsbError('Web Serial no está disponible dentro del visor embebido (iframe) debido a la política de seguridad del navegador. Para enlazar directamente con el puerto USB COM3, abre la aplicación en una nueva pestaña.');
        } else if (res.cancelled) {
          // Usuario canceló el diálogo de selección de puerto, no mostrar alerta
        } else {
          setUsbError(res.error || 'No se pudo abrir COM3. Si PlatformIO Monitor está abierto en VS Code, presiona Ctrl+C en su terminal para liberar el puerto COM3.');
        }
      } catch (err: any) {
        setUsbError(err.message || 'Error al conectar por USB. Asegúrate de cerrar PlatformIO Monitor en VS Code.');
      }
    }
  };

  // Fetch full hardware state from server
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/hardware/state');
      if (res.ok) {
        const data: FullHardwareState = await res.json();
        setDisplay(data.display);
        setSensors(data.sensors);
        if (data.sonoff) setSonoff(data.sonoff);
        setRelays(data.relays);
        setIrQueue(data.irQueue);
        setHeartbeat(data.heartbeat);
        setDocuments(data.documents);
        setLogs(data.logs);
        setGeminiConnected(data.geminiConnected);
      }
    } catch (e) {
      console.error('Failed to poll hardware state:', e);
    }
  }, []);

  // Poll state every 3.5 seconds
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3500);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Send message to Jarvis (Gemini with function calling)
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-5)
        })
      });

      const data = await res.json();

      if (data.state) {
        if (data.state.display) {
          setDisplay(data.state.display);
          if (usbConnected) {
            webSerial.sendMood(data.state.display.mood, data.state.display.message);
          }
          // Envío inmediato por Wi-Fi Local al ESP32
          esp32Wifi.sendMood(data.state.display.mood, data.state.display.message);
        }
        if (data.state.sensors) setSensors(data.state.sensors);
        if (data.state.relays) setRelays(data.state.relays);
        if (data.state.irQueue) setIrQueue(data.state.irQueue);
      }

      const jarvisMsg: ChatMessage = {
        id: `jarvis-${Date.now()}`,
        sender: 'jarvis',
        text: data.reply || 'Orden procesada puntualmente, señor.',
        timestamp: new Date().toISOString(),
        mood: data.mood || display.mood,
        functionCalls: data.functionCalls
      };

      setMessages(prev => [...prev, jarvisMsg]);
      fetchState();
    } catch (e) {
      console.error(e);
      const errorMsg: ChatMessage = {
        id: `jarvis-err-${Date.now()}`,
        sender: 'jarvis',
        text: 'Mis disculpas, señor. He experimentado una interrupción temporal al sincronizar la orden.',
        timestamp: new Date().toISOString(),
        mood: 'ALERT'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct manual display test
  const handleMoodChange = async (mood: DisplayMood, message?: string) => {
    const msg = message || `MODO ${mood}\nSISTEMA NOMINAL`;
    setDisplay(prev => ({ ...prev, mood, message: msg }));

    // 1. Envío por USB Serial si está conectado a la PC
    if (usbConnected) {
      webSerial.sendMood(mood, msg);
    }

    // 2. Envío directo por Wi-Fi Local al ESP32 (http://192.168.0.69/mood)
    esp32Wifi.sendMood(mood, msg);

    // 3. Envío instantáneo por MQTT Cloud (Control remoto 4G fuera de casa)
    jarvisMqtt.sendMood(mood, msg);

    try {
      await fetch('/api/hardware/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, message: msg })
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle relay
  const handleToggleSonoff = async (nextState: boolean) => {
    // 1. Actualización optimista de UI
    setSonoff(prev => ({
      ...prev,
      state: nextState,
      updatedAt: new Date().toISOString()
    }));

    // 2. Canal USB Serial de ultra-baja latencia (si está conectado al puerto COM)
    if (usbConnected) {
      webSerial.sendVelador(nextState);
    }

    // 3. Canal Wi-Fi Local directo al ESP32 (http://192.168.0.69/velador?state=1)
    esp32Wifi.sendVelador(nextState);

    // 4. Canal MQTT Cloud (broker.hivemq.com)
    jarvisMqtt.sendSonoffPower(sonoff.mqttTopic, nextState);

    // 5. Servidor Central (para que el bucle de sondeo HTTP poll del ESP32 también lo detecte)
    try {
      await fetch('/api/hardware/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: nextState })
      });
      fetchState();
    } catch (e) {
      console.error('Error enviando conmutación a Sonoff:', e);
    }
  };

  const handleUpdateSonoffConfig = async (
    topic: string,
    ip: string,
    mode: 'SMARTLIFE_CLOUD' | 'TUYA_LOCAL' | 'MQTT' | 'WEBHOOK',
    deviceId?: string,
    localKey?: string,
    webhookUrl?: string,
    version?: '3.4' | '3.3' | '3.1'
  ) => {
    setSonoff(prev => ({
      ...prev,
      mqttTopic: topic,
      ip,
      mode,
      deviceId: deviceId ?? prev.deviceId,
      localKey: localKey ?? prev.localKey,
      webhookUrl: webhookUrl ?? prev.webhookUrl,
      version: version ?? prev.version ?? '3.4',
      updatedAt: new Date().toISOString()
    }));

    try {
      await fetch('/api/hardware/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mqttTopic: topic, ip, mode, deviceId, localKey, webhookUrl, version: version || '3.4' })
      });
      fetchState();
    } catch (e) {
      console.error('Error actualizando configuración de enchufe:', e);
    }
  };

  const handleToggleRelay = async (id: string, state: boolean) => {
    setRelays(prev => ({
      ...prev,
      [id]: { ...prev[id], state }
    }));

    // 1. Envío por USB Serial si está conectado
    const targetGpio = relays[id]?.gpio ?? 15;
    if (usbConnected) {
      webSerial.sendRelay(targetGpio, state);
    }

    // 2. Envío directo por Wi-Fi Local al ESP32 (http://192.168.0.69/relay)
    esp32Wifi.sendRelay(targetGpio, state);

    // 3. Envío instantáneo por MQTT Cloud (Control remoto 4G fuera de casa)
    jarvisMqtt.sendRelay(targetGpio, state);

    try {
      await fetch('/api/hardware/relays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, state })
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  // Update sensor simulation
  const handleUpdateSensors = async (temperature: number, humidity: number) => {
    try {
      await fetch('/api/hardware/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature, humidity })
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  // Send IR command
  const handleSendIR = async (device: string, command: string) => {
    try {
      await fetch('/api/hardware/ir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, command })
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  // Document management
  const handleSaveDocument = async (filename: string, content: string) => {
    try {
      await fetch('/api/hardware/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'write', filename, content })
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDocument = async (filename: string) => {
    try {
      await fetch('/api/hardware/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', filename })
      });
      fetchState();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/10">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                PROYECTO JARVIS
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  ESP32-S3 Hardware Hub
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Integración física con microcontroladores, display ST7735 y orquestación con Gemini
            </p>
          </div>
        </div>

        {/* Global Hardware & Cloud Telemetry Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* ESP32 Local Wi-Fi Badge */}
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center gap-2 text-slate-300">
            <div className={`w-2 h-2 rounded-full ${wifiOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <button
              type="button"
              onClick={() => {
                const newIp = prompt('Ingresa la dirección IP de tu ESP32 en tu red Wi-Fi:', espIp);
                if (newIp && newIp.trim()) {
                  esp32Wifi.setIp(newIp.trim());
                  setEspIp(newIp.trim());
                }
              }}
              title="Haz clic para cambiar la IP si tu router asignó otra"
              className="text-cyan-300 font-bold hover:underline cursor-pointer"
            >
              {espIp}
            </button>
            <a
              href={`http://${espIp}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir panel web local directo del ESP32 en una pestaña"
              className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
            >
              Abrir ↗
            </a>
          </div>

          {/* MQTT Cloud 4G Badge */}
          <button
            type="button"
            onClick={() => setActiveTab('cloud_voice')}
            title="Estado del broker MQTT (Control desde fuera de casa con 4G). Haz clic para configurar o probar."
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              mqttConnected
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20 font-bold'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${mqttConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{mqttConnected ? 'MQTT 4G ON' : 'MQTT 4G'}</span>
          </button>

          {/* USB Direct Web Serial Button */}
          <button
            type="button"
            onClick={handleToggleUsb}
            title={usbConnected ? "Desconectar USB (COM3)" : "Conectar directamente por USB (COM3) para control en tiempo real"}
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              usbConnected
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20 font-bold'
                : 'bg-slate-900 border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300'
            }`}
          >
            {usbConnected ? (
              <>
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <Usb className="w-3.5 h-3.5 text-cyan-400" />
                <span>USB COM3</span>
              </>
            ) : (
              <>
                <Usb className="w-3.5 h-3.5 text-slate-400" />
                <span>CONECTAR USB</span>
              </>
            )}
          </button>

          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Node.js</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gemini FC</span>
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              await fetchState();
              await esp32Wifi.checkHealth();
              setTimeout(() => setIsRefreshing(false), 600);
            }}
            title="Sincronizar telemetría"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Navigation Sub-bar */}
      <nav className="border-b border-slate-800/80 bg-slate-900/40 px-4 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('control')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
              activeTab === 'control'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Centro de Mando & ST7735</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cloud_voice')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
              activeTab === 'cloud_voice'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Control Remoto 4G & Voz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('firmware')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
              activeTab === 'firmware'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Cableado Pinout & Firmware C++</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
              activeTab === 'docs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos Markdown (/data)</span>
            <span className="text-[10px] px-1.5 rounded-full bg-slate-800 text-slate-300">
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold ${
              activeTab === 'logs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Telemetría & Eventos</span>
            <span className="text-[10px] px-1.5 rounded-full bg-slate-800 text-slate-300">
              {logs.length}
            </span>
          </button>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* USB Warning/Alert Banner */}
        {usbError && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-start justify-between gap-3 shadow-lg">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4 text-amber-400 shrink-0" />
                <strong className="text-amber-300">
                  {usbIframeBlocked ? 'Web Serial restringido en el visor integrado (iframe)' : 'Aviso sobre puerto USB (COM3):'}
                </strong>
              </div>
              <p className="leading-relaxed">{usbError}</p>
              {usbIframeBlocked ? (
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-semibold text-xs transition-colors shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir en pestaña nueva para conectar USB
                  </a>
                  <span className="text-[11px] text-slate-400">
                    O controla el ESP32 directamente por Wi-Fi ({espIp || '192.168.0.69'}) sin necesidad de cable USB.
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-amber-300/80">
                  En Windows los puertos COM son exclusivos. Si en VS Code tienes el <strong>Monitor Serie (PlatformIO)</strong> abierto, haz clic en la terminal de VS Code y presiona <strong>Ctrl + C</strong> para cerrarlo. Luego pulsa de nuevo <strong>[CONECTAR USB]</strong>.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setUsbError(null);
                setUsbIframeBlocked(false);
              }}
              className="text-amber-400 hover:text-white px-2 py-1 rounded bg-amber-900/50 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Wi-Fi Direct Status Banner */}
        {mixedContentWarning && (
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex items-start justify-between gap-3 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <strong className="text-cyan-300">ESP32 Conectado por Wi-Fi Local ({espIp}):</strong>
              </div>
              <p className="text-slate-300">
                Las órdenes de expresiones faciales y relés se transmiten directamente al ESP32 por tu red local. Para que Chrome también permita recibir la telemetría en vivo del DHT22 sin restricciones de contenido mixto:
              </p>
              <p className="text-[11px] text-cyan-300/80">
                Haz clic en el icono de <strong>ajustes/candado</strong> a la izquierda de la URL de esta página en Chrome ➔ <strong>Configuración del sitio</strong> ➔ Busca <strong>Contenido no seguro</strong> y cámbialo a <strong>Permitir</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMixedContentWarning(false)}
              className="text-cyan-400 hover:text-white px-2 py-1 rounded bg-cyan-900/50 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: Command Center & ST7735 */}
        {activeTab === 'control' && (
          <div className="space-y-6">
            {/* Top Row: ST7735 Hardware Twin + Jarvis Chat Terminal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* ST7735 Hardware Twin Screen (4 cols on lg) */}
              <div className="lg:col-span-4 flex flex-col items-center justify-start bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs font-mono text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-bold">RÉPLICA FÍSICA ST7735</span>
                  </div>
                  <span className="text-slate-500">80x160 RGB IPS</span>
                </div>

                <St7735Display
                  mood={display.mood}
                  message={display.message}
                  onMoodChange={handleMoodChange}
                />

                <div className="mt-4 w-full p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Estado Facial:</span>
                    <strong className="text-cyan-300">[{display.mood}]</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Mensaje ST7735:</span>
                    <span className="text-slate-200 truncate max-w-[170px]">
                      {display.message.replace('\n', ' / ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Controlador:</span>
                    <span className="text-slate-400">SPI FSPI (GPIO 8..12)</span>
                  </div>
                </div>
              </div>

              {/* Conversational Terminal with Function Calling (8 cols on lg) */}
              <div className="lg:col-span-8 h-[580px]">
                <JarvisChat
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  currentMood={display.mood}
                />
              </div>
            </div>

            {/* Bottom Row: Hardware Peripherals Dashboard (Real Sonoff Velador + Physical DHT22) */}
            <HardwareDashboard
              sonoff={sonoff}
              sensors={sensors}
              heartbeat={heartbeat}
              onToggleSonoff={handleToggleSonoff}
              onUpdateSonoffConfig={handleUpdateSonoffConfig}
              onUpdateSensors={handleUpdateSensors}
            />
          </div>
        )}

        {/* TAB 2: Control Remoto Nube MQTT & Voz */}
        {activeTab === 'cloud_voice' && (
          <MqttAndVoiceSettings onSendTestMood={handleMoodChange} />
        )}

        {/* TAB 3: Firmware & Pinout Matrix */}
        {activeTab === 'firmware' && (
          <FirmwareAndWiring serverUrl="http://192.168.1.100:3000" />
        )}

        {/* TAB 3: Markdown Documents Manager */}
        {activeTab === 'docs' && (
          <DocumentsManager
            documents={documents}
            onSaveDocument={handleSaveDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        )}

        {/* TAB 4: Telemetry & Event Logs */}
        {activeTab === 'logs' && (
          <EventLogViewer logs={logs} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 lg:px-8 py-3 text-center text-xs text-slate-600 font-mono">
        Proyecto Jarvis — Puente Node.js Express &bull; Google AI Studio &bull; Microcontrolador ESP32-S3 &bull; Pantalla ST7735 SPI
      </footer>
    </div>
  );
}
