/**
 * Jarvis Voice & Personality Manager
 * Permite seleccionar y previsualizar la voz de Jarvis (Gemini Neural TTS, Web Audio DSP, Web Speech).
 */

export interface JarvisVoiceOption {
  id: string;
  name: string;
  provider: 'Gemini Neural' | 'ElevenLabs' | 'Edge Neural';
  description: string;
  gender: 'male' | 'female';
  sampleText: string;
  pitch: number;
  rate: number;
  acousticFilter?: 'deep_bass' | 'tactical_metallic' | 'crisp_dynamic' | 'soprano_crystal' | 'warm_calm' | 'cinematic_sub';
}

export const AVAILABLE_VOICES: JarvisVoiceOption[] = [
  {
    id: 'charon',
    name: 'Charon (Estilo Jarvis Original)',
    provider: 'Gemini Neural',
    description: 'Voz masculina profunda, formal, calmada y con cadencia de mayordomo británico sofisticado.',
    gender: 'male',
    sampleText: 'A su entera disposición, señor. Sistemas de telemetría y actuadores en línea.',
    pitch: 0.78,
    rate: 0.92,
    acousticFilter: 'deep_bass'
  },
  {
    id: 'fenrir',
    name: 'Fenrir (Voz Táctica de Comando)',
    provider: 'Gemini Neural',
    description: 'Tono grave, firme, autoritario y técnico. Ideal para confirmaciones de acción militar.',
    gender: 'male',
    sampleText: 'Circuito de potencia conmutado. Parámetros operativos dentro del rango nominal.',
    pitch: 0.65,
    rate: 1.05,
    acousticFilter: 'tactical_metallic'
  },
  {
    id: 'puck',
    name: 'Puck (Dinámico & Enérgico)',
    provider: 'Gemini Neural',
    description: 'Voz ágil, expresiva, rápida y cercana. Gran velocidad de respuesta conversacional.',
    gender: 'male',
    sampleText: '¡Entendido, señor! Procedo a verificar la temperatura y el sensor de inmediato.',
    pitch: 1.35,
    rate: 1.22,
    acousticFilter: 'crisp_dynamic'
  },
  {
    id: 'aoede',
    name: 'Aoede (Elegante & Cristalina)',
    provider: 'Gemini Neural',
    description: 'Voz femenina sofisticada, clara, armónica y con articulación de alta fidelidad.',
    gender: 'female',
    sampleText: 'Buenas tardes. El enlace de comunicación con el microcontrolador está establecido.',
    pitch: 1.25,
    rate: 1.0,
    acousticFilter: 'soprano_crystal'
  },
  {
    id: 'kore',
    name: 'Kore (Calmada & Relajante)',
    provider: 'Gemini Neural',
    description: 'Tono suave, neutro, pausado y envolvente. Diseñado para no fatigar en sesiones prolongadas.',
    gender: 'female',
    sampleText: 'Lecturas de humedad ambiental estables. Ninguna anomalía detectada en los registros.',
    pitch: 0.92,
    rate: 0.88,
    acousticFilter: 'warm_calm'
  },
  {
    id: 'elevenlabs_jarvis',
    name: 'Paul B. (Clon Jarvis Cinematográfico)',
    provider: 'ElevenLabs',
    description: 'Voz con resonancia acústica inspirada en la armadura de Iron Man.',
    gender: 'male',
    sampleText: 'Siempre un placer asistirle, señor. He desplegado los protocolos solicitados.',
    pitch: 0.82,
    rate: 0.96,
    acousticFilter: 'cinematic_sub'
  }
];

