import { S, CARDS, addGasto, setPagado, addIngreso, setConfig, fechaLimite, loadAll } from '../data.js';
import { CONFIG } from '../config.js';
import { ui, actions, run, openSheet, rerender, toast, fieldError, closeSheet } from '../core.js';
import { I } from '../icons.js';
import { esc, money, today, iso, fromIso, lastDay, MONTHS, MON_SHORT, relDay, dayLabel, sha256, uid, dmy } from '../util.js';

ui.pin = { buf: '', stage: null, first: '', msg: '', shake: false };

function pinStage() {
  const c = S.home?.config || {};
  if (!ui.pin.stage) ui.pin.stage = c.pinHash ? 'enter' : 'new';
  return ui.pin.stage;
}

function pinScreen() {
  const st = pinStage();
  const title = st === 'new' ? 'Crea una clave de 4 dígitos' : st === 'confirm' ? 'Escríbela otra vez' : 'Escribe tu clave';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return `<h1 class="title">Finanzas</h1>
  <div class="pin">
    <div class="lock">${I.lock(28)}</div>
    <div style="text-align:center;display:flex;flex-direction:column;gap:6px">
      <p style="font-size:17px;font-weight:600">${title}</p>
      <p class="small" style="min-height:18px;${ui.pin.msg ? 'color:var(--rojo-ink);font-weight:600' : ''}">${esc(ui.pin.msg || (st === 'new' ? 'La pedirá cada vez que abras Finanzas.' : ''))}</p>
    </div>
    <div class="dots ${ui.pin.shake ? 'shake' : ''}" role="status" aria-label="${ui.pin.buf.length} de 4 dígitos">${[0, 1, 2, 3].map(i => `<i class="${i < ui.pin.buf.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="keypad">${keys.map(k => k === '' ? '<span></span>' : k === 'del' ? `<button class="txt" data-act="pin" data-k="del" aria-label="Borrar un dígito">Borrar</button>` : `<button data-act="pin" data-k="${k}" aria-label="Dígito ${k}">${k}</button>`).join('')}</div>
  </div>`;
}

actions.pin = async (el) => {
  const k = el.dataset.k, p = ui.pin;
  p.shake = false; p.msg = '';
  if (k === 'del') { p.buf = p.buf.slice(0, -1); rerender(); return; }
  if (p.buf.length >= 4) return;
  p.buf += k;
  rerender();
  if (p.buf.length < 4) return;
  const st = pinStage(), entered = p.buf;
  p.buf = '';
  if (st === 'new') { p.first = entered; p.stage = 'confirm'; rerender(); return; }
  if (st === 'confirm') {
    if (entered !== p.first) { p.stage = 'new'; p.msg = 'No coincidían. Empieza de nuevo.'; p.shake = true; rerender(); return; }
    const salt = uid() + uid();
    const hash = await sha256(salt + entered);
    await run(async () => { await setConfig('pinSalt', salt); await setConfig('pinHash', hash); }, 'Clave creada');
    p.stage = 'enter'; ui.finUnlocked = true; rerender(); return;
  }
  const c = S.home.config;
  const ok = (await sha256((c.pinSalt || '') + entered)) === c.pinHash;
  if (ok) { ui.finUnlocked = true; p.msg = ''; }
  else { p.msg = 'Clave incorrecta'; p.shake = true; if (navigator.vibrate) navigator.vibrate(80); }
  rerender();
};
actions.lockfin = () => { ui.finUnlocked = false; ui.pin.stage = null; rerender(); };
actions.fintab = (el) => { ui.finTab = el.dataset.tab; rerender(); };
actions.refresh = () => run(async () => { await loadAll(); }, 'Sincronizado con FIN');

const ago = (d) => { if (!d) return 'sin sincronizar'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };

function monthStrip() {
  const f = S.fin, m = f.month, y = m.getFullYear(), mo = m.getMonth(), n = lastDay(y, mo), t = today();
  const pays = {};
  f.compromisos.forEach(c => { if (c.fecha && c.fecha.getMonth() === mo) (pays[c.fecha.getDate()] = pays[c.fecha.getDate()] || []).push(c); });
  const qEnd = Math.min(30, n);
  const cells = [];
  for (let d = 1; d <= n; d++) {
    const date = new Date(y, mo, d);
    const p = pays[d];
    let cls = '';
    if (p) cls = p.every(c => c.pagado) ? 'paid' : 'pay';
    else if (d === 15 || d === qEnd) cls = 'inc';
    if (date < t && cls !== 'paid') cls += ' past';
    if (iso(date) === iso(t)) cls = 'today';
    const lbl = `Día ${d}` + (p ? ': ' + p.map(c => c.concepto + (c.pagado ? ' (pagado)' : '')).join(', ') : '') + ((d === 15 || d === qEnd) ? ', quincena' : '');
    cells.push(`<i class="${cls}" title="${esc(lbl)}" aria-label="${esc(lbl)}"></i>`);
  }
  return `<section aria-label="El mes en una franja" style="display:flex;flex-direction:column;gap:8px">
    <div class="section-head" style="padding:0"><h2 class="h3">${MONTHS[mo][0].toUpperCase() + MONTHS[mo].slice(1)}</h2><span class="small">hoy es ${t.getDate()}</span></div>
    <div class="month-strip" style="--n:${n}" role="img" aria-label="Días de pago del mes">${cells.join('')}</div>
    <div class="legend"><span><i class="sq c-dinero"></i>Pago</span><span><i class="sq c-dinero" style="opacity:.35"></i>Pagado</span><span><i class="sq" style="background:var(--ink)"></i>Quincena</span><span><i class="sq" style="background:#fff;outline:2px solid var(--ink)"></i>Hoy</span></div>
  </section>`;
}

function pagoRow(c) {
  const t = today();
  const late = !c.pagado && c.fecha && c.fecha < t;
  const days = c.fecha ? Math.round((c.fecha - t) / 864e5) : 99;
  const sub = c.pagado ? 'Pagado' : late ? `Venció ${relDay(c.fecha)}` : days <= 3 ? cap1(relDay(c.fecha)) : (c.fecha ? dayLabel(c.fecha) : '');
  return `<div class="row ${c.pagado ? 'done' : ''}">
    <button class="check dinero" data-act="pagado" data-row="${c.row}" aria-pressed="${c.pagado}" aria-label="Marcar ${esc(c.concepto)} como pagado">${I.check()}</button>
    <div class="date-box"><b>${c.fecha ? c.fecha.getDate() : '–'}</b><span>${c.fecha ? MON_SHORT[c.fecha.getMonth()] : ''}</span></div>
    <div class="grow"><span class="t">${esc(c.concepto)}</span><span class="s ${late ? 'late' : (!c.pagado && days <= 3 ? 'soon' : '')}">${sub}</span></div>
    <span class="amt">${money(c.valor)}</span></div>`;
}
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

function resumen() {
  const f = S.fin;
  const cobrar = f.porCobrar.reduce((a, p) => a + p.total, 0);
  const netCards = f.tarjetasMes - cobrar;
  const pctB = Math.min(100, Math.max(0, netCards / CONFIG.CARD_BUDGET * 100));
  const over = netCards > CONFIG.CARD_BUDGET;
  const mo = f.month.getMonth();
  const ingMes = f.ingresos.filter(i => i.fecha && i.fecha.getMonth() === mo && i.fecha.getFullYear() === f.month.getFullYear());
  const totalIng = ingMes.reduce((a, i) => a + i.valor, 0);
  const sorted = [...f.compromisos].sort((a, b) => (a.pagado - b.pagado) || ((a.fecha || 0) - (b.fecha || 0)));
  return `
  <section style="display:flex;flex-direction:column;gap:4px">
    <p style="font-size:15px;color:var(--muted)">Falta por pagar en ${MONTHS[mo]}</p>
    <p class="big-num">${money(f.falta)}</p>
    <p class="small" style="font-size:14px">De ${money(f.total)} en compromisos. Si te pagan lo que te deben, quedan ${money(Math.max(0, f.falta - cobrar))} a tu cargo.</p>
  </section>
  ${monthStrip()}
  <section aria-label="Presupuesto de tarjetas" style="display:flex;flex-direction:column;gap:10px;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><p style="font-size:15px;font-weight:600">Tarjetas este mes</p><p style="font-size:15px"><b>${money(netCards)}</b> <span style="color:var(--muted)">de ${money(CONFIG.CARD_BUDGET)}</span></p></div>
    <div class="bar"><i style="width:${pctB}%;background:${over ? 'var(--rojo)' : 'var(--dinero)'}"></i></div>
    <p class="small" style="${over ? 'color:var(--rojo-ink);font-weight:600' : ''}">${over ? `Te pasaste por ${money(netCards - CONFIG.CARD_BUDGET)}.` : `Te quedan ${money(CONFIG.CARD_BUDGET - netCards)} de presupuesto.`} Ya descuenta lo que te deben.</p>
  </section>
  <section class="section" aria-label="Pagos del mes">
    <div class="section-head"><h2 class="h2">Pagos del mes</h2><span class="small">Toca la casilla al pagar</span></div>
    ${sorted.map(pagoRow).join('') || '<p class="empty">No hay compromisos en FIN para este mes.</p>'}
  </section>
  <section class="section" aria-label="Te deben">
    <h2 class="h2" style="margin-bottom:4px">Te deben</h2>
    ${f.porCobrar.filter(p => p.total).map(p => `<div class="kv"><span>${esc(p.quien)}</span><b>${money(p.total)}</b></div>`).join('') || '<p class="small">Nadie te debe este mes.</p>'}
  </section>
  <section class="section" aria-label="Ingresos">
    <div class="section-head"><h2 class="h2">Te entró este mes</h2><b style="font-size:15px">${money(totalIng)}</b></div>
    ${ingMes.slice(-3).reverse().map(i => `<div class="kv"><span>${esc(i.concepto)} <span class="small">· ${i.fecha.getDate()} ${MON_SHORT[i.fecha.getMonth()]}</span></span><b>+${money(i.valor)}</b></div>`).join('') || '<p class="small">Aún no registras ingresos este mes.</p>'}
  </section>
  ${moneyButtons()}`;
}

function moneyButtons() {
  return `<div role="group" aria-label="Registrar en FIN" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
    <button class="btn primary" style="height:52px" data-act="gasto">${I.plus(16)}Gasto</button>
    <button class="btn" style="height:52px" data-act="pago">${I.plus(16)}Pago</button>
    <button class="btn" style="height:52px" data-act="ingreso">${I.plus(16)}Ingreso</button>
  </div>`;
}

function tarjetas() {
  return S.fin.cards.map(c => {
    const used = c.cupo ? Math.min(100, (1 - c.disp / c.cupo) * 100) : 0;
    return `<section class="card" style="gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><h2 class="h3">${esc(c.name)}</h2><span class="small">Este mes <b style="color:var(--ink)">${money(c.mes || 0)}</b></span></div>
      <div class="bar thin"><i style="width:${used}%;background:var(--dinero)"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>Disponible <b>${money(c.disp)}</b></span><span class="small">de ${money(c.cupo)}</span></div>
      <p class="small">${c.corte ? `Corte el ${c.corte}` : 'Corte sin definir'} · ${c.pago ? `paga el ${c.pago}` : 'pago sin definir'}</p>
    </section>`;
  }).join('') + moneyButtons();
}

function movimientos() {
  const f = S.fin;
  const all = [
    ...f.compras.map(c => ({ fecha: c.fecha, t: c.desc || 'Compra', s: c.tarjeta + (c.cobrarA ? ` · cobrar a ${c.cobrarA}` : ''), v: -c.valor })),
    ...f.ingresos.map(i => ({ fecha: i.fecha, t: i.concepto || 'Ingreso', s: i.tipo || 'Ingreso', v: i.valor }))
  ].filter(x => x.fecha).sort((a, b) => b.fecha - a.fecha).slice(0, 60);
  return `<section class="section">${all.map(x => `<div class="row"><div class="date-box"><b>${x.fecha.getDate()}</b><span>${MON_SHORT[x.fecha.getMonth()]}</span></div><div class="grow"><span class="t">${esc(x.t)}</span><span class="s">${esc(x.s)}</span></div><span class="amt" style="${x.v > 0 ? 'color:var(--entreno-ink)' : ''}">${x.v > 0 ? '+' : ''}${money(x.v)}</span></div>`).join('') || '<p class="empty">Sin movimientos todavía.</p>'}</section>${moneyButtons()}`;
}

export function render() {
  if (!ui.finUnlocked) return pinScreen();
  const tabs = [['resumen', 'Resumen'], ['tarjetas', 'Tarjetas'], ['movimientos', 'Movimientos']];
  const body = ui.finTab === 'tarjetas' ? tarjetas() : ui.finTab === 'movimientos' ? movimientos() : resumen();
  return `<header class="top"><h1 class="title">Finanzas</h1>
    <div style="display:flex;gap:8px"><button class="status-chip" data-act="refresh" aria-label="Sincronizar con la hoja FIN">${I.sync()}FIN · ${ago(S.lastSync)}</button>
    <button class="icon-btn" data-act="lockfin" aria-label="Bloquear Finanzas" style="width:36px;height:36px">${I.lock(16)}</button></div></header>
  <div class="seg" role="tablist" aria-label="Vistas de finanzas">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${ui.finTab === k}" data-act="fintab" data-tab="${k}">${l}</button>`).join('')}</div>
  ${body}`;
}

// ---------- Formularios ----------
export function moneyField(name, label, value = '') {
  return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" class="money-input" inputmode="numeric" autocomplete="off" placeholder="$0" value="${value}" data-money></div>`;
}
const digits = (s) => Number(String(s || '').replace(/\D/g, '')) || 0;
export function wireMoney(form) {
  form.querySelectorAll('[data-money]').forEach(inp => {
    inp.addEventListener('input', () => { const n = digits(inp.value); inp.value = n ? '$' + n.toLocaleString('es-CO') : ''; inp.dispatchEvent(new Event('money')); });
  });
}
const radios = (name, opts, sel) => `<div class="opts" role="radiogroup">${opts.map(o => `<label class="chip" style="cursor:pointer"><input type="radio" name="${name}" value="${esc(o)}" ${o === sel ? 'checked' : ''} style="position:absolute;opacity:0;width:1px;height:1px">${esc(o)}</label>`).join('')}</div>`;
function wireRadios(form) {
  const sync = () => form.querySelectorAll('.opts label').forEach(l => l.setAttribute('aria-pressed', l.querySelector('input').checked));
  form.addEventListener('change', sync); sync();
}

