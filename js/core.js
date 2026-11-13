// Núcleo de la interfaz: estado de pantalla, acciones, hoja inferior, avisos emergentes.
import { AuthNeeded } from './google.js';
import { esc } from './util.js';
import { I } from './icons.js';

export const ui = {
  route: 'hoy',
  finUnlocked: false, finTab: 'resumen', lastHidden: 0,
  agendaDay: null, agendaFilter: 'todo',
  pendFilter: 'todo',
  wellDay: null,
  needsReauth: false
};

export const actions = {};
let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };
export const rerender = () => renderFn();

let toastTimer;
export function toast(msg, isErr = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast' + (isErr ? ' err' : ''); }, isErr ? 4200 : 2400);
}

// Ejecuta una escritura: actualiza la pantalla al instante y avisa si falla.
export async function run(fn, okMsg) {
  try {
    const p = fn();
    rerender();
    await p;
    if (okMsg) toast(okMsg);
    rerender();
  } catch (e) {
    console.error(e);
    if (e instanceof AuthNeeded) { ui.needsReauth = true; toast('Tu sesión de Google venció. Toca "Reconectar" y vuelve a intentarlo.', true); }
    else toast('No se pudo guardar: ' + (e.message || e), true);
    rerender();
  }
}

// ---------- Hoja inferior ----------
let sheetCleanup = null;
export function openSheet({ title, body, submit, submitLabel = 'Guardar', onSubmit, onOpen }) {
  closeSheet(true);
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  const sh = document.createElement('form');
  sh.className = 'sheet';
  sh.setAttribute('role', 'dialog');
  sh.setAttribute('aria-modal', 'true');
  sh.setAttribute('aria-label', title);
  sh.noValidate = true;
  sh.innerHTML = `<div class="grab" aria-hidden="true"></div>
    <div class="sheet-head"><h2 class="h2">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${I.close()}</button></div>
    ${body}
    ${submit !== false ? `<button type="submit" class="btn primary block">${esc(submitLabel)}</button>` : ''}`;
  document.body.append(back, sh);
  requestAnimationFrame(() => { back.classList.add('open'); sh.classList.add('open'); });
  const prevFocus = document.activeElement;
  const close = () => closeSheet();
  back.addEventListener('click', close);
  sh.querySelector('[data-close]').addEventListener('click', close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  sh.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const data = Object.fromEntries(new FormData(sh).entries());
    const res = await onSubmit(data, sh);
    if (res !== false) closeSheet();
  });
  sheetCleanup = (instant) => {
    document.removeEventListener('keydown', onKey);
    back.classList.remove('open'); sh.classList.remove('open');
    const rm = () => { back.remove(); sh.remove(); };
    instant ? rm() : setTimeout(rm, 260);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };
  setTimeout(() => { const f = sh.querySelector('input:not([type=hidden]), select'); if (f && !onOpen) f.focus(); }, 280);
  if (onOpen) onOpen(sh);
  return sh;
}
export function closeSheet(instant = false) { if (sheetCleanup) { const c = sheetCleanup; sheetCleanup = null; c(instant); } }

export function fieldError(form, name, msg) {
  const f = form.querySelector(`[name="${name}"]`);
  const wrap = f?.closest('.field');
  if (!wrap) return;
  let e = wrap.querySelector('.err');
  if (!e) { e = document.createElement('p'); e.className = 'err'; wrap.append(e); }
  e.textContent = msg;
  f.setAttribute('aria-invalid', 'true');
  f.focus();
}
