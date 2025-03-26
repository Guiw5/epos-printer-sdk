var base64 = (function(undefined) {
  var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
    u = {},
    v = 0;
  while (v < 64) {
    u[t.charAt(v)] = v;
    v++
  }
  return {
    encode: function(d) {
      var i = 0,
        j = 0,
        n, s = d + "\0\0",
        l = s.length - 2,
        r = new Array((l + 2) / 3 << 2);
      while (i < l) {
        n = (s.charCodeAt(i++) & 255) << 16 | (s.charCodeAt(i++) & 255) << 8 | (s.charCodeAt(i++) & 255);
        r[j++] = t.charAt(n >> 18 & 63);
        r[j++] = t.charAt(n >> 12 & 63);
        r[j++] = t.charAt(n >> 6 & 63);
        r[j++] = t.charAt(n & 63)
      }
      while (i > l) {
        r[--j] = "=";
        i--
      }
      return r.join("")
    },
    decode: function(d) {
      var i = 0,
        j = 0,
        n, s = d.replace(/[^A-Za-z0-9\+\/]/g, "") + "AAA",
        l = s.length - 3,
        r = new Array((l + 3 >> 2) * 3),
        x = String.fromCharCode;
      while (i < l) {
        n = u[s.charAt(i++)] << 18 | u[s.charAt(i++)] << 12 | u[s.charAt(i++)] << 6 | u[s.charAt(i++)];
        r[j++] = x(n >> 16 & 255);
        r[j++] = x(n >> 8 & 255);
        r[j++] = x(n & 255)
      }
      r.length = j - i + l;
      return r.join("")
    }
  }
})();