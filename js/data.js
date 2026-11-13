// Capa de datos: hoja FIN (finanzas), hoja HOME (datos propios de la app) y Google Calendar.
import { CONFIG, DEMO } from './config.js';
import { sheets, drive, calendar } from './google.js';
import { iso, fromIso, today, addDays, toDate, toNum, dmy, uid, pad, parseHm, lastDay } from './util.js';
import { demoState } from './demo.js';

export const MEALS = [
  ['desayuno', 'Desayuno'], ['media_manana', 'Media mañana'], ['almuerzo', 'Almuerzo'],
  ['media_tarde', 'Media tarde'], ['cena', 'Cena']
];
export const DEFAULT_MEAL_TIMES = { desayuno: '07:00', media_manana: '10:30', almuerzo: '12:15', media_tarde: '16:00', cena: '19:45' };
export const DIA_COLS = ['fecha', 'desayuno', 'media_manana', 'almuerzo', 'media_tarde', 'cena', 'agua', 'creatina', 'whey', 'entrenos'];
export const TIPOS_ENTRENO = ['gym', 'squash', 'futbol', 'bici', 'otro'];
export const CARDS = ['Bancolombia', 'Nu', 'Davivienda', 'RappiCard'];

const SEED_RUTINA = [
  // dia: 1 lunes ... 7 domingo
  [1, 'Gimnasio · espalda, bíceps y abdomen', 'gym', '05:45', '06:45'],
  [2, 'Gimnasio · pierna (cuádriceps)', 'gym', '05:45', '06:45'],
  [3, 'Gimnasio · pecho, tríceps y hombro', 'gym', '05:45', '06:45'],
  [4, 'Gimnasio · espalda, bíceps y abdomen', 'gym', '05:45', '06:45'],
  [5, 'Gimnasio · pierna (isquios)', 'gym', '05:45', '06:45'],
  [6, 'Gimnasio · pecho, tríceps y hombro', 'gym', '05:45', '06:45'],
  [1, 'Squash', 'squash', '20:00', '21:00'],
  [4, 'Squash', 'squash', '20:00', '21:00'],
  [5, 'Fútbol', 'futbol', '20:00', '21:30'],
  [7, 'Bici de ruta', 'bici', '07:00', '10:00'],
  ...[1, 2, 3, 4, 5, 6].flatMap(d => [[d, 'BRAVO', 'bravo', '09:00', '11:30'], [d, 'BRAVO', 'bravo', '14:00', '19:30']])
];

const ALERT_DEFAULTS = { avisoPagos: '1', avisoCorte: '1', avisoPendientes: '1', avisoEntrenos: '0' };

// ---------- Estado ----------
export const S = {
  ready: false, error: null, demo: DEMO,
  fin: null, home: null, events: {}, calendars: [], alertCalId: null,
  lastSync: null
};

const CACHE = 'home.cache.v1';
export function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (!c) return false;
    Object.assign(S, revive(c), { ready: true });
    return true;
  } catch { return false; }
}
function saveCache() {
  try { localStorage.setItem(CACHE, JSON.stringify({ fin: S.fin, home: S.home, events: S.events, alertCalId: S.alertCalId, calendars: S.calendars, lastSync: S.lastSync })); } catch {}
}
function revive(c) {
  const d = (v) => v ? new Date(v) : null;
  if (c.fin) {
    c.fin.month = d(c.fin.month);
    c.fin.compromisos.forEach(x => x.fecha = d(x.fecha));
    c.fin.compras.forEach(x => { x.fecha = d(x.fecha); x.limite = d(x.limite); });
    c.fin.ingresos.forEach(x => x.fecha = d(x.fecha));
  }
  return c;
}

