const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP: { [key: string]: number } = BASE64_CHARS.split("").reduce((acc, char, index) => {
  acc[char] = index;
  return acc;
}, {} as { [key: string]: number });

/**
 * Encodes a string into Base64 format.
 * @param input - The string to encode.
 * @returns A Base64 encoded string.
 */
export function encode(input: string): string {
  let output = "";
  let i = 0;
  const paddedInput = input + "\0\0"; // Add padding
  const length = paddedInput.length - 2;

  while (i < length) {
    const n =
      (paddedInput.charCodeAt(i++) & 255) << 16 |
      (paddedInput.charCodeAt(i++) & 255) << 8 |
      (paddedInput.charCodeAt(i++) & 255);

    output +=
      BASE64_CHARS[n >> 18 & 63] +
      BASE64_CHARS[n >> 12 & 63] +
      BASE64_CHARS[n >> 6 & 63] +
      BASE64_CHARS[n & 63];
  }

  while (i > length) {
    output = output.slice(0, -1) + "=";
    i--;
  }

  return output;
}

/**
 * Decodes a Base64-encoded string.
 * @param input - The Base64 encoded string.
 * @returns The decoded string.
 */
export function decode(input: string): string {
  let output = "";
  let i = 0;
  const sanitizedInput = input.replace(/[^A-Za-z0-9+/]/g, "") + "AAA"; // Normalize input
  const length = sanitizedInput.length - 3;

  while (i < length) {
    const n =
      BASE64_LOOKUP[sanitizedInput.charAt(i++)] << 18 |
      BASE64_LOOKUP[sanitizedInput.charAt(i++)] << 12 |
      BASE64_LOOKUP[sanitizedInput.charAt(i++)] << 6 |
      BASE64_LOOKUP[sanitizedInput.charAt(i++)];

    output +=
      String.fromCharCode(n >> 16 & 255) +
      String.fromCharCode(n >> 8 & 255) +
      String.fromCharCode(n & 255);
  }

  return output.slice(0, output.length - (i - length));
}
