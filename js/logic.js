/* certificate-maker-bd - pure logic (no DOM). Node-testable.
 * Pure ASCII source: Bengali text is written as \uXXXX escapes. */
'use strict';

/* In Node, data comes from require(); in the browser, data.js already
 * defined the same names as global lexical bindings. */
const _DATA = (typeof require !== 'undefined')
  ? require('./data.js')
  : { TEMPLATES: TEMPLATES, ORIENTATIONS: ORIENTATIONS, MONTHS_EN: MONTHS_EN, MONTHS_BN: MONTHS_BN };
const TPL = _DATA.TEMPLATES, ORI = _DATA.ORIENTATIONS;
const M_EN = _DATA.MONTHS_EN, M_BN = _DATA.MONTHS_BN;

const BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}

function digits(s, lang) {
  return lang === 'bn' ? toBnDigits(s) : String(s);
}

/* ISO date (YYYY-MM-DD) -> "18 November 2026" / Bengali digits form.
 * Returns '' for anything that is not a real calendar date. */
function formatDateLong(iso, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  if (lang === 'bn') return toBnDigits(String(d)) + ' ' + M_BN[mo - 1] + ' ' + toBnDigits(String(y));
  return d + ' ' + M_EN[mo - 1] + ' ' + y;
}

function isValidIsoDate(iso) {
  return formatDateLong(iso, 'en') !== '';
}

function templateById(id) {
  return TPL.find((t) => t.id === id) || TPL[0];
}

function orientationById(id) {
  return ORI.find((o) => o.id === id) || ORI[0];
}

/* Validate a certificate draft. Returns an array of error keys (empty = valid). */
function validateCert(c) {
  const errs = [];
  const name = String(c.name || '').trim();
  const title = String(c.title || '').trim();
  const issuer = String(c.issuer || '').trim();
  const line = String(c.line || '').trim();
  const signer = String(c.signer || '').trim();
  if (name.length < 2 || name.length > 80) errs.push('errName');
  if (title.length < 2 || title.length > 120) errs.push('errTitle');
  if (issuer.length < 2 || issuer.length > 80) errs.push('errIssuer');
  if (!isValidIsoDate(c.date)) errs.push('errDate');
  if (line.length > 160) errs.push('errLine');
  if (signer.length > 80) errs.push('errSigner');
  if (!TPL.some((t) => t.id === c.template)) errs.push('errTemplate');
  if (!ORI.some((o) => o.id === c.orientation)) errs.push('errOrientation');
  return errs;
}

/* Normalise a raw object into a stored certificate (or null if invalid). */
function normaliseCert(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const c = {
    id: String(raw.id || ''),
    name: String(raw.name || '').trim(),
    title: String(raw.title || '').trim(),
    line: String(raw.line || '').trim(),
    issuer: String(raw.issuer || '').trim(),
    signer: String(raw.signer || '').trim(),
    date: String(raw.date || ''),
    template: String(raw.template || 'classic'),
    orientation: String(raw.orientation || 'landscape'),
    issuedAt: String(raw.issuedAt || ''),
  };
  if (validateCert(c).length) return null;
  if (!c.id) return null;
  return c;
}

function newId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Strict import validation. Accepts the app's own export shape:
 * { app: 'certificate-maker-bd', version: 1, certificates: [...] }
 * Returns { ok: true, certificates } or { ok: false, errors: [keys] }. */
function validateImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: ['badJson'] };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.certificates)) {
    return { ok: false, errors: ['badShape'] };
  }
  if (parsed.certificates.length > 500) return { ok: false, errors: ['tooMany'] };
  const certs = [];
  const errors = [];
  const seen = new Set();
  parsed.certificates.forEach((raw, i) => {
    const c = normaliseCert(raw);
    if (!c) { errors.push('badCert:' + i); return; }
    if (seen.has(c.id)) { errors.push('dupId:' + i); return; }
    seen.add(c.id);
    certs.push(c);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, certificates: certs };
}

/* File name for a printed/exported certificate. ASCII-safe. */
function certFileName(c) {
  const safe = String(c.name || 'certificate').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'certificate';
  return 'Certificate-' + safe + '-' + String(c.date || 'undated') + '.pdf';
}

/* Short one-line summary used in the Issued list. */
function certSummary(c, lang) {
  return c.name + ' \u2014 ' + c.title + ' \u00b7 ' + formatDateLong(c.date, lang);
}

if (typeof module !== 'undefined') {
  module.exports = {
    toBnDigits, digits, formatDateLong, isValidIsoDate,
    templateById, orientationById, validateCert, normaliseCert,
    newId, validateImport, certFileName, certSummary,
  };
}
