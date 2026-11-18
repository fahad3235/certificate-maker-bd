/* certificate-maker-bd — node unit tests. Run: node tests/test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../js/data.js');
const L = require('../js/logic.js');
const { TEMPLATES, ORIENTATIONS, I18N, SAMPLE } = DATA;

const GOOD = {
  id: 'c1', name: 'Ishan Ahmed Fahad', title: 'Web Development Bootcamp 2026',
  line: 'has successfully completed with distinction', issuer: 'Team Probaho',
  signer: 'Md. Mehedi Hassan', date: '2026-11-18', template: 'classic',
  orientation: 'landscape', issuedAt: '2026-11-18T10:00:00.000Z',
};

test('data: 4 templates + 2 orientations, unique ids, BN names present', () => {
  assert.equal(TEMPLATES.length, 4);
  assert.deepEqual(TEMPLATES.map((t) => t.id), ['classic', 'modern', 'academic', 'minimal']);
  for (const t of TEMPLATES) {
    assert.ok(t.name && t.nameBn && t.nameBn.length > 2, t.id);
    assert.ok(t.desc && t.descBn, t.id);
  }
  assert.deepEqual(ORIENTATIONS.map((o) => o.id), ['landscape', 'portrait']);
  assert.ok(I18N.en.appTitle && I18N.bn.appTitle);
  assert.ok(SAMPLE.name && SAMPLE.title && SAMPLE.issuer && SAMPLE.date);
  assert.equal(L.validateCert(SAMPLE).length, 0, 'sample must validate');
});

test('toBnDigits converts all digits', () => {
  assert.equal(L.toBnDigits('0123456789'), '\u09e6\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee\u09ef');
  assert.equal(L.toBnDigits('2026-11-18'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e7-\u09e7\u09ee');
  assert.equal(L.toBnDigits('no digits'), 'no digits');
});

test('formatDateLong: EN and BN, real-date validation', () => {
  assert.equal(L.formatDateLong('2026-11-18', 'en'), '18 November 2026');
  assert.equal(L.formatDateLong('2026-11-18', 'bn'), '\u09e7\u09ee \u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0 \u09e8\u09e6\u09e8\u09ec');
  assert.equal(L.formatDateLong('2026-01-01', 'en'), '1 January 2026');
  assert.equal(L.formatDateLong('2024-02-29', 'en'), '29 February 2024'); // leap year ok
  assert.equal(L.formatDateLong('2026-02-29', 'en'), ''); // not a leap year
  assert.equal(L.formatDateLong('2026-13-01', 'en'), '');
  assert.equal(L.formatDateLong('2026-00-10', 'en'), '');
  assert.equal(L.formatDateLong('2026-04-31', 'en'), ''); // April has 30 days
  assert.equal(L.formatDateLong('18-11-2026', 'en'), '');
  assert.equal(L.formatDateLong('', 'en'), '');
  assert.equal(L.formatDateLong(null, 'en'), '');
});

test('isValidIsoDate agrees with formatDateLong', () => {
  assert.equal(L.isValidIsoDate('2026-11-18'), true);
  assert.equal(L.isValidIsoDate('2023-02-29'), false);
  assert.equal(L.isValidIsoDate('garbage'), false);
});

test('templateById / orientationById fall back to first', () => {
  assert.equal(L.templateById('modern').id, 'modern');
  assert.equal(L.templateById('nope').id, 'classic');
  assert.equal(L.orientationById('portrait').id, 'portrait');
  assert.equal(L.orientationById('nope').id, 'landscape');
});

test('validateCert: good draft passes', () => {
  assert.deepEqual(L.validateCert(GOOD), []);
  // optional fields may be empty
  assert.deepEqual(L.validateCert(Object.assign({}, GOOD, { line: '', signer: '' })), []);
});

test('validateCert: each bad field flagged', () => {
  assert.ok(L.validateCert(Object.assign({}, GOOD, { name: '' })).includes('errName'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { name: 'A' })).includes('errName'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { name: 'x'.repeat(81) })).includes('errName'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { title: '' })).includes('errTitle'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { title: 'x'.repeat(121) })).includes('errTitle'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { issuer: ' ' })).includes('errIssuer'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { date: '2026-02-29' })).includes('errDate'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { date: '' })).includes('errDate'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { line: 'x'.repeat(161) })).includes('errLine'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { signer: 'x'.repeat(81) })).includes('errSigner'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { template: 'nope' })).includes('errTemplate'));
  assert.ok(L.validateCert(Object.assign({}, GOOD, { orientation: 'nope' })).includes('errOrientation'));
  // boundary lengths pass
  assert.deepEqual(L.validateCert(Object.assign({}, GOOD, { name: 'Ab', title: 'Cd' })), []);
});

test('normaliseCert: trims, rejects bad, requires id', () => {
  const c = L.normaliseCert(Object.assign({}, GOOD, { name: '  Ishan  ' }));
  assert.equal(c.name, 'Ishan');
  assert.equal(L.normaliseCert(Object.assign({}, GOOD, { name: '' })), null);
  assert.equal(L.normaliseCert(Object.assign({}, GOOD, { id: '' })), null);
  assert.equal(L.normaliseCert(null), null);
  assert.equal(L.normaliseCert('nope'), null);
  assert.equal(L.normaliseCert({}), null);
});

test('validateImport: happy path, bad json, bad shape, bad cert, dup id, too many', () => {
  const ok = L.validateImport(JSON.stringify({ app: 'certificate-maker-bd', version: 1, certificates: [GOOD] }));
  assert.equal(ok.ok, true);
  assert.equal(ok.certificates.length, 1);
  assert.equal(ok.certificates[0].name, GOOD.name);

  const empty = L.validateImport(JSON.stringify({ app: 'certificate-maker-bd', version: 1, certificates: [] }));
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.certificates, []);

  assert.deepEqual(L.validateImport('{not json').errors, ['badJson']);
  assert.deepEqual(L.validateImport('[]').errors, ['badShape']);
  assert.deepEqual(L.validateImport('{"certificates": {}}').errors, ['badShape']);
  assert.deepEqual(L.validateImport(JSON.stringify({ certificates: [GOOD, Object.assign({}, GOOD, { name: '' })] })).errors, ['badCert:1']);
  assert.deepEqual(L.validateImport(JSON.stringify({ certificates: [GOOD, GOOD] })).errors, ['dupId:1']);
  const many = Array.from({ length: 501 }, (_, i) => Object.assign({}, GOOD, { id: 'c' + i }));
  assert.deepEqual(L.validateImport(JSON.stringify({ certificates: many })).errors, ['tooMany']);
  // import does not mutate the source object
  const src = JSON.stringify({ certificates: [GOOD] });
  L.validateImport(src);
  assert.equal(JSON.parse(src).certificates[0].name, GOOD.name);
});

test('certFileName: ASCII-safe, uses name + date', () => {
  assert.equal(L.certFileName(GOOD), 'Certificate-Ishan-Ahmed-Fahad-2026-11-18.pdf');
  assert.equal(L.certFileName(Object.assign({}, GOOD, { name: '  A  B  ' })), 'Certificate-A-B-2026-11-18.pdf');
  assert.equal(L.certFileName(Object.assign({}, GOOD, { name: '!!!' })), 'Certificate-certificate-2026-11-18.pdf');
});

test('certSummary: EN and BN date forms', () => {
  assert.equal(L.certSummary(GOOD, 'en'), 'Ishan Ahmed Fahad \u2014 Web Development Bootcamp 2026 \u00b7 18 November 2026');
  assert.ok(L.certSummary(GOOD, 'bn').includes('\u09e7\u09ee \u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0 \u09e8\u09e6\u09e8\u09ec'));
});

test('newId: unique, string, prefixed', () => {
  const a = L.newId(), b = L.newId();
  assert.notEqual(a, b);
  assert.ok(a.startsWith('c'));
  assert.ok(/^[a-z0-9]+$/.test(a));
});
