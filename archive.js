import { isProfile, validate, profileName, seal } from './save.js';

const LIMIT = 16 * 1024 * 1024;
function inspectZip(b) {
  if (b.length > LIMIT) throw new Error('O backup deve ter até 16 MB. Selecione o ZIP dos saves, não os arquivos do jogo.');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50 && i + 22 + dv.getUint16(i + 20, true) === b.length) { end = i; break; }
  if (end < 0) throw new Error('ZIP incompleto ou inválido.');
  if (dv.getUint16(end + 4, true) || dv.getUint16(end + 6, true)) throw new Error('ZIP dividido em volumes não é suportado.');
  const count = dv.getUint16(end + 10, true);
  if (!count || count > 200) throw new Error('Este ZIP não parece um backup de saves (máximo de 200 arquivos).');
  let at = dv.getUint32(end + 16, true), total = 0;
  const decoder = new TextDecoder(), names = new Set();
  for (let n = 0; n < count; n++) {
    if (at + 46 > end || dv.getUint32(at, true) !== 0x02014b50) throw new Error('Diretório do ZIP inválido.');
    if (dv.getUint16(at + 8, true) & 1) throw new Error('ZIP com senha não é suportado.');
    const size = dv.getUint32(at + 24, true), len = dv.getUint16(at + 28, true), extra = dv.getUint16(at + 30, true), comment = dv.getUint16(at + 32, true);
    const next = at + 46 + len + extra + comment;
    if (next > end) throw new Error('Entrada truncada no ZIP.');
    const name = decoder.decode(b.subarray(at + 46, at + 46 + len));
    if (name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some(p => ['..', '__proto__', 'prototype', 'constructor'].includes(p)) || name.includes('\0') || names.has(name)) throw new Error('O ZIP tem caminhos inválidos ou arquivos duplicados.');
    names.add(name); total += size;
    if (size > 2 * 1024 * 1024 || total > LIMIT) throw new Error('O conteúdo descompactado excede o limite de um backup de saves.');
    at = next;
  }
}
export function openArchive(input, filename, zipAPI = globalThis.fflate) {
  const raw = input instanceof Uint8Array ? input.slice() : new Uint8Array(input);
  let entries, zip = false;
  if (raw[0] === 0x50 && raw[1] === 0x4b) {
    inspectZip(raw);
    if (!zipAPI) throw new Error('Não foi possível carregar o leitor de ZIP. Recarregue a página.');
    try { entries = zipAPI.unzipSync(raw); } catch { throw new Error('Não foi possível descompactar o ZIP. Baixe um novo backup e tente novamente.'); }
    zip = true;
  } else entries = { [filename]: raw };
  const profiles = [];
  for (const [path, bytes] of Object.entries(entries)) if (isProfile(bytes)) {
    validate(bytes);
    profiles.push({ path, name: profileName(bytes), original: bytes.slice(), bytes: bytes.slice(), actions: [] });
  }
  if (!profiles.length) throw new Error('Nenhum perfil compatível foi encontrado. Use o ZIP de “Download backup” do jogo ou o arquivo de perfil sem extensão.');
  return { filename, raw, entries, profiles, zip };
}
export function exportArchive(archive, zipAPI = globalThis.fflate) {
  const entries = { ...archive.entries };
  for (const p of archive.profiles) { validate(p.bytes); entries[p.path] = seal(p.bytes); }
  if (archive.zip) return { bytes: zipAPI.zipSync(entries, { level: 6 }), filename: 'nfsu2-backup-editado.zip', type: 'application/zip' };
  const profile = archive.profiles[0];
  return { bytes: entries[profile.path], filename: profile.name, type: 'application/octet-stream' };
}
