// Types
type BigIntArray = number[];

// Global variables
let bpe: number = 0;
let mask: number = 0;
let radix: number = mask + 1;
let digitsStr: string = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_=!@#$%^&*()[]{}|;:,.<>/?`~ \\'\"+-";
let buff: BigIntArray;

// Initialize bpe
for (bpe = 0; (1 << (bpe + 1)) > (1 << bpe); bpe++) {}
bpe >>= 1;
mask = (1 << bpe) - 1;
radix = mask + 1;

// Arrays initialization
let one: BigIntArray = int2bigInt(1, 1, 1);
let t: BigIntArray = new Array(0);
let ss: BigIntArray = t;
let s0: BigIntArray = t;
// let s1: BigIntArray = t;
// let s2: BigIntArray = t;
let s3: BigIntArray = t;
let s4: BigIntArray = t;
let s5: BigIntArray = t;
let s6: BigIntArray = t;
let s7: BigIntArray = t;
let T: BigIntArray = t;
let sa: BigIntArray = t;
let mr_x1: BigIntArray = t;
let mr_r: BigIntArray = t;
let mr_a: BigIntArray = t;
let eg_v: BigIntArray = t;
let eg_u: BigIntArray = t;
let eg_A: BigIntArray = t;
let eg_B: BigIntArray = t;
let eg_C: BigIntArray = t;
let eg_D: BigIntArray = t;
// let md_q1: BigIntArray = t;
// let md_q2: BigIntArray = t;
// let md_q3: BigIntArray = t;
// let md_r: BigIntArray = t;
// let md_r1: BigIntArray = t;
// let md_r2: BigIntArray = t;
// let md_tt: BigIntArray = t;
let primes: BigIntArray = t;
let pows: number[] = t;
let s_i: BigIntArray = t;
let s_i2: BigIntArray = t;
let s_R: BigIntArray = t;
let s_rm: BigIntArray = t;
let s_q: BigIntArray = t;
let s_n1: BigIntArray = t;
let s_a: BigIntArray = t;
let s_r2: BigIntArray = t;
let s_n: BigIntArray = t;
let s_b: BigIntArray = t;
let s_d: BigIntArray = t;
// @ts-ignore
let s_x1: BigIntArray = t;
// @ts-ignore
let s_x2: BigIntArray = t;
let s_aa: BigIntArray = t;
let rpprb: BigIntArray = t;

// Utility functions
function adapterMathRandom(): number {
    let crypto = window.crypto || (window as any).msCrypto;
    let rand: number;
    
    try {
      rand = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    } catch {
      throw new Error("GetRandomValues is not supported on your browser");
    }
    return rand;
}

function findPrimes(n: number): BigIntArray {
  let i: number, s: number[], p: number, ans: BigIntArray;
  s = new Array(n);
  for (i = 0; i < n; i++) {
    s[i] = 0;
  }
  s[0] = 2;
  p = 0;
  for (; s[p] < n;) {
    for (i = s[p] * s[p]; i < n; i += s[p]) {
      s[i] = 1;
    }
    p++;
    s[p] = s[p - 1] + 1;
    for (; s[p] < n && s[s[p]]; s[p]++) {}
  }
  ans = new Array(p);
  for (i = 0; i < p; i++) {
    ans[i] = s[i];
  }
  return ans;
}

function millerRabinInt(x: BigIntArray, b: number): number {
  if (mr_x1.length != x.length) {
    mr_x1 = dup(x);
    mr_r = dup(x);
    mr_a = dup(x);
  }
  copyInt_(mr_a, b);
  return millerRabin(x, mr_a);
}

function millerRabin(x: BigIntArray, b: BigIntArray): number {
  let i: number, j: number, k: number, s: number = 0;  // Initialize s
  
  if (mr_x1.length != x.length) {
    mr_x1 = dup(x);
    mr_r = dup(x);
    mr_a = dup(x);
  }
  
  copy_(mr_a, b);
  copy_(mr_r, x);
  copy_(mr_x1, x);
  addInt_(mr_r, -1);
  addInt_(mr_x1, -1);
  
  k = 0;
  for (i = 0; i < mr_r.length; i++) {
    for (j = 1; j < mask; j <<= 1) {
      if (x[i] & j) {
        s = (k < mr_r.length + bpe ? k : 0);
        i = mr_r.length;
        j = mask;
      } else {
        k++;
      }
    }
  }

  if (s) {
    rightShift_(mr_r, s);
  }
  
  powMod_(mr_a, mr_r, x);
  
  if (!equalsInt(mr_a, 1) && !equals(mr_a, mr_x1)) {
    j = 1;
    while (j <= s - 1 && !equals(mr_a, mr_x1)) {
      squareMod_(mr_a, x);
      if (equalsInt(mr_a, 1)) {
        return 0;
      }
      j++;
    }
    if (!equals(mr_a, mr_x1)) {
      return 0;
    }
  }
  return 1;
}

