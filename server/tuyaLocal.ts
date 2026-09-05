// @ts-ignore
import TuyAPI from 'tuyapi';

/**
 * Tuya Local Protocol Client basado en TuyAPI (npm)
 * Utiliza la librería comunitaria probada y madura con soporte nativo para v3.1 a v3.4,
 * eliminando reimplementaciones manuales de framing/crypto y dependencias frágiles de subprocesos.
 */

export interface TuyaDeviceConfig {
  ip: string;
  deviceId: string;
  localKey: string;
  version?: '3.4' | '3.3' | '3.1';
  port?: number;
  dpsKey?: string | number; // Normalmente 1 o "1"
}

export interface TuyaResult {
  success: boolean;
  latencyMs: number;
  message: string;
  driver?: 'tuyapi' | 'tinytuya' | 'native_v34' | 'native_v33';
  errorDetails?: string;
}

export class TuyaLocalClient {
  /**
   * Conmuta el estado de encendido del dispositivo Tuya por LAN local de forma segura.
   * Conexión one-shot: Conecta -> Envía comando -> Desconecta.
   */
  static async setPower(
    config: TuyaDeviceConfig,
    state: boolean,
    timeoutMs: number = 3000
  ): Promise<TuyaResult> {
    const startTime = Date.now();

    if (!config.ip || !config.deviceId || !config.localKey) {
      return {
        success: false,
        latencyMs: 0,
        driver: 'tuyapi',
        message: 'Faltan parámetros requeridos (IP local, Device ID o Local Key)'
      };
    }

    const version = config.version || '3.4';
    const dps = config.dpsKey ? Number(config.dpsKey) : 1;

    let device: any = null;

    try {
      device = new TuyAPI({
        id: config.deviceId,
        key: config.localKey,
        ip: config.ip,
        port: config.port || 6668,
        version: version,
        issueGetOnConnect: false
      });

      // Manejar evento de error del EventEmitter para evitar fallos no capturados en el socket
      device.on('error', (_err: any) => {
        // El reject del Promise.race o el catch principal procesarán el error
      });

      // Ejecución de conexión y envío con timeout
      const executeCommand = async () => {
        await device.connect();
        const res = await device.set({ dps, set: state });
        return res;
      };

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout tras ${timeoutMs}ms intentando conectar a ${config.ip}:${config.port || 6668}`)),
          timeoutMs
        )
      );

      await Promise.race([executeCommand(), timeoutPromise]);

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        driver: 'tuyapi',
        message: `Velador ${state ? 'ENCENDIDO' : 'APAGADO'} con éxito mediante TuyAPI (${config.ip}, v${version})`
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err?.message || String(err);

      // Diagnóstico si la IP es una red privada local y el servidor corre en la nube
      const isPrivateLan =
        config.ip.startsWith('192.168.') ||
        config.ip.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(config.ip);

      let lanNotice = '';
      if (
        isPrivateLan &&
        (errMsg.includes('Timeout') ||
          errMsg.includes('ECONNREFUSED') ||
          errMsg.includes('EHOSTUNREACH') ||
          errMsg.includes('timed out'))
      ) {
        lanNotice =
          ` [Diagnóstico de Red]: La IP ${config.ip} es una dirección privada de tu router local. ` +
          `Cuando ejecutas la app localmente en tu PC (npm run dev) funcionará directo; ` +
          `si corre en la nube, el control debe hacerse a través del ESP32 o del bridge MQTT local (jarvis_tuya_bridge.py).`;
      }

      return {
        success: false,
        latencyMs,
        driver: 'tuyapi',
        message: `Error TuyAPI conmutando ${config.ip} (v${version}): ${errMsg}.${lanNotice}`,
        errorDetails: errMsg
      };
    } finally {
      if (device) {
        try {
          device.disconnect();
        } catch (_) {}
      }
    }
  }
}
