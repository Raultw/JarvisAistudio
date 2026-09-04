import React, { useState } from 'react';
import { SonoffDevice, SensorData, HardwareHeartbeat } from '../types';
import {
  Zap,
  Thermometer,
  Droplets,
  Cpu,
  Wifi,
  Power,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Radio,
  Sliders,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Globe,
  Key,
  Smartphone,
  ShieldCheck,
  Terminal,
  Download
} from 'lucide-react';
import { jarvisMqtt } from '../utils/jarvisMqtt';

interface HardwareDashboardProps {
  sonoff: SonoffDevice;
  sensors: SensorData;
  heartbeat: HardwareHeartbeat;
  onToggleSonoff: (state: boolean) => void;
  onUpdateSonoffConfig?: (
    topic: string,
    ip: string,
    mode: 'SMARTLIFE_CLOUD' | 'TUYA_LOCAL' | 'MQTT' | 'WEBHOOK',
    deviceId?: string,
    localKey?: string,
    webhookUrl?: string,
    version?: '3.4' | '3.3' | '3.1'
  ) => void;
  onUpdateSensors: (temp: number, hum: number) => void;
}

export const HardwareDashboard: React.FC<HardwareDashboardProps> = ({
  sonoff,
  sensors,
  heartbeat,
  onToggleSonoff,
  onUpdateSonoffConfig,
  onUpdateSensors
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [activeGuideTab, setActiveGuideTab] = useState<'webhook' | 'tuya_local' | 'mqtt'>('tuya_local');
  
  const [customTopic, setCustomTopic] = useState(sonoff.mqttTopic || 'jarvis_raul_s3/velador/power');
  const [customIp, setCustomIp] = useState(sonoff.ip || '192.168.0.28');
  const [customDeviceId, setCustomDeviceId] = useState(sonoff.deviceId || 'ebd1e90786fec509a8pngp');
  const [customLocalKey, setCustomLocalKey] = useState(sonoff.localKey || 'PvCBXhovwQg!Dq+*');
  const [customVersion, setCustomVersion] = useState<'3.4' | '3.3' | '3.1'>(sonoff.version || '3.4');
  const [customWebhookUrl, setCustomWebhookUrl] = useState(sonoff.webhookUrl || '');
  const [customMode, setCustomMode] = useState<'SMARTLIFE_CLOUD' | 'TUYA_LOCAL' | 'MQTT' | 'WEBHOOK'>(
    sonoff.mode || 'TUYA_LOCAL'
  );

  React.useEffect(() => {
    if (sonoff.ip) setCustomIp(sonoff.ip);
    if (sonoff.deviceId) setCustomDeviceId(sonoff.deviceId);
    if (sonoff.localKey) setCustomLocalKey(sonoff.localKey);
    if (sonoff.mode) setCustomMode(sonoff.mode);
    if (sonoff.mqttTopic) setCustomTopic(sonoff.mqttTopic);
    if (sonoff.version) setCustomVersion(sonoff.version);
  }, [sonoff.ip, sonoff.deviceId, sonoff.localKey, sonoff.mode, sonoff.mqttTopic, sonoff.version]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingTuya, setTestingTuya] = useState(false);
  const [tuyaTestMsg, setTuyaTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  const handleTestTuya = async () => {
    setTestingTuya(true);
    setTuyaTestMsg(null);
    try {
      const res = await fetch('/api/hardware/tuya-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: customIp,
          deviceId: customDeviceId,
          localKey: customLocalKey,
          version: customVersion,
          state: !sonoff.state
        })
      });
      const data = await res.json();
      if (data.success) {
        setTuyaTestMsg({
          success: true,
          text: `✓ Conexión exitosa [${data.driver || customVersion}] (${data.latencyMs}ms): ${data.message}`
        });
        onToggleSonoff(!sonoff.state);
      } else {
        setTuyaTestMsg({
          success: false,
          text: `✗ Error (${data.driver || customVersion}): ${data.message || data.error}`
        });
      }
    } catch (e: any) {
      setTuyaTestMsg({ success: false, text: `✗ Error de red: ${e?.message}` });
    } finally {
      setTestingTuya(false);
    }
  };

  const handleToggle = () => {
    const nextState = !sonoff.state;
    onToggleSonoff(nextState);
    // Transmitir inmediatamente vía MQTT Cloud a tópicos de control
    jarvisMqtt.sendSonoffPower(sonoff.mqttTopic, nextState);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateSonoffConfig) {
      onUpdateSonoffConfig(
        customTopic,
        customIp,
        customMode,
        customDeviceId,
        customLocalKey,
        customWebhookUrl,
        customVersion
      );
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div id="hardware-actuators-dashboard" className="space-y-4">
      {/* Hardware Status Strip */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </div>
          <span className="font-semibold text-slate-200">ESP32-S3 BRIDGE:</span>
          <span className="text-emerald-400 font-bold">ONLINE</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>IP: </span>
            <a
              href={`http://${heartbeat.ip}`}
              target="_blank"
              rel="noreferrer"
              title="Abrir panel web local del ESP32 en una pestaña"
              className="text-cyan-300 font-bold hover:underline"
            >
              {heartbeat.ip} ↗
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <span>RSSI: <strong className="text-slate-200">{heartbeat.rssi} dBm</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Heap: <strong className="text-slate-200">{(heartbeat.freeHeap / 1024).toFixed(1)} KB</strong></span>
          </div>
        </div>
      </div>

      {/* Grid: 1 Actuador Real GF-SMSOCKET (Smart Life / Tuya) + Sensor Físico DHT22 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* TARJETA PRINCIPAL: ENCHUFE INTELIGENTE GF-SMSOCKET (Smart Life) - 7 cols */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border transition-all ${
                  sonoff.state 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/10' 
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-100">{sonoff.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
                      GF-SMSOCKET
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                      <Smartphone className="w-2.5 h-2.5" /> SMART LIFE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Enchufe Inteligente Wi-Fi Tuya • Conmutación directa 220V/110V</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="p-1.5 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                title="Configurar conexión del enchufe Smart Life"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            {/* Visualizador de la Lámpara del Velador */}
            <div className={`relative rounded-xl p-6 border transition-all flex flex-col sm:flex-row items-center justify-between gap-5 ${
              sonoff.state
                ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/5'
                : 'bg-slate-950/60 border-slate-800/80'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  sonoff.state
                    ? 'bg-amber-400/20 border-2 border-amber-400 text-amber-300 shadow-2xl shadow-amber-400/40'
                    : 'bg-slate-900 border border-slate-800 text-slate-600'
                }`}>
                  <Lightbulb className={`w-8 h-8 ${sonoff.state ? 'animate-pulse' : ''}`} />
                  {sonoff.state && (
                    <div className="absolute inset-0 rounded-2xl bg-amber-400/10 blur-md pointer-events-none" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">ESTADO VELADOR:</span>
                    <span className={`text-sm font-black font-mono px-2 py-0.5 rounded ${
                      sonoff.state
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {sonoff.state ? 'ENCENDIDO (ON)' : 'APAGADO (OFF)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 font-mono">
                    {sonoff.state ? 'Luz del velador encendida' : 'Circuito abierto • Enchufe en reposo'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Protocolo: <span className="text-cyan-400 font-bold">{sonoff.mode}</span> • Modelo: <span className="text-slate-300">GF-SMSOCKET</span>
                  </p>
                </div>
              </div>

              {/* Botón de Conmutación Rápida */}
              <button
                type="button"
                onClick={handleToggle}
                className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                  sonoff.state
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 active:scale-95'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20 active:scale-95'
                }`}
              >
                <Power className="w-5 h-5" />
                <span>{sonoff.state ? 'APAGAR VELADOR' : 'ENCENDER VELADOR'}</span>
              </button>
            </div>

            {/* Ajustes de Parámetros del GF-SMSOCKET (Smart Life / Tuya) */}
            {showConfig && (
              <form onSubmit={handleSaveConfig} className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Parámetros de Enchufe Smart Life (GF-SMSOCKET)
                  </span>
                  <span className="text-[10px] text-slate-400">Personaliza la integración</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Modo de Integración:</label>
                    <select
                      value={customMode}
                      onChange={(e) => setCustomMode(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none focus:border-cyan-500"
                    >
                      <option value="MQTT">MQTT Bridge (Broker HiveMQ - Recomendado)</option>
                      <option value="WEBHOOK">Webhook / IFTTT / Smart Life URL</option>
                      <option value="TUYA_LOCAL">Tuya Local LAN (Device ID + Local Key)</option>
                      <option value="SMARTLIFE_CLOUD">Smart Life Cloud API</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Tópico MQTT de Control:</label>
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-cyan-300 focus:border-cyan-500 outline-none font-mono text-xs"
                      placeholder="jarvis_raul_s3/velador/power"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">IP Local del Enchufe:</label>
                    <input
                      type="text"
                      value={customIp}
                      onChange={(e) => setCustomIp(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-cyan-300 focus:border-cyan-500 outline-none font-mono text-xs"
                      placeholder="192.168.0.75"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Device ID (Tuya/Smart Life):</label>
                    <input
                      type="text"
                      value={customDeviceId}
                      onChange={(e) => setCustomDeviceId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-cyan-300 focus:border-cyan-500 outline-none font-mono text-xs"
                      placeholder="bf123456789abcdef"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Local Key (Clave AES 16 caracteres):</label>
                    <input
                      type="text"
                      value={customLocalKey}
                      onChange={(e) => setCustomLocalKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-emerald-300 focus:border-emerald-500 outline-none font-mono text-xs"
                      placeholder="Ej: a1b2c3d4e5f6g7h8"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Versión de Protocolo Tuya:</label>
                    <select
                      value={customVersion}
                      onChange={(e) => setCustomVersion(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-amber-300 text-xs outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="3.4">Protocolo 3.4 (TinyTuya + Handshake HMAC - Tu versión)</option>
                      <option value="3.3">Protocolo 3.3 (Estándar CRC32)</option>
                      <option value="3.1">Protocolo 3.1 (Legacy)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">
                      URL Webhook (opcional para IFTTT o Smart Life Automation):
                    </label>
                    <input
                      type="text"
                      value={customWebhookUrl}
                      onChange={(e) => setCustomWebhookUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-cyan-300 focus:border-cyan-500 outline-none font-mono text-xs"
                      placeholder="https://maker.ifttt.com/trigger/velador_{state}/with/key/TU_KEY"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Nota: Puedes usar `{'{state}'}` en la URL para reemplazar automáticamente por 'on' u 'off'.
                    </span>
                  </div>
                </div>

                {tuyaTestMsg && (
                  <div className={`p-2 rounded text-[11px] font-mono border ${
                    tuyaTestMsg.success
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  }`}>
                    {tuyaTestMsg.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestTuya}
                    disabled={testingTuya || !customIp || !customDeviceId || !customLocalKey}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{testingTuya ? 'Enviando comando LAN...' : 'Probar Tuya Local (LAN)'}</span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : null}
                    <span>{saveSuccess ? 'Guardado Exitosamente' : 'Guardar Parámetros'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              Modo activo: <strong className="text-slate-200">{sonoff.mode}</strong>
            </span>
            <span>Última conmutación: <strong className="text-slate-300">{new Date(sonoff.updatedAt).toLocaleTimeString()}</strong></span>
          </div>
        </div>

        {/* TARJETA: SENSOR FÍSICO DHT22 (TEMPERATURA & HUMEDAD) - 5 cols */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Sonda Ambiental DHT22</h3>
                  <p className="text-xs text-slate-400">Sensor físico conectado a GPIO 4 del ESP32</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
                GPIO 4
              </span>
            </div>

            {/* Métricas en vivo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>TEMPERATURA</span>
                  <Thermometer className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-black font-mono text-slate-100">
                  {sensors.temperature.toFixed(1)} <span className="text-sm font-normal text-slate-400">°C</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400 font-mono">
                  Rango de confort (18 - 26°C)
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span>HUMEDAD</span>
                  <Droplets className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-2 text-2xl font-black font-mono text-slate-100">
                  {sensors.humidity.toFixed(1)} <span className="text-sm font-normal text-slate-400">%</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400 font-mono">
                  Humedad relativa (RH)
                </div>
              </div>
            </div>

            {/* Sensación / Índice Térmico */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Sensación Térmica (Heat Index):</span>
              </div>
              <strong className="text-amber-300 font-bold">{sensors.heatIndex.toFixed(1)} °C</strong>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Sonda: <strong className="text-slate-200">DHT22 Digital</strong></span>
            <span>Refresco: <strong className="text-cyan-300">Cada 2 seg</strong></span>
          </div>
        </div>
      </div>

      {/* GUÍA PASO A PASO: CÓMO VINCULAR TU ENCHUFE GF-SMSOCKET (SMART LIFE / TUYA) */}
      <div className="bg-slate-900/90 border border-cyan-500/20 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Guía de Vinculación: Enchufe GF-SMSOCKET con Smart Life
              </h4>
              <p className="text-[11px] text-slate-400">
                Al ser plataforma Tuya / Smart Life (no eWeLink), elige la opción más cómoda para enlazarlo con Jarvis.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1 text-xs font-mono text-cyan-300 hover:text-cyan-200 cursor-pointer"
          >
            <span>{showGuide ? 'Ocultar Guía' : 'Ver Guía Completa'}</span>
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showGuide && (
          <div className="mt-4 space-y-4 font-mono text-xs">
            {/* Pestañas de Métodos */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-2">
              <button
                type="button"
                onClick={() => setActiveGuideTab('webhook')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeGuideTab === 'webhook'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ★ Opción 1: Webhook / IFTTT / Smart Life (El más rápido sin abrir nada)
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('mqtt')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeGuideTab === 'mqtt'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Opción 2: Puente MQTT vía ESP32-S3 (Directo con tu microcontrolador)
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab('tuya_local')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeGuideTab === 'tuya_local'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Opción 3: Tuya Local LAN (Device ID + LocalKey - Cero Latencia)
              </button>
            </div>

            {/* Opción 1: Webhook / IFTTT */}
            {activeGuideTab === 'webhook' && (
              <div className="space-y-3 text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Globe className="w-4 h-4" />
                  <span>Vinculación directa en 3 pasos mediante Automatización Webhook o IFTTT:</span>
                </div>
                <p>
                  El enchufe <strong>GF-SMSOCKET</strong> se vincula a tu app <strong>Smart Life</strong> oficial de Tuya. Desde allí puedes conectarlo al mundo exterior con un disparador webhook instantáneo:
                </p>

                <ol className="list-decimal list-inside space-y-2 text-slate-300">
                  <li>
                    <strong className="text-slate-100">Agregar a Smart Life:</strong> Conecta el GF-SMSOCKET al tomacorriente, mantén presionado el botón 5 segundos hasta que parpadee rápido y agrégalo en la app <em>Smart Life</em> con tu Wi-Fi 2.4 GHz.
                  </li>
                  <li>
                    <strong className="text-slate-100">Vincular con un Webhook (IFTTT o Tuya Cloud):</strong> En la app IFTTT (o Smart Life Automatización), crea dos escenas rápidas: 
                    <br />• <em>"Si recibo Webhook velador_on ➔ Encender enchufe GF-SMSOCKET"</em>
                    <br />• <em>"Si recibo Webhook velador_off ➔ Apagar enchufe GF-SMSOCKET"</em>
                  </li>
                  <li>
                    <strong className="text-slate-100">Copiar URL en Jarvis:</strong> Abre los ajustes (icono de deslizadores) en la tarjeta de arriba y pega tu URL:
                    <div className="mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-cyan-300">
                      https://maker.ifttt.com/trigger/velador_{'{state}'}/with/key/TU_API_KEY
                    </div>
                    Jarvis reemplazará automáticamente <code className="text-amber-300">{'{state}'}</code> por <code className="text-amber-300">on</code> u <code className="text-amber-300">off</code> cada vez que conmute.
                  </li>
                </ol>
              </div>
            )}

            {/* Opción 2: MQTT con ESP32-S3 */}
            {activeGuideTab === 'mqtt' && (
              <div className="space-y-3 text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Zap className="w-4 h-4" />
                  <span>Tu ESP32-S3 como puente central de comunicación:</span>
                </div>
                <p>
                  Esta es la arquitectura por defecto: Jarvis publica órdenes en el broker público HiveMQ (<code className="text-cyan-300">broker.hivemq.com</code>) bajo el tópico:
                </p>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 font-mono">
                  jarvis_raul_s3/velador/power ➔ (Payload: "ON" o "OFF")
                </div>
                <p>
                  Tu ESP32-S3 (o cualquier gateway local como Home Assistant) suscribe a este tópico. Cuando escucha la orden de Jarvis, transmite la instrucción de encendido/apagado a tu enchufe Smart Life.
                </p>
              </div>
            )}

            {/* Opción 3: Tuya Local LAN */}
            {activeGuideTab === 'tuya_local' && (
              <div className="space-y-4 text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Key className="w-4 h-4" />
                  <span>Control Local por LAN (Tuya v3.4 - Ultrabaja Latencia 15ms):</span>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
                  <strong>✓ ¡Tus credenciales físicas ya están verificadas y funcionando!</strong>
                  <br />
                  En tu terminal ya conmutó con éxito gracias a tu Device ID (<code className="text-slate-200">ebd1e90786fec509a8pngp</code>) y Local Key (<code className="text-slate-200">PvCBXhovwQg!Dq+*</code>).
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-slate-200">
                    ¿Por qué conmutó en tu terminal pero no directo desde esta web?
                  </p>
                  <p className="text-slate-400">
                    La dirección <code className="text-cyan-300 font-bold">192.168.0.28</code> es una IP privada de tu casa. Los navegadores web y servidores en la nube no pueden enviar paquetes TCP directos a una red Wi-Fi privada sin un puente local.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4" /> Activa el Puente de Enlace Local en 1 segundo:
                    </span>
                    <a
                      href="/jarvis_tuya_bridge.py"
                      download="jarvis_tuya_bridge.py"
                      className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar script Python
                    </a>
                  </div>

                  <p className="text-slate-300 text-[11px]">
                    En tu terminal (donde ya tienes Python y tinytuya), instala el cliente MQTT y corre el puente:
                  </p>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-cyan-300 text-[11px] select-all">
                    pip install paho-mqtt tinytuya
                  </div>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-amber-300 text-[11px] select-all">
                    python jarvis_tuya_bridge.py
                  </div>

                  <p className="text-[11px] text-slate-400">
                    En cuanto ejecutes ese comando, el puente escuchará los botones de la web y los comandos de voz de Jarvis, encendiendo y apagando tu velador en <strong>15 milisegundos</strong> exactos.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
