/**
 * ESP32 Local Wi-Fi Direct Controller
 * Comunica el navegador directamente con el servidor HTTP del ESP32 (ej. 192.168.0.69)
 */

export interface Esp32WifiTelemetry {
  temperature?: number;
  humidity?: number;
  ip?: string;
  online: boolean;
  mixedContentBlocked?: boolean;
}

class Esp32WifiManager {
  private ip: string;
  private listeners: ((data: Esp32WifiTelemetry) => void)[] = [];
  private pollInterval: any = null;
  private isMixedContentBlocked = false;

  constructor() {
    this.ip = localStorage.getItem('jarvis_esp32_ip') || '192.168.0.69';
  }

  getIp(): string {
    return this.ip;
  }

  setIp(newIp: string) {
    this.ip = newIp.trim();
    localStorage.setItem('jarvis_esp32_ip', this.ip);
    this.checkHealth();
  }

  getMixedContentBlocked(): boolean {
    return this.isMixedContentBlocked;
  }

  /**
   * Envía cambio de estado/cara directamente al ESP32 por Wi-Fi Local
   */
  async sendMood(mood: string, message: string): Promise<boolean> {
    if (!this.ip) return false;

    const url = `http://${this.ip}/mood`;
    const params = { val: mood, msg: message };

    // Intento 1: Fetch estándar con timeout corto
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${url}?val=${encodeURIComponent(mood)}&msg=${encodeURIComponent(message)}`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        this.isMixedContentBlocked = false;
        return true;
      }
    } catch (err: any) {
      // Si el navegador bloquea fetch por Mixed Content (HTTPS -> HTTP), usamos el fallback de formulario
      if (err.name === 'TypeError' || err.message?.includes('Mixed Content') || err.message?.includes('Failed to fetch')) {
        this.isMixedContentBlocked = true;
      }
    }

    // Intento 2 (Fallback anti-bloqueo Mixed Content): Formulario oculto dirigido a un iframe invisible
    this.sendViaHiddenForm(url, params);
    return true;
  }

  /**
   * Envía activación/desactivación de relé directamente al ESP32
   */
  async sendRelay(gpio: number, state: boolean): Promise<boolean> {
    if (!this.ip) return false;

    const url = `http://${this.ip}/relay`;
    const stateVal = state ? '1' : '0';
    const params = { gpio: gpio.toString(), state: stateVal };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      await fetch(`${url}?gpio=${gpio}&state=${stateVal}`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return true;
    } catch {
      // Fallback
    }

    this.sendViaHiddenForm(url, params);
    return true;
  }

  /**
   * Envía conmutación de velador / enchufe Tuya directamente al endpoint local del ESP32
   */
  async sendVelador(state: boolean): Promise<boolean> {
    if (!this.ip) return false;

    const url = `http://${this.ip}/velador`;
    const stateVal = state ? '1' : '0';
    const params = { state: stateVal };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      await fetch(`${url}?state=${stateVal}`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return true;
    } catch {
      // Fallback si mixed content bloquea
    }

    this.sendViaHiddenForm(url, params);
    return true;
  }

  /**
   * Consulta telemetría en vivo del DHT22 por Wi-Fi
   */
  async checkHealth(): Promise<Esp32WifiTelemetry> {
    if (!this.ip) return { online: false };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`http://${this.ip}/telemetry`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.isMixedContentBlocked = false;
        const result: Esp32WifiTelemetry = {
          temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
          humidity: typeof data.humidity === 'number' ? data.humidity : undefined,
          ip: data.ip || this.ip,
          online: true,
          mixedContentBlocked: false
        };
        this.notify(result);
        return result;
      }
    } catch (err: any) {
      // Detectar si fue por Mixed Content
      this.isMixedContentBlocked = true;
    }

    const fallback: Esp32WifiTelemetry = {
      online: false,
      ip: this.ip,
      mixedContentBlocked: this.isMixedContentBlocked
    };
    this.notify(fallback);
    return fallback;
  }

  /**
   * Inicia sondeo periódico cada N ms
   */
  startAutoPoll(intervalMs = 4000) {
    this.stopAutoPoll();
    this.checkHealth();
    this.pollInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  stopAutoPoll() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  onTelemetry(callback: (data: Esp32WifiTelemetry) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify(data: Esp32WifiTelemetry) {
    this.listeners.forEach(cb => cb(data));
  }

  /**
   * Formulario GET invisible que permite enviar comandos a HTTP local desde HTTPS
   * sin ser bloqueado por la política de Mixed Content del navegador.
   */
  private sendViaHiddenForm(url: string, params: Record<string, string>) {
    try {
      let iframe = document.getElementById('esp32_hidden_bridge_frame') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'esp32_hidden_bridge_frame';
        iframe.name = 'esp32_hidden_bridge_frame';
        iframe.style.display = 'none';
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }

      const form = document.createElement('form');
      form.target = 'esp32_hidden_bridge_frame';
      form.action = url;
      form.method = 'GET';
      form.style.display = 'none';

      for (const [k, v] of Object.entries(params)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();

      // Limpiar elemento form después de enviar
      setTimeout(() => {
        try {
          form.remove();
        } catch {}
      }, 500);
    } catch (e) {
      console.error('Error al enviar formulario a ESP32:', e);
    }
  }
}

export const esp32Wifi = new Esp32WifiManager();