// ---------- Carga ----------
export async function loadAll() {
  if (DEMO) { Object.assign(S, demoState(), { ready: true, lastSync: new Date() }); return; }
  const [fin, home] = await Promise.all([loadFin(), loadHome()]);
  S.fin = fin; S.home = home;
  await loadCalendars();
  const t = today();
  const start = addDays(t, -((t.getDay() + 6) % 7)); // lunes
  await loadEvents(start, addDays(start, 7));
  S.ready = true; S.lastSync = new Date(); S.error = null;
  saveCache();
}

async function loadFin() {
  const id = CONFIG.FIN_ID;
  const meta = await sheets.meta(id);
  const titles = meta.sheets.map(s => s.properties.title);
  const ranges = ["Variables!B7:F14", "'Compromisos del Mes'!B5:H30", "'Resumen Mensual'!B5:N11", 'Compras!B7:H1000'];
  const hasIngresos = titles.includes('Ingresos');
  if (hasIngresos) ranges.push('Ingresos!A2:D1000');
  const r = await sheets.batchGet(id, ranges);
  const [vars, comp, resumen, compras, ingresos] = r.valueRanges.map(v => v.values || []);

  const cards = vars.filter(row => row[0]).map(row => ({ name: String(row[0]).trim(), cupo: toNum(row[1]), disp: toNum(row[2]), corte: toNum(row[3]) || null, pago: toNum(row[4]) || null }));

  // Compromisos del Mes: fila 5 = mes, fila 7 = encabezados, desde fila 8 conceptos hasta "TOTAL COMPROMISOS".
  const month = toDate(comp[0]?.[1]) || new Date(today().getFullYear(), today().getMonth(), 1);
  const compromisos = [];
  let total = 0, falta = 0, neto = 0;
  const porCobrar = [];
  let inCobrar = false;
  comp.forEach((row, i) => {
    const sheetRow = 5 + i;
    const label = String(row[0] ?? '').trim();
    if (sheetRow >= 8 && !inCobrar && label && !/^total/i.test(label) && !/falta/i.test(label) && compromisos.length < 40 && !total) {
      compromisos.push({ row: sheetRow, concepto: label, valor: toNum(row[1]), fecha: toDate(row[2]), pagado: row[3] === true || String(row[3]).toUpperCase() === 'TRUE' });
    }
    if (/^total compromisos/i.test(label)) total = toNum(row[1]);
    if (/^falta por pagar/i.test(label)) falta = toNum(row[1]);
    if (/^por cobrar/i.test(label)) { inCobrar = true; return; }
    if (inCobrar) {
      if (/^total por cobrar/i.test(label)) { inCobrar = false; return; }
      if (label) porCobrar.push({ quien: label, total: toNum(row[1]) });
    }
    if (/^neto a tu cargo/i.test(label)) neto = toNum(row[1]);
  });

  // Resumen Mensual: fila 5 meses, filas 6-9 tarjetas, fila 10 total.
  const head = resumen[0] || [];
  const col = head.findIndex((v, i) => i > 0 && toDate(v) && toDate(v).getMonth() === month.getMonth() && toDate(v).getFullYear() === month.getFullYear());
  const porTarjeta = {};
  let tarjetasMes = 0;
  if (col > 0) {
    resumen.slice(1, 5).forEach(row => { if (row[0]) porTarjeta[String(row[0]).trim()] = toNum(row[col]); });
    tarjetasMes = toNum(resumen[5]?.[col]);
  }
  cards.forEach(c => c.mes = porTarjeta[c.name] || 0);

  let nextComprasRow = 7;
  const comprasList = [];
  compras.forEach((row, i) => {
    if (row[0] !== undefined && row[0] !== '') nextComprasRow = 7 + i + 1;
    if (!row[0]) return;
    comprasList.push({ fecha: toDate(row[0]), desc: String(row[1] ?? '').trim(), tarjeta: String(row[2] ?? '').trim(), valor: toNum(row[3]), limite: toDate(row[4]), cobrarA: String(row[5] ?? '').trim(), valorCobrar: toNum(row[6]) });
  });

  const ingresosList = (ingresos || []).filter(r => r[0]).map(r => ({ fecha: toDate(r[0]), concepto: String(r[1] ?? ''), valor: toNum(r[2]), tipo: String(r[3] ?? '') }));

  return { month, cards, compromisos, total, falta, neto, porCobrar, tarjetasMes, compras: comprasList, nextComprasRow, ingresos: ingresosList, hasIngresos };
}

