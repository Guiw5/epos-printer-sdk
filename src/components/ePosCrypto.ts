import { str2bigInt, randBigInt, powMod } from '../crypto/bigint';
import { MD5 } from '../crypto/md5';
import blowfish, { EncryptParams, DecryptParams } from '../crypto/blowfish';
import { encode, decode } from '../crypto/base64';

// Tipos necesarios para mantener la compatibilidad con la implementación original
type BigInteger = number[];

// Función auxiliar para convertir BigInteger a string hexadecimal
function bigInt2str(num: BigInteger, base: number): string {
  return num.map(n => n.toString(base).padStart(2, '0')).join('');
}

/**
 * Implementación TypeScript de ePosCrypto
 * Mantiene la funcionalidad exacta del SDK original
 */
export class ePosCrypto {
  private pubkey_c: BigInteger;
  private secretKey: string;

  constructor() {
    this.pubkey_c = [];
    this.secretKey = '';
  }

  /**
   * Genera las claves del cliente usando el protocolo Diffie-Hellman
   * @param arg_prime_s - Número primo en formato hexadecimal
   * @param arg_pubkey_s - Clave pública en formato hexadecimal
   */
  public genClientKeys(arg_prime_s: string, arg_pubkey_s: string): void {
    // Generador fijo g = 2
    const g = str2bigInt("2", 10);    
    // Convertir primo de hex a BigInteger
    const prime_c = str2bigInt(arg_prime_s, 16);
    // Generar clave privada aleatoria de 64 bits
    const privkey_c = randBigInt(64, 0);
    // Calcular clave pública: g^privkey mod prime
    this.pubkey_c = powMod(g, privkey_c, prime_c);
    // Convertir clave pública recibida de hex a BigInteger
    const intPubkey = str2bigInt(arg_pubkey_s, 16);
    // Calcular secreto compartido: pubkey^privkey mod prime
    const modNum = powMod(intPubkey, privkey_c, prime_c);
    // Convertir a string hexadecimal
    let strModNum = bigInt2str(modNum, 16);
    let strSecretKey = strModNum.toLowerCase();
    // Padding con ceros hasta 192 caracteres
    while (strSecretKey.length < 192) {
      strSecretKey = '0' + strSecretKey;
    }
    // Hash MD5 del secreto compartido
    this.secretKey = MD5.bin(strSecretKey);
  }

  /**
   * Cifra datos usando Blowfish en modo CBC
   * @param data - Datos a cifrar
   * @returns Datos cifrados en base64 o cadena vacía si hay error
   */
  public bfEncrypt(data: string): string {
    try {
      const enc_req: EncryptParams = {
        data: data,
        key: this.secretKey,
        mode: "cbc",
        // round: 16 => never used
        iv: blowfish.mkIV()
      };
      
      const cdata = blowfish.encrypt(enc_req);
      return encode(cdata);
    } catch {
      return "";
    }
  }

  /**
   * Descifra datos usando Blowfish en modo CBC
   * @param data - Datos cifrados en base64
   * @returns Datos descifrados o cadena vacía si hay error
   */
  public bfDecrypt(data: string): string {
    try {
      const dec_req: DecryptParams = {
        data: decode(data),
        key: this.secretKey,
        mode: "cbc"
      };
      
      return blowfish.decrypt(dec_req);
    } catch {
      return "";
    }
  }

  /**
   * Obtiene la clave pública actual
   * @returns Clave pública como BigInteger
   */
  public getPubkey(): BigInteger {
    return this.pubkey_c;
  }  
}
