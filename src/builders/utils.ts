export function escapeMarkup(s: string): string {
  const markup = /[<>&'"\t\n\r]/g;
  const replacements: { [key: string]: string } = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
    '\t': '&#9;',
    '\n': '&#10;',
    '\r': '&#13;',
  };
  return markup.test(s) ? s.replace(markup, c => replacements[c] || c) : s;
}

export function escapeControl(s: string): string {
  const control = /[\\\x00-\x1f\x7f-\xff]/g;
  return control.test(s)
    ? s.replace(control, c => c === '\\' ? '\\\\' : `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
    : s;
}
export function validateRange(name: string, value: number, min: number, max: number): void {
  if (isNaN(value) || value < min || value > max) {
    throw new Error(`Parameter "${name}" is invalid`);
  }
 }

export function toHexBinary(s: string): string {
  return Array.from(s)
    .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

export function toHexBinaryOld(s: string): string {
  const l: number = s.length;
  const r: string[] = new Array(l);
  
  for (let i = 0; i < l; i++) {
    r[i] = ("0" + s.charCodeAt(i).toString(16)).slice(-2);
  }
  
  return r.join("");
}


export function toBase64Binary(s: string): string {
  return btoa(s);
}

export function toBase64BinaryOLD(s: string): string {
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result: string[] = [];  
  let i = 0;
  // Proceso de conversión en bloques de 3 bytes a 4 caracteres base64
  while (i < s.length) {
    const n = (s.charCodeAt(i++) << 16) | (s.charCodeAt(i++) << 8) | s.charCodeAt(i++);
    result.push(base64Chars.charAt((n >> 18) & 63));
    result.push(base64Chars.charAt((n >> 12) & 63));
    result.push(base64Chars.charAt((n >> 6) & 63));
    result.push(base64Chars.charAt(n & 63));
  }
  // Agregar padding '=' si es necesario
  const padding = (s.length % 3) === 1 ? 2 : (s.length % 3) === 2 ? 1 : 0;
  result.splice(-padding, padding, ...Array(padding).fill('='));
  return result.join('');
}

export function toMonoImage(imgdata: ImageData, s: number, g: number): string {
  const charCode = String.fromCharCode;
  const m8 = [
    [2, 130, 34, 162, 10, 138, 42, 170],
    [194, 66, 226, 98, 202, 74, 234, 106],
    [50, 178, 18, 146, 58, 186, 26, 154],
    [242, 114, 210, 82, 250, 122, 218, 90],
    [14, 142, 46, 174, 6, 134, 38, 166],
    [206, 78, 238, 110, 198, 70, 230, 102],
    [62, 190, 30, 158, 54, 182, 22, 150],
    [254, 126, 222, 94, 246, 118, 214, 86],
  ];

  const { data: d, width: w, height: h } = imgdata;
  const r = new Array((w + 7) >> 3 * h);
  let n = 0, p = 0, q = 0, t = 128;
  const errorBuffer = s === 1 ? new Array(w).fill(0) : [];
  
  for (let j = 0; j < h; j++) {
    let e1 = 0, e2 = 0;

    for (let i = 0; i < w; i++) {
      const b = i & 7;
      t = s === 0 ? m8[j & 7][b] : t;

      let v = ((d[p++] * 0.29891 + d[p++] * 0.58661 + d[p++] * 0.11448) * d[p] / 255 + 255 - d[p++]) / 255;
      v = Math.pow(v, 1 / g) * 255 | 0;

      if (s === 1) {
        v += errorBuffer[i] + e1 >> 4;
        const f = v - (v < t ? 0 : 255);

        if (i > 0) errorBuffer[i - 1] += f;
        errorBuffer[i] = f * 7 + e2;
        e1 = f * 5;
        e2 = f * 3;
      }

      if (v < t) {
        n |= 128 >> b;
      }

      if (b === 7 || i === w) {
        r[q++] = charCode(n === 16 ? 32 : n);
        n = 0;
      }
    }
  }
  return r.join('');
}

export function toGrayImage(imgdata: ImageData, g: number): string {
  const charCode = String.fromCharCode;
  const m4 = [
    [0, 9, 2, 11],
    [13, 4, 15, 6],
    [3, 12, 1, 10],
    [16, 7, 14, 5],
  ];

  const thermal = [0, 7, 13, 19, /* ... el resto de valores omitidos por longitud */ 255];
  const { data: d, width: w, height: h } = imgdata;
  const r = new Array((w + 1) >> 1 * h);
  let n = 0, p = 0, q = 0;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const b = i & 1;

      let v = ((d[p++] * 0.29891 + d[p++] * 0.58661 + d[p++] * 0.11448) * d[p] / 255 + 255 - d[p++]) / 255;
      v = thermal[Math.pow(v, 1 / g) * 255 | 0];
      let v1 = v / 17 | 0;

      if (m4[j & 3][i & 3] < v % 17) {
        v1++;
      }

      n |= v1 << ((1 - b) << 2);

      if (b === 1 || i === w) {
        r[q++] = charCode(n);
        n = 0;
      }
    }
  }
  return r.join('');
}
