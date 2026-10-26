import { CARS } from './data/cars.js';
import { PAINTS, WHEELS, RIM_COLORS } from './data/style.js';
import * as save from './save.js?v=3';
import { openArchive, exportArchive } from './archive.js?v=3';

const $ = id => document.getElementById(id);
let archive = null, activeProfile = 0, activeSlot = 0, reading = false, moneyInvalid = false, toastTimer;
const current = () => archive?.profiles[activeProfile];
const cash = n => '$' + Number(n).toLocaleString('pt-BR');
const label = n => `Slot ${String(n + 1).padStart(2, '0')}`;
const makeOption = (value, text) => new Option(text, String(value));

function notify(text, error = false) {
  const el = $('notice'); el.textContent = text; el.classList.toggle('error', error); el.hidden = false;
  el.setAttribute('role', error ? 'alert' : 'status');
  toast(text);
}
function toast(text) {
  clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}
function record(key, text) {
  const p = current();
  const old = p.actions.find(a => a.key === key);
  if (old) old.text = text; else p.actions.push({ key, text });
}
function modify(key, description, fn) {
  if (!current()) return;
  const p = current(), backup = p.bytes.slice(), actions = p.actions.map(a => ({ ...a }));
  try {
    fn(p.bytes);
    const slotSuffix = '-' + activeSlot;
    if (key === 'car' + slotSuffix) p.actions = p.actions.filter(a => !a.key.endsWith(slotSuffix));
    if (key === 'oem' + slotSuffix) p.actions = p.actions.filter(a => !['wheel-select', 'rim-select', 'tint', 'height'].some(k => a.key === k + slotSuffix));
    record(key, description);
    render(); toast(description);
  } catch (e) { p.bytes = backup; p.actions = actions; render(); notify(e.message, true); }
}
function vehicleArt(body, color) {
  // Diagrammatic silhouettes only; these are not renders of in-game parts.
  const shapes = {
    coupe: 'M12 45 18 34 46 29 65 15 110 15 137 31 166 35 175 45 175 54 12 54Z',
    hatch: 'M12 45 18 32 40 29 55 13 112 13 126 30 161 34 174 45 174 54 12 54Z',
    sedan: 'M12 45 21 33 45 29 62 15 112 15 133 30 165 34 176 45 176 54 12 54Z',
    suv: 'M12 44 16 13 114 13 129 28 164 31 175 43 175 56 12 56Z'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 190 72'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${shapes[body] || shapes.coupe}" fill="${color}" opacity=".85"/><path d="M52 29 69 18 108 18 125 29Z" fill="#141912"/><path d="M14 55h162" stroke="currentColor" stroke-width="2"/><circle cx="45" cy="54" r="13" fill="#111410"/><circle cx="144" cy="54" r="13" fill="#111410"/><circle cx="45" cy="54" r="8" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="144" cy="54" r="8" fill="none" stroke="currentColor" stroke-width="3"/>`;
  return svg;
}
function renderSlots() {
  $('slot-grid').replaceChildren();
  const data = current() ? save.slots(current().bytes) : Array.from({ length: 5 }, (_, i) => ({ index: i, occupied: false }));
  for (const s of data) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'slot-card' + (s.index === activeSlot ? ' selected' : '');
    button.disabled = !current() || reading; button.setAttribute('aria-pressed', String(s.index === activeSlot));
    button.setAttribute('aria-label', `${label(s.index)}: ${s.name || 'Vaga disponível'}`);
    const index = document.createElement('span'); index.className = 'slot-index'; index.textContent = label(s.index).toUpperCase(); button.append(index);
    if (s.occupied) button.append(vehicleArt(s.car?.body, PAINTS.find(p => p.key === s.paint)?.hex || '#adb3a5'));
    else { const mark = document.createElement('span'); mark.className = 'slot-empty-mark'; mark.textContent = '+'; button.append(mark); }
    const name = document.createElement('span'); name.className = 'slot-name'; name.textContent = s.name || 'Vaga disponível'; button.append(name);
    const status = document.createElement('span'); status.className = 'slot-status' + (s.full ? ' tuned' : '');
    status.textContent = s.occupied ? s.full ? 'FULL TUNING' : 'SEU PROJETO' : 'ADICIONAR CARRO'; button.append(status);
    button.addEventListener('click', () => { activeSlot = s.index; render(); });
    $('slot-grid').append(button);
  }
  $('garage-count').replaceChildren(document.createTextNode(String(data.filter(s => s.occupied).length) + ' '));
  const small = document.createElement('small'); small.textContent = '/ 5 VAGAS'; $('garage-count').append(small);
}
function selectKnown(id, choices, value, originalLabel) {
  const select = $(id); select.replaceChildren(makeOption('keep', originalLabel));
  for (const choice of choices) select.append(makeOption(choice.key, choice.label));
  select.value = choices.some(c => c.key === value) ? String(value) : 'keep';
}
function renderCar() {
  const p = current(), s = p ? save.slot(p.bytes, activeSlot) : null;
  $('car-editor').disabled = !p || reading;
  $('selected-slot-label').textContent = label(activeSlot).toUpperCase();
  $('selected-car-name').textContent = s?.name || 'Escolha seu próximo projeto';
  const select = $('car-select'); select.replaceChildren(makeOption('', 'Vaga disponível'));
  for (const car of [...CARS].sort((a, b) => a.name.localeCompare(b.name))) select.append(makeOption(car.id, car.name));
  if (s?.occupied && !s.car) select.append(makeOption('unknown', 'Carro de mod · manter sem trocar'));
  select.value = s?.car?.id || (s?.occupied ? 'unknown' : '');
  selectKnown('paint-select', PAINTS, s?.paint, 'Manter pintura atual');
  selectKnown('wheel-select', WHEELS, s?.wheel, 'Manter rodas atuais');
  selectKnown('rim-select', RIM_COLORS, s?.rim, 'Manter cor atual');
  const height = s?.height;
  $('height-select').value = [0, 80, 95, 100].includes(height) ? String(height) : 'keep';
  const tints = { 1025915192: 'stock', 2308203520: 'light', 4168712821: 'medium', 3599671489: 'dark' };
  $('tint-select').value = tints[s?.tint] || 'keep';
  for (const el of document.querySelectorAll('.editor-fields select, #oem-preset, #stock-performance, #full-performance, #remove-car')) el.disabled = !s?.occupied || reading;
  $('oem-preset').disabled = !s?.car || reading;
  $('performance-label').textContent = !p ? 'Importe um perfil para começar' : !s.occupied ? 'Escolha um carro para preparar' : s.full ? 'Pacote máximo de upgrades instalado' : 'Ajuste original ou personalizado';
  $('full-performance').setAttribute('aria-pressed', String(!!s?.full));
}
function renderSummary() {
  const p = current(), diff = p ? save.changedBytes(p.original, p.bytes) : 0;
  $('summary-profile').textContent = p?.name || '—';
  $('summary-cars').textContent = p ? `${save.slots(p.bytes).filter(s => s.occupied).length} / 5` : '— / 5';
  $('summary-money').textContent = p ? cash(save.money(p.bytes)) : '$0';
  $('change-count').textContent = diff ? String(p.actions.length) : '0';
  const list = $('changes-list'); list.replaceChildren();
  if (diff) for (const action of p.actions) { const li = document.createElement('li'); li.textContent = action.text; list.append(li); }
  else { const li = document.createElement('li'); li.className = 'empty-changes'; li.textContent = p ? 'Tudo como no arquivo importado.' : 'Importe um save para começar.'; list.append(li); }
  $('export-button').disabled = !p || reading || moneyInvalid;
  $('reset-button').disabled = !diff || reading;
  for (const el of document.querySelectorAll('[data-unlock]')) {
    const done = !!p?.actions.some(a => a.key === 'unlock-' + el.dataset.unlock);
    el.classList.toggle('applied', done); el.querySelector('.unlock-state').textContent = done ? 'Aplicado ✓' : el.dataset.unlock === 'shops' ? 'Revelar ↗' : 'Liberar ↗';
  }
}
function render() {
  const p = current();
  $('profile-bar').hidden = !archive;
  $('wallet-fields').disabled = $('unlock-fields').disabled = !p || reading;
  if (!moneyInvalid) $('money-input').value = p ? save.money(p.bytes) : '';
  renderSlots(); renderCar(); renderSummary();
}
async function importFile(file) {
  if (!file || reading) return;
  reading = true; $('import-button').disabled = true; $('import-button').textContent = 'Lendo save…'; render();
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error('Selecione um backup de saves com até 16 MB.');
    const loaded = openArchive(new Uint8Array(await file.arrayBuffer()), file.name);
    archive = loaded; activeProfile = 0; activeSlot = 0; moneyInvalid = false;
    $('money-input').setCustomValidity('');
    $('profile-select').replaceChildren(...loaded.profiles.map((p, i) => makeOption(i, p.name)));
    $('file-description').textContent = `${file.name} · ${loaded.profiles.length} ${loaded.profiles.length === 1 ? 'perfil encontrado' : 'perfis encontrados'}`;
    $('import-title').textContent = 'Save na oficina';
    const oldChecksums = loaded.profiles.some(p => !save.validChecksums(p.bytes));
    notify(oldChecksums ? 'Perfil carregado. As verificações antigas serão recalculadas ao baixar a cópia editada.' : 'Perfil carregado. Seu original está preservado; pode começar a editar.');
  } catch (e) { notify(e.message, true); }
  finally { reading = false; $('import-button').disabled = false; $('import-button').textContent = archive ? 'Trocar arquivo ↗' : 'Importar save ↗'; $('file-input').value = ''; render(); }
}
$('import-button').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', e => importFile(e.target.files[0]));
const drop = $('drop-zone');
for (const kind of ['dragenter', 'dragover']) drop.addEventListener(kind, e => { e.preventDefault(); drop.classList.add('drag-over'); });
for (const kind of ['dragleave', 'drop']) drop.addEventListener(kind, e => { e.preventDefault(); drop.classList.remove('drag-over'); });
drop.addEventListener('drop', e => { if (e.dataTransfer.files.length !== 1) notify('Importe um único ZIP ou perfil por vez.', true); else importFile(e.dataTransfer.files[0]); });
window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', e => e.preventDefault());
$('profile-select').addEventListener('change', e => { activeProfile = Number(e.target.value); activeSlot = 0; moneyInvalid = false; $('money-input').setCustomValidity(''); render(); });
$('car-select').addEventListener('change', e => {
  const id = e.target.value;
  if (id === 'unknown') return;
  if (!id) return modify('car-' + activeSlot, `${label(activeSlot)}: carro removido`, b => save.clearSlot(b, activeSlot));
  const car = CARS.find(c => c.id === id);
  modify('car-' + activeSlot, `${label(activeSlot)}: ${car.name}`, b => save.replaceCar(b, activeSlot, id));
});
$('remove-car').addEventListener('click', () => modify('car-' + activeSlot, `${label(activeSlot)}: carro removido`, b => save.clearSlot(b, activeSlot)));
$('full-performance').addEventListener('click', () => modify('perf-' + activeSlot, `${label(activeSlot)}: full tuning + upgrades únicos`, b => save.setPerformance(b, activeSlot, 'full')));
$('stock-performance').addEventListener('click', () => modify('perf-' + activeSlot, `${label(activeSlot)}: desempenho original`, b => save.setPerformance(b, activeSlot, 'stock')));
for (const [id, catalog, part, key] of [['paint-select', PAINTS, 63, 'Pintura'], ['wheel-select', WHEELS, 29, 'Rodas'], ['rim-select', RIM_COLORS, 73, 'Cor das rodas']]) {
  $(id).addEventListener('change', e => {
    if (e.target.value === 'keep') return;
    const item = catalog.find(c => c.key === Number(e.target.value));
    modify(`${id}-${activeSlot}`, `${label(activeSlot)}: ${key.toLowerCase()} · ${item.label}`, b => {
      save.setPart(b, activeSlot, part, item.key);
      if (part === 29) save.setPart(b, activeSlot, 30, item.key);
    });
  });
}
$('height-select').addEventListener('change', e => {
  if (e.target.value === 'keep') return;
  const value = Number(e.target.value), text = e.target.selectedOptions[0].text;
  modify('height-' + activeSlot, `${label(activeSlot)}: ${text}`, b => save.setHeight(b, activeSlot, value));
});
$('tint-select').addEventListener('change', e => {
  if (e.target.value === 'keep') return;
  const key = { stock: 0x3d263938, light: 0x89946400, medium: 0xf8798275, dark: 0xd68ea0c1 }[e.target.value];
  const text = e.target.selectedOptions[0].text;
  modify('tint-' + activeSlot, `${label(activeSlot)}: vidros ${text.toLowerCase()}`, b => save.setPart(b, activeSlot, 153, key));
});
$('oem-preset').addEventListener('click', () => modify('oem-' + activeSlot, `${label(activeSlot)}: estética OEM+ e altura leve`, b => save.restoreOEM(b, activeSlot)));
$('money-input').addEventListener('input', e => {
  if (!current()) return;
  try {
    save.setMoney(current().bytes, e.target.value); moneyInvalid = false; e.target.setCustomValidity('');
    record('money', 'Saldo definido em ' + cash(save.money(current().bytes))); renderSummary();
  } catch (error) { moneyInvalid = true; e.target.setCustomValidity(error.message); renderSummary(); }
});
$('money-input').addEventListener('change', e => { if (moneyInvalid) { e.target.reportValidity(); notify('O saldo precisa ser inteiro, de 0 a 999.999.999.', true); } });
for (const el of document.querySelectorAll('[data-money]')) el.addEventListener('click', () => {
  moneyInvalid = false; $('money-input').setCustomValidity('');
  modify('money', 'Saldo definido em ' + cash(el.dataset.money), b => save.setMoney(b, el.dataset.money));
});
const unlockLabels = { parts: 'Inventário completo de peças liberado nos cinco slots', dealers: 'Carros da concessionária liberados', shops: 'Lojas reveladas no mapa', slots: 'Cinco vagas da garagem liberadas' };
for (const el of document.querySelectorAll('[data-unlock]')) el.addEventListener('click', () => modify('unlock-' + el.dataset.unlock, unlockLabels[el.dataset.unlock], b => save.unlock(b, el.dataset.unlock)));
$('unlock-all').addEventListener('click', () => {
  if (!current()) return;
  const backup = current().bytes.slice(), actions = current().actions.map(a => ({ ...a }));
  try {
    for (const kind of Object.keys(unlockLabels)) { save.unlock(current().bytes, kind); record('unlock-' + kind, unlockLabels[kind]); }
    render(); toast('Customizações, concessionária, lojas e vagas liberados.');
  } catch (e) { current().bytes = backup; current().actions = actions; render(); notify(e.message, true); }
});
function download(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })), a = document.createElement('a');
  a.href = url; a.download = filename.replace(/[\\/:*?"<>|]/g, '_'); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
$('download-original').addEventListener('click', () => { if (archive) download(archive.raw, archive.filename, archive.zip ? 'application/zip' : 'application/octet-stream'); });
$('export-button').addEventListener('click', () => {
  if (!archive || moneyInvalid) return;
  try { const result = exportArchive(archive); download(result.bytes, result.filename, result.type); notify('Cópia editada pronta. Restaure no jogo e confira as alterações.'); }
  catch (e) { notify(e.message, true); }
});
$('reset-button').addEventListener('click', () => {
  if (!current()) return;
  current().bytes = current().original.slice(); current().actions = []; moneyInvalid = false;
  $('money-input').setCustomValidity(''); render(); toast('O perfil voltou ao arquivo original importado.');
});
for (const link of document.querySelectorAll('.nav-link')) link.addEventListener('click', () => {
  for (const other of document.querySelectorAll('.nav-link')) other.classList.remove('active'); link.classList.add('active');
});
window.addEventListener('beforeunload', e => {
  if (archive?.profiles.some(p => save.changedBytes(p.original, p.bytes))) { e.preventDefault(); e.returnValue = ''; }
});
render();
