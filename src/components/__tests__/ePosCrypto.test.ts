import { describe, it, expect, beforeEach } from 'vitest';

import { ePosCrypto } from '../ePosCrypto';
import { randProbPrime, bigInt2str } from '../../crypto/bigint';

describe('ePosCrypto', () => {
  let crypto: ePosCrypto;

  beforeEach(() => {
    crypto = new ePosCrypto();
  });

  describe('genClientKeys', () => {
    it('debería generar las claves del cliente correctamente', () => {
      // Generamos un número primo grande usando las funciones existentes
      const prime = randProbPrime(64);
      const prime_s = bigInt2str(prime, 16);
      const pubkey_s = prime_s; // Para tests usamos el mismo valor

      crypto.genClientKeys(prime_s, pubkey_s);
      
      // Verificar que se generó una clave pública
      const pubkey = crypto.getPubkey();
      expect(pubkey).toBeDefined();
      expect(Array.isArray(pubkey)).toBe(true);
      expect(pubkey.length).toBeGreaterThan(0);
    });
  });

  describe('bfEncrypt y bfDecrypt', () => {
    it('debería encriptar y desencriptar correctamente', () => {
      // Primero generamos las claves
      const prime = randProbPrime(64);
      const prime_s = bigInt2str(prime, 16);
      const pubkey_s = prime_s; // Para tests usamos el mismo valor
      crypto.genClientKeys(prime_s, pubkey_s);

      // Datos de prueba
      const originalData = 'Hola, esto es un mensaje de prueba!';
      
      // Encriptar
      const encryptedData = crypto.bfEncrypt(originalData);
      
      // Verificar que la encriptación fue exitosa
      expect(encryptedData).toBeDefined();
      expect(encryptedData).not.toBe('');
      expect(encryptedData).not.toBe(originalData);
      
      // Desencriptar
      const decryptedData = crypto.bfDecrypt(encryptedData);
      
      // Verificar que la desencriptación fue exitosa
      expect(decryptedData).toBeDefined();
      expect(decryptedData).not.toBe('');
      expect(decryptedData).toBe(originalData);
    });

    it('debería manejar datos vacíos correctamente', () => {
      // Primero generamos las claves
      const prime = randProbPrime(64);
      const prime_s = bigInt2str(prime, 16);
      const pubkey_s = prime_s; // Para tests usamos el mismo valor
      crypto.genClientKeys(prime_s, pubkey_s);

      const emptyData = '';
      
      const encryptedEmpty = crypto.bfEncrypt(emptyData);
      // expect(encryptedEmpty).toBe('o2GQSj1KBvU=');      
      const decryptedEmpty = crypto.bfDecrypt(encryptedEmpty);
      expect(decryptedEmpty).toBe('');
    });
  });
}); 