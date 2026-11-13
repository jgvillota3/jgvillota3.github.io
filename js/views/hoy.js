import { S, MEALS, mealTimes, rutinaDe, dia, setDia, entrenosHechos, toggleEntreno, avisos, bellItems } from '../data.js';
import { ui, actions, run, openSheet } from '../core.js';
import { I } from '../icons.js';
import { esc, iso, today, hm, parseHm, minutesNow, DOW, MONTHS, cap, nextQuincena, daysBetween, money, relDay, dayLabel } from '../util.js';

const START = 5 * 60, END = 22 * 60, SPAN = END - START;
const MEAL_LEN = { desayuno: 30, media_manana: 15, almuerzo: 45, media_tarde: 15, cena: 25 };
const catOfTipo = (t) => t === 'bravo' ? 'agenda' : 'entreno';

export function dayItems(date) {
  const key = iso(date);
  const items = [];
  const rut = rutinaDe(date);
  rut.forEach(r => {
    const s = parseHm(r.inicio), e = parseHm(r.fin || r.inicio) || s + 60;
    items.push({ kind: 'rutina', id: r.id, titulo: r.titulo, tipo: r.tipo, start: s, end: Math.max(e, s + 15), cat: catOfTipo(r.tipo), done: entrenosHechos(key).includes(r.id) });
  });
  const mt = mealTimes();
  const d = dia(key);
  MEALS.forEach(([k, label]) => {
    const s = parseHm(mt[k]);
    items.push({ kind: 'meal', id: k, titulo: label, start: s, end: s + MEAL_LEN[k], cat: 'comida', done: !!d[k] });
  });
  (S.events[key] || []).forEach(ev => {
    if (ev.allDay) return;
    const dup = rut.some(r => Math.abs(parseHm(r.inicio) - ev.start) <= 15 && catOfTipo(r.tipo) === ev.cat);
    if (!dup) items.push({ kind: 'event', id: ev.id, titulo: ev.titulo, start: ev.start, end: Math.max(ev.end, ev.start + 15), cat: ev.cat });
  });
  return items.sort((a, b) => a.start - b.start || b.end - a.end);
}

const pct = (m) => Math.max(0, Math.min(100, ((m - START) / SPAN) * 100));

function franja(items, nowMin, showNow) {
  const segs = items.filter(i => i.end > START && i.start < END).map(i => {
    const l = pct(i.start), w = Math.max(pct(i.end) - l, 1.2);
    return `<button class="seg-b c-${i.cat}" style="left:${l}%;width:${w}%" aria-label="${esc(i.titulo)}, ${hm(i.start)}" data-act="seg" data-kind="${i.kind}" data-id="${esc(i.id)}"></button>`;
  }).join('');
  const now = showNow ? pct(nowMin) : 0;
  return `<div class="franja" role="group" aria-label="La franja del día">${segs}
    ${showNow ? `<div class="past" style="width:${now}%"></div><div class="now" style="left:${now}%"></div>` : ''}</div>
    <div class="franja-axis" aria-hidden="true"><span style="left:0">5</span><span style="left:${pct(540)}%">9</span><span style="left:${pct(720)}%">12</span><span style="left:${pct(840)}%">2</span><span style="left:${pct(1080)}%">6</span><span style="left:100%">10 p. m.</span></div>`;
}
export { franja };

export function legend() {
  return `<div class="legend">${[['agenda', 'Agenda'], ['entreno', 'Entreno'], ['comida', 'Comida'], ['pend', 'Pendiente'], ['dinero', 'Dinero']].map(([c, l]) => `<span><i class="sq c-${c}"></i>${l}</span>`).join('')}</div>`;
}

export function maskedAmount() { return `<span class="masked" aria-label="Monto oculto; se ve en Finanzas">${I.lock()}$ ••••</span>`; }

