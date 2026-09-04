import React, { useState, useEffect } from 'react';
import {
  Globe,
  Radio,
  Volume2,
  VolumeX,
  Play,
  Square,
  Check,
  Zap,
  Sliders,
  Sparkles,
  Wifi,
  Smartphone,
  ShieldCheck,
  Send,
  HelpCircle
} from 'lucide-react';
import { jarvisMqtt, MqttConfig } from '../utils/jarvisMqtt';
import { jarvisVoice, AVAILABLE_VOICES, JarvisVoiceOption } from '../utils/voiceManager';

interface MqttAndVoiceSettingsProps {
  onSendTestMood?: (mood: string, msg: string) => void;
}

export const MqttAndVoiceSettings: React.FC<MqttAndVoiceSettingsProps> = ({
  onSendTestMood
}) => {
  const [mqttConfig, setMqttConfig] = useState<MqttConfig>(jarvisMqtt.getConfig());
  const [mqttConnected, setMqttConnected] = useState<boolean>(jarvisMqtt.getIsConnected());
  const [selectedVoice, setSelectedVoice] = useState<JarvisVoiceOption>(jarvisVoice.getSelectedVoice());
  const [speechRate, setSpeechRate] = useState<number>(jarvisVoice.getSpeechRate());
  const [isPlayingPreview, setIsPlayingPreview] = useState<string | null>(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [sonoffTestSent, setSonoffTestSent] = useState(false);
  const [sonoffTestState, setSonoffTestState] = useState(false);

  useEffect(() => {
    const unsubStatus = jarvisMqtt.onStatusChange((connected) => {
      setMqttConnected(connected);
    });
    return () => unsubStatus();
  }, []);

  const handleSaveMqtt = (e: React.FormEvent) => {
    e.preventDefault();
    jarvisMqtt.saveConfig(mqttConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const handleSelectVoice = (voice: JarvisVoiceOption) => {
    jarvisVoice.setVoice(voice.id);
    setSelectedVoice(voice);
  };

  const handlePreviewVoice = async (voice: JarvisVoiceOption) => {
    if (isPlayingPreview === voice.id) {
      jarvisVoice.stopSpeaking();
      setIsPlayingPreview(null);
      return;
    }
    setIsPlayingPreview(voice.id);
    await jarvisVoice.previewVoice(voice);
    setIsPlayingPreview(null);
  };

  const handleRateChange = (rate: number) => {
    setSpeechRate(rate);
    jarvisVoice.setSpeechRate(rate);
  };

  const handleSendMqttTest = () => {
    const ok = jarvisMqtt.sendMood('ALERT', 'TEST MQTT 4G\\nEXITOSO!');
    if (onSendTestMood) {
      onSendTestMood('ALERT', 'TEST MQTT 4G\\nEXITOSO!');
    }
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1. SECCIÓN MQTT CLOUD: CONTROL REMOTO FUERA DE CASA */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Enlace MQTT en la Nube (Control 4G Fuera de Casa)
                <span className={`px-2 py-0.5 text-[11px] font-mono rounded-full border ${
                  mqttConnected 
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-950/70 border-amber-500/40 text-amber-400'
                }`}>
                  {mqttConnected ? '● BROKER EN LÍNEA' : '○ CONECTANDO...'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Permite comandar las expresiones de Jarvis y recibir temperatura desde cualquier lugar sin abrir puertos en tu router.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !sonoffTestState;
                setSonoffTestState(next);
                jarvisMqtt.sendSonoffPower('', next);
                setSonoffTestSent(true);
                setTimeout(() => setSonoffTestSent(false), 2500);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>
                {sonoffTestSent ? '¡MQTT Enviado!' : sonoffTestState ? 'Probar Apagar Velador' : 'Probar Encender Velador'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSendMqttTest}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testSent ? '¡Comando Enviado!' : 'Probar Pantalla ST7735'}</span>
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-cyan-900/40 text-xs text-slate-300 flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-cyan-200">
              ¿Cómo funciona el control desde tu celular fuera de casa?
            </p>
            <p className="text-slate-400 leading-relaxed">
              El ESP32 se conecta al broker MQTT en <code className="text-cyan-300">{mqttConfig.esp32BrokerHost}</code> en el puerto 1883. Esta web se conecta al mismo broker mediante WebSockets seguros. Cuando cambias de expresión o consultas la temperatura con datos móviles, el mensaje tarda menos de <strong className="text-slate-200">40 milisegundos</strong> en cruzar internet.
            </p>
          </div>
        </div>

        {/* Formulario de Configuración MQTT */}
        <form onSubmit={handleSaveMqtt} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Broker WebSockets (App Web):
            </label>
            <input
              type="text"
              value={mqttConfig.brokerUrl}
              onChange={(e) => setMqttConfig({ ...mqttConfig, brokerUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
              placeholder="wss://broker.hivemq.com:8884/mqtt"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Broker Host (ESP32 Firmware):
            </label>
            <input
              type="text"
              value={mqttConfig.esp32BrokerHost}
              onChange={(e) => setMqttConfig({ ...mqttConfig, esp32BrokerHost: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
              placeholder="broker.hivemq.com"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Prefijo de Tópicos Único:
            </label>
            <input
              type="text"
              value={mqttConfig.topicPrefix}
              onChange={(e) => setMqttConfig({ ...mqttConfig, topicPrefix: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
              placeholder="jarvis_raul_s3"
            />
          </div>

          <div className="sm:col-span-3 flex justify-between items-center pt-2">
            <div className="text-[11px] font-mono text-slate-500">
              Tópicos activos: <span className="text-slate-300">{mqttConfig.topicPrefix}/cmd</span> y <span className="text-slate-300">{mqttConfig.topicPrefix}/telemetry</span>
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono text-slate-200 cursor-pointer flex items-center gap-1.5"
            >
              {configSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Sliders className="w-3.5 h-3.5" />}
              <span>{configSaved ? '¡Configuración Guardada!' : 'Guardar y Reconectar'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. SECCIÓN SELECTOR DE VOZ DE JARVIS */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-950/80 border border-violet-500/30 text-violet-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Personalidad y Voz de Jarvis
                <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300">
                  ACTUAL: {selectedVoice.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona el timbre neuronal y la velocidad con la que Jarvis sintetiza su audio por el parlante.
              </p>
            </div>
          </div>

          {/* Slider de Velocidad */}
          <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-400">Velocidad:</span>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={speechRate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-24 accent-violet-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-violet-400 font-bold">{speechRate.toFixed(2)}x</span>
          </div>
        </div>

        {/* Tarjetas de Selección de Voz */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {AVAILABLE_VOICES.map((v) => {
            const isSelected = selectedVoice.id === v.id;
            const isPlaying = isPlayingPreview === v.id;

            return (
              <div
                key={v.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-gradient-to-b from-violet-950/40 to-slate-900 border-violet-500/60 shadow-lg shadow-violet-950/30 ring-1 ring-violet-500/40'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                        {v.name}
                      </h4>
                      <span className="text-[10px] font-mono text-violet-400 px-1.5 py-0.5 rounded bg-violet-950/80 border border-violet-800/40">
                        {v.provider}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="p-1 rounded-full bg-violet-500/20 text-violet-400">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-2">
                    {v.description}
                  </p>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] font-mono text-slate-300 italic">
                    "{v.sampleText}"
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handlePreviewVoice(v)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isPlaying
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlaying ? 'Detener' : 'Escuchar Muestra'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectVoice(v)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 hover:bg-violet-600/30 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                  >
                    {isSelected ? 'Seleccionada' : 'Elegir'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
