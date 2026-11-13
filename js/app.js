import { CONFIG, DEMO } from './config.js';
import { signIn, signOut, isSignedIn, hasEverSignedIn, onAuthChange, userEmail, AuthNeeded } from './google.js';
import { S, loadAll, loadCache, syncAvisos } from './data.js';
import { ui, actions, setRender, rerender, toast, openSheet } from './core.js';
import { I } from './icons.js';
import { esc } from './util.js';
import * as hoy from './views/hoy.js';
import * as finanzas from './views/finanzas.js';
import * as agenda from './views/agenda.js';
import * as wellness from './views/wellness.js';
import * as pendientes from './views/pendientes.js';

const VIEWS = { hoy, finanzas, agenda, wellness, pendientes };
const NAV = [['hoy', 'Hoy', I.hoy], ['finanzas', 'Finanzas', I.finanzas], ['agenda', 'Agenda', I.agenda], ['wellness', 'Wellness', I.wellness], ['pendientes', 'Pendientes', I.pendientes]];
const root = document.getElementById('app');
let loading = false;

function routeFromHash() {
  const r = location.hash.replace('#', '');
  ui.route = VIEWS[r] ? r : 'hoy';
}

function loginScreen(err) {
  return `<main class="login">
    <div style="display:flex;flex-direction:column;gap:28px">
      <div class="mark" aria-hidden="true"><i class="c-entreno" style="flex:.6"></i><i class="c-comida" style="flex:.3"></i><i class="c-agenda" style="flex:1.4"></i><i class="c-pend" style="flex:.3"></i><i class="c-agenda" style="flex:2"></i><i class="c-dinero" style="flex:.3"></i><i class="c-entreno" style="flex:.8"></i></div>
      <div><h1>Home</h1><p>Tu día, tus finanzas, tu agenda y tus entrenos en un solo lugar. Se sincroniza con tu hoja FIN y tu Google Calendar.</p></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      ${err ? `<p class="banner" role="alert">${esc(err)}</p>` : ''}
      <button class="gbtn" data-act="signin">${I.google()}Iniciar sesión con Google</button>
      <p class="note" style="text-align:center">Home pide permiso para leer y editar tus hojas de cálculo y tu calendario. Nada sale de tu cuenta de Google.</p>
    </div>
  </main>`;
}

function shell(content) {
  const bell = '';
  return `${ui.needsReauth && !DEMO ? `<div class="main" style="padding-bottom:0;margin-bottom:-12px"><div class="banner" role="alert">Tu sesión de Google venció.<button class="btn" data-act="reauth">Reconectar</button></div></div>` : ''}
  ${DEMO ? `<div class="main" style="padding-bottom:0;margin-bottom:-12px"><div class="banner">Modo demo: datos de ejemplo, no se guarda nada en Google.</div></div>` : ''}
  <main class="main" id="view" tabindex="-1">${content}</main>
  <nav class="nav" aria-label="Secciones"><span class="brand">Home</span>
    ${NAV.map(([k, l, ic]) => `<a href="#${k}" ${ui.route === k ? 'aria-current="page"' : ''}><span class="pill">${ic()}</span>${l}</a>`).join('')}
  </nav>
  <button class="fab" data-act="fab" aria-label="Registrar algo nuevo">${I.plus(24)}</button>`;
}

function skeleton() {
  return `<div style="display:flex;flex-direction:column;gap:22px">
    <div class="skel" style="height:40px;width:60%"></div><div class="skel" style="height:44px"></div>
    <div class="skel" style="height:140px;border-radius:18px"></div><div class="skel" style="height:60px"></div><div class="skel" style="height:60px"></div></div>`;
}

function render() {
  if (!DEMO && !isSignedIn() && !hasEverSignedIn()) { root.innerHTML = loginScreen(ui.loginError); return; }
  if (!S.ready) { root.innerHTML = shell(S.error ? `<p class="empty" role="alert">${esc(S.error)}</p><button class="btn" data-act="retry">Reintentar</button>` : skeleton()); return; }
  const scrollY = window.scrollY;
  const prevRoute = root.dataset.route;
  let html;
  try { html = VIEWS[ui.route].render(); }
  catch (e) { console.error(e); html = `<p class="empty" role="alert">Algo falló al mostrar esta pantalla: ${esc(e.message)}</p>`; }
  root.innerHTML = shell(html);
  root.dataset.route = ui.route;
  if (prevRoute === ui.route) window.scrollTo(0, scrollY); else window.scrollTo(0, 0);
}
setRender(render);

