import { S, avisos, addPendiente, togglePendiente, deletePendiente, setPagado, setConfig, syncAvisos, pendOccurrence } from '../data.js';
import { ui, actions, run, openSheet, rerender, fieldError, toast } from '../core.js';
import { I } from '../icons.js';
import { esc, money, today, iso, relDay, dayLabel, addDays } from '../util.js';
import { maskedAmount } from './hoy.js';
import { moneyField, wireMoney } from './finanzas.js';

const FILTERS = [['todo', 'Todo'], ['pagos', 'Pagos'], ['tareas', 'Tareas'], ['mes', 'Cada mes']];
const ALERTS = [
  ['avisoPagos', 'Pagos', '3 días antes y el mismo día, 8:00 a. m.'],
  ['avisoCorte', 'Corte de tarjeta', 'El día anterior, 8:00 a. m.'],
  ['avisoPendientes', 'Pendientes con fecha', 'El mismo día, 8:00 a. m.'],
  ['avisoEntrenos', 'Entrenos', '30 minutos antes de cada sesión']
];

function item(a) {
  const isPago = a.kind === 'pago';
  const when = a.fecha ? (a.vencido ? `Venció ${relDay(a.fecha)}` : `${dayLabel(a.fecha)} · ${relDay(a.fecha)}`) : 'Sin fecha';
  const cls = a.vencido ? 'late' : (a.dias <= 3 ? 'soon' : '');
  const amt = a.monto ? (ui.finUnlocked ? `<span class="amt">${money(a.monto)}</span>` : maskedAmount()) : '';
  return `<div class="row">
    <button class="check ${a.cat === 'dinero' ? 'dinero' : 'pend'}" data-act="${isPago ? 'pagado' : 'ptoggle'}" ${isPago ? `data-row="${a.row}"` : `data-id="${a.id}"`} aria-pressed="false" aria-label="Marcar ${esc(a.titulo)} como hecho">${I.check()}</button>
    <div class="grow"><span class="t">${esc(a.titulo)}</span><span class="s ${cls}">${when}${a.mensual ? ' · cada mes' : ''}${isPago ? ' · FIN' : ''}</span></div>
    ${amt}${!isPago ? `<button class="icon-btn" style="width:40px;height:40px;border:none;background:none;color:var(--muted)" data-act="pdel" data-id="${a.id}" aria-label="Borrar ${esc(a.titulo)}">${I.trash(16)}</button>` : ''}
  </div>`;
}