actions.gasto = () => {
  const lastCard = localStorage.getItem('home.lastCard') || 'Bancolombia';
  openSheet({
    title: 'Registrar gasto', submitLabel: 'Guardar en FIN',
    body: `${moneyField('valor', 'Valor')}
      <div class="field"><label for="f-desc">Descripción</label><input id="f-desc" name="desc" autocomplete="off" placeholder="Ej. Mercado D1" maxlength="80"></div>
      <div class="field"><span class="lbl">Tarjeta</span>${radios('tarjeta', CARDS, lastCard)}</div>
      <div class="two">
        <div class="field"><label for="f-fecha">Fecha</label><input id="f-fecha" type="date" name="fecha" value="${iso(today())}"></div>
        <div class="field"><label for="f-cobrar">¿Se lo cobras a alguien?</label><select id="f-cobrar" name="cobrarA"><option value="">No</option><option>Sofía</option><option>BRAVO</option></select></div>
      </div>
      <div class="field" data-cobro hidden>${''}<label for="f-vc">Valor a cobrar</label><input id="f-vc" name="valorCobrar" inputmode="numeric" data-money placeholder="Igual al gasto"></div>
      <p class="note" data-limite></p>`,
    onOpen: (form) => {
      wireMoney(form); wireRadios(form);
      const upd = () => {
        const d = form.fecha.value ? fromIso(form.fecha.value) : today();
        const card = form.querySelector('[name=tarjeta]:checked')?.value;
        const lim = card && fechaLimite(card, d);
        form.querySelector('[data-limite]').textContent = lim ? `Se paga el ${dayLabel(lim).toLowerCase()} de ${MONTHS[lim.getMonth()]}.` : '';
        form.querySelector('[data-cobro]').hidden = !form.cobrarA.value;
      };
      form.addEventListener('change', upd); upd();
      setTimeout(() => form.valor.focus(), 280);
    },
    onSubmit: (d, form) => {
      const valor = digits(d.valor);
      if (!valor) { fieldError(form, 'valor', 'Escribe el valor del gasto.'); return false; }
      if (!d.desc.trim()) { fieldError(form, 'desc', 'Escribe en qué fue el gasto.'); return false; }
      localStorage.setItem('home.lastCard', d.tarjeta);
      run(() => addGasto({ fecha: d.fecha || iso(today()), desc: d.desc.trim(), tarjeta: d.tarjeta, valor, cobrarA: d.cobrarA, valorCobrar: digits(d.valorCobrar) || valor }), 'Gasto guardado en FIN');
    }
  });
};

