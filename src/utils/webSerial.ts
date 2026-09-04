// Web Serial API service for zero-latency direct communication with ESP32-S3 over USB (COM3)

export interface SerialTelemetry {
  temperature?: number;
  humidity?: number;
  ip?: string;
  rssi?: number;
}

type TelemetryCallback = (data: SerialTelemetry) => void;
type LogCallback = (line: string) => void;

export interface WebSerialConnectResult {
  success: boolean;
  isIframe?: boolean;
  cancelled?: boolean;
  error?: string;
}

class WebSerialManager {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private isReading = false;
  private telemetryCallbacks: Set<TelemetryCallback> = new Set();
  private logCallbacks: Set<LogCallback> = new Set();

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isInIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  public isConnected(): boolean {
    return this.port !== null;
  }

  public async connect(): Promise<WebSerialConnectResult> {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Web Serial API no soportada en este navegador. Usa Chrome o Edge.'
      };
    }

    if (this.isInIframe()) {
      return {
        success: false,
        isIframe: true,
        error: 'Web Serial no está permitido dentro del visor embebido (iframe) debido a la directiva de permisos. Abre la aplicación en una pestaña independiente para conectar directamente por USB.'
      };
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();

      this.startReading();
      return { success: true };
    } catch (err: any) {
      this.port = null;
      this.writer = null;

      const isSecurityError =
        err.name === 'SecurityError' ||
        (err.message && err.message.toLowerCase().includes('permissions policy'));
      const isCancelled = err.name === 'NotFoundError';

      if (isSecurityError) {
        return {
          success: false,
          isIframe: true,
          error: 'Acceso a Web Serial restringido en visor embebido por directiva de permisos.'
        };
      }

      if (isCancelled) {
        return {
          success: false,
          cancelled: true
        };
      }

      return {
        success: false,
        error: err.message || 'Error al conectar por puerto Serial'
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (e) {
      console.warn('Error closing port:', e);
      this.port = null;
    }
  }

  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this.writer) return false;
    try {
      const payload = cmd.endsWith('\n') ? cmd : cmd + '\n';
      await this.writer.write(payload);
      return true;
    } catch (e) {
      console.warn('Failed to send serial command:', e);
      return false;
    }
  }

  public async sendMood(mood: string, msg: string): Promise<boolean> {
    return this.sendCommand(`MOOD:${mood}:${msg}`);
  }

  public async sendRelay(gpio: number, state: boolean): Promise<boolean> {
    return this.sendCommand(`RELAY:${gpio}:${state ? 1 : 0}`);
  }

  public async sendVelador(state: boolean): Promise<boolean> {
    return this.sendCommand(`VELADOR:${state ? 1 : 0}`);
  }

  public onTelemetry(cb: TelemetryCallback): () => void {
    this.telemetryCallbacks.add(cb);
    return () => this.telemetryCallbacks.delete(cb);
  }

  public onLog(cb: LogCallback): () => void {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  private async startReading() {
    if (!this.port || !this.port.readable) return;
    this.isReading = true;

    try {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      let buffer = '';

      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            this.logCallbacks.forEach(cb => cb(cleanLine));

            // Parse telemetry if JSON or prefixed
            if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
              try {
                const parsed = JSON.parse(cleanLine);
                if (parsed.temperature !== undefined || parsed.temp !== undefined) {
                  this.telemetryCallbacks.forEach(cb =>
                    cb({
                      temperature: parsed.temperature ?? parsed.temp,
                      humidity: parsed.humidity ?? parsed.hum,
                      ip: parsed.ip,
                      rssi: parsed.rssi
                    })
                  );
                }
              } catch (e) {
                // ignore non-json
              }
            } else if (cleanLine.startsWith('[DHT]')) {
              // format: [DHT] Temp: 24.2C, Hum: 50.1%
              const match = cleanLine.match(/Temp:\s*([0-9.]+).*Hum:\s*([0-9.]+)/i);
              if (match) {
                this.telemetryCallbacks.forEach(cb =>
                  cb({
                    temperature: parseFloat(match[1]),
                    humidity: parseFloat(match[2])
                  })
                );
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Serial reader exited:', e);
    } finally {
      this.isReading = false;
    }
  }
}

export const webSerial = new WebSerialManager();
