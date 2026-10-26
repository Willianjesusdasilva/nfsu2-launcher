import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CARS } from '../data/cars.js';
import { UNLOCKS } from '../data/unlocks.js';
import { SIZE, BASE, STRIDE, MONEY, validate, profileName, checksum, seal, validChecksums, setMoney, money, slots, slot, replaceCar, clearSlot, setPerformance, setHeight, restoreOEM, unlock } from '../save.js';
import { openArchive, exportArchive } from '../archive.js';
const context = vm.createContext({ Uint8Array, Uint16Array, Uint32Array, TextDecoder, TextEncoder });
vm.runInContext(readFileSync(new URL('../vendor/fflate.js', import.meta.url), 'utf8'), context);
const zip = context.fflate;
function fixture(name = 'Pilot') {
  const b = new Uint8Array(SIZE), dv = new DataView(b.buffer);
  b.set([50, 48, 67, 77]);
  for (const [off, value] of [[4, SIZE], [8, 8], [12, 54930], [28, 0x10d], [32, 54930], [MONEY, 350]]) dv.setUint32(off, value, true);
  b.set(new TextEncoder().encode(name), 0xd225);
  for (let i = 0; i < 5; i++) dv.setUint32(BASE + i * STRIDE + 4, 0x319a8ca1 + i, true);
  b.set(CARS[2].header, BASE + 8);
  CARS[2].parts.forEach((key, i) => dv.setUint32(BASE + 32 + i * 4, key, true));
  b.fill(100, 0x5bc4, 0x5c91); b[0xa175] = 1;
  return seal(b);
}
test('shape/version validation rejects incompatible inputs without changing them', () => {
  assert.throws(() => validate(new Uint8Array(10)), /perfil/);
  const b = fixture(), copy = b.slice(); b[28] = 0;
  assert.throws(() => validate(b), /versão/); assert.equal(b[28], 0); assert.equal(copy[28], 13);
  const short = b.subarray(0, -1); assert.throws(() => validate(short), /bytes/);
});
test('native checksum handles subarrays and header dependency order', () => {
  assert.equal(checksum(new Uint8Array([0, 1, 2, 3])), 0x00010203);
  assert.equal(checksum(new Uint8Array([0, 1, 2])), 0);
  const b = fixture(); assert.ok(validChecksums(b));
  b[MONEY] ^= 1; assert.ok(!validChecksums(b));
  const sealed = seal(b); assert.ok(validChecksums(sealed)); assert.notDeepEqual(b, sealed);
  const padded = new Uint8Array(SIZE + 12); padded.set(sealed, 7);
  assert.ok(validChecksums(padded.subarray(7, 7 + SIZE)));
});
test('money presets are exact and edits are confined to four bank bytes', () => {
  const b = fixture(), original = b.slice(); setMoney(b, 999000000);
  assert.equal(money(b), 999000000);
  assert.deepEqual(b.subarray(0, MONEY), original.subarray(0, MONEY));
  assert.deepEqual(b.subarray(MONEY + 4), original.subarray(MONEY + 4));
  for (const n of [-1, 1.5, NaN, Infinity, '', 1000000000]) assert.throws(() => setMoney(b, n));
});
test('all 31 model swaps keep slot identities, wallet and career progress', () => {
  assert.equal(CARS.length, 31);
  for (const car of CARS) {
    const b = fixture(), original = b.slice(); replaceCar(b, 4, car.id);
    assert.equal(slot(b, 4).car.id, car.id);
    assert.deepEqual(b.subarray(BASE + 4 * STRIDE, BASE + 4 * STRIDE + 8), original.subarray(BASE + 4 * STRIDE, BASE + 4 * STRIDE + 8));
    assert.equal(slot(b, 0).car.id, 'COROLLA'); assert.equal(money(b), 350);
    assert.equal(b[0xa175], 6);
    assert.deepEqual(b.subarray(0xa176), original.subarray(0xa176));
    assert.equal(slot(b, 4).height, 100);
  }
});
test('changing one car never changes another occupied slot', () => {
  const b = fixture(); replaceCar(b, 1, 'SUPRA'); const first = b.slice(BASE, BASE + STRIDE);
  replaceCar(b, 1, 'A3'); assert.deepEqual(b.subarray(BASE, BASE + STRIDE), first);
  assert.equal(slot(b, 1).car.id, 'A3');
});
test('OEM+ keeps paint and full performance, restores factory geometry', () => {
  const b = fixture(); replaceCar(b, 1, 'A3'); setPerformance(b, 1, 'full');
  const dv = new DataView(b.buffer), paintOff = BASE + STRIDE + 32 + 63 * 4;
  dv.setUint32(paintOff, 0x3c6ef953, true);
  dv.setUint32(BASE + STRIDE + 32 + 9 * 4, 0, true);
  restoreOEM(b, 1);
  assert.equal(slot(b, 1).paint, 0x3c6ef953); assert.ok(slot(b, 1).full);
  assert.equal(slot(b, 1).height, 95);
  assert.equal(dv.getUint32(BASE + STRIDE + 32 + 9 * 4, true), CARS.find(c => c.id === 'A3').parts[9]);
  for (let i = 0; i < 5; i++) assert.equal(b[0x5bc4 + STRIDE + 41 * i + 7], 95);
});
test('tuning and height reject bad slots; last remaining car cannot be removed', () => {
  const b = fixture(); assert.throws(() => clearSlot(b, 0), /pelo menos/);
  assert.throws(() => setPerformance(b, 1, 'full'), /primeiro/);
  assert.throws(() => setPerformance(b, -1, 'full'), /Slot/);
  assert.throws(() => setHeight(b, 0, 255), /Altura/);
  replaceCar(b, 1, 'ECLIPSE'); clearSlot(b, 0);
  assert.equal(slots(b).filter(s => s.occupied).length, 1);
  assert.equal(slot(b, 1).car.id, 'ECLIPSE');
});
test('unlock shortcuts leave player model hashes, balance, name and career race region intact', () => {
  const b = fixture(), original = b.slice();
  for (const kind of ['parts', 'dealers', 'shops', 'slots']) unlock(b, kind);
  assert.equal(money(b), 350); assert.equal(profileName(b), 'Pilot');
  assert.equal(slot(b, 0).hash, slot(original, 0).hash);
  assert.deepEqual(b.subarray(0xa176, 0xad80), original.subarray(0xa176, 0xad80));
  assert.ok(validChecksums(seal(b)));
});