function bitSize(x: BigIntArray): number {
  let j: number, z: number, w: number;
  for (j = x.length - 1; (x[j] == 0) && (j > 0); j--) {}
  for (z = 0, w = x[j]; w; (w >>= 1), z++) {}
  z += bpe * j;
  return z;
}

function expand(x: BigIntArray, n: number): BigIntArray {
  let ans: BigIntArray = int2bigInt(0, (x.length > n ? x.length : n) * bpe, 0);
  copy_(ans, x);
  return ans;
}

function randTruePrime(k: number): BigIntArray {
  let ans: BigIntArray = int2bigInt(0, k, 0);
  randTruePrime_(ans, k);
  return trim(ans, 1);
}

function randProbPrime(k: number): BigIntArray {
  if (k >= 600) return randProbPrimeRounds(k, 2);
  if (k >= 550) return randProbPrimeRounds(k, 4);
  if (k >= 500) return randProbPrimeRounds(k, 5);
  if (k >= 400) return randProbPrimeRounds(k, 6);
  if (k >= 350) return randProbPrimeRounds(k, 7);
  if (k >= 300) return randProbPrimeRounds(k, 9);
  if (k >= 250) return randProbPrimeRounds(k, 12);
  if (k >= 200) return randProbPrimeRounds(k, 15);
  if (k >= 150) return randProbPrimeRounds(k, 18);
  if (k >= 100) return randProbPrimeRounds(k, 27);
  return randProbPrimeRounds(k, 40);
}

function randProbPrimeRounds(k: number, n: number): BigIntArray {
  let ans: BigIntArray, i: number, divisible: number, B: number;
  B = 30000;
  ans = int2bigInt(0, k, 0);
  
  if (primes.length == 0) {
    primes = findPrimes(30000);
  }
  
  if (rpprb.length != ans.length) {
    rpprb = dup(ans);
  }
  
  for (;;) {
    randBigInt_(ans, k, 0);
    ans[0] |= 1;
    divisible = 0;
    
    for (i = 0; (i < primes.length) && (primes[i] <= B); i++) {
      if (modInt(ans, primes[i]) == 0 && !equalsInt(ans, primes[i])) {
        divisible = 1;
        break;
      }
    }
    
    for (i = 0; i < n && !divisible; i++) {
      randBigInt_(rpprb, k, 0);
      while (!greater(ans, rpprb)) {
        randBigInt_(rpprb, k, 0);
      }
      if (!millerRabin(ans, rpprb)) {
        divisible = 1;
      }
    }
    
    if (!divisible) {
      return ans;
    }
  }
}

function mod(x: BigIntArray, n: BigIntArray): BigIntArray {
  var ans = dup(x);
  mod_(ans, n);
  return trim(ans, 1);
}
function addInt(x: BigIntArray, n: number): BigIntArray {
  var ans = expand(x, x.length + 1);
  addInt_(ans, n);
  return trim(ans, 1);
}

function mult(x: BigIntArray, y: BigIntArray): BigIntArray {
  var ans = expand(x, x.length + y.length);
  mult_(ans, y);
  return trim(ans, 1);
}

function powMod(x: BigIntArray, y: BigIntArray, n: BigIntArray): BigIntArray {
  let ans: BigIntArray = expand(x, n.length);
  powMod_(ans, trim(y, 2), trim(n, 2));  // Remove extra parameter
  return trim(ans, 1);
}


function sub(x: BigIntArray, y: BigIntArray): BigIntArray {
  var ans = expand(x, x.length > y.length ? x.length + 1 : y.length + 1);
  sub_(ans, y);
  return trim(ans, 1);
}
function add(x: BigIntArray, y: BigIntArray): BigIntArray {
  var ans = expand(x, x.length > y.length ? x.length + 1 : y.length + 1);
  add_(ans, y);
  return trim(ans, 1);
}

function inverseMod(x: BigIntArray, n: BigIntArray): BigIntArray | null {
  var ans = expand(x, n.length);
  var s;
  s = inverseMod_(ans, n);
  return s ? trim(ans, 1) : null;
}

function multMod(x: BigIntArray, y: BigIntArray, n: BigIntArray): BigIntArray {
  var ans = expand(x, n.length);
  multMod_(ans, y, n);
  return trim(ans, 1);
}

