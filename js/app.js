/* certificate-maker-bd - browser glue (no framework, no network).
 * Reads/writes localStorage keys cmbd-lang and cmbd-certs. */
'use strict';

const LS_LANG = 'cmbd-lang';
const LS_CERTS = 'cmbd-certs';

let lang = 'en';
try { lang = localStorage.getItem(LS_LANG) || 'en'; } catch (e) { lang = 'en'; }
if (lang !== 'bn' && lang !== 'en') lang = 'en';

let certs = [];
try { certs = JSON.parse(localStorage.getItem(LS_CERTS) || '[]'); } catch (e) { certs = []; }
if (!Array.isArray(certs)) certs = [];
certs = certs.map((c) => normaliseCert(c)).filter(Boolean);

let tab = 'make';
let searchQ = '';

const $ = (s) => document.querySelector(s);
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function saveCerts() {
  try { localStorage.setItem(LS_CERTS, JSON.stringify(certs)); } catch (e) { /* storage full/blocked */ }
}

function draft() {
  return {
    name: $('#f-name').value,
    title: $('#f-title').value,
    line: $('#f-line').value,
    issuer: $('#f-issuer').value,
    signer: $('#f-signer').value,
    date: $('#f-date').value,
    template: $('#f-template').value,
    orientation: $('#f-orient').value,
  };
}

function renderPreview() {
  const c = draft();
  const sheet = $('#cert-sheet');
  sheet.className = 'cert-sheet tpl-' + (templateById(c.template).id) + ' ori-' + (orientationById(c.orientation).id);
  $('#pv-word').textContent = t('certWord');
  $('#pv-presented').textContent = t('presentedTo');
  $('#pv-name').textContent = c.name.trim() || '\u2014';
  $('#pv-line').textContent = c.line.trim();
  $('#pv-line').style.display = c.line.trim() ? '' : 'none';
  $('#pv-title').textContent = c.title.trim() || '\u2014';
  $('#pv-issuer').textContent = c.issuer.trim() || '\u2014';
  $('#pv-date').textContent = c.date ? formatDateLong(c.date, lang) : '\u2014';
  $('#pv-signer').textContent = c.signer.trim();
  $('#pv-signer-row').style.display = c.signer.trim() ? '' : 'none';
  document.title = 'Certificate Maker BD \u2014 ' + (c.name.trim() || 'preview');
}

function showErrors(errs) {
  const box = $('#form-errors');
  if (!errs.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.innerHTML = errs.map((k) => '<div>' + esc(t(k) || k) + '</div>').join('');
  box.style.display = '';
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.style.display = '';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function renderIssued() {
  const list = $('#issued-list');
  const q = searchQ.trim().toLowerCase();
  const shown = certs.filter((c) => !q || (c.name + ' ' + c.title + ' ' + c.issuer).toLowerCase().includes(q));
  $('#issued-count').textContent = digits(String(certs.length), lang);
  if (!shown.length) {
    list.innerHTML = '<p class="empty">' + esc(t('issuedEmpty')) + '</p>';
    return;
  }
  list.innerHTML = shown.map((c) => (
    '<article class="issued-card" data-id="' + esc(c.id) + '">' +
    '<div class="ic-main"><strong>' + esc(c.name) + '</strong>' +
    '<span>' + esc(c.title) + '</span>' +
    '<small>' + esc(certSummary(c, lang)) + ' \u00b7 ' + esc(templateById(c.template).name) + '</small></div>' +
    '<div class="ic-btns">' +
    '<button class="btn small" data-act="load">' + esc(t('btnLoad')) + '</button>' +
    '<button class="btn small" data-act="dup">' + esc(t('btnDup')) + '</button>' +
    '<button class="btn small danger" data-act="del">' + esc(t('btnDel')) + '</button>' +
    '</div></article>'
  )).join('');
}

function setTab(next) {
  tab = next;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === next));
  $('#pane-make').style.display = next === 'make' ? '' : 'none';
  $('#pane-issued').style.display = next === 'issued' ? '' : 'none';
  $('#pane-data').style.display = next === 'data' ? '' : 'none';
  if (next === 'issued') renderIssued();
}