class JarvisVoiceManager {
  private selectedVoiceId: string;
  private speechRate: number = 1.0;
  private isSpeaking: boolean = false;
  private audioContext: AudioContext | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.selectedVoiceId = localStorage.getItem('jarvis_voice_id') || 'charon';
    const savedRate = localStorage.getItem('jarvis_voice_rate');
    if (savedRate) {
      this.speechRate = parseFloat(savedRate) || 1.0;
    }
  }

  getSelectedVoiceId(): string {
    return this.selectedVoiceId;
  }

  getSelectedVoice(): JarvisVoiceOption {
    return AVAILABLE_VOICES.find(v => v.id === this.selectedVoiceId) || AVAILABLE_VOICES[0];
  }

  setVoice(voiceId: string) {
    this.selectedVoiceId = voiceId;
    localStorage.setItem('jarvis_voice_id', voiceId);
  }

  getSpeechRate(): number {
    return this.speechRate;
  }

  setSpeechRate(rate: number) {
    this.speechRate = Math.max(0.7, Math.min(1.5, rate));
    localStorage.setItem('jarvis_voice_rate', this.speechRate.toString());
  }

  /**
   * Previsualiza la voz seleccionada
   */
  async previewVoice(voice?: JarvisVoiceOption): Promise<boolean> {
    const target = voice || this.getSelectedVoice();
    return this.speakText(target.sampleText, target);
  }

  /**
   * Reproduce el audio usando síntesis del backend o fallback avanzado en navegador
   */
  async speakText(text: string, voiceOpt?: JarvisVoiceOption): Promise<boolean> {
    const opt = voiceOpt || this.getSelectedVoice();
    this.stopSpeaking();

    // 1. INTENTO DE SÍNTESIS NEURAL VÍA BACKEND (Gemini Speech / TTS)
    try {
      const resp = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: opt.id })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.base64Audio) {
          const played = await this.playBase64Audio(data.base64Audio, data.mimeType);
          if (played) return true;
        }
      }
    } catch {
      // Backend no disponible o clave no configurada: fallback inmediato al sintetizador del navegador
    }

    // 2. SÍNTESIS CON EL NAVEGADOR CON PERFILES VOCALES Y FILTROS AUDIBLES
    return this.speakWithBrowserSynthesis(text, opt);
  }

  /**
   * Reproduce audio PCM / WAV decodificado con Web Audio API
   */
  private async playBase64Audio(base64Data: string, mimeType: string): Promise<boolean> {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      let audioBuffer: AudioBuffer;
      if (mimeType && mimeType.includes('pcm')) {
        // Linear 16-bit PCM (24000Hz monocanal de Gemini)
        const int16Array = new Int16Array(bytes.buffer);
        const floatArray = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          floatArray[i] = int16Array[i] / 32768.0;
        }
        audioBuffer = this.audioContext.createBuffer(1, floatArray.length, 24000);
        audioBuffer.getChannelData(0).set(floatArray);
      } else {
        // WAV o MP3 estándar
        audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      this.currentAudioSource = source;
      this.isSpeaking = true;

      return new Promise<boolean>((resolve) => {
        source.onended = () => {
          this.isSpeaking = false;
          this.currentAudioSource = null;
          resolve(true);
        };
        source.start(0);
      });
    } catch (e) {
      console.warn('[JarvisVoice] Error decodificando audio neural, pasando a fallback vocal:', e);
      return false;
    }
  }

  /**
   * Síntesis del navegador diferenciando marcadamente tono, velocidad y voz física
   */
  private speakWithBrowserSynthesis(text: string, opt: JarvisVoiceOption): Promise<boolean> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve(false);
        return;
      }

      window.speechSynthesis.cancel();

      // Generar tono auditivo característico previo que identifica acústicamente a la IA seleccionada
      this.playAcousticChime(opt.acousticFilter);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = opt.rate * this.speechRate;
      utterance.pitch = opt.pitch;
      utterance.lang = 'es-ES';

      const voices = window.speechSynthesis.getVoices();

      // Búsqueda inteligente de voz distinta según género y nombre
      if (voices.length > 0) {
        let bestVoice: SpeechSynthesisVoice | undefined;

        if (opt.gender === 'female') {
          bestVoice = voices.find(v => 
            (v.lang.startsWith('es') || v.lang.startsWith('en')) &&
            (v.name.toLowerCase().includes('female') || 
             v.name.toLowerCase().includes('helena') || 
             v.name.toLowerCase().includes('monica') || 
             v.name.toLowerCase().includes('paulina') || 
             v.name.toLowerCase().includes('sabina') || 
             v.name.toLowerCase().includes('lucia') || 
             v.name.toLowerCase().includes('zira') ||
             v.name.toLowerCase().includes('kore'))
          );
        } else {
          // Masculinas
          if (opt.id === 'fenrir') {
            bestVoice = voices.find(v => 
              v.name.toLowerCase().includes('enrique') || 
              v.name.toLowerCase().includes('alvaro') ||
              v.name.toLowerCase().includes('male') ||
              v.name.toLowerCase().includes('david')
            );
          } else if (opt.id === 'puck') {
            bestVoice = voices.find(v => 
              v.name.toLowerCase().includes('miguel') || 
              v.name.toLowerCase().includes('diego') ||
              v.name.toLowerCase().includes('george')
            );
          } else {
            // Charon / Jarvis
            bestVoice = voices.find(v => 
              v.name.toLowerCase().includes('jorge') || 
              v.name.toLowerCase().includes('raul') ||
              v.name.toLowerCase().includes('carlos') ||
              v.name.toLowerCase().includes('natural')
            );
          }
        }

        // Si no encontró por nombre, buscar por idioma
        if (!bestVoice) {
          const langVoices = voices.filter(v => v.lang.startsWith('es'));
          if (langVoices.length > 1) {
            // Repartir índices para que no usen siempre la voz 0
            const voiceIdx = opt.id === 'charon' ? 0 : opt.id === 'fenrir' ? 1 % langVoices.length : opt.id === 'puck' ? 2 % langVoices.length : (langVoices.length - 1);
            bestVoice = langVoices[voiceIdx];
          } else if (langVoices.length === 1) {
            bestVoice = langVoices[0];
          }
        }

        if (bestVoice) {
          utterance.voice = bestVoice;
        }
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        resolve(true);
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve(false);
      };

      // Pequeño retardo de 120ms para que el chime acústico introductorio suene limpio
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 120);
    });
  }

  /**
   * Emite un sutil pitido/firma acústica sintetizada con osciladores Web Audio
   * para dar textura física distinguible a cada personalidad.
   */
  private playAcousticChime(filterType?: string) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);

      if (filterType === 'deep_bass') {
        // Charon: Pulso grave formal estilo mayordomo (110Hz -> 82Hz)
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(82, now + 0.12);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      } else if (filterType === 'tactical_metallic') {
        // Fenrir: Tono cuadrado táctico marcial (220Hz -> 180Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      } else if (filterType === 'crisp_dynamic') {
        // Puck: Chime brillante ascendente (440Hz -> 880Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      } else if (filterType === 'soprano_crystal') {
        // Aoede: Armónico cristalino suave (660Hz -> 520Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      } else {
        // Kore / Paul: Tono suave relajante (196Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(196, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      }

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Sin audio context no crítico
    }
  }

  stopSpeaking() {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch {}
      this.currentAudioSource = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
  }
}

export const jarvisVoice = new JarvisVoiceManager();