function randTruePrime_(ans: BigIntArray, k: number): void {
  let c: number, m: number, pm: number, dd: number, j: number, r: number, B: number, divisible: number, z: number, zz: number, recSize: number;
  const recLimit = 20;
  let w: number;

  if (primes.length == 0) {
    primes = findPrimes(30000);
  }
  if (pows.length == 0) {
    pows = new Array(512);
    for (j = 0; j < 512; j++) {
      pows[j] = Math.pow(2, j / 511 - 1);
    }
  }

  c = 0.1;
  m = 20;

  if (s_i2.length != ans.length) {
    s_i2 = dup(ans);
    s_R = dup(ans);
    s_n1 = dup(ans);
    s_r2 = dup(ans);
    s_d = dup(ans);
    s_x1 = dup(ans);
    s_x2 = dup(ans);
    s_b = dup(ans);
    s_n = dup(ans);
    s_i = dup(ans);
    s_rm = dup(ans);
    s_q = dup(ans);
    s_a = dup(ans);
    s_aa = dup(ans);
  }

  if (k <= recLimit) {
    pm = (1 << ((k + 2) >> 1)) - 1;
    copyInt_(ans, 0);
    for (dd = 1; dd;) {
      dd = 0;
      ans[0] = 1 | (1 << (k - 1)) | Math.floor(adapterMathRandom() * (1 << k));
      for (j = 1; (j < primes.length) && ((primes[j] & pm) == primes[j]); j++) {
        if (0 == (ans[0] % primes[j])) {
          dd = 1;
          break;
        }
      }
    }
    carry_(ans);
    return;
  }

  B = c * k * k;
  if (k > 2 * m) {
    for (r = 1; k - k * r <= m;) {
      r = pows[Math.floor(adapterMathRandom() * 512)];
    }
  } else {
    r = 0.5;
  }

  recSize = Math.floor(r * k) + 1;
  randTruePrime_(s_q, recSize);
  copyInt_(s_i2, 0);
  s_i2[Math.floor((k - 2) / bpe)] |= (1 << ((k - 2) % bpe));
  divide_(s_i2, s_q, s_i, s_rm);

  z = bitSize(s_i);

  for (;;) {
    for (;;) {
      randBigInt_(s_R, z, 0);
      if (greater(s_i, s_R)) {
        break;
      }
    }
    addInt_(s_R, 1);
    add_(s_R, s_i);
    copy_(s_n, s_q);
    mult_(s_n, s_R);
    multInt_(s_n, 2);
    addInt_(s_n, 1);
    copy_(s_r2, s_R);
    multInt_(s_r2, 2);
    
    for (divisible = 0, j = 0; (j < primes.length) && (primes[j] < B); j++) {
      if (modInt(s_n, primes[j]) == 0 && !equalsInt(s_n, primes[j])) {
        divisible = 1;
        break;
      }
    }
    
    if (!divisible) {
      if (!millerRabinInt(s_n, 2)) {
        divisible = 1;
      }
    }
    
    if (!divisible) {
      addInt_(s_n, -3);
      for (j = s_n.length - 1; (s_n[j] == 0) && (j > 0); j--) {}
      for (zz = 0, w = s_n[j]; w; (w >>= 1), zz++) {}
      zz += bpe * j;
      for (;;) {
        randBigInt_(s_a, zz, 0);
        if (greater(s_n, s_a)) {
          break;
        }
      }
      addInt_(s_n, 3);
      addInt_(s_a, 2);
      copy_(s_b, s_a);
      copy_(s_n1, s_n);
      addInt_(s_n1, -1);
      powMod_(s_b, s_n1, s_n);
      addInt_(s_b, -1);
      if (isZero(s_b)) {
        copy_(s_b, s_a);
        powMod_(s_b, s_r2, s_n);
        addInt_(s_b, -1);
        copy_(s_aa, s_n);
        copy_(s_d, s_b);
        GCD_(s_d, s_n);
        if (equalsInt(s_d, 1)) {
          copy_(ans, s_aa);
          return;
        }
      }
    }
  }
}

function randBigInt(n: number, s: number): BigIntArray {
  let a: number = Math.floor((n - 1) / bpe) + 2;
  let b: BigIntArray = int2bigInt(0, 0, a);
  randBigInt_(b, n, s);
  return b;
}

function randBigInt_(b: BigIntArray, n: number, s: number): void {
  let i: number, a: number;
  for (i = 0; i < b.length; i++) {
    b[i] = 0;
  }
  a = Math.floor((n - 1) / bpe) + 1;
  for (i = 0; i < a; i++) {
    b[i] = Math.floor(adapterMathRandom() * (1 << (bpe - 1)));
  }
  b[a - 1] &= (2 << ((n - 1) % bpe)) - 1;
  if (s == 1) {
    b[a - 1] |= (1 << ((n - 1) % bpe));
  }
}

function GCD(x: BigIntArray, y: BigIntArray): BigIntArray {
  let xc: BigIntArray = dup(x);
  let yc: BigIntArray = dup(y);
  GCD_(xc, yc);
  return xc;
}