// ---------- Hoja HOME ----------
const HOME_TABS = {
  Config: ['clave', 'valor'],
  Rutina: ['id', 'dia (1=lunes … 7=domingo)', 'actividad', 'tipo', 'inicio', 'fin'],
  Dias: ['fecha', 'desayuno', 'media mañana', 'almuerzo', 'media tarde', 'cena', 'agua (vasos)', 'creatina', 'whey', 'entrenos hechos'],
  Pendientes: ['id', 'título', 'fecha', 'repetir', 'día del mes', 'hecho', 'categoría', 'monto', 'creado']
};

async function findOrCreateHome() {
  const cached = localStorage.getItem('home.sheetId');
  if (cached) return cached;
  const found = await drive.findSheet(CONFIG.HOME_SHEET_NAME);
  if (found.files?.length) { localStorage.setItem('home.sheetId', found.files[0].id); return found.files[0].id; }
  const created = await sheets.create({
    properties: { title: CONFIG.HOME_SHEET_NAME, locale: 'es_CO', timeZone: 'America/Bogota' },
    sheets: Object.entries(HOME_TABS).map(([title, header]) => ({
      properties: { title, gridProperties: { frozenRowCount: 1 } },
      data: [{ startRow: 0, startColumn: 0, rowData: [{ values: header.map(h => ({ userEnteredValue: { stringValue: h }, userEnteredFormat: { textFormat: { bold: true } } })) }] }]
    }))
  });
  const id = created.spreadsheetId;
  const cfg = Object.entries({ ...ALERT_DEFAULTS, comidas: JSON.stringify(DEFAULT_MEAL_TIMES) });
  await sheets.update(id, 'Config!A2:B' + (1 + cfg.length), cfg, 'RAW');
  await sheets.update(id, 'Rutina!A2:F' + (1 + SEED_RUTINA.length), SEED_RUTINA.map(r => [uid(), ...r]), 'RAW');
  localStorage.setItem('home.sheetId', id);
  return id;
}

const isoOf = (v) => typeof v === 'number' ? iso(toDate(v)) : String(v || '').trim();

async function loadHome() {
  const id = await findOrCreateHome();
  const r = await sheets.batchGet(id, ['Config!A2:B200', 'Rutina!A2:F200', 'Dias!A2:J2000', 'Pendientes!A2:I2000']);
  const [cfg, rut, dias, pend] = r.valueRanges.map(v => v.values || []);
  const config = { ...ALERT_DEFAULTS };
  const configRows = {};
  cfg.forEach((row, i) => { if (row[0]) { config[row[0]] = String(row[1] ?? ''); configRows[row[0]] = i + 2; } });
  const rutina = rut.filter(r => r[0]).map(r => ({ id: String(r[0]), dia: Number(r[1]), titulo: String(r[2] ?? ''), tipo: String(r[3] ?? 'otro'), inicio: String(r[4] ?? ''), fin: String(r[5] ?? '') }));
  const diasMap = {};
  dias.forEach((row, i) => {
    if (!row[0]) return;
    const o = { row: i + 2 };
    DIA_COLS.forEach((k, j) => o[k] = row[j] ?? '');
    o.fecha = isoOf(row[0]);
    o.agua = Number(o.agua) || 0;
    diasMap[o.fecha] = o;
  });
  const pendientes = pend.filter(r => r[0]).map((r, i) => ({ row: i + 2, id: String(r[0]), titulo: String(r[1] ?? ''), fecha: isoOf(r[2]), repetir: String(r[3] || 'no'), diaMes: Number(r[4]) || null, hecho: isoOf(r[5]), cat: String(r[6] || 'pend'), monto: toNum(r[7]) }));
  return { id, config, configRows, rutina, dias: diasMap, nextDiaRow: dias.length + 2, pendientes, nextPendRow: pend.length + 2 };
}

