import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, DisplayMood } from '../types';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bot,
  User,
  Wrench,
  Terminal,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { jarvisVoice } from '../utils/voiceManager';

interface JarvisChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  currentMood: DisplayMood;
}

export const JarvisChat: React.FC<JarvisChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  currentMood
}) => {
  const [inputText, setInputText] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Speech synthesis with configured Jarvis Voice & Pitch
  useEffect(() => {
    if (!ttsEnabled || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender === 'jarvis') {
      jarvisVoice.speakText(lastMsg.text);
    }
  }, [messages, ttsEnabled]);

  // Speech recognition
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta SpeechRecognition. Por favor usa Chrome o Edge.');
      return;
    }

    if (isVoiceActive) {
      setIsVoiceActive(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsVoiceActive(true);
      recognition.onend = () => setIsVoiceActive(false);
      recognition.onerror = () => setIsVoiceActive(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          onSendMessage(transcript);
        }
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsVoiceActive(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    onSendMessage(text);
  };

  const quickPrompts = [
    'Jarvis, ¿cuál es la temperatura y humedad actual?',
    'Encendé las luces del laboratorio y el taller',
    'Dispará el comando IR para encender el televisor',
    'Poné tu pantalla en modo SARCASTIC con un comentario',
    'Modo ALERTA: mostrá advertencia en la pantalla ST7735',
    'Creá una nota Markdown en /data sobre la prueba de hoy'
  ];

  return (
    <div id="jarvis-chat-console" className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide text-slate-200">JARVIS AI CORE</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Orquestador de periféricos & ESP32-S3</p>
          </div>
        </div>

        {/* Audio & Voice Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title={ttsEnabled ? 'Voz desactivada' : 'Activar voz sintética de Jarvis'}
            className={`p-1.5 rounded-lg border transition-all ${
              ttsEnabled
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] md:max-w-[80%] rounded-2xl px-4 py-3 border shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-cyan-600/20 border-cyan-500/40 text-slate-100 rounded-tr-sm'
                  : 'bg-slate-950/70 border-slate-800 text-slate-200 rounded-tl-sm'
              }`}
            >
              {/* Sender label */}
              <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono opacity-60">
                {msg.sender === 'user' ? (
                  <>
                    <span>CREADOR</span>
                    <User className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-cyan-400" />
                    <span className="text-cyan-400 font-semibold">JARVIS</span>
                    {msg.mood && (
                      <span className="bg-slate-800 text-slate-300 px-1 py-0.2 rounded text-[10px]">
                        [{msg.mood}]
                      </span>
                    )}
                  </>
                )}
                <span className="text-[10px] ml-auto">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              {/* Message text */}
              <p className="whitespace-pre-wrap leading-relaxed text-slate-200">{msg.text}</p>

              {/* Function calls badges if any */}
              {msg.functionCalls && msg.functionCalls.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-cyan-400 text-[11px]">
                    <Wrench className="w-3 h-3" />
                    <span>Llamadas a hardware ejecutadas:</span>
                  </div>
                  {msg.functionCalls.map((fc, i) => (
                    <div
                      key={i}
                      className="bg-slate-900/90 rounded p-2 border border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>⚡ {fc.name}()</span>
                        <span className="text-emerald-400 text-[10px]">✓ EJECUTADO</span>
                      </div>
                      <div className="mt-1 text-slate-400 text-[10px] break-all">
                        {JSON.stringify(fc.args)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-cyan-400 font-mono text-xs">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Jarvis procesando lógica y ejecutando herramientas...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[10px] uppercase font-mono text-slate-500 whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Órdenes rápidas:
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => onSendMessage(prompt)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all whitespace-nowrap flex-shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          title="Hablar con Jarvis (Micrófono)"
          className={`p-2.5 rounded-xl border transition-all ${
            isVoiceActive
              ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-slate-700'
          }`}
        >
          {isVoiceActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <input
          id="jarvis-input-field"
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Escribí una orden o consulta a Jarvis..."
          disabled={isLoading}
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50"
        />

        <button
          type="submit"
          id="btn-send-jarvis-msg"
          disabled={isLoading || !inputText.trim()}
          className="p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-cyan-600/30 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