function GCD_(x: BigIntArray, y: BigIntArray): void {
  let i: number, xp: number, yp: number, A: number, B: number, C: number, D: number, q: number, sing: number;
  let t: number;
  let qp: number;
  if (T.length != x.length) {
    T = dup(x);
  }
  sing = 1;
  while (sing) {
    sing = 0;
    for (i = 1; i < y.length; i++) {
      if (y[i]) {
        sing = 1;
        break;
      }
    }
    if (!sing) break;
    for (i = x.length; !x[i] && i >= 0; i--) {}
    xp = x[i];
    yp = y[i];
    A = 1;
    B = 0;
    C = 0;
    D = 1;
    while ((yp + C) && (yp + D)) {
      q = Math.floor((xp + A) / (yp + C));
      qp = Math.floor((xp + B) / (yp + D));
      if (q != qp) break;
      t = A - q * C;
      A = C;
      C = t;
      t = B - q * D;
      B = D;
      D = t;
      t = xp - q * yp;
      xp = yp;
      yp = t;
    }
    if (B) {
      copy_(T, x);
      linComb_(x, y, A, B);
      linComb_(y, T, D, C);
    } else {
      mod_(x, y);
      copy_(T, x);
      copy_(x, y);
      copy_(y, T);
    }
  }
  if (y[0] == 0) return;
  t = modInt(x, y[0]);
  copyInt_(x, y[0]);
  y[0] = t;
  while (y[0]) {
    x[0] %= y[0];
    t = x[0];
    x[0] = y[0];
    y[0] = t;
  }
}

function inverseMod_(x: BigIntArray, n: BigIntArray): number {
  let k: number = 1 + 2 * Math.max(x.length, n.length);
  
  if (!(x[0] & 1) && !(n[0] & 1)) {
    copyInt_(x, 0);
    return 0;
  }
  
  if (eg_u.length != k) {
    eg_u = new Array(k);
    eg_v = new Array(k);
    eg_A = new Array(k);
    eg_B = new Array(k);
    eg_C = new Array(k);
    eg_D = new Array(k);
  }
  
  copy_(eg_u, x);
  copy_(eg_v, n);
  copyInt_(eg_A, 1);
  copyInt_(eg_B, 0);
  copyInt_(eg_C, 0);
  copyInt_(eg_D, 1);
  
  for (;;) {
    while (!(eg_u[0] & 1)) {
      halve_(eg_u);
      if (!(eg_A[0] & 1) && !(eg_B[0] & 1)) {
        halve_(eg_A);
        halve_(eg_B);
      } else {
        add_(eg_A, n);
        halve_(eg_A);
        sub_(eg_B, x);
        halve_(eg_B);
      }
    }
    
    while (!(eg_v[0] & 1)) {
      halve_(eg_v);
      if (!(eg_C[0] & 1) && !(eg_D[0] & 1)) {
        halve_(eg_C);
        halve_(eg_D);
      } else {
        add_(eg_C, n);
        halve_(eg_C);
        sub_(eg_D, x);
        halve_(eg_D);
      }
    }
    
    if (!greater(eg_v, eg_u)) {
      sub_(eg_u, eg_v);
      sub_(eg_A, eg_C);
      sub_(eg_B, eg_D);
    } else {
      sub_(eg_v, eg_u);
      sub_(eg_C, eg_A);
      sub_(eg_D, eg_B);
    }
    
    if (equalsInt(eg_u, 0)) {
      if (negative(eg_C)) {
        add_(eg_C, n);
      }
      copy_(x, eg_C);
      if (!equalsInt(eg_v, 1)) {
        copyInt_(x, 0);
        return 0;
      }
      return 1;
    }
  }
}

function inverseModInt(x: number, n: number): number {
  let a: number = 1, b: number = 0;
  for (;;) {
    if (x == 1) return a;
    if (x == 0) return 0;
    b -= a * Math.floor(n / x);
    n %= x;
    if (n == 1) return b;
    if (n == 0) return 0;
    a -= b * Math.floor(x / n);
    x %= n;
  }
}

// @ts-ignore
function eGCD_(x: BigIntArray, y: BigIntArray, v: BigIntArray, a: BigIntArray, b: BigIntArray): void {
  let g: number = 0;
  let k: number = Math.max(x.length, y.length);
  
  if (eg_u.length != k) {
    eg_u = new Array(k);
    eg_A = new Array(k);
    eg_B = new Array(k);
    eg_C = new Array(k);
    eg_D = new Array(k);
  }
  
  while (!(x[0] & 1) && !(y[0] & 1)) {
    halve_(x);
    halve_(y);
    g++;
  }
  
  copy_(eg_u, x);
  copy_(v, y);
  copyInt_(eg_A, 1);
  copyInt_(eg_B, 0);
  copyInt_(eg_C, 0);
  copyInt_(eg_D, 1);
  
  for (;;) {
    while (!(eg_u[0] & 1)) {
      halve_(eg_u);
      if (!(eg_A[0] & 1) && !(eg_B[0] & 1)) {
        halve_(eg_A);
        halve_(eg_B);
      } else {
        add_(eg_A, y);
        halve_(eg_A);
        sub_(eg_B, x);
        halve_(eg_B);
      }
    }
    
    while (!(v[0] & 1)) {
      halve_(v);
      if (!(eg_C[0] & 1) && !(eg_D[0] & 1)) {
        halve_(eg_C);
        halve_(eg_D);
      } else {
        add_(eg_C, y);
        halve_(eg_C);
        sub_(eg_D, x);
        halve_(eg_D);
      }
    }
    
    if (!greater(v, eg_u)) {
      sub_(eg_u, v);
      sub_(eg_A, eg_C);
      sub_(eg_B, eg_D);
    } else {
      sub_(v, eg_u);
      sub_(eg_C, eg_A);
      sub_(eg_D, eg_B);
    }
    
    if (equalsInt(eg_u, 0)) {
      if (negative(eg_C)) {
        add_(eg_C, y);
        sub_(eg_D, x);
      }
      multInt_(eg_D, -1);
      copy_(a, eg_C);
      copy_(b, eg_D);
      leftShift_(v, g);
      return;
    }
  }
}

