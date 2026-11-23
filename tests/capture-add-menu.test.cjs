const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, '../cloud-capture.html'), 'utf8');
const code = html.slice(html.indexOf('const menuCategories='), html.indexOf('function newCandidate('));

function setup({duplicate = false, failed = false} = {}) {
  const item = {item: '蜂蜜檸檬貝果', qty: 2, notes: '不烤', catalogStatus: 'unknown'};
  const fields = {
    '[data-new-name]': {value: item.item},
    '[data-new-category]': {value: '貝果'},
    '[data-new-price]': {value: '65'},
    '[data-new-regular]': {value: '70'},
    '[data-menu-error]': {textContent: ''},
  };
  let inserted;
  const menu = duplicate ? [{name: item.item, price: 60, active: true}] : [];
  const status = {textContent: ''};
  const ctx = {
    proposals: [item], menu, esc: s => String(s),
    api: {from(table) { assert.equal(table, 'breakfast_menu'); return {insert(record) {
      inserted = record;
      return {select() {return {async single() {
        return failed ? {error: {message: 'permission denied'}} : {data: {...record, id: 'new-id'}};
      }}}};
    }}}},
    normalizeCandidateItem(p) {p.catalogStatus = 'matched'; p.price = menu.find(m => m.name === p.item).price},
    drawCandidates() {ctx.drawn = true}, $: () => status,
  };
  vm.runInNewContext(code + '\nglobalThis.createCandidateMenu = createCandidateMenu;', ctx);
  const button = {disabled: false, closest: () => ({querySelector: selector => fields[selector]})};
  return {ctx, item, menu, fields, button, status, get inserted() {return inserted}};
}

test('unknown item can be added to menu and reused without changing quantity or notes', async () => {
  const s = setup();
  await s.ctx.createCandidateMenu(0, s.button);
  assert.equal(s.inserted.name, '蜂蜜檸檬貝果');
  assert.equal(s.inserted.category, '貝果');
  assert.equal(s.inserted.price, 65);
  assert.equal(s.inserted.regular_price, 70);
  assert.equal(s.inserted.active, true);
  assert.equal(s.item.catalogStatus, 'matched');
  assert.equal(s.item.qty, 2);
  assert.equal(s.item.notes, '不烤');
  assert.equal(s.item.price, 65);
  assert.equal(s.menu.length, 1);
  assert.equal(s.button.disabled, false);
});

test('other category has one sale price and existing menu item is reused', async () => {
  const s = setup();
  s.fields['[data-new-category]'].value = '沙拉';
  s.fields['[data-new-regular]'].value = '99';
  await s.ctx.createCandidateMenu(0, s.button);
  assert.equal(s.inserted.price, 65);
  assert.equal(s.inserted.regular_price, 65);
  const existing = setup({duplicate: true});
  await existing.ctx.createCandidateMenu(0, existing.button);
  assert.equal(existing.inserted, undefined);
  assert.equal(existing.item.catalogStatus, 'matched');
});

test('save failure keeps unmatched item and displays error', async () => {
  const s = setup({failed: true});
  await s.ctx.createCandidateMenu(0, s.button);
  assert.equal(s.item.catalogStatus, 'unknown');
  assert.equal(s.menu.length, 0);
  assert.match(s.fields['[data-menu-error]'].textContent, /permission denied/);
  assert.equal(s.button.disabled, false);
});
