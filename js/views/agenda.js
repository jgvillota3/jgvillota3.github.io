import { S, loadEvents, addEvento, eventCat } from '../data.js';
import { ui, actions, run, openSheet, rerender, fieldError } from '../core.js';
import { I } from '../icons.js';
import { esc, iso, fromIso, today, addDays, hm, minutesNow, DOW_SHORT, MON_SHORT, MONTHS, pad } from '../util.js';
import { rutinaDe } from '../data.js';

const PX = 38, START = 5, END = 22;
const FILTERS = [['todo', 'Todo', null], ['agenda', 'Agenda', 'agenda'], ['entreno', 'Entreno', 'entreno'], ['dinero', 'Pagos', 'dinero']];

function selected() { return ui.agendaDay ? fromIso(ui.agendaDay) : today(); }
const monday = (d) => addDays(d, -((d.getDay() + 6) % 7));

function dayEvents(d) {
  const key = iso(d);
  const evs = (S.events[key] || []).map(e => ({ ...e }));
  // Rutina de entreno y BRAVO como bloques, si no están ya en el calendario.
  rutinaDe(d).forEach(r => {
    const [h, m] = r.inicio.split(':').map(Number), s = h * 60 + m;
    const [h2, m2] = (r.fin || r.inicio).split(':').map(Number), e = h2 * 60 + m2;
    const cat = r.tipo === 'bravo' ? 'agenda' : 'entreno';
    if (!evs.some(x => Math.abs(x.start - s) <= 15 && x.cat === cat)) evs.push({ id: 'r-' + r.id, titulo: r.titulo, start: s, end: Math.max(e, s + 30), cat, rutina: true });
  });
  return evs.sort((a, b) => a.start - b.start);
}

export function render() {
  const sel = selected(), mon = monday(sel), t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const loaded = days.every(d => S.events[iso(d)]);
  if (!loaded && !S.demo) { loadEvents(mon, addDays(mon, 7)).then(rerender).catch(() => {}); }
  const f = ui.agendaFilter;
  const evs = dayEvents(sel).filter(e => f === 'todo' || e.cat === f);
  const allDay = evs.filter(e => e.allDay);
  const timed = evs.filter(e => !e.allDay);
  const end = days[6];
  const range = mon.getMonth() === end.getMonth() ? `${mon.getDate()} – ${end.getDate()} de ${MONTHS[mon.getMonth()]}` : `${mon.getDate()} ${MON_SHORT[mon.getMonth()]} – ${end.getDate()} ${MON_SHORT[end.getMonth()]}`;
  const isToday = iso(sel) === iso(t);
  const nowTop = (minutesNow() / 60 - START) * PX;

  return `<header class="top"><h1 class="title">Agenda</h1>
    <span class="status-chip"><i class="dot" style="background:${S.demo ? 'var(--dinero)' : 'var(--entreno)'}"></i>${S.demo ? 'Datos de ejemplo' : 'Google Calendar'}</span></header>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <button class="icon-btn" style="border-radius:12px" data-act="week" data-d="-7" aria-label="Semana anterior">${I.left()}</button>
    <p style="font-size:16px;font-weight:700">${range}</p>
    <button class="icon-btn" style="border-radius:12px" data-act="week" data-d="7" aria-label="Semana siguiente">${I.right()}</button>
  </div>
  <div class="week">${days.map(d => {
    const cats = [...new Set(dayEvents(d).map(e => e.cat))].slice(0, 3);
    return `<button class="wday ${iso(d) === iso(t) ? 'today' : ''}" data-act="aday" data-d="${iso(d)}" aria-pressed="${iso(d) === iso(sel)}" aria-label="${d.getDate()} de ${MONTHS[d.getMonth()]}"><small>${DOW_SHORT[d.getDay()]}</small><b>${d.getDate()}</b><span class="dots">${cats.map(c => `<i class="c-${c}"></i>`).join('')}</span></button>`;
  }).join('')}</div>
  <div class="chips" role="group" aria-label="Filtrar">${FILTERS.map(([k, l, c]) => `<button class="chip" data-act="afilter" data-f="${k}" aria-pressed="${f === k}">${c ? `<i class="dot c-${c}"></i>` : ''}${l}</button>`).join('')}</div>
  ${allDay.length ? `<div class="allday">${allDay.map(e => `<div class="f-${e.cat}">${esc(e.titulo)} · todo el día</div>`).join('')}</div>` : ''}
  <section class="timeline" aria-label="Eventos del día" style="height:${(END - START) * PX}px">
    ${Array.from({ length: END - START + 1 }, (_, i) => { const h = START + i; const lab = h < 12 ? h + ' a' : h === 12 ? '12 m' : (h - 12) + ' p'; return `<div class="hr" style="top:${i * PX}px"><span>${i % 2 === 0 || h === END ? lab : ''}</span></div>`; }).join('')}
    ${timed.map(e => {
      const top = Math.max(0, (e.start / 60 - START) * PX), h = Math.max(30, ((e.end - e.start) / 60) * PX - 3);
      const short = e.end - e.start < 75;
      return `<div class="ev f-${e.cat} ${short ? 'short' : ''}" style="top:${top + 1}px;height:${h}px;${e.rutina ? 'opacity:.92' : ''}"><b>${esc(e.titulo)}</b><span>${hm(e.start)}${short ? '' : ' – ' + hm(e.end)}</span></div>`;
    }).join('')}
    ${isToday && nowTop > 0 && nowTop < (END - START) * PX ? `<div class="nowline" style="top:${nowTop}px"></div>` : ''}
  </section>
  ${!timed.length && !allDay.length ? '<p class="empty">No hay nada este día. Toca + para agregar un evento.</p>' : ''}
  <button class="btn block" data-act="evento">${I.plus(18)}Agregar evento</button>
  <p class="note">Los eventos se guardan en tu Google Calendar. Tu rutina de entreno y los turnos de BRAVO aparecen como bloques aunque no estén en el calendario.</p>`;
}

actions.week = (el) => { const d = addDays(selected(), Number(el.dataset.d)); ui.agendaDay = iso(d); rerender(); };
actions.aday = (el) => { ui.agendaDay = el.dataset.d; rerender(); };
actions.afilter = (el) => { ui.agendaFilter = el.dataset.f; rerender(); };

actions.evento = () => {
  const d = ui.route === 'agenda' ? iso(selected()) : iso(today());
  const nowH = Math.min(21, new Date().getHours() + 1);
  openSheet({
    title: 'Nuevo evento', submitLabel: 'Guardar en Calendar',
    body: `<div class="field"><label for="f-tit">Qué</label><input id="f-tit" name="titulo" autocomplete="off" placeholder="Ej. Almuerzo con mi familia" maxlength="120"></div>
      <div class="field"><label for="f-fe">Día</label><input id="f-fe" type="date" name="fecha" value="${d}"></div>
      <div class="two"><div class="field"><label for="f-ini">Empieza</label><input id="f-ini" type="time" name="inicio" value="${pad(nowH)}:00"></div>
      <div class="field"><label for="f-fin">Termina</label><input id="f-fin" type="time" name="fin" value="${pad(nowH + 1)}:00"></div></div>`,
    onSubmit: (v, form) => {
      if (!v.titulo.trim()) { fieldError(form, 'titulo', 'Escribe qué es el evento.'); return false; }
      if (v.fin <= v.inicio) { fieldError(form, 'fin', 'Debe terminar después de empezar.'); return false; }
      run(() => addEvento({ titulo: v.titulo.trim(), fecha: v.fecha, inicio: v.inicio, fin: v.fin }), 'Evento guardado en Calendar');
    }
  });
};