function negative(x: BigIntArray): boolean {
  return ((x[x.length - 1] >> (bpe - 1)) & 1) === 1;
}

function greaterShift(x: BigIntArray, y: BigIntArray, shift: number): boolean {
  let i: number, kx: number = x.length, ky: number = y.length;
  let k: number = ((kx + shift) < ky) ? (kx + shift) : ky;
  for (i = ky - 1 - shift; i < kx && i >= 0; i++) {
    if (x[i] > 0) return true;
  }
  for (i = kx - 1 + shift; i < ky; i++) {
    if (y[i] > 0) return false;
  }
  for (i = k - 1; i >= shift; i--) {
    if (x[i - shift] > y[i]) return true;
    else if (x[i - shift] < y[i]) return false;
  }
  return false;
}

function greater(x: BigIntArray, y: BigIntArray): boolean {
  let i: number;
  let k: number = (x.length < y.length) ? x.length : y.length;

  for (i = x.length; i < y.length; i++) {
    if (y[i]) {
      return false;
    }
  }

  for (i = y.length; i < x.length; i++) {
    if (x[i]) {
      return true;
    }
  }

  for (i = k - 1; i >= 0; i--) {
    if (x[i] > y[i]) {
      return true;
    } else if (x[i] < y[i]) {
      return false;
    }
  }
  return false;
}

function divide_(x: BigIntArray, y: BigIntArray, q: BigIntArray, r: BigIntArray): void {
  let kx: number, ky: number;
  let i: number, y1: number, y2: number, c: number, a: number, b: number;
  copy_(r, x);
  for (ky = y.length; y[ky - 1] == 0; ky--) {}
  b = y[ky - 1];
  for (a = 0; b; a++) {
    b >>= 1;
  }
  a = bpe - a;
  leftShift_(y, a);
  leftShift_(r, a);
  for (kx = r.length; r[kx - 1] == 0 && kx > ky; kx--) {}
  copyInt_(q, 0);
  while (!greaterShift(y, r, kx - ky)) {
    subShift_(r, y, kx - ky);
    q[kx - ky]++;
  }
  for (i = kx - 1; i >= ky; i--) {
    if (r[i] == y[ky - 1]) {
      q[i - ky] = mask;
    } else {
      q[i - ky] = Math.floor((r[i] * radix + r[i - 1]) / y[ky - 1]);
    }
    for (;;) {
      y2 = (ky > 1 ? y[ky - 2] : 0) * q[i - ky];
      c = y2 >> bpe;
      y2 = y2 & mask;
      y1 = c + q[i - ky] * y[ky - 1];
      c = y1 >> bpe;
      y1 = y1 & mask;
      if (c == r[i] ? y1 == r[i - 1] ? y2 > (i > 1 ? r[i - 2] : 0) : y1 > r[i - 1] : c > r[i]) {
        q[i - ky]--;
      } else {
        break;
      }
    }
    linCombShift_(r, y, -q[i - ky], i - ky);
    if (negative(r)) {
      addShift_(r, y, i - ky);
      q[i - ky]--;
    }
  }
  rightShift_(y, a);
  rightShift_(r, a);
}

function carry_(x: BigIntArray): void {
  let i: number, k: number, c: number, b: number;
  k = x.length;
  c = 0;
  for (i = 0; i < k; i++) {
    c += x[i];
    b = 0;
    if (c < 0) {
      b = -(c >> bpe);
      c += b * radix;
    }
    x[i] = c & mask;
    c = (c >> bpe) - b;
  }
}

function modInt(x: BigIntArray, n: number): number {
  let i: number, c: number = 0;
  for (i = x.length - 1; i >= 0; i--) {
    c = (c * radix + x[i]) % n;
  }
  return c;
}

function int2bigInt(t: number, bits: number, minSize: number): BigIntArray {
  let k: number = Math.ceil(bits / bpe) + 1;
  k = minSize > k ? minSize : k;
  buff = new Array(k);
  copyInt_(buff, t);
  return buff;
}

