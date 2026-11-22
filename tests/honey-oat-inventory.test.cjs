const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'bagel-inventory.js'), 'utf8');
const start = source.indexOf('function canonicalBagel(');
const end = source.indexOf('function mount(){');
const context = {
  week: '2026-11-22', stock: [], ledger: [], catalog: [],
  menuBagels: () => ['蜂蜜燕麥貝果'], bagelName: () => null,
  endOfWeek: () => '2026-11-27', isNewWeekBridge: () => false,
  orders: [
    {status:'active',pickup_date:'2026-11-25',item:'蜂蜜燕麥貝果',quantity:1},
    {status:'active',pickup_date:'2026-11-25',item:'蜂蜜燕麥貝果+燻雞 (不加醬、奶油、起司)',quantity:2},
    {status:'active',pickup_date:'2026-11-25',item:'蜂蜜燕麥貝果蜂蜜燕麥貝果(+厚蛋/菜 不要醬)',quantity:1},
    {status:'active',pickup_date:'2026-11-25',item:'紅茶',notes:'11/26 蜂蜜燕麥貝果',quantity:1},
    {status:'cancelled',pickup_date:'2026-11-25',item:'蜂蜜燕麥貝果+燻雞',quantity:3},
  ],
};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
assert.equal(context.model().rows[0].reserved,4);
assert.equal(context.canonicalBagel('蜂蜜燕麥貝果+燻雞',['蜂蜜燕麥貝果']),null);
console.log('honey-oat inventory: passed');