export function avisoRow(a, { showAmount }) {
  const ico = a.cat === 'dinero' ? I.card() : (a.mensual ? I.repeat() : I.task());
  const when = a.vencido ? `Venció ${relDay(a.fecha)}` : (a.fecha ? `${dayLabel(a.fecha)} · ${relDay(a.fecha)}` : 'Sin fecha');
  const cls = a.vencido ? 'late' : (a.dias <= 3 ? 'soon' : '');
  const amt = a.monto ? (showAmount ? `<span class="amt">${money(a.monto)}</span>` : maskedAmount()) : '';
  return `<div class="row"><span class="ico ${a.vencido ? 'rojo' : (a.cat === 'dinero' ? 'dinero' : 'pend')}">${ico}</span>
    <div class="grow"><span class="t">${esc(a.titulo)}</span><span class="s ${cls}">${when}${a.mensual ? ' · cada mes' : ''}</span></div>${amt}</div>`;
}

export function render() {
  const t = today(), key = iso(t), nowMin = minutesNow();
  const items = dayItems(t);
  const current = items.filter(i => i.start <= nowMin && i.end > nowMin).sort((a, b) => (a.kind === 'rutina' && a.tipo === 'bravo') - (b.kind === 'rutina' && b.tipo === 'bravo'))[0];
  const upcoming = items.filter(i => i.start > nowMin);
  const next = upcoming[0], after = upcoming[1];
  const q = nextQuincena(t), qd = daysBetween(t, q);
  const d = dia(key);
  const rutHoy = rutinaDe(t).filter(r => r.tipo !== 'bravo');
  const hechos = entrenosHechos(key);
  const list = avisos().filter(a => a.dias <= 7).slice(0, 3);
  const bell = bellItems().length;
  const finOpen = ui.finUnlocked;

  const nextCard = next ? `<section class="card" aria-label="Lo que sigue">
      <div style="display:flex;gap:14px;align-items:flex-start">
        <i style="width:6px;align-self:stretch;border-radius:3px" class="c-${next.cat}"></i>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px">
          <p class="small" style="font-weight:600;color:var(--ink-2)">Sigue · ${hm(next.start)} · en ${fmtIn(next.start - nowMin)}</p>
          <h2 style="font-size:21px;line-height:1.2;font-weight:700">${esc(next.titulo)}</h2>
        </div>
      </div>
      ${next.kind === 'meal' || (next.kind === 'rutina' && next.tipo !== 'bravo') ? `<div style="display:flex;gap:10px"><button class="btn ${next.done ? '' : (next.kind === 'meal' ? 'comida' : 'primary')}" data-act="${next.kind === 'meal' ? 'meal' : 'entreno'}" data-id="${esc(next.id)}">${next.done ? 'Hecho · deshacer' : 'Marcar como hecho'}</button></div>` : ''}
      ${after ? `<div class="divider"></div><div style="display:flex;justify-content:space-between;align-items:center;font-size:15px"><span style="display:flex;align-items:center;gap:10px"><i class="dot c-${after.cat}"></i>${esc(after.titulo)}</span><span class="small">${hm(after.start)}</span></div>` : ''}
    </section>` : `<section class="card"><p class="h3">Nada más por hoy</p><p class="small">Mañana: ${esc((dayItems(new Date(t.getTime() + 864e5))[0] || {}).titulo || 'día libre')}.</p></section>`;

  return `
  <header class="top">
    <div><h1 class="title">${DOW[t.getDay()]} ${t.getDate()}</h1>
      <p class="sub">${cap(MONTHS[t.getMonth()])} · ${qd === 0 ? 'hoy es quincena' : `faltan ${qd} día${qd > 1 ? 's' : ''} para la quincena`}</p></div>
    <button class="icon-btn" data-act="bell" aria-label="Avisos${bell ? ': ' + bell : ''}">${I.bell()}${bell ? `<span class="badge">${bell}</span>` : ''}</button>
  </header>

  <section aria-label="La franja del día" style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <p style="font-size:15px;font-weight:600">Ahora · ${esc(current ? current.titulo : 'Libre')}</p>
      <p class="small" style="font-size:15px">${hm(nowMin)}</p>
    </div>
    ${franja(items, nowMin, true)}
    ${legend()}
  </section>

  ${nextCard}

  <section class="section" aria-label="Avisos">
    <div class="section-head"><h2 class="h2">Avisos</h2><a href="#pendientes" class="link" style="text-decoration:none">Ver todo</a></div>
    ${list.length ? list.map(a => avisoRow(a, { showAmount: finOpen })).join('') : '<p class="empty">Nada vence esta semana.</p>'}
  </section>

  <section aria-label="Tu cuerpo hoy" style="display:flex;flex-direction:column;gap:14px">
    <h2 class="h2">Tu cuerpo hoy</h2>
    <div class="meals">${MEALS.map(([k, l]) => `<button class="meal" data-act="meal" data-id="${k}" aria-pressed="${!!d[k]}"><span class="circ">${I.check(16)}</span><span>${l}</span></button>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p style="font-size:15px;font-weight:600">Agua · ${d.agua || 0} de 12 vasos</p>
        <div class="cups" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i class="${i < (d.agua || 0) ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <div class="stepper"><button data-act="water" data-d="-1" aria-label="Quitar un vaso">${I.minus()}</button><button class="plus" data-act="water" data-d="1" aria-label="Sumar un vaso">${I.plus()}</button></div>
    </div>
    ${rutHoy.map(r => checkRow({ act: 'entreno', id: r.id, label: r.titulo, sub: hm(parseHm(r.inicio)), on: hechos.includes(r.id), cls: 'entreno' })).join('')}
    ${checkRow({ act: 'supl', id: 'creatina', label: 'Creatina', sub: 'con una comida principal', on: !!d.creatina, cls: 'entreno' })}
    ${checkRow({ act: 'supl', id: 'whey', label: 'Proteína whey', sub: 'en una merienda', on: !!d.whey, cls: 'entreno' })}
  </section>`;
}

export function checkRow({ act, id, label, sub, on, cls }) {
  return `<div class="row ${on ? 'done' : ''}" style="min-height:52px;padding:6px 0;border-bottom:none">
    <button class="check ${cls}" data-act="${act}" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${esc(label)}">${I.check()}</button>
    <div class="grow"><span class="t">${esc(label)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ''}</div></div>`;
}

function fmtIn(m) { if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + ' min' : ''); }

// ---------- Acciones compartidas (Hoy y Wellness) ----------
const dayKey = () => ui.route === 'wellness' && ui.wellDay ? ui.wellDay : iso(today());
actions.meal = (el) => { const k = dayKey(), id = el.dataset.id; run(() => setDia(k, id, dia(k)[id] ? '' : '1')); };
actions.supl = actions.meal;
actions.entreno = (el) => run(() => toggleEntreno(dayKey(), el.dataset.id));
actions.water = (el) => { const k = dayKey(); const v = Math.max(0, Math.min(16, (dia(k).agua || 0) + Number(el.dataset.d))); run(() => setDia(k, 'agua', v)); };
actions.seg = (el) => {
  const it = dayItems(today()).find(i => i.kind === el.dataset.kind && i.id === el.dataset.id);
  if (it) import('../core.js').then(m => m.toast(`${it.titulo} · ${hm(it.start)} a ${hm(it.end)}`));
};
actions.bell = () => {
  const items = bellItems();
  openSheet({
    title: 'Avisos', submit: false,
    body: items.length ? `<div class="section">${items.map(a => avisoRow(a, { showAmount: ui.finUnlocked })).join('')}</div><p class="note">También te llegan como notificación desde Google Calendar (calendario "Home · avisos").</p>` : '<p class="empty">No hay nada vencido ni por vencer en los próximos 3 días.</p>'
  });
};
