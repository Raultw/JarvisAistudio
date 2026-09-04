import net from 'net';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Tuya Local Protocol v3.4 / v3.3 Client & TinyTuya Python Bridge
 * Proporciona conexión directa por socket TCP al puerto 6668 y puente directo a tinytuya.
 */

// CRC32 table
const crcTable: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

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
  driver?: 'tinytuya' | 'native_v34' | 'native_v33';
  errorDetails?: string;
}

export class TuyaLocalClient {
  /**
   * Intenta conmutar usando la biblioteca Python 'tinytuya' local del usuario
   * (El comando que el usuario confirmó que funciona 100% en su máquina)
   */
  static async setPowerViaTinyTuya(config: TuyaDeviceConfig, state: boolean): Promise<TuyaResult | null> {
    const startTime = Date.now();
    const ver = config.version || '3.4';
    const pyBool = state ? 'True' : 'False';
    const pyCmd = `import tinytuya; d = tinytuya.OutletDevice('${config.deviceId}', '${config.ip}', '${config.localKey}'); d.set_version(${ver}); d.set_status(${pyBool}); print('OK')`;

    // Probar primero con 'python', luego 'python3', luego 'py'
    const interpreters = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];

    for (const interp of interpreters) {
      try {
        const fullCmd = `${interp} -c "${pyCmd.replace(/"/g, '\\"')}"`;
        const { stdout, stderr } = await execPromise(fullCmd, { timeout: 4000 });
        const latencyMs = Date.now() - startTime;
        if (stdout.includes('OK') || stdout.toLowerCase().includes('encendido') || stdout.toLowerCase().includes('success')) {
          return {
            success: true,
            latencyMs,
            driver: 'tinytuya',
            message: `Comando ${state ? 'ON' : 'OFF'} ejecutado con éxito mediante tinytuya (${interp}) a ${config.ip} (v${ver})`
          };
        }
        if (stderr) {
          console.warn(`[TinyTuya ${interp} stderr]:`, stderr);
        }
      } catch (err: any) {
        // Si no está instalado tinytuya o el intérprete no existe, probar siguiente
        const errMsg = err?.message || '';
        if (errMsg.includes('No module named tinytuya') || errMsg.includes('not found') || errMsg.includes('no se reconoce')) {
          continue;
        }
        // Si falló por red/timeout específico
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          driver: 'tinytuya',
          message: `Error ejecutando tinytuya (${interp}): ${errMsg.slice(0, 150)}`,
          errorDetails: errMsg
        };
      }
    }

    return null; // tinytuya no disponible en este entorno
  }

  /**
   * Envía conmutación con negociación nativa Tuya Protocol v3.4 (handshake 3 pasos + HMAC-SHA256)
   */
  static async setPowerNativeV34(config: TuyaDeviceConfig, state: boolean, timeoutMs: number = 3000): Promise<TuyaResult> {
    const startTime = Date.now();
    const port = config.port || 6668;
    const dps = String(config.dpsKey || '1');
    const localKeyBuf = Buffer.from(config.localKey.padEnd(16, '\0').slice(0, 16), 'utf8');

    return new Promise((resolve) => {
      let resolved = false;
      const socket = new net.Socket();
      let sessionKey: Buffer | null = null;
      let step = 0; // 0: init, 1: neg_start sent, 2: finish sent, 3: control sent
      let localNonce = crypto.randomBytes(16);

      const finish = (success: boolean, msg: string, errDet?: string) => {
        if (resolved) return;
        resolved = true;
        try { socket.destroy(); } catch {}
        resolve({
          success,
          latencyMs: Date.now() - startTime,
          driver: 'native_v34',
          message: msg,
          errorDetails: errDet
        });
      };

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        // PASO 1: Enviar SESS_KEY_NEG_START (cmd 0x03)
        // Header: prefix(4) + seq(4) + cmd(4)=0x00000003 + length(4)=0x00000030 (48 bytes: 16 nonce + 32 hmac)
        const header = Buffer.from([
          0x00, 0x00, 0x55, 0xAA,
          0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x03,
          0x00, 0x00, 0x00, 0x30
        ]);
        const hmac = crypto.createHmac('sha256', localKeyBuf).update(Buffer.concat([header, localNonce])).digest();
        const suffix = Buffer.from([0x00, 0x00, 0xAA, 0x55]);
        const packet1 = Buffer.concat([header, localNonce, hmac, suffix]);

        step = 1;
        socket.write(packet1);
      });

      socket.on('data', (data: Buffer) => {
        if (step === 1) {
          // PASO 2: Recibir SESS_KEY_NEG_RESP (cmd 0x04)
          if (data.length < 48) {
            return finish(false, `Respuesta v3.4 insuficiente (${data.length} bytes recibidos)`);
          }
          const remoteNonce = data.subarray(16, 32);

          // Derivar Session Key: AES-128-ECB(localNonce XOR remoteNonce, key=localKey)
          const xorNonce = Buffer.alloc(16);
          for (let i = 0; i < 16; i++) {
            xorNonce[i] = localNonce[i] ^ remoteNonce[i];
          }
          const cipher = crypto.createCipheriv('aes-128-ecb', localKeyBuf, null);
          cipher.setAutoPadding(false);
          sessionKey = Buffer.concat([cipher.update(xorNonce), cipher.final()]);

          // PASO 3: Enviar SESS_KEY_NEG_FINISH (cmd 0x05)
          const finishHmac = crypto.createHmac('sha256', localKeyBuf).update(remoteNonce).digest();
          const header3 = Buffer.from([
            0x00, 0x00, 0x55, 0xAA,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x05,
            0x00, 0x00, 0x00, 0x40 // 64 bytes (32 payload + 32 hmac)
          ]);
          const outerHmac = crypto.createHmac('sha256', localKeyBuf).update(Buffer.concat([header3, finishHmac])).digest();
          const suffix = Buffer.from([0x00, 0x00, 0xAA, 0x55]);
          const packet3 = Buffer.concat([header3, finishHmac, outerHmac, suffix]);

          step = 2;
          socket.write(packet3, () => {
            // PASO 4: Enviar Comando de Potencia CONTROL_NEW (cmd 0x0D)
            const nowSec = Math.floor(Date.now() / 1000);
            const cmdJson = JSON.stringify({
              protocol: 5,
              t: nowSec,
              data: {
                dps: {
                  [dps]: state
                }
              }
            });

            const encCipher = crypto.createCipheriv('aes-128-ecb', sessionKey!, null);
            encCipher.setAutoPadding(true);
            const encryptedData = Buffer.concat([encCipher.update(Buffer.from(cmdJson, 'utf8')), encCipher.final()]);

            const verHeader = Buffer.from('3.4');
            const padding = Buffer.alloc(12, 0);
            const tuyaPayload = Buffer.concat([verHeader, padding, encryptedData]);

            const totalLen = tuyaPayload.length + 32;
            const lenBuf = Buffer.alloc(4);
            lenBuf.writeUInt32BE(totalLen, 0);

            const headerCmd = Buffer.concat([
              Buffer.from([0x00, 0x00, 0x55, 0xAA, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0D]),
              lenBuf
            ]);

            const cmdHmac = crypto.createHmac('sha256', sessionKey!).update(Buffer.concat([headerCmd, tuyaPayload])).digest();
            const fullCmdPacket = Buffer.concat([headerCmd, tuyaPayload, cmdHmac, suffix]);

            step = 3;
            socket.write(fullCmdPacket, () => {
              setTimeout(() => {
                finish(true, `Comando ${state ? 'ON' : 'OFF'} transmitido exitosamente por socket nativo Tuya v3.4 a ${config.ip}:${port}`);
              }, 50);
            });
          });
        } else if (step === 3) {
          finish(true, `Confirmación de estado recibida desde el enchufe ${config.ip}:${port}`);
        }
      });

      socket.on('timeout', () => {
        finish(false, `Timeout de socket (no hubo respuesta en ${timeoutMs}ms desde ${config.ip}:${port})`);
      });

      socket.on('error', (err) => {
        finish(false, `Error de conexión socket: ${err.message}`, err.message);
      });

      try {
        socket.connect(port, config.ip);
      } catch (err: any) {
        finish(false, `Fallo al iniciar conexión socket: ${err?.message}`);
      }
    });
  }

  /**
   * Conmutación estándar Tuya Protocol v3.3 (AES-128-ECB con CRC32)
   */
  static async setPowerNativeV33(config: TuyaDeviceConfig, state: boolean, timeoutMs: number = 2500): Promise<TuyaResult> {
    const startTime = Date.now();
    const port = config.port || 6668;
    const dps = String(config.dpsKey || '1');
    const keyBuf = Buffer.from(config.localKey.padEnd(16, '\0').slice(0, 16), 'utf8');

    const nowSec = Math.floor(Date.now() / 1000);
    const dataObj = {
      devId: config.deviceId,
      uid: config.deviceId,
      t: nowSec,
      dps: {
        [dps]: state
      }
    };
    const jsonStr = JSON.stringify(dataObj);

    const cipher = crypto.createCipheriv('aes-128-ecb', keyBuf, null);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(jsonStr, 'utf8')), cipher.final()]);

    const verHeader = Buffer.from('3.3');
    const padding = Buffer.alloc(12, 0);
    const payloadBuffer = Buffer.concat([verHeader, padding, encrypted]);

    const prefix = Buffer.from([0x00, 0x00, 0x55, 0xAA]);
    const sequence = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    const command = Buffer.from([0x00, 0x00, 0x00, 0x07]); // CONTROL
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32BE(payloadBuffer.length + 8, 0);

    const packetWithoutCrc = Buffer.concat([prefix, sequence, command, lengthBuf, payloadBuffer]);
    const crcVal = crc32(packetWithoutCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);

    const suffix = Buffer.from([0x00, 0x00, 0xAA, 0x55]);
    const fullPacket = Buffer.concat([packetWithoutCrc, crcBuf, suffix]);

    return new Promise((resolve) => {
      let resolved = false;
      const socket = new net.Socket();

      const finish = (success: boolean, msg: string, errDet?: string) => {
        if (resolved) return;
        resolved = true;
        try { socket.destroy(); } catch {}
        resolve({
          success,
          latencyMs: Date.now() - startTime,
          driver: 'native_v33',
          message: msg,
          errorDetails: errDet
        });
      };

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        socket.write(fullPacket, () => {
          setTimeout(() => {
            finish(true, `Comando ${state ? 'ON' : 'OFF'} transmitido a ${config.ip}:${port} (Tuya v3.3)`);
          }, 40);
        });
      });

      socket.on('data', (data) => {
        finish(true, `Respuesta recibida de ${config.ip}:${port} (${data.length} bytes)`);
      });

      socket.on('timeout', () => {
        finish(false, `Timeout de socket al conectar a ${config.ip}:${port}`);
      });

      socket.on('error', (err) => {
        finish(false, `Error de socket: ${err.message}`, err.message);
      });

      try {
        socket.connect(port, config.ip);
      } catch (err: any) {
        finish(false, `No se pudo iniciar socket: ${err?.message}`);
      }
    });
  }

  /**
   * Conmutador maestro:
   * 1. Prioriza 'tinytuya' si está instalado en el sistema (el script probado que funciona)
   * 2. Si no, ejecuta el socket nativo v3.4 o v3.3 según corresponda
   */
  static async setPower(config: TuyaDeviceConfig, state: boolean, timeoutMs: number = 2500): Promise<TuyaResult> {
    if (!config.ip || !config.deviceId || !config.localKey) {
      return {
        success: false,
        latencyMs: 0,
        message: 'Faltan parámetros requeridos (IP local, Device ID o Local Key)'
      };
    }

    const version = config.version || '3.4';

    // 1. Intentar con tinytuya (puente Python ultra-confiable)
    const pyResult = await this.setPowerViaTinyTuya(config, state);
    if (pyResult && pyResult.success) {
      return pyResult;
    }

    // 2. Si tinytuya reportó un error específico de red o no está instalado, usar el socket nativo
    if (version === '3.4') {
      const nativeResult = await this.setPowerNativeV34(config, state, timeoutMs);
      if (nativeResult.success) return nativeResult;

      // Si falla y tinytuya dio error, combinar los mensajes para máxima claridad
      const isPrivateLan = config.ip.startsWith('192.168.') || config.ip.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(config.ip);
      const lanNotice = isPrivateLan ? " [Diagnóstico]: La IP " + config.ip + " es una red privada local. Si esta web corre en la nube, ejecuta en tu PC 'python jarvis_tuya_bridge.py' para enlazarla por MQTT en 15ms, o corre la web localmente en tu terminal." : "";

      if (pyResult && !pyResult.success) {
        return {
          ...nativeResult,
          message: `${nativeResult.message}.${lanNotice}`
        };
      }
      return {
        ...nativeResult,
        message: `${nativeResult.message}.${lanNotice}`
      };
    } else {
      return await this.setPowerNativeV33(config, state, timeoutMs);
    }
  }
}