actions.pago = () => {
  const pend = S.fin.compromisos.filter(c => !c.pagado);
  openSheet({
    title: 'Registrar pago', submit: false,
    body: pend.length ? `<p class="small">Marca lo que ya pagaste. Se actualiza la columna "Pagado" en Compromisos del Mes.</p><div class="section">${pend.map(pagoRow).join('')}</div>` : '<p class="empty">Todo lo de este mes está pagado.</p>'
  });
};

actions.pagado = (el) => {
  const row = Number(el.dataset.row);
  const c = S.fin.compromisos.find(x => x.row === row);
  if (!c) return;
  const v = !c.pagado;
  el.setAttribute('aria-pressed', v);
  el.closest('.row')?.classList.toggle('done', v);
  run(() => setPagado(row, v), v ? `${c.concepto} marcado como pagado` : `${c.concepto} sin pagar`);
};

actions.ingreso = () => {
  openSheet({
    title: 'Registrar ingreso', submitLabel: 'Guardar en FIN',
    body: `${moneyField('valor', 'Valor')}
      <div class="field"><span class="lbl">Tipo</span>${radios('tipo', ['Quincena', 'BRAVO', 'Reembolso', 'Otro'], 'Quincena')}</div>
      <div class="field"><label for="f-concepto">Concepto</label><input id="f-concepto" name="concepto" autocomplete="off" placeholder="Ej. Quincena 15 de noviembre" maxlength="80"></div>
      <div class="field"><label for="f-fecha">Fecha</label><input id="f-fecha" type="date" name="fecha" value="${iso(today())}"></div>
      <p class="note">Se guarda en la pestaña "Ingresos" de FIN${S.fin.hasIngresos ? '' : ', que se crea la primera vez'}.</p>`,
    onOpen: (form) => { wireMoney(form); wireRadios(form); setTimeout(() => form.valor.focus(), 280); },
    onSubmit: (d, form) => {
      const valor = digits(d.valor);
      if (!valor) { fieldError(form, 'valor', 'Escribe cuánto te entró.'); return false; }
      run(() => addIngreso({ fecha: d.fecha || iso(today()), concepto: d.concepto.trim() || d.tipo, valor, tipo: d.tipo }), 'Ingreso guardado en FIN');
    }
  });
};