function str2bigInt(s: string, base: number, minSize?: number): BigIntArray {
  let d: number, i: number, x: BigIntArray, y: BigIntArray, kk: number;
  let k: number = s.length;
  
  if (base == -1) { // comma-separated list of array elements
    x = new Array(0);
    for (;;) {
      y = new Array(x.length + 1);
      for (i = 0; i < x.length; i++) {
        y[i + 1] = x[i];
      }
      y[0] = parseInt(s, 10);
      x = y;
      d = s.indexOf(",", 0);
      if (d < 1) break;
      s = s.substring(d + 1);
      if (s.length == 0) break;
    }
    if (minSize && x.length < minSize) {
      y = new Array(minSize);
      copy_(y, x);
      return y;
    }
    return x;
  }

  x = int2bigInt(0, base * k, 0);
  for (i = 0; i < k; i++) {
    d = digitsStr.indexOf(s.substring(i, i + 1), 0);
    if (base <= 36 && d >= 36) {
      d -= 26;
    }
    if (d >= base || d < 0) {
      break;
    }
    multInt_(x, base);
    addInt_(x, d);
  }
  
  for (k = x.length; k > 0 && !x[k - 1]; k--) {}
  k = minSize && (minSize > (k + 1)) ? minSize : k + 1;
  y = new Array(k);
  kk = k < x.length ? k : x.length;
  for (i = 0; i < kk; i++) {
    y[i] = x[i];
  }
  for (; i < k; i++) {
    y[i] = 0;
  }
  return y;
}
function equalsInt(x: BigIntArray, y: number): boolean {
  let i: number;
  if (x[0] != y) {
    return false;
  }
  for (i = 1; i < x.length; i++) {
    if (x[i]) {
      return false;
    }
  }
  return true;
}

function equals(x: BigIntArray, y: BigIntArray): boolean {
  let i: number;
  let k: number = x.length < y.length ? x.length : y.length;
  
  for (i = 0; i < k; i++) {
    if (x[i] != y[i]) {
      return false;
    }
  }
  
  if (x.length > y.length) {
    for (; i < x.length; i++) {
      if (x[i]) {
        return false;
      }
    }
  } else {
    for (; i < y.length; i++) {
      if (y[i]) {
        return false;
      }
    }
  }
  return true;
}

function isZero(x: BigIntArray): boolean {
  let i: number;
  for (i = 0; i < x.length; i++) {
    if (x[i]) {
      return false;
    }
  }
  return true;
}

function bigInt2str(x: BigIntArray, base: number): string {
  let i: number, t: number, s: string = "";
  
  if (s6.length != x.length) {
    s6 = dup(x);
  } else {
    copy_(s6, x);
  }
  
  if (base == -1) { // return the list of array elements
    for (i = x.length - 1; i > 0; i--) {
      s += x[i] + ",";
    }
    s += x[0];
  } else { // return it in the given base
    while (!isZero(s6)) {
      t = divInt_(s6, base);
      s = digitsStr.substring(t, t + 1) + s;
    }
  }
  
  if (s.length == 0) {
    s = "0";
  }
  return s;
}

function dup(x: BigIntArray): BigIntArray {
  let buff: BigIntArray = new Array(x.length);
  copy_(buff, x);
  return buff;
}

function copy_(x: BigIntArray, y: BigIntArray): void {
  let i: number;
  let k: number = x.length < y.length ? x.length : y.length;
  for (i = 0; i < k; i++) {
    x[i] = y[i];
  }
  for (i = k; i < x.length; i++) {
    x[i] = 0;
  }
}

function copyInt_(x: BigIntArray, n: number): void {
  let i: number, c: number;
  for (c = n, i = 0; i < x.length; i++) {
    x[i] = c & mask;
    c >>= bpe;
  }
}

function addInt_(x: BigIntArray, n: number): void {
  let i: number, k: number, c: number, b: number;
  x[0] += n;
  k = x.length;
  c = 0;
  for (i = 0; i < k; i++) {
    c += x[i];
    b = 0;
    if (c < 0) {
      b = -(c >> bpe);
      c += b * radix;
    }
    x[i] = c & mask;
    c = (c >> bpe) - b;
    if (!c) {
      return;
    }
  }
}
function rightShift_(x: BigIntArray, n: number): void {
  let i: number;
  let k: number = Math.floor(n / bpe);
  if (k) {
    for (i = 0; i < x.length - k; i++) {
      x[i] = x[i + k];
    }
    for (; i < x.length; i++) {
      x[i] = 0;
    }
    n %= bpe;
  }
  for (i = 0; i < x.length - 1; i++) {
    x[i] = mask & ((x[i + 1] << (bpe - n)) | (x[i] >> n));
  }
  x[i] >>= n;
}

function halve_(x: BigIntArray): void {
  let i: number;
  for (i = 0; i < x.length - 1; i++) {
    x[i] = mask & ((x[i + 1] << (bpe - 1)) | (x[i] >> 1));
  }
  x[i] = (x[i] >> 1) | (x[i] & (radix >> 1));
}


