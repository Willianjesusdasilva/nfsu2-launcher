import { CARS } from './data/cars.js';
import { UNLOCKS } from './data/unlocks.js';
import { DEALERS } from './data/dealers.js';

export const SIZE = 54966, BASE = 0x5868, STRIDE = 0x7f2, MONEY = 0xa16a;
const view = b => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u32 = (b, o) => view(b).getUint32(o, true);
const put = (b, o, n) => view(b).setUint32(o, n, true);
const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
  table[i] = r >>> 0;
}
export function checksum(b) {
  if (b.length < 4) return 0;
  let r = ~((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  for (let i = 4; i < b.length; i++) r = (((r << 8) | b[i]) ^ table[r >>> 24]) >>> 0;
  return ~r >>> 0;
}
export function validChecksums(b) {
  return b.length === SIZE && u32(b, 16) === checksum(b.subarray(28, 36)) &&
    u32(b, 20) === checksum(b.subarray(36)) && u32(b, 24) === checksum(b.subarray(0, 24));
}
export function seal(input) {
  const b = input.slice();
  put(b, 16, checksum(b.subarray(28, 36)));
  put(b, 20, checksum(b.subarray(36)));
  put(b, 24, checksum(b.subarray(0, 24)));
  return b;
}
export function isProfile(b) { return b.length >= 4 && b[0] === 50 && b[1] === 48 && b[2] === 67 && b[3] === 77; }
export function validate(b) {
  if (!isProfile(b)) throw new Error('Este arquivo não é um perfil de NFS Underground 2. Selecione o ZIP de backup ou o arquivo do perfil sem extensão.');
  if (b.length !== SIZE) throw new Error(`Save incompatível: ${b.length.toLocaleString('pt-BR')} bytes. A versão suportada usa 54.966 bytes.`);
  if (u32(b, 4) !== SIZE || u32(b, 8) !== 8 || u32(b, 12) !== 54930 || u32(b, 28) !== 0x10d || u32(b, 32) !== 54930)
    throw new Error('O cabeçalho deste save é de outra versão ou está danificado. Nenhuma alteração foi aplicada.');
  return true;
}
export function profileName(b) {
  let name = '';
  for (let i = 0xd225; i < 0xd245 && b[i]; i++) name += String.fromCharCode(b[i]);
  return name || 'Perfil';
}
export function money(b) { return u32(b, MONEY); }
export function setMoney(b, value) {
  const n = Number(value);
  if (value === '' || !Number.isSafeInteger(n) || n < 0 || n > 999999999) throw new Error('Digite um valor inteiro entre 0 e 999.999.999.');
  put(b, MONEY, n);
}
function indexCheck(i) { if (!Number.isInteger(i) || i < 0 || i > 4) throw new Error('Slot inválido.'); }
export function slot(b, i) {
  indexCheck(i);
  const at = BASE + i * STRIDE, hash = u32(b, at + 28);
  const car = CARS.find(c => c.hash === hash);
  const perf = b.subarray(0x5b80 + i * STRIDE, 0x5bc4 + i * STRIDE);
  return { index: i, hash, car, occupied: !!hash, name: hash ? car?.name || 'Carro de mod · preservado' : 'Vaga disponível',
    paint: u32(b, at + 32 + 63 * 4), wheel: u32(b, at + 32 + 29 * 4), rim: u32(b, at + 32 + 73 * 4),
    tint: u32(b, at + 32 + 153 * 4), height: b[0x5bc4 + i * STRIDE + 3], full: perf.every(v => v === 1) };
}
export const slots = b => Array.from({ length: 5 }, (_, i) => slot(b, i));
export function replaceCar(b, i, id) {
  indexCheck(i);
  const car = CARS.find(c => c.id === id);
  if (!car) throw new Error('Carro não suportado.');
  const at = BASE + i * STRIDE;
  if (!slot(b, i).occupied) {
    const donor = slots(b).find(s => s.occupied && s.car);
    if (!donor) throw new Error('Para adicionar carros, o perfil precisa ter pelo menos um carro comprado na carreira.');
    const identity = b.slice(at, at + 8);
    b.set(b.slice(BASE + donor.index * STRIDE, BASE + (donor.index + 1) * STRIDE), at);
    b.set(identity, at);
  }
  b.set(car.header, at + 8);
  car.parts.forEach((key, p) => put(b, at + 32 + p * 4, key));
  // New model starts with neutral tuning, without inheriting the previous model's setup.
  b.fill(0, 0x5b30 + i * STRIDE, 0x5bc4 + i * STRIDE);
  b.fill(100, 0x5bc4 + i * STRIDE, 0x5c91 + i * STRIDE);
  const required = i === 4 ? 6 : i + 1;
  b[0xa175] = Math.max(b[0xa175], required);
}
export function clearSlot(b, i) {
  indexCheck(i);
  if (slots(b).filter(s => s.occupied).length <= 1 && slot(b, i).occupied) throw new Error('Mantenha pelo menos um carro na garagem.');
  const at = BASE + i * STRIDE;
  b.fill(0, at + 8, at + STRIDE);
  put(b, at + 12, 1); put(b, at + 16, 4);
}
export function setPerformance(b, i, mode, unique = true) {
  indexCheck(i);
  if (!slot(b, i).occupied) throw new Error('Selecione um carro para este slot primeiro.');
  if (!['stock', 'full'].includes(mode)) throw new Error('Pacote de desempenho inválido.');
  b.fill(mode === 'full' ? 1 : 0, 0x5b80 + i * STRIDE, 0x5bc4 + i * STRIDE);
  for (let k = 0; k < 10; k++) put(b, 0x5b58 + i * STRIDE + 4 * k, mode === 'full' && unique ? 1 : 0);
  if (mode === 'full') unlockPerformance(b);
}
export function setHeight(b, i, level) {
  indexCheck(i);
  if (!slot(b, i).occupied) throw new Error('Selecione um carro primeiro.');
  if (![0, 80, 95, 100].includes(Number(level))) throw new Error('Altura inválida.');
  for (let mode = 0; mode < 5; mode++) {
    const q = 0x5bc4 + i * STRIDE + mode * 41;
    b[q + 3] = b[q + 7] = Number(level);
  }
}
export function setPart(b, i, p, key) {
  indexCheck(i);
  if (!slot(b, i).occupied) throw new Error('Selecione um carro primeiro.');
  if (!Number.isInteger(p) || p < 0 || p >= 170 || !Number.isInteger(key) || key < 0 || key > 0xffffffff) throw new Error('Peça inválida.');
  put(b, BASE + i * STRIDE + 32 + p * 4, key);
}
export function restoreOEM(b, i) {
  const s = slot(b, i);
  if (!s.car) throw new Error('Escolha um dos carros originais para usar o preset OEM+.');
  const paint = s.paint;
  s.car.parts.forEach((key, p) => setPart(b, i, p, key));
  setPart(b, i, 63, paint);
  setHeight(b, i, 95);
}
function bytes(hex) { return new Uint8Array(hex.trim().split(/\s+/).map(v => parseInt(v, 16))); }
export function unlockPerformance(b) {
  for (const start of [0xc45b, 0xc483]) for (let off = start; off <= start + 0x20; off += 8) b[off] = Math.max(b[off], 3);
}
export function unlockOwnedParts(b, i) {
  indexCheck(i);
  // CareerCar::Save (0x516620) serializes OwnedPartInventory at record + 0x432.
  // OwnedPartInventory::Save (0x503F00) reorders the final fields. Only these
  // ranges are bitmaps; +0x294 is a counter and +0x2A0 is a performance hash list.
  const at = BASE + i * STRIDE + 0x432;
  // Repair only the exact invalid tail written by launcher versions before this fix.
  const legacy = bytes(UNLOCKS.layout.SHOP_PARTS_UNLOCK_TAIL_HEX);
  if (legacy.every((v, k) => b[at + 0x291 + k] === v)) {
    b.fill(0, at + 0x294, at + 0x298);
    b.fill(0, at + 0x2a0, at + 0x3b0);
  }
  for (const [start, end] of [[0, 0x294], [0x298, 0x2a0], [0x3b0, 0x3c0]]) b.fill(0xff, at + start, at + end);
}
export function unlock(b, kind) {
  if (kind === 'parts') {
    for (let i = 0; i < 5; i++) unlockOwnedParts(b, i);
    unlockPerformance(b);
  } else if (kind === 'dealers') for (const p of DEALERS) b.set(bytes(p.hex), p.off);
  else if (kind === 'shops') b.fill(1, 0xad9a, 0xad9a + 0x3a);
  else if (kind === 'slots') b[0xa175] = 6;
  else throw new Error('Desbloqueio inválido.');
}
export function changedBytes(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
