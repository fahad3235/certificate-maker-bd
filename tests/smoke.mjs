/* certificate-maker-bd headless-Chrome smoke test (raw CDP, no deps).
 * Run: node tests/smoke.mjs  (from the certificate-maker-bd folder)
 * Loads index.html over file://, drives the real UI, collects
 * console/page errors, asserts visible state at 1280px and 390px. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE_URL = 'file:///home/hatch/workspace/muse-project-factory/builds/certificate-maker-bd/index.html';
const PORT = 9228;

let pass = 0, fail = 0;
const errors = [];
const netReqs = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const chrome = spawn(SHELL, ['--headless', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('headless_shell did not start');
}

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function click(selector) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('missing ' + ${JSON.stringify(selector)}); e.click(); return true; })()`);
}
const setVal = (sel, v) => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const setSel = (sel, v) => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === 'Network.requestWillBeSent') netReqs.push(m.params.request.url);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);

  /* ---- initial render ---- */
  check('title is Certificate Maker BD', await evalJs(`document.title.includes('Certificate Maker BD')`));
  check('3 tabs present', await evalJs(`document.querySelectorAll('.tab').length`) === 3);
  check('4 template options', await evalJs(`document.querySelectorAll('#f-template option').length`) === 4);
  check('2 orientation options', await evalJs(`document.querySelectorAll('#f-orient option').length`) === 2);
  check('preview sheet rendered', await evalJs(`!!document.querySelector('#cert-sheet')`));
  check('no horizontal overflow at 1280px', await evalJs(`document.documentElement.scrollWidth <= 1280`));
  check('issued list empty state', await evalJs(`document.querySelector('#issued-list').textContent.includes('No certificates')`));

  /* ---- live preview updates ---- */
  await setVal('#f-name', 'Ishan Ahmed Fahad');
  await setVal('#f-title', 'Web Development Bootcamp 2026');
  await setVal('#f-issuer', 'Team Probaho');
  await sleep(200);
  check('preview shows typed name', await evalJs(`document.querySelector('#pv-name').textContent`) === 'Ishan Ahmed Fahad');
  check('preview shows typed title', await evalJs(`document.querySelector('#pv-title').textContent`) === 'Web Development Bootcamp 2026');
  check('preview shows typed issuer', await evalJs(`document.querySelector('#pv-issuer').textContent`) === 'Team Probaho');

  /* ---- validation: empty date blocks issue ---- */
  await click('#btn-issue');
  await sleep(200);
  check('issue with missing date shows error', await evalJs(`document.querySelector('#form-errors').style.display !== 'none' && document.querySelector('#form-errors').textContent.length > 0`));
  check('no cert saved after failed issue', await evalJs(`JSON.parse(localStorage.getItem('cmbd-certs') || '[]').length`) === 0);

  /* ---- sample + issue ---- */
  await click('#btn-sample');
  await sleep(200);
  check('sample fills name', await evalJs(`document.querySelector('#f-name').value`) === 'Ishan Ahmed Fahad');
  check('sample fills date', await evalJs(`document.querySelector('#f-date').value`) === '2026-11-18');
  check('preview date formatted EN', await evalJs(`document.querySelector('#pv-date').textContent`) === '18 November 2026');
  await click('#btn-issue');
  await sleep(300);
  check('issue saves 1 cert', await evalJs(`JSON.parse(localStorage.getItem('cmbd-certs') || '[]').length`) === 1);
  check('Issued tab shown after issue', await evalJs(`document.querySelector('#pane-issued').style.display !== 'none'`));
  check('issued card shows name', await evalJs(`document.querySelector('#issued-list').textContent.includes('Ishan Ahmed Fahad')`));
  check('issued count badge = 1', await evalJs(`document.querySelector('#issued-count').textContent`) === '1');

  /* ---- template + orientation switch ---- */
  await click('[data-tab="make"]');
  await sleep(200);
  await setSel('#f-template', 'modern');
  await sleep(200);
  check('modern template class applied', await evalJs(`document.querySelector('#cert-sheet').className.includes('tpl-modern')`));
  await setSel('#f-orient', 'portrait');
  await sleep(200);
  check('portrait class applied', await evalJs(`document.querySelector('#cert-sheet').className.includes('ori-portrait')`));
  await setSel('#f-template', 'academic');
  await sleep(150);
  check('academic template class applied', await evalJs(`document.querySelector('#cert-sheet').className.includes('tpl-academic')`));
  await setSel('#f-template', 'minimal');
  await sleep(150);
  check('minimal template class applied', await evalJs(`document.querySelector('#cert-sheet').className.includes('tpl-minimal')`));
  await setSel('#f-template', 'classic');
  await setSel('#f-orient', 'landscape');

  /* ---- duplicate + delete (confirm stubbed to true) ---- */
  await click('[data-tab="issued"]');
  await sleep(200);
  await evalJs(`window.confirm = () => true`);
  await evalJs(`(() => { document.querySelector('[data-act="dup"]').click(); return true; })()`);
  await sleep(300);
  check('duplicate makes 2 certs', await evalJs(`JSON.parse(localStorage.getItem('cmbd-certs') || '[]').length`) === 2);
  check('issued count badge = 2', await evalJs(`document.querySelector('#issued-count').textContent`) === '2');
  await evalJs(`(() => { document.querySelector('[data-act="load"]').click(); return true; })()`);
  await sleep(300);
  check('load returns to Make tab with name', await evalJs(`document.querySelector('#pane-make').style.display !== 'none' && document.querySelector('#f-name').value === 'Ishan Ahmed Fahad'`));
  await click('[data-tab="issued"]');
  await sleep(200);
  await evalJs(`(() => { document.querySelector('[data-act="del"]').click(); return true; })()`);
  await sleep(300);
  check('delete leaves 1 cert', await evalJs(`JSON.parse(localStorage.getItem('cmbd-certs') || '[]').length`) === 1);

  /* ---- search filter ---- */
  await setVal('#search-issued', 'zzz-no-match');
  await sleep(200);
  check('search no-match shows empty state', await evalJs(`document.querySelector('#issued-list').textContent.includes('No certificates')`));
  await setVal('#search-issued', 'ishan');
  await sleep(200);
  check('search match shows card', await evalJs(`document.querySelectorAll('#issued-list .issued-card').length`) === 1);
  await setVal('#search-issued', '');

  /* ---- reload persistence ---- */
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);
  check('cert persists across reload', await evalJs(`JSON.parse(localStorage.getItem('cmbd-certs') || '[]').length`) === 1);

  /* ---- BN toggle (reload sample first: form state is not persisted) ---- */
  await click('#btn-sample');
  await sleep(200);
  await click('#lang-btn');
  await sleep(300);
  check('BN title shown', await evalJs(`document.querySelector('#app-title').textContent.length > 5 && document.querySelector('#app-title').textContent !== 'Certificate Maker BD'`));
  check('BN date in preview (Bengali digits)', await evalJs(`document.querySelector('#pv-date').textContent.includes('\u09e7\u09ee')`));
  check('BN issued count uses Bengali digit', await evalJs(`document.querySelector('#issued-count').textContent`) === '\u09e7');
  check('lang persists in localStorage', await evalJs(`localStorage.getItem('cmbd-lang')`) === 'bn');
  await click('#lang-btn');
  await sleep(300);
  check('back to EN title', await evalJs(`document.querySelector('#app-title').textContent`) === 'Certificate Maker BD');

  /* ---- XSS safety: script tag in name is escaped ---- */
  await click('[data-tab="make"]');
  await sleep(200);
  await setVal('#f-name', '<script>alert(1)</script>');
  await sleep(200);
  check('script tag shown as text, not executed', await evalJs(`document.querySelector('#pv-name').textContent.includes('<script>') && !document.querySelector('#pv-name script')`));
  await click('#btn-sample'); // restore sane form

  /* ---- mobile 390px ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(600);
  check('no horizontal overflow at 390px', await evalJs(`document.documentElement.scrollWidth <= 391`));
  check('preview visible at 390px', await evalJs(`(() => { const r = document.querySelector('#cert-sheet').getBoundingClientRect(); return r.width > 300 && r.height > 100; })()`));

  /* ---- errors / network ---- */
  check('zero console/page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  check('zero network requests (offline)', netReqs.filter((u) => !u.startsWith('file://') && !u.startsWith('data:')).length === 0, netReqs.join(', ').slice(0, 200));

  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  chrome.kill();
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error('SMOKE ERROR:', e.message);
  chrome.kill();
  process.exit(1);
}