function leftShift_(x: BigIntArray, n: number): void {
  let i: number;
  let k: number = Math.floor(n / bpe);
  if (k) {
    for (i = x.length; i >= k; i--) {
      x[i] = x[i - k];
    }
    for (; i >= 0; i--) {
      x[i] = 0;
    }
    n %= bpe;
  }
  if (!n) {
    return;
  }
  for (i = x.length - 1; i > 0; i--) {
    x[i] = mask & ((x[i] << n) | (x[i - 1] >> (bpe - n)));
  }
  x[i] = mask & (x[i] << n);
}

function multInt_(x: BigIntArray, n: number): void {
  let i: number, k: number, c: number, b: number;
  if (!n) {
    return;
  }
  k = x.length;
  c = 0;
  for (i = 0; i < k; i++) {
    c += x[i] * n;
    b = 0;
    if (c < 0) {
      b = -(c >> bpe);
      c += b * radix;
    }
    x[i] = c & mask;
    c = (c >> bpe) - b;
  }
}

function divInt_(x: BigIntArray, n: number): number {
  let i: number, r: number = 0, s: number;
  for (i = x.length - 1; i >= 0; i--) {
    s = r * radix + x[i];
    x[i] = Math.floor(s / n);
    r = s % n;
  }
  return r;
}

function linComb_(x: BigIntArray, y: BigIntArray, a: number, b: number): void {
  let i: number, c: number, k: number, kk: number;
  k = x.length < y.length ? x.length : y.length;
  kk = x.length;
  for (c = 0, i = 0; i < k; i++) {
    c += a * x[i] + b * y[i];
    x[i] = c & mask;
    c >>= bpe;
  }
  for (i = k; i < kk; i++) {
    c += a * x[i];
    x[i] = c & mask;
    c >>= bpe;
  }
}

function linCombShift_(x: BigIntArray, y: BigIntArray, b: number, ys: number): void {
  let i: number, c: number, k: number, kk: number;
  k = x.length < ys + y.length ? x.length : ys + y.length;
  kk = x.length;
  for (c = 0, i = ys; i < k; i++) {
    c += x[i] + b * y[i - ys];
    x[i] = c & mask;
    c >>= bpe;
  }
  for (i = k; c && i < kk; i++) {
    c += x[i];
    x[i] = c & mask;
    c >>= bpe;
  }
}

function addShift_(x: BigIntArray, y: BigIntArray, ys: number): void {
  let i: number, c: number, k: number, kk: number;
  k = x.length < ys + y.length ? x.length : ys + y.length;
  kk = x.length;
  for (c = 0, i = ys; i < k; i++) {
    c += x[i] + y[i - ys];
    x[i] = c & mask;
    c >>= bpe;
  }
  for (i = k; c && i < kk; i++) {
    c += x[i];
    x[i] = c & mask;
    c >>= bpe;
  }
}

function subShift_(x: BigIntArray, y: BigIntArray, ys: number): void {
  let i: number, c: number, k: number, kk: number;
  k = x.length < ys + y.length ? x.length : ys + y.length;
  kk = x.length;
  for (c = 0, i = ys; i < k; i++) {
    c += x[i] - y[i - ys];
    x[i] = c & mask;
    c >>= bpe;
  }
  for (i = k; c && i < kk; i++) {
    c += x[i];
    x[i] = c & mask;
    c >>= bpe;
  }
}

function sub_(x: BigIntArray, y: BigIntArray): void {
  let i: number, c: number, k: number;
  k = x.length < y.length ? x.length : y.length;

  for (c = 0, i = 0; i < k; i++) {
    c += x[i] - y[i];
    x[i] = c & mask;
    c >>= bpe;
  }

  for (i = k; c && i < x.length; i++) {
    c += x[i];
    x[i] = c & mask;
    c >>= bpe;
  }
}

function add_(x: BigIntArray, y: BigIntArray): void {
  let i: number, c: number, k: number;
  k = x.length < y.length ? x.length : y.length;
  for (c = 0, i = 0; i < k; i++) {
    c += x[i] + y[i];
    x[i] = c & mask;
    c >>= bpe;
  }
  for (i = k; c && i < x.length; i++) {
    c += x[i];
    x[i] = c & mask;
    c >>= bpe;
  }
}

function mult_(x: BigIntArray, y: BigIntArray): void {
  let i: number;
  if (ss.length != 2 * x.length) {
    ss = new Array(2 * x.length);
  }
  copyInt_(ss, 0);
  for (i = 0; i < y.length; i++) {
    if (y[i]) {
      linCombShift_(ss, x, y[i], i);
    }
  }
  copy_(x, ss);
}

function mod_(x: BigIntArray, n: BigIntArray): void {
  if (s4.length != x.length) {
    s4 = dup(x);
  } else {
    copy_(s4, x);
  }
  if (s5.length != x.length) {
    s5 = dup(x);
  }
  divide_(s4, n, s5, x);
}

function multMod_(x: BigIntArray, y: BigIntArray, n: BigIntArray): void {
  let i: number;
  if (s0.length != 2 * x.length) {
    s0 = new Array(2 * x.length);
  }
  copyInt_(s0, 0);
  for (i = 0; i < y.length; i++) {
    if (y[i]) {
      linCombShift_(s0, x, y[i], i);
    }
  }
  mod_(s0, n);
  copy_(x, s0);
}