async function refresh({ quiet = false } = {}) {
  if (loading) return;
  loading = true;
  try {
    await loadAll();
    ui.needsReauth = false;
    const last = Number(localStorage.getItem('home.avisosSync') || 0);
    if (!DEMO && Date.now() - last > 6 * 3600e3) syncAvisos().catch(e => console.warn('avisos', e));
  } catch (e) {
    console.error(e);
    if (e instanceof AuthNeeded) ui.needsReauth = true;
    else if (!S.ready) S.error = 'No se pudo cargar: ' + (e.message || e);
    else if (!quiet) toast('No se pudo sincronizar: ' + (e.message || e), true);
  } finally { loading = false; render(); }
}

// ---------- Acciones globales ----------
actions.signin = async () => {
  try { ui.loginError = ''; await signIn(); render(); await refresh(); }
  catch (e) { ui.loginError = e.message === 'popup_closed' || e.message === 'popup_failed_to_open' ? 'Se cerró la ventana de Google. Inténtalo de nuevo.' : 'No se pudo iniciar sesión: ' + e.message; render(); }
};
actions.reauth = async () => {
  try { await signIn({ silent: true }); ui.needsReauth = false; await refresh(); }
  catch (e) { toast('No se pudo reconectar: ' + e.message, true); }
};
actions.retry = () => { S.error = null; render(); refresh(); };
actions.fab = () => {
  const opts = [['gasto', 'Gasto', 'c-dinero'], ['pago', 'Pago', 'c-dinero'], ['ingreso', 'Ingreso', 'c-dinero'], ['pendiente', 'Pendiente', 'c-pend'], ['evento', 'Evento', 'c-agenda'], ['cuenta', 'Mi cuenta', '']];
  openSheet({ title: 'Registrar', submit: false, body: `<div class="menu-grid">${opts.map(([a, l, c]) => `<button type="button" data-menu="${a}"><i class="${c}" style="${c ? '' : 'background:var(--line-2)'}"></i>${l}</button>`).join('')}</div>`,
    onOpen: (sh) => sh.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.menu; setTimeout(() => actions[a](), 10); })) });
};
actions.cuenta = () => {
  openSheet({ title: 'Mi cuenta', submit: false, body: `<p style="font-size:16px">${DEMO ? 'Modo demo' : 'Conectado como <b>' + esc(userEmail() || 'tu cuenta de Google') + '</b>'}</p>
    <div class="kv"><span>Hoja de finanzas</span><a href="https://docs.google.com/spreadsheets/d/${CONFIG.FIN_ID}" target="_blank" rel="noopener">Abrir FIN</a></div>
    ${S.home && S.home.id !== 'demo' ? `<div class="kv"><span>Datos de Home</span><a href="https://docs.google.com/spreadsheets/d/${S.home.id}" target="_blank" rel="noopener">Abrir hoja HOME</a></div>` : ''}
    <button class="btn" type="button" data-act="refresh">${I.sync()}Sincronizar ahora</button>
    ${DEMO ? '' : `<button class="btn" type="button" data-act="signout">${I.logout()}Cerrar sesión</button>`}` });
};
actions.signout = () => { signOut(); localStorage.removeItem('home.cache.v1'); location.reload(); };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

window.addEventListener('hashchange', () => { routeFromHash(); render(); document.getElementById('view')?.focus({ preventScroll: true }); });

// Bloquea Finanzas si la app pasa más de 3 minutos en segundo plano; resincroniza al volver.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ui.lastHidden = Date.now(); return; }
  if (ui.lastHidden && Date.now() - ui.lastHidden > 3 * 60e3) { ui.finUnlocked = false; ui.pin.stage = null; }
  if (ui.lastHidden && Date.now() - ui.lastHidden > 60e3 && (DEMO || isSignedIn())) refresh({ quiet: true });
  render();
});
// Mantiene la franja al día.
setInterval(() => { if (!document.hidden && ui.route === 'hoy' && !document.querySelector('.sheet')) render(); }, 60e3);

onAuthChange((ok) => { if (!ok && hasEverSignedIn()) { ui.needsReauth = true; render(); } });

if ('serviceWorker' in navigator && !location.hostname.match(/^(localhost|127\.)/)) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- Arranque ----------
routeFromHash();
if (!DEMO) loadCache();
render();
if (DEMO) refresh();
else if (isSignedIn()) refresh();
else if (hasEverSignedIn()) { ui.needsReauth = true; render(); }
