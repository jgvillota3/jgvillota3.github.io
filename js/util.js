// Utilidades: fechas, dinero, HTML.
export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a, b) => iso(a) === iso(b);
export const daysBetween = (a, b) => Math.round((fromIso(iso(b)) - fromIso(iso(a))) / 86400000);
export const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
export const dmy = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();

// Fechas de Google Sheets (número de serie) a Date local.
export const fromSerial = (n) => {
  if (typeof n !== 'number') return null;
  const ms = Math.round((n - 25569) * 86400000);
  const u = new Date(ms);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};
// Acepta serial, "d/m/aaaa" o "aaaa-mm-dd".
export const toDate = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return fromSerial(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
};
export const toNum = (v) => {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(s) || 0;
};

const fmtCOP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const money = (n) => (n < 0 ? '-$' : '$') + fmtCOP.format(Math.abs(Math.round(n || 0)));

export const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DOW_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MON_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "8:00 a. m."
export const hm = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  const h12 = ((h + 11) % 12) + 1;
  return h12 + ':' + pad(m) + (h < 12 ? ' a. m.' : ' p. m.');
};
export const parseHm = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// Cuándo: "hoy", "mañana", "en 3 días", "hace 2 días"
export function relDay(d) {
  const n = daysBetween(today(), d);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 1) return 'en ' + n + ' días';
  return 'hace ' + (-n) + ' días';
}
export const dayLabel = (d) => DOW[d.getDay()] + ' ' + d.getDate();

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 10);

// Próxima quincena (15 y 30; en febrero, el último día).
export function nextQuincena(from = today()) {
  const y = from.getFullYear(), m = from.getMonth(), d = from.getDate();
  const end = Math.min(30, lastDay(y, m));
  if (d < 15) return new Date(y, m, 15);
  if (d < end) return new Date(y, m, end);
  return new Date(y, m + 1, 15);
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
