/**
 * SHA-256 DRBG used only when native CSPRNG (Hermes / expo-crypto) fails.
 * Not Math.random(). Unique IVs and audit IDs still require this fallback
 * to be mixed with time + a monotonic counter.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

function rotr(n, x) {
  return (x >>> n) | (x << (32 - n));
}

function sha256(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const bitLen = input.length * 8;
  const withPad = new Uint8Array(((input.length + 9 + 63) & ~63));
  withPad.set(input);
  withPad[input.length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, bitLen, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < withPad.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

let counter = 0;
const seedText = `ad-csprng-v1|${Date.now()}|${
  typeof performance !== 'undefined' && performance.now ? performance.now() : 0
}`;
const seedBytes = new Uint8Array(seedText.length);
for (let i = 0; i < seedText.length; i += 1) seedBytes[i] = seedText.charCodeAt(i) & 0xff;
let state = sha256(seedBytes);

function mixEntropy(extra = '') {
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : 0;
  const hr =
    typeof process !== 'undefined' && typeof process.hrtime === 'function'
      ? String(process.hrtime.bigint ? process.hrtime.bigint() : process.hrtime())
      : '';
  counter += 1;
  const seed = new Uint8Array(state.length + 64);
  seed.set(state, 0);
  const text = `${Date.now()}|${now}|${counter}|${hr}|${extra}`;
  for (let i = 0; i < text.length && i < 64; i++) {
    seed[state.length + i] = text.charCodeAt(i) & 0xff;
  }
  state = sha256(seed);
  return state;
}

export function fillSoftwareRandomValues(typedArray) {
  if (!typedArray || typedArray.length == null) return typedArray;
  const bytes =
    typedArray instanceof Uint8Array
      ? typedArray
      : new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  let offset = 0;
  while (offset < bytes.length) {
    const block = mixEntropy(`block:${offset}`);
    const n = Math.min(block.length, bytes.length - offset);
    bytes.set(block.subarray(0, n), offset);
    offset += n;
  }
  return typedArray;
}

export function softwareRandomHex(byteCount = 16) {
  const n = Math.max(1, Math.min(1024, Number(byteCount) || 16));
  const bytes = new Uint8Array(n);
  fillSoftwareRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function softwareRandomUUID() {
  const bytes = new Uint8Array(16);
  fillSoftwareRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default {
  fillSoftwareRandomValues,
  softwareRandomHex,
  softwareRandomUUID,
};