// ---------- Calendar ----------
async function loadCalendars() {
  const list = await calendar.list();
  const items = list.items || [];
  let alert = items.find(c => c.summary === CONFIG.ALERT_CALENDAR_NAME);
  S.alertCalId = alert ? alert.id : null;
  S.calendars = items.filter(c => c.selected !== false && c.id !== S.alertCalId && !/holiday|festivos|#contacts/i.test(c.id)).map(c => ({ id: c.id, name: c.summary, primary: !!c.primary }));
}

export function eventCat(title) {
  const t = (title || '').toLowerCase();
  if (/gym|gimnasio|squash|f[uú]tbol|bici|entreno|correr|caminar/.test(t)) return 'entreno';
  if (/pago|pagar|factura|tarjeta|cuota|banco/.test(t)) return 'dinero';
  return 'agenda';
}

export async function loadEvents(from, to) {
  if (DEMO) return;
  const tMin = from.toISOString(), tMax = to.toISOString();
  const results = await Promise.all(S.calendars.map(c => calendar.events(c.id, tMin, tMax).then(r => (r.items || []).map(e => ({ e, cal: c }))).catch(() => [])));
  const byDay = {};
  for (let d = new Date(from); d < to; d = addDays(d, 1)) byDay[iso(d)] = [];
  results.flat().forEach(({ e, cal }) => {
    if (e.status === 'cancelled') return;
    const allDay = !!e.start.date;
    const s = allDay ? fromIso(e.start.date) : new Date(e.start.dateTime);
    const en = allDay ? fromIso(e.end.date) : new Date(e.end.dateTime);
    const key = iso(s);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push({
      id: e.id, calId: cal.id, titulo: e.summary || '(sin título)', allDay,
      start: allDay ? 0 : s.getHours() * 60 + s.getMinutes(),
      end: allDay ? 1440 : (sameDayDate(s, en) ? en.getHours() * 60 + en.getMinutes() : 1440),
      cat: eventCat(e.summary), link: e.htmlLink
    });
  });
  Object.values(byDay).forEach(a => a.sort((x, y) => x.start - y.start));
  Object.assign(S.events, byDay);
  saveCache();
}
const sameDayDate = (a, b) => a.toDateString() === b.toDateString();

export async function addEvento({ titulo, fecha, inicio, fin }) {
  const ev = { summary: titulo, start: { dateTime: fecha + 'T' + inicio + ':00-05:00', timeZone: 'America/Bogota' }, end: { dateTime: fecha + 'T' + fin + ':00-05:00', timeZone: 'America/Bogota' } };
  if (DEMO) {
    (S.events[fecha] = S.events[fecha] || []).push({ id: uid(), titulo, start: parseHm(inicio), end: parseHm(fin), cat: eventCat(titulo) });
    S.events[fecha].sort((a, b) => a.start - b.start);
    return;
  }
  const prim = S.calendars.find(c => c.primary) || S.calendars[0];
  await calendar.insert(prim ? prim.id : 'primary', ev);
  const d = fromIso(fecha);
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  await loadEvents(monday, addDays(monday, 7));
}

// ---------- Escrituras: Wellness ----------
export function dia(fechaIso) {
  return S.home.dias[fechaIso] || { fecha: fechaIso, agua: 0, entrenos: '' };
}
export async function setDia(fechaIso, field, value) {
  const d = { ...dia(fechaIso), [field]: value };
  S.home.dias[fechaIso] = d;
  saveCache();
  if (DEMO) return;
  const rowVals = DIA_COLS.map(k => k === 'fecha' ? fechaIso : (d[k] ?? ''));
  if (!d.row) { d.row = S.home.nextDiaRow++; }
  await sheets.update(S.home.id, `Dias!A${d.row}:J${d.row}`, [rowVals], 'RAW');
}
export const entrenosHechos = (fechaIso) => String(dia(fechaIso).entrenos || '').split(',').filter(Boolean);
export async function toggleEntreno(fechaIso, rutinaId) {
  const set = new Set(entrenosHechos(fechaIso));
  set.has(rutinaId) ? set.delete(rutinaId) : set.add(rutinaId);
  await setDia(fechaIso, 'entrenos', [...set].join(','));
}
export const rutinaDe = (date) => {
  const dow = ((date.getDay() + 6) % 7) + 1;
  return S.home.rutina.filter(r => r.dia === dow).sort((a, b) => parseHm(a.inicio) - parseHm(b.inicio));
};
export const mealTimes = () => { try { return { ...DEFAULT_MEAL_TIMES, ...JSON.parse(S.home.config.comidas || '{}') }; } catch { return DEFAULT_MEAL_TIMES; } };

// ---------- Escrituras: Config ----------
export async function setConfig(key, value) {
  S.home.config[key] = String(value);
  saveCache();
  if (DEMO) return;
  let row = S.home.configRows[key];
  if (!row) { row = Math.max(1, ...Object.values(S.home.configRows)) + 1; S.home.configRows[key] = row; }
  await sheets.update(S.home.id, `Config!A${row}:B${row}`, [[key, String(value)]], 'RAW');
}

// ---------- Escrituras: Pendientes ----------
export function pendOccurrence(p, ref = today()) {
  if (p.repetir === 'mensual' && p.diaMes) {
    const y = ref.getFullYear(), m = ref.getMonth();
    let d = new Date(y, m, Math.min(p.diaMes, lastDay(y, m)));
    const period = (x) => x.getFullYear() + '-' + pad(x.getMonth() + 1);
    // Si ya está hecho este mes, mostrar el del mes siguiente.
    if (p.hecho === period(d)) d = new Date(y, m + 1, Math.min(p.diaMes, lastDay(y, m + 1)));
    return { fecha: d, hecho: p.hecho === period(d), period: period(d) };
  }
  return { fecha: p.fecha ? fromIso(p.fecha) : null, hecho: !!p.hecho, period: null };
}
export async function addPendiente({ titulo, fecha, repetir, monto, cat }) {
  const p = { id: uid(), titulo, fecha: fecha || '', repetir: repetir || 'no', diaMes: repetir === 'mensual' && fecha ? fromIso(fecha).getDate() : null, hecho: '', cat: cat || 'pend', monto: Number(monto) || 0 };
  S.home.pendientes.push(p);
  saveCache();
  if (DEMO) return;
  p.row = S.home.nextPendRow++;
  await sheets.update(S.home.id, `Pendientes!A${p.row}:I${p.row}`, [[p.id, p.titulo, p.fecha, p.repetir, p.diaMes || '', '', p.cat, p.monto || '', iso(today())]], 'RAW');
}
export async function togglePendiente(id) {
  const p = S.home.pendientes.find(x => x.id === id);
  if (!p) return;
  const occ = pendOccurrence(p);
  if (p.repetir === 'mensual') p.hecho = occ.hecho ? '' : occ.period;
  else p.hecho = p.hecho ? '' : iso(today());
  saveCache();
  if (DEMO) return;
  await sheets.update(S.home.id, `Pendientes!F${p.row}`, [[p.hecho]], 'RAW');
}
export async function deletePendiente(id) {
  const p = S.home.pendientes.find(x => x.id === id);
  if (!p) return;
  S.home.pendientes = S.home.pendientes.filter(x => x !== p);
  saveCache();
  if (DEMO) return;
  await sheets.update(S.home.id, `Pendientes!A${p.row}:I${p.row}`, [['', '', '', '', '', '', '', '', '']], 'RAW');
}

// ---------- Escrituras: FIN ----------
// Fecha límite de pago según las reglas de cada tarjeta.
export function fechaLimite(tarjeta, fecha) {
  const y = fecha.getFullYear(), m = fecha.getMonth(), d = fecha.getDate();
  switch (tarjeta) {
    case 'Bancolombia': return new Date(y, m + 1, 16);
    case 'Nu': return d >= 16 ? new Date(y, m + 2, 7) : new Date(y, m + 1, 7);
    case 'Davivienda': return d <= 8 ? new Date(y, m, 24) : new Date(y, m + 1, 24);
    case 'RappiCard': return d <= 5 ? new Date(y, m, 15) : new Date(y, m + 1, 15);
    default: return null;
  }
}

export async function addGasto({ fecha, desc, tarjeta, valor, cobrarA, valorCobrar }) {
  const f = fromIso(fecha);
  const lim = fechaLimite(tarjeta, f);
  const item = { fecha: f, desc, tarjeta, valor: Number(valor), limite: lim, cobrarA: cobrarA || '', valorCobrar: cobrarA ? Number(valorCobrar || valor) : 0 };
  S.fin.compras.push(item);
  saveCache();
  if (DEMO) return;
  const row = S.fin.nextComprasRow++;
  await sheets.update(CONFIG.FIN_ID, `Compras!B${row}:H${row}`, [[dmy(f), desc, tarjeta, Number(valor), lim ? dmy(lim) : '', item.cobrarA, item.cobrarA ? item.valorCobrar : '']]);
  S.fin = await loadFin(); saveCache();
}

export async function setPagado(row, pagado) {
  const c = S.fin.compromisos.find(x => x.row === row);
  if (c) c.pagado = pagado;
  recalcFalta();
  saveCache();
  if (DEMO) return;
  await sheets.update(CONFIG.FIN_ID, `'Compromisos del Mes'!E${row}`, [[pagado ? 'TRUE' : 'FALSE']]);
}
function recalcFalta() { S.fin.falta = S.fin.compromisos.filter(c => !c.pagado).reduce((a, c) => a + c.valor, 0); }

export async function addIngreso({ fecha, concepto, valor, tipo }) {
  const f = fromIso(fecha);
  S.fin.ingresos.push({ fecha: f, concepto, valor: Number(valor), tipo });
  saveCache();
  if (DEMO) return;
  if (!S.fin.hasIngresos) {
    await sheets.batchUpdate(CONFIG.FIN_ID, [{ addSheet: { properties: { title: 'Ingresos', gridProperties: { frozenRowCount: 1 } } } }]);
    await sheets.update(CONFIG.FIN_ID, 'Ingresos!A1:D1', [['Fecha', 'Concepto', 'Valor', 'Tipo']]);
    S.fin.hasIngresos = true;
  }
  await sheets.append(CONFIG.FIN_ID, 'Ingresos!A:D', [[dmy(f), concepto, Number(valor), tipo]]);
}

// ---------- Avisos ----------
// Lista unificada de lo que vence: pagos del mes (FIN) + pendientes (HOME).
export function avisos({ withAmounts = true } = {}) {
  const t = today();
  const out = [];
  if (S.fin) S.fin.compromisos.forEach(c => {
    if (c.pagado || !c.fecha) return;
    out.push({ kind: 'pago', key: 'pago:' + c.row, titulo: 'Pagar ' + c.concepto, fecha: c.fecha, monto: c.valor, row: c.row, cat: 'dinero' });
  });
  if (S.home) S.home.pendientes.forEach(p => {
    const o = pendOccurrence(p);
    if (o.hecho) return;
    out.push({ kind: 'pend', key: 'pend:' + p.id, id: p.id, titulo: p.titulo, fecha: o.fecha, monto: p.monto, cat: p.cat || 'pend', mensual: p.repetir === 'mensual' });
  });
  out.forEach(a => { a.dias = a.fecha ? Math.round((a.fecha - t) / 86400000) : 9999; a.vencido = a.dias < 0; });
  out.sort((a, b) => a.dias - b.dias);
  return out;
}
export const bellItems = () => avisos().filter(a => a.dias <= 3);

// Crea/borra eventos con recordatorio en el calendario "Home · avisos".
export async function syncAvisos() {
  if (DEMO || !S.fin || !S.home) return;
  const cfg = S.home.config;
  if (!S.alertCalId) {
    const c = await calendar.createCalendar(CONFIG.ALERT_CALENDAR_NAME);
    S.alertCalId = c.id;
  }
  const t = today();
  const desired = new Map();
  const at8 = (d) => ({ dateTime: iso(d) + 'T08:00:00-05:00', timeZone: 'America/Bogota' });
  const at815 = (d) => ({ dateTime: iso(d) + 'T08:15:00-05:00', timeZone: 'America/Bogota' });
  if (cfg.avisoPagos === '1') S.fin.compromisos.forEach(c => {
    if (c.pagado || !c.fecha || c.fecha < t) return;
    desired.set('pago:' + iso(c.fecha) + ':' + c.concepto, { summary: 'Pagar ' + c.concepto, start: at8(c.fecha), end: at815(c.fecha), reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }, { method: 'popup', minutes: 3 * 1440 }] } });
  });
  if (cfg.avisoCorte === '1') S.fin.cards.forEach(card => {
    if (!card.corte) return;
    for (let k = 0; k < 2; k++) {
      const d = new Date(t.getFullYear(), t.getMonth() + k, Math.min(card.corte, lastDay(t.getFullYear(), t.getMonth() + k)));
      if (d < t) continue;
      desired.set('corte:' + iso(d) + ':' + card.name, { summary: 'Corte ' + card.name + ' mañana', start: at8(addDays(d, -1)), end: at815(addDays(d, -1)), reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] } });
    }
  });
  if (cfg.avisoPendientes === '1') S.home.pendientes.forEach(p => {
    const o = pendOccurrence(p);
    if (o.hecho || !o.fecha || o.fecha < t) return;
    desired.set('pend:' + p.id + ':' + iso(o.fecha), { summary: p.titulo, start: at8(o.fecha), end: at815(o.fecha), reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] } });
  });
  if (cfg.avisoEntrenos === '1') {
    const BY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    S.home.rutina.filter(r => r.tipo !== 'bravo' && r.inicio).forEach(r => {
      let d = new Date(t); while (((d.getDay() + 6) % 7) + 1 !== r.dia) d = addDays(d, 1);
      desired.set('rutina:' + r.id + ':' + r.inicio + ':' + r.dia, { summary: r.titulo, start: { dateTime: iso(d) + 'T' + r.inicio + ':00-05:00', timeZone: 'America/Bogota' }, end: { dateTime: iso(d) + 'T' + (r.fin || r.inicio) + ':00-05:00', timeZone: 'America/Bogota' }, recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=' + BY[r.dia - 1]], reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] } });
    });
  }
  const existing = await calendar.rawEvents(S.alertCalId, '&timeMin=' + encodeURIComponent(addDays(t, -1).toISOString()) + '&privateExtendedProperty=' + encodeURIComponent('app=home'));
  const have = new Map();
  (existing.items || []).forEach(e => { const k = e.extendedProperties?.private?.homeKey; if (k) have.set(k, e); });
  for (const [k, ev] of desired) {
    if (!have.has(k)) await calendar.insert(S.alertCalId, { ...ev, extendedProperties: { private: { app: 'home', homeKey: k } } });
  }
  for (const [k, e] of have) {
    if (!desired.has(k)) await calendar.remove(S.alertCalId, e.id).catch(() => {});
  }
  localStorage.setItem('home.avisosSync', String(Date.now()));
}
