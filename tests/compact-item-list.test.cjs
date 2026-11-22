const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const browser = {window: {}, Date};
vm.createContext(browser);
for (const file of ['line-parser-v2.js', 'line-txt-v3.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), browser);
}
const parser = browser.window.BreakfastLineParser;
const txt = browser.window.BreakfastLineTxt;
const rows = result => Array.from(result, x => [x.customer, x.date, x.item, x.qty]);
const expected = [
  ['陳慧君', '2026-11-25', '巧克力花生焦糖', 1],
  ['陳慧君', '2026-11-25', '檸檬', 1],
  ['陳慧君', '2026-11-25', '明太子', 1],
];

assert.deepEqual(rows(parser.parse('陳慧君\n11/25 巧克力花生焦糖1檸檬1明太子1', {year: 2026, menu: ['明太子']})), expected);
assert.deepEqual(rows(parser.parse('陳慧君\n11/25 巧克力花生焦糖1檸檬1明\n太子1', {year: 2026, menu: ['明太子']})), expected);
const exportText = '日, 11/22/2026\n上午10:23\t陳慧君\t11/25 巧克力花生焦糖1檸檬1明\n太子1';
assert.deepEqual(rows(txt.candidates(exportText, {menu: ['明太子']}).candidates), expected);
const multiDay = [
  ['菊子', '2026-11-24', '芝麻奶霜', 2],
  ['菊子', '2026-11-24', '巧克力花生焦糖', 1],
  ['菊子', '2026-11-26', '檸檬', 1],
];
const multiDayText = '11/24芝麻奶霜×2+巧克力花生焦糖×1 11/26檸檬×1';
assert.deepEqual(rows(parser.parse('菊子\n' + multiDayText, {year: 2026, menu: ['芝麻奶霜']})), multiDay);
assert.deepEqual(rows(txt.candidates('日, 11/22/2026\n上午10:38\t菊子\t' + multiDayText, {menu: ['芝麻奶霜']}).candidates), multiDay);
const lisaText = '11/24 芝麻奶霜+1 11/25 檸檬+1 11/26 雞肉沙拉(醬多一點)';
const lisaExpected = [
  ['張儷齡Lisa', '2026-11-24', '芝麻奶霜', 1],
  ['張儷齡Lisa', '2026-11-25', '檸檬', 1],
  ['張儷齡Lisa', '2026-11-26', '雞肉沙拉', 1],
];
assert.deepEqual(rows(parser.parse('張儷齡Lisa\n' + lisaText, {year: 2026, menu: ['雞肉沙拉']})), lisaExpected);
assert.deepEqual(rows(txt.candidates('日, 11/22/2026\n上午11:52\t張儷齡Lisa\t' + lisaText, {menu: ['雞肉沙拉']}).candidates), lisaExpected);
assert.ok(parser.parseLine(lisaText, {customer: '張儷齡Lisa', year: 2026, menu: ['雞肉沙拉']}).every(x => x.notes.includes('醬多一點')));
assert.equal(parser.parseLine('11/10＋11/11 咖啡核桃＋紅茶', {customer: '甲', year: 2026, menu: ['咖啡核桃','紅茶']}).length, 4);
assert.equal(parser.parseLine('11/24 明太子貝果+2', {customer: '菊子', year: 2026, menu: ['明太子貝果']}).length, 1);
const weiText = '11/24巧克力花生貝果、明太子熏雞三明治謝謝';
const weiExpected = [
  ['瑋瑋', '2026-11-24', '巧克力花生貝果', 1],
  ['瑋瑋', '2026-11-24', '明太子熏雞三明治', 1],
];
assert.deepEqual(rows(parser.parse('瑋瑋\n' + weiText, {year: 2026, menu: ['明太子','明太子燻雞雞蛋三明治']})), weiExpected);
assert.deepEqual(rows(txt.candidates('日, 11/22/2026\n上午9:58\t瑋瑋\t' + weiText, {menu: ['明太子','明太子燻雞雞蛋三明治']}).candidates), weiExpected);
assert.equal(parser.parseLine('11/24 巧克力花生貝果、明太子熏雞三明治×2', {customer:'瑋瑋',year:2026,menu:['明太子']})[1].qty,2);
const reviewCode = fs.readFileSync(path.join(__dirname, '..', 'cloud-extras.js'), 'utf8');
const auditFunction = reviewCode.slice(reviewCode.indexOf('function possibleMissingItems('), reviewCode.indexOf('function drawProposals()'));
const audit = {window:browser.window,menuRows:[{name:'巧克力花生焦糖貝果'}]};
vm.createContext(audit);vm.runInContext(auditFunction,audit);
const pending=[{customer:'紜芳',pickup_date:'2026-11-24',notes:multiDayText,item:'巧克力花生焦糖貝果'}];
assert.equal(audit.possibleMissingItems(pending),1);
assert.equal(audit.possibleMissingItems([...pending,{...pending,item:'芝麻奶霜'}]),0);
console.log('compact item list: passed');