function squareMod_(x: BigIntArray, n: BigIntArray): void {
  let i: number, j: number, c: number, kx: number, k: number;
  
  for (kx = x.length; kx > 0 && !x[kx - 1]; kx--) {}
  k = kx > n.length ? 2 * kx : 2 * n.length;
  
  if (s0.length != k) {
    s0 = new Array(k);
  }
  
  copyInt_(s0, 0);
  
  for (i = 0; i < kx; i++) {
    c = s0[2 * i] + x[i] * x[i];
    s0[2 * i] = c & mask;
    c >>= bpe;
    for (j = i + 1; j < kx; j++) {
      c = s0[i + j] + 2 * x[i] * x[j] + c;
      s0[i + j] = (c & mask);
      c >>= bpe;
    }
    s0[i + kx] = c;
  }
  
  mod_(s0, n);
  copy_(x, s0);
}

function trim(x: BigIntArray, k: number): BigIntArray {
  let i: number, y: BigIntArray;
  for (i = x.length; i > 0 && !x[i - 1]; i--) {}
  y = new Array(i + k);
  copy_(y, x);
  return y;
}

function powMod_(x: BigIntArray, y: BigIntArray, n: BigIntArray): void {
  let k1: number, k2: number, kn: number, np: number;
  
  if (s7.length != n.length) {
    s7 = dup(n);
  }
  
  if ((n[0] & 1) == 0) {
    copy_(s7, x);
    copyInt_(x, 1);
    while (!equalsInt(y, 0)) {
      if (y[0] & 1) {
        multMod_(x, s7, n);
      }
      divInt_(y, 2);
      squareMod_(s7, n);
    }
    return;
  }
  
  copyInt_(s7, 0);
  for (kn = n.length; kn > 0 && !n[kn - 1]; kn--) {}
  np = radix - inverseModInt(modInt(n, radix), radix);
  s7[kn] = 1;
  multMod_(x, s7, n);
  
  if (s3.length != x.length) {
    s3 = dup(x);
  } else {
    copy_(s3, x);
  }
  
  // @ts-ignore: Intentionally using single & for bitwise operation
  for (k1 = y.length - 1; k1 > 0 & !y[k1]; k1--) {}
  
  if (y[k1] == 0) {
    copyInt_(x, 1);
    return;
  }
  
  for (k2 = 1 << (bpe - 1); k2 && !(y[k1] & k2); k2 >>= 1) {}
  
  for (;;) {
    if (!(k2 >>= 1)) {
      k1--;
      if (k1 < 0) {
        mont_(x, one, n, np);
        return;
      }
      k2 = 1 << (bpe - 1);
    }
    mont_(x, x, n, np);
    if (k2 & y[k1]) {
      mont_(x, s3, n, np);
    }
  }
}

function mont_(x: BigIntArray, y: BigIntArray, n: BigIntArray, np: number): void {
  let i: number, j: number, c: number, ui: number, t: number, ks: number;
  let kn: number = n.length;
  let ky: number = y.length;

  if (sa.length != kn) {
    sa = new Array(kn);
  }
  copyInt_(sa, 0);

  for (; kn > 0 && n[kn - 1] == 0; kn--) {}
  for (; ky > 0 && y[ky - 1] == 0; ky--) {}
  ks = sa.length - 1;

  for (i = 0; i < kn; i++) {
    t = sa[0] + x[i] * y[0];
    ui = ((t & mask) * np) & mask;
    c = (t + ui * n[0]) >> bpe;
    t = x[i];
    j = 1;

    for (; j < ky - 4;) {
      c += sa[j] + ui * n[j] + t * y[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j] + t * y[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j] + t * y[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j] + t * y[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j] + t * y[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
    }

    for (; j < ky;) {
      c += sa[j] + ui * n[j] + t * y[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
    }

    for (; j < kn - 4;) {
      c += sa[j] + ui * n[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
      c += sa[j] + ui * n[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
    }

    for (; j < kn;) {
      c += sa[j] + ui * n[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
    }

    for (; j < ks;) {
      c += sa[j];
      sa[j - 1] = c & mask;
      c >>= bpe;
      j++;
    }
    sa[j - 1] = c & mask;
  }

  if (!greater(n, sa)) {
    sub_(sa, n);
  }
  copy_(x, sa);
}

// Export only at the end of the file
export { 
  powMod, 
  str2bigInt, 
  bigInt2str, 
  int2bigInt, 
  randBigInt, 
  randTruePrime, 
  randProbPrime, 
  randProbPrimeRounds, 
  GCD, 
  mod, 
  modInt, 
  multMod, 
  inverseMod, 
  negative, 
  sub, 
  add, 
  addInt, 
  mult, 
  greaterShift, 
  greater, 
  equals, 
  equalsInt, 
  bitSize, 
  expand
} 