export function render() {
  const f = ui.pendFilter;
  let list = avisos();
  if (f === 'pagos') list = list.filter(a => a.kind === 'pago' || a.cat === 'dinero');
  if (f === 'tareas') list = list.filter(a => a.kind === 'pend' && a.cat !== 'dinero' && !a.mensual);
  if (f === 'mes') list = list.filter(a => a.mensual);
  const groups = [
    ['Vencido', list.filter(a => a.vencido), 'color:var(--rojo-ink)'],
    ['Esta semana', list.filter(a => !a.vencido && a.dias <= 7), ''],
    ['Más adelante', list.filter(a => !a.vencido && a.dias > 7 && a.dias < 9999), ''],
    ['Sin fecha', list.filter(a => a.dias === 9999), '']
  ].filter(g => g[1].length);
  const done = (S.home?.pendientes || []).filter(p => { const o = pendOccurrence(p); return o.hecho && p.repetir !== 'mensual'; }).slice(-5);
  const cfg = S.home?.config || {};
  const lastSync = Number(localStorage.getItem('home.avisosSync') || 0);

  return `<header class="top"><h1 class="title">Pendientes</h1></header>
  <div class="chips" role="group" aria-label="Filtrar">${FILTERS.map(([k, l]) => `<button class="chip" data-act="pfilter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
  ${groups.map(([t, items, st]) => `<section class="section"><h2 class="h3" style="font-size:15px;${st}">${t}</h2>${items.map(item).join('')}</section>`).join('') || '<p class="empty">No tienes pendientes. Toca + para agregar uno.</p>'}
  <button class="btn block" data-act="pendiente">${I.plus(18)}Agregar pendiente</button>
  ${done.length ? `<section class="section"><h2 class="h3" style="font-size:15px;color:var(--muted)">Hechos hace poco</h2>${done.map(p => `<div class="row done"><button class="check pend" data-act="ptoggle" data-id="${p.id}" aria-pressed="true" aria-label="Desmarcar ${esc(p.titulo)}">${I.check()}</button><div class="grow"><span class="t">${esc(p.titulo)}</span></div></div>`).join('')}</section>` : ''}
  <section class="card" aria-label="Cómo te aviso" style="gap:0;padding:6px 18px">
    <h2 class="h3" style="margin:12px 0 2px">Cómo te aviso</h2>
    ${ALERTS.map(([k, t, s]) => `<div class="row" style="border-bottom-color:#EFEFEA"><div class="grow"><span class="t">${t}</span><span class="s">${s}</span></div><button class="switch" role="switch" aria-checked="${cfg[k] === '1'}" aria-label="${t}" data-act="alert" data-k="${k}"></button></div>`).join('')}
    <p class="note" style="margin:12px 0">Cada aviso se crea en tu Google Calendar, en el calendario "Home · avisos", con su recordatorio: el celular te notifica aunque Home esté cerrada. ${S.demo ? '' : lastSync ? 'Última actualización: ' + new Date(lastSync).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + '.' : ''}</p>
    ${S.demo ? '' : `<button class="btn" style="margin-bottom:14px" data-act="syncavisos">${I.sync()}Actualizar avisos ahora</button>`}
  </section>`;
}

actions.pfilter = (el) => { ui.pendFilter = el.dataset.f; rerender(); };
actions.ptoggle = (el) => {
  const p = S.home.pendientes.find(x => x.id === el.dataset.id);
  run(async () => { await togglePendiente(el.dataset.id); syncAvisos().catch(() => {}); }, p ? (pendOccurrence(p).hecho ? `Hecho: ${p.titulo}` : 'Desmarcado') : '');
};
actions.pdel = (el) => {
  const p = S.home.pendientes.find(x => x.id === el.dataset.id);
  if (!p) return;
  openSheet({ title: 'Borrar pendiente', submitLabel: 'Borrar', body: `<p style="font-size:16px">¿Borrar "${esc(p.titulo)}"? ${p.repetir === 'mensual' ? 'Dejará de repetirse cada mes.' : ''}</p>`, onSubmit: () => { run(async () => { await deletePendiente(p.id); syncAvisos().catch(() => {}); }, 'Pendiente borrado'); } });
};
actions.alert = (el) => {
  const k = el.dataset.k, v = S.home.config[k] === '1' ? '0' : '1';
  el.setAttribute('aria-checked', v === '1');
  run(async () => { await setConfig(k, v); await syncAvisos(); }, 'Avisos actualizados');
};
actions.syncavisos = () => run(() => syncAvisos(), 'Avisos actualizados en Calendar');

actions.pendiente = () => {
  openSheet({
    title: 'Nuevo pendiente',
    body: `<div class="field"><label for="f-pt">Qué hay que hacer</label><input id="f-pt" name="titulo" autocomplete="off" placeholder="Ej. Pagar el SOAT" maxlength="120"></div>
      <div class="two"><div class="field"><label for="f-pf">Fecha</label><input id="f-pf" type="date" name="fecha" value="${iso(addDays(today(), 1))}"></div>
      <div class="field"><label for="f-pr">Repetir</label><select id="f-pr" name="repetir"><option value="no">No</option><option value="mensual">Cada mes</option></select></div></div>
      <div class="field"><label for="f-pc">Tipo</label><select id="f-pc" name="cat"><option value="pend">Tarea</option><option value="dinero">Pago</option></select></div>
      <div data-monto hidden>${moneyField('monto', 'Valor (opcional)')}</div>
      <p class="note">Si tiene fecha, te llega el aviso por Google Calendar ese día a las 8:00 a. m.</p>`,
    onOpen: (form) => { wireMoney(form); form.addEventListener('change', () => { form.querySelector('[data-monto]').hidden = form.cat.value !== 'dinero'; }); },
    onSubmit: (v, form) => {
      if (!v.titulo.trim()) { fieldError(form, 'titulo', 'Escribe qué hay que hacer.'); return false; }
      if (v.repetir === 'mensual' && !v.fecha) { fieldError(form, 'fecha', 'Elige el día del mes en que se repite.'); return false; }
      run(async () => { await addPendiente({ titulo: v.titulo.trim(), fecha: v.fecha, repetir: v.repetir, cat: v.cat, monto: Number(String(v.monto || '').replace(/\D/g, '')) || 0 }); syncAvisos().catch(() => {}); }, 'Pendiente guardado');
    }
  });
};