test('all five inventories unlock every bitmap without changing counters, hash lists or installed parts', () => {
  const b = fixture();
  // Nonzero sentinels expose writes outside the ownership bitmaps.
  for (let i = 0; i < 5; i++) {
    const start = BASE + i * STRIDE + 0x432;
    b.fill(0x5a, start, start + 0x3c0);
  }
  const original = b.slice();
  unlock(b, 'parts');
  for (let i = 0; i < 5; i++) {
    const record = BASE + i * STRIDE, at = record + 0x432;
    assert.deepEqual(b.subarray(record, at), original.subarray(record, at));
    for (const [lo, hi] of [[0, 0x294], [0x298, 0x2a0], [0x3b0, 0x3c0]])
      assert.ok(b.subarray(at + lo, at + hi).every(v => v === 255));
    for (const [lo, hi] of [[0x294, 0x298], [0x2a0, 0x3b0]])
      assert.deepEqual(b.subarray(at + lo, at + hi), original.subarray(at + lo, at + hi));
    // Native OwnsCarPart uses separate general, decal, wheel and specialty tables.
    for (const word of [18 * 4, 17 * 4, 22 * 4, 0x16c + 0xfc, 0x26c, 0x27c, 0x28c, 0x298, 0x3b0])
      assert.equal(new DataView(b.buffer).getUint32(at + word, true), 0xffffffff);
  }
  const twice = b.slice(); unlock(b, 'parts'); assert.deepEqual(b, twice);
  assert.ok(validChecksums(seal(b)));
});

test('exact obsolete unlock tail is repaired without erasing installed tuning', () => {
  const b = fixture(), at = BASE + 0x432;
  setPerformance(b, 0, 'full');
  const installed = b.slice(BASE, at);
  b.set(UNLOCKS.layout.SHOP_PARTS_UNLOCK_TAIL_HEX.split(' ').map(v => parseInt(v, 16)), at + 0x291);
  unlock(b, 'parts');
  assert.deepEqual(b.subarray(BASE, at), installed);
  assert.ok(b.subarray(at + 0x294, at + 0x298).every(v => v === 0));
  assert.ok(b.subarray(at + 0x2a0, at + 0x3b0).every(v => v === 0));
  assert.ok(slot(b, 0).full);
});
test('ZIP round-trip preserves other profiles and every non-profile payload', () => {
  const entries = { 'NFS Underground 2/Pilot/Pilot': fixture(), 'NFS Underground 2/Other/Other': fixture('Other'), 'settings.ini': new TextEncoder().encode('roam = off\n'), 'registry.txt': new Uint8Array([0, 1, 255, 5]) };
  const raw = zip.zipSync(entries), a = openArchive(raw, 'backup.zip', zip);
  assert.equal(a.profiles.length, 2); setMoney(a.profiles[0].bytes, 999000000);
  const result = exportArchive(a, zip), out = zip.unzipSync(result.bytes);
  assert.deepEqual(out['settings.ini'], entries['settings.ini']);
  assert.deepEqual(out['registry.txt'], entries['registry.txt']);
  assert.deepEqual(out['NFS Underground 2/Other/Other'], entries['NFS Underground 2/Other/Other']);
  assert.equal(money(out['NFS Underground 2/Pilot/Pilot']), 999000000);
  assert.ok(validChecksums(out['NFS Underground 2/Pilot/Pilot']));
  assert.deepEqual(a.raw, raw);
});
test('raw profile import/export seals edited bytes and preserves the original', () => {
  const raw = fixture(), a = openArchive(raw, 'Pilot', zip);
  setMoney(a.profiles[0].bytes, 1000000);
  const out = exportArchive(a, zip);
  assert.equal(out.filename, 'Pilot'); assert.equal(money(out.bytes), 1000000);
  assert.equal(money(a.raw), 350); assert.ok(validChecksums(out.bytes));
});
test('hostile paths, ZIP bombs, duplicate paths and truncated ZIPs are refused', () => {
  for (const path of ['../x', '/x', 'C:/x', '__proto__/x', 'x\\y']) {
    const raw = zip.zipSync({ [path]: new Uint8Array([1]) });
    assert.throws(() => openArchive(raw, 'bad.zip', zip), /caminhos/);
  }
  const big = zip.zipSync({ 'giant.txt': new Uint8Array(3 * 1024 * 1024) });
  assert.throws(() => openArchive(big, 'bomb.zip', zip), /limite/);
  const good = zip.zipSync({ Pilot: fixture() });
  assert.throws(() => openArchive(good.subarray(0, -7), 'cut.zip', zip), /inválido/);
  assert.throws(() => openArchive(zip.zipSync({ 'readme.txt': new Uint8Array([1]) }), 'none.zip', zip), /Nenhum perfil/);
});
