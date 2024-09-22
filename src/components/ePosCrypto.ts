export class ePosCrypto {
  public pubkey_c: string = "";
  private secretKey: string = "";

  /**
   * Genera las claves del cliente usando Diffie-Hellman.
   * @param arg_prime_s - El valor primo en formato hexadecimal.
   * @param arg_pubkey_s - La clave pública en formato hexadecimal.
   */
  public genClientKeys(arg_prime_s: string, arg_pubkey_s: string): void {
    const g = str2bigInt("2", 10);
    const prime_c = str2bigInt(arg_prime_s, 16);
    const privkey_c = randBigInt(64, 0);
    
    this.pubkey_c = powMod(g, privkey_c, prime_c);

    const intPubkey = str2bigInt(arg_pubkey_s, 16);
    const modNum = powMod(intPubkey, privkey_c, prime_c);
    let strSecretKey = bigInt2str(modNum, 16).toLowerCase();

    // Asegura que la clave secreta tenga la longitud de 192 caracteres.
    while (strSecretKey.length < 192) {
      strSecretKey = "0" + strSecretKey;
    }

    this.secretKey = md5.bin(strSecretKey); // Genera la clave secreta con MD5.
  }

  /**
   * Encripta los datos utilizando Blowfish.
   * @param data - Los datos a encriptar.
   * @returns El texto cifrado en Base64 o una cadena vacía en caso de error.
   */
  public bfEncrypt(data: string): string {
    try {
      const enc_req = {
        data: data,
        key: this.secretKey,
        mode: "cbc",
        round: 16,
        iv: blowfish.mkIV() // Genera el IV (Vector de Inicialización) para el modo CBC.
      };

      const enc_data = blowfish.encrypt(enc_req);
      return base64.encode(enc_data);
    } catch (e) {
      console.error("Encryption failed:", e);
      return "";
    }
  }

  /**
   * Desencripta los datos encriptados con Blowfish.
   * @param data - Los datos encriptados en Base64.
   * @returns Los datos desencriptados o una cadena vacía en caso de error.
   */
  public bfDecrypt(data: string): string {
    try {
      const dec_req = {
        data: base64.decode(data),
        key: this.secretKey,
        mode: "cbc"
      };

      return blowfish.decrypt(dec_req);
    } catch (e) {
      console.error("Decryption failed:", e);
      return "";
    }
  }
}