function applyLang() {
  document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  $('#app-title').textContent = t('appTitle');
  $('#app-sub').textContent = t('appSub');
  $('#lang-btn').textContent = lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
  document.querySelectorAll('.tab').forEach((b) => { b.textContent = t(b.dataset.tab === 'make' ? 'tabMake' : b.dataset.tab === 'issued' ? 'tabIssued' : 'tabData'); });
  $('#form-title').textContent = t('formTitle');
  const labels = { 'lb-name': 'fName', 'lb-title': 'fTitle', 'lb-line': 'fLine', 'lb-issuer': 'fIssuer', 'lb-signer': 'fSigner', 'lb-date': 'fDate', 'lb-template': 'fTemplate', 'lb-orient': 'fOrient' };
  Object.keys(labels).forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = t(labels[id]); });
  const ph = { 'f-name': 'fNamePh', 'f-title': 'fTitlePh', 'f-line': 'fLinePh', 'f-issuer': 'fIssuerPh', 'f-signer': 'fSignerPh' };
  Object.keys(ph).forEach((id) => { const el = document.getElementById(id); if (el) el.placeholder = t(ph[id]); });
  $('#btn-issue').textContent = t('btnIssue');
  $('#btn-sample').textContent = t('btnSample');
  $('#btn-print').textContent = t('btnPrint');
  $('#btn-clear').textContent = t('btnClear');
  $('#issued-title').textContent = t('issuedTitle');
  $('#search-issued').placeholder = t('searchPh');
  $('#data-title').textContent = t('dataTitle');
  $('#data-text').textContent = t('dataText');
  $('#btn-export').textContent = t('btnExport');
  $('#btn-import').textContent = t('btnImport');
  $('#btn-erase').textContent = t('btnErase');
  $('#foot').textContent = t('footer');
  // template + orientation option labels
  const ts = $('#f-template');
  ts.innerHTML = TEMPLATES.map((tp) => '<option value="' + tp.id + '">' + esc(lang === 'bn' ? tp.nameBn : tp.name) + ' \u2014 ' + esc(lang === 'bn' ? tp.descBn : tp.desc) + '</option>').join('');
  ts.value = $('#f-template').dataset.keep || draft().template || 'classic';
  const os = $('#f-orient');
  os.innerHTML = ORIENTATIONS.map((o) => '<option value="' + o.id + '">' + esc(lang === 'bn' ? o.nameBn : o.name) + '</option>').join('');
  os.value = draft().orientation || 'landscape';
  renderPreview();
  renderIssued();
  try { localStorage.setItem(LS_LANG, lang); } catch (e) { /* ignore */ }
}

function fillForm(c) {
  $('#f-name').value = c.name || '';
  $('#f-title').value = c.title || '';
  $('#f-line').value = c.line || '';
  $('#f-issuer').value = c.issuer || '';
  $('#f-signer').value = c.signer || '';
  $('#f-date').value = c.date || '';
  $('#f-template').value = c.template || 'classic';
  $('#f-orient').value = c.orientation || 'landscape';
  showErrors([]);
  renderPreview();
}

function issue() {
  const c = draft();
  const errs = validateCert(c);
  showErrors(errs);
  if (errs.length) return;
  const stored = normaliseCert(Object.assign({}, c, { id: newId(), issuedAt: new Date().toISOString() }));
  certs.unshift(stored);
  saveCerts();
  toast(t('okIssued'));
  setTab('issued');
}

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
  // keep template selection across language re-render
  $('#f-template').addEventListener('change', (e) => { $('#f-template').dataset.keep = e.target.value; renderPreview(); });
  $('#f-orient').addEventListener('change', renderPreview);
  ['f-name', 'f-title', 'f-line', 'f-issuer', 'f-signer', 'f-date'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderPreview);
  });
  $('#lang-btn').addEventListener('click', () => { lang = lang === 'bn' ? 'en' : 'bn'; applyLang(); });
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#btn-issue').addEventListener('click', issue);
  $('#btn-sample').addEventListener('click', () => fillForm(SAMPLE));
  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-clear').addEventListener('click', () => fillForm({ name: '', title: '', line: '', issuer: '', signer: '', date: '', template: 'classic', orientation: 'landscape' }));
  $('#search-issued').addEventListener('input', (e) => { searchQ = e.target.value; renderIssued(); });
  $('#issued-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const card = e.target.closest('.issued-card');
    const id = card && card.dataset.id;
    const c = certs.find((x) => x.id === id);
    if (!c) return;
    if (btn.dataset.act === 'load') { fillForm(c); setTab('make'); }
    if (btn.dataset.act === 'dup') {
      const copy = normaliseCert(Object.assign({}, c, { id: newId(), issuedAt: new Date().toISOString() }));
      certs.unshift(copy); saveCerts(); renderIssued(); toast(t('okIssued'));
    }
    if (btn.dataset.act === 'del') {
      if (!window.confirm(t('confirmDelete'))) return;
      certs = certs.filter((x) => x.id !== id); saveCerts(); renderIssued(); toast(t('okDeleted'));
    }
  });
  $('#btn-export').addEventListener('click', () => {
    download('certificate-maker-bd-export.json', JSON.stringify({ app: 'certificate-maker-bd', version: 1, certificates: certs }, null, 2));
  });
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = validateImport(String(reader.result || ''));
      if (!res.ok) { toast(t('errImport') + res.errors.join(', ')); return; }
      certs = res.certificates.concat(certs.filter((c) => !res.certificates.some((n) => n.id === c.id)));
      saveCerts(); renderIssued(); toast(res.certificates.length + ' ' + t('okImported'));
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  $('#btn-erase').addEventListener('click', () => {
    const ans = window.prompt(t('eraseConfirm'));
    if (ans !== 'DELETE') return;
    certs = []; saveCerts(); renderIssued();
  });
  applyLang();
  setTab('make');
});
