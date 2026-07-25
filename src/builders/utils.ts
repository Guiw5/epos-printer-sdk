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
  // Deliberately matches raw control bytes — this escapes them for the wire protocol.
  // eslint-disable-next-line no-control-regex
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
  // Convert in blocks of 3 bytes to 4 base64 characters
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
  const r = new Array(((w + 7) >> 3) * h);
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

  const thermal = [0, 7, 13, 19, 23, 27, 31, 35, 40, 44, 49, 52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 70, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 83, 84, 85, 86, 86, 87, 88, 88, 89, 90, 90, 91, 91, 92, 93, 93, 94, 94, 95, 96, 96, 97, 98, 98, 99, 99, 100, 101, 101, 102, 102, 103, 103, 104, 104, 105, 105, 106, 106, 107, 107, 108, 108, 109, 109, 110, 110, 111, 111, 112, 112, 112, 113, 113, 114, 114, 115, 115, 116, 116, 117, 117, 118, 118, 119, 119, 120, 120, 120, 121, 121, 122, 122, 123, 123, 123, 124, 124, 125, 125, 125, 126, 126, 127, 127, 127, 128, 128, 129, 129, 130, 130, 130, 131, 131, 132, 132, 132, 133, 133, 134, 134, 135, 135, 135, 136, 136, 137, 137, 137, 138, 138, 139, 139, 139, 140, 140, 141, 141, 141, 142, 142, 143, 143, 143, 144, 144, 145, 145, 146, 146, 146, 147, 147, 148, 148, 148, 149, 149, 150, 150, 150, 151, 151, 152, 152, 152, 153, 153, 154, 154, 155, 155, 155, 156, 156, 157, 157, 158, 158, 159, 159, 160, 160, 161, 161, 161, 162, 162, 163, 163, 164, 164, 165, 165, 166, 166, 166, 167, 167, 168, 168, 169, 169, 170, 170, 171, 171, 172, 173, 173, 174, 175, 175, 176, 177, 178, 178, 179, 180, 180, 181, 182, 182, 183, 184, 184, 185, 186, 186, 187, 189, 191, 193, 195, 198, 200, 202, 255];
  const { data: d, width: w, height: h } = imgdata;
  const r = new Array(((w + 1) >> 1) * h);
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
