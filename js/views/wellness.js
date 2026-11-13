import { S, MEALS, mealTimes, rutinaDe, dia, entrenosHechos } from '../data.js';
import { ui, actions, rerender } from '../core.js';
import { I } from '../icons.js';
import { esc, iso, fromIso, today, addDays, hm, parseHm, DOW_SHORT, DOW, MONTHS } from '../util.js';
import { checkRow } from './hoy.js';

const monday = (d) => addDays(d, -((d.getDay() + 6) % 7));
const short = (t) => { const x = t.replace(/^Gimnasio · /, '').toLowerCase(); if (x.includes('cuádr')) return 'Cuádriceps'; if (x.includes('isqui')) return 'Isquios'; if (x.startsWith('espalda')) return 'Espalda'; if (x.startsWith('pecho')) return 'Pecho'; if (x.startsWith('bici')) return 'Bici'; return t.replace(/^Gimnasio · /, ''); };

export function render() {
  const t = today();
  const sel = ui.wellDay ? fromIso(ui.wellDay) : t;
  const key = iso(sel);
  const mon = monday(t);
  let planned = 0, done = 0;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i), k = iso(d);
    const rut = rutinaDe(d).filter(r => r.tipo !== 'bravo');
    const h = entrenosHechos(k);
    const nDone = rut.filter(r => h.includes(r.id)).length;
    planned += rut.length; done += nDone;
    let cls = 'rest';
    if (rut.length) cls = nDone === rut.length ? 'done' : (d < t ? 'miss' : '');
    if (nDone && nDone < rut.length) cls = 'done';
    const label = rut.length ? rut.map(r => short(r.titulo)).join(' + ') : 'Descanso';
    return `<button class="plan-day ${k === iso(t) ? 'today' : ''}" data-act="wday" data-d="${k}" aria-pressed="${k === key}" aria-label="${DOW[d.getDay()]}: ${esc(label)}${cls === 'done' ? ', hecho' : cls === 'miss' ? ', no marcado' : ''}"><span class="blk ${cls}"></span><b>${DOW_SHORT[d.getDay()]}</b><span>${esc(label)}</span></button>`;
  }).join('');
  const missed = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter(d => d < t && rutinaDe(d).some(r => r.tipo !== 'bravo' && !entrenosHechos(iso(d)).includes(r.id)));

  const rut = rutinaDe(sel).filter(r => r.tipo !== 'bravo');
  const h = entrenosHechos(key);
  const d = dia(key);
  const mt = mealTimes();
  const isToday = key === iso(t);
  const mealsDone = MEALS.filter(([k]) => d[k]).length;

  return `<header class="top"><div><h1 class="title">Wellness</h1>${isToday ? '' : `<p class="sub">${DOW[sel.getDay()]} ${sel.getDate()} de ${MONTHS[sel.getMonth()]} · <button class="link" data-act="wday" data-d="${iso(t)}">volver a hoy</button></p>`}</div></header>
  <section aria-label="Semana de entreno" style="display:flex;flex-direction:column;gap:10px">
    <div class="section-head" style="padding:0"><h2 class="h2">Entreno · esta semana</h2><span class="small">${done} de ${planned} hechos</span></div>
    <div class="plan-week">${week}</div>
    <p class="small">${missed.length ? `Sin marcar: ${missed.map(x => DOW[x.getDay()].toLowerCase()).join(', ')}. Toca el día para marcarlo.` : 'Toca un día para ver o marcar sus entrenos.'}</p>
  </section>
  <section class="card" aria-label="Entrenos del día" style="gap:6px">
    <h2 class="h3">${isToday ? 'Hoy' : DOW[sel.getDay()] + ' ' + sel.getDate()}</h2>
    ${rut.length ? rut.map(r => checkRow({ act: 'entreno', id: r.id, label: r.titulo, sub: hm(parseHm(r.inicio)) + (r.fin ? ' a ' + hm(parseHm(r.fin)) : ''), on: h.includes(r.id), cls: 'entreno' })).join('') : '<p class="small">Día de descanso.</p>'}
  </section>
  <section class="section" aria-label="Comida">
    <div class="section-head"><h2 class="h2">Comida · plan de Camilo</h2><span class="small">${mealsDone} de 5</span></div>
    ${MEALS.map(([k, l]) => checkRow({ act: 'meal', id: k, label: l, sub: hm(parseHm(mt[k])), on: !!d[k], cls: 'comida' })).join('')}
  </section>
  <section style="display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
    <div style="flex:1;display:flex;flex-direction:column;gap:8px"><p style="font-size:15px;font-weight:600">Agua · ${d.agua || 0} de 12 vasos <span class="small">(3 L)</span></p>
      <div class="cups" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i class="${i < (d.agua || 0) ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="stepper"><button data-act="water" data-d="-1" aria-label="Quitar un vaso">${I.minus()}</button><button class="plus" data-act="water" data-d="1" aria-label="Sumar un vaso">${I.plus()}</button></div>
  </section>
  <section class="section" aria-label="Suplementos">
    <h2 class="h2" style="margin-bottom:4px">Suplementos</h2>
    ${checkRow({ act: 'supl', id: 'creatina', label: 'Creatina', sub: 'todos los días, con una comida', on: !!d.creatina, cls: 'entreno' })}
    ${checkRow({ act: 'supl', id: 'whey', label: 'Proteína whey', sub: 'reemplaza la proteína de una merienda', on: !!d.whey, cls: 'entreno' })}
  </section>
  <p class="note">Tu rutina vive en la hoja "${esc(S.home?.id === 'demo' ? 'HOME' : 'HOME · datos de la app')}", pestaña Rutina. Si cambias un día u hora ahí, la app lo toma al sincronizar.</p>`;
}

actions.wday = (el) => { ui.wellDay = el.dataset.d === iso(today()) ? null : el.dataset.d; rerender(); };
