/* 吃早餐：整張訂單一次編輯、一鍵儲存
 * The existing database keeps one row per item for auditing and statistics.
 * This is one customer/date order in the UI and one transactional RPC save.
 */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyOf=x=>String(x.pickup_date)+'\u001f'+String(x.customer).trim();
let editing=null,busy=false,dirty=false;
function grouped(rows){
 const result=new Map();
 for(const x of rows){const key=keyOf(x);if(!result.has(key))result.set(key,[]);result.get(key).push(x)}
 return [...result.values()];
}
function amount(x){return x.total_override!=null&&x.total_override!==''?Number(x.total_override):x.price==null||x.price===''?null:Number(x.price)*Number(x.quantity)}
function card(group){
 const live=group.filter(x=>x.status==='active'),x=group[0],total=live.reduce((v,item)=>v+Number(amount(item)??0),0);
 const missing=live.some(y=>amount(y)===null);
 return '<section class="card customer-order-card"><div class="row"><div><h3>🧾 '+esc(x.customer)+'</h3><p class="hint">取餐日 '+esc(x.pickup_date)+'｜'+live.length+' 個有效品項</p></div><strong class="customer-order-amount">'+(missing?'已定價 ':'')+'$'+total.toFixed(0)+(missing?'＋未定價':'')+'</strong></div>'+
 '<div class="customer-order-lines">'+group.map(x=>'<div class="order order-group-line'+(x.status==='cancelled'?' group-cancelled':'')+'"><div class="row"><strong>'+esc(x.item)+' ×'+x.quantity+'</strong><span>'+(x.status==='cancelled'?'已取消':amount(x)===null?'待定價':'$'+amount(x).toFixed(0))+'</span></div>'+
 (x.notes?'<div class="note">'+esc(x.notes)+'</div>':'')+'</div>').join('')+'</div>'+
 (live.length?'<button type="button" class="open-whole-order" data-open-order="'+esc(live[0].id)+'">✏️ 編輯整張訂單（新增／修改／刪除品項）</button>':'<p class="hint">全部品項已取消</p>')+'</section>';
}
// Local operational cutoff: 11:00 Asia/Taipei, irrespective of device timezone.
function taipeiClock(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour),minute:Number(p.minute)};
}
function archivedDate(date,now=taipeiClock()){
 return date<now.day||(date===now.day&&now.hour>=11);
}
function visibleCurrentOrder(row,now=taipeiClock()){
 return !archivedDate(row.pickup_date,now);
}
function matchesSearch(group,search){
 return !search||group.some(x=>[x.customer,x.pickup_date,x.item,x.notes].join(' ').toLowerCase().includes(search));
}
function historyCard(group){
 const live=group.filter(x=>x.status==='active'),first=group[0];
 const total=live.reduce((n,x)=>n+(amount(x)??0),0);
 const incomplete=live.some(x=>amount(x)==null);
 const items=group.map(x=>'<div class="history-line">'+esc(x.item)+' ×'+x.quantity+
  (x.status==='cancelled'?'（已取消）':amount(x)==null?'（未定價）':'｜$'+amount(x).toFixed(0))+
  (x.notes?'<div class="history-note">'+esc(x.notes)+'</div>':'')+'</div>').join('');
 return '<details class="history-order-entry"><summary>'+esc(first.pickup_date)+'｜'+esc(first.customer)+'｜'+live.length+' 項｜$'+total.toFixed(0)+(incomplete?'＋未定價':'')+'</summary>'+
  '<div class="history-lines">'+items+'</div></details>';
}
function drawHistoryOrders(now=taipeiClock()){
 const dates=[...new Set(orders.filter(x=>archivedDate(x.pickup_date,now)).map(x=>x.pickup_date))].sort().reverse();
 const select=el('archivedOrderDate');
 if(!select)return;
 const previous=select.value;
 select.innerHTML='<option value="all">全部歷史日期</option>'+dates.map(date=>'<option value="'+esc(date)+'">'+esc(date)+'</option>').join('');
 select.value=previous==='all'||dates.includes(previous)?previous:'all';
 const query=el('archivedOrderSearch')?.value.trim().toLowerCase()||'';
 const archived=orders.filter(x=>archivedDate(x.pickup_date,now)&&(select.value==='all'||x.pickup_date===select.value));
 const result=grouped(archived).filter(group=>matchesSearch(group,query)).reverse();
 el('archivedOrderCount').textContent=result.length+' 張歷史訂單｜只供查詢，不影響當日訂單、銷售統計或訂單卡列印。';
 el('archivedOrderList').innerHTML=result.map(historyCard).join('')||'<p class="hint">沒有符合條件的歷史訂單。</p>';
}
function drawGrouped(){
 const now=taipeiClock();
 const search=el('search')?.value.trim().toLowerCase()||'';
 const recent=orders.filter(x=>visibleCurrentOrder(x,now));
 const result=grouped(recent).filter(g=>matchesSearch(g,search));
 el('orderList').innerHTML=result.map(card).join('')||'<div class="card hint">目前沒有待處理的客人訂單。</div>';
 const older=orders.filter(x=>archivedDate(x.pickup_date,now));
 el('orderActiveSummary').textContent='待處理 '+result.length+' 張訂單｜台灣時間每日 11:00 自動將當日訂單移至「紀錄」，資料不刪除。';
 el('orderArchivedHint').textContent=older.length?'另有 '+grouped(older).length+' 張歷史訂單可在「紀錄」查詢。':'';
 drawHistoryOrders(now);
}
function sourceLines(group){return group.filter(x=>x.status==='active').map(x=>({id:x.id,version:x.version,item:x.item,quantity:x.quantity,price:x.price,total_override:x.total_override,notes:x.notes,remove:false}))}
function editorChoices(){
 const rows=typeof menuRows==='undefined'?[]:menuRows.filter(x=>x.active);
 return '<option value="">請挑選菜單（也可直接輸入）</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
}
function editorLine(x,i){
 const id=i,hasOverride=x.total_override!==null&&x.total_override!=='';
 return '<div class="whole-item'+(x.remove?' whole-item-removed':'')+'" data-item-index="'+i+'">'+
 '<div class="row"><b>品項 '+(i+1)+(x.id?'':' · 新增')+'</b><button type="button" class="secondary" data-item-remove="'+i+'">'+(x.remove?'↩️ 復原品項':'移除品項')+'</button></div>'+
 '<label>菜單快捷選擇<select data-item-menu="'+i+'">'+editorChoices()+'</select></label>'+
 '<label>品名<input data-item-field="item" data-index="'+i+'" maxlength="200" value="'+esc(x.item)+'" required></label>'+
 '<div class="grid"><label>數量<input type="number" data-index="'+i+'" data-item-field="quantity" min="1" max="999" value="'+x.quantity+'" required></label>'+
 '<label>單價<input type="number" data-index="'+i+'" data-item-field="price" step="0.01" min="0" value="'+(x.price??'')+'" placeholder="可留空"></label></div>'+
 '<div class="row"><b>品項小計</b><strong class="whole-line-subtotal">'+(amount(x)===null?'未定價':'$'+amount(x).toFixed(0))+'</strong></div>'+
 '<details class="whole-line-discount"'+(hasOverride?' open':'')+'><summary>特殊折扣／整項總額調整</summary><label>特殊總額（可留空）<input type="number" min="0" step="0.01" data-index="'+i+'" data-item-field="total_override" value="'+(x.total_override??'')+'"></label></details>'+
 '<label>品項備註<textarea data-index="'+i+'" data-item-field="notes" rows="2">'+esc(x.notes)+'</textarea></label></div>';
}
function updateTotals(){
 if(!editing)return;
 const live=editing.lines.filter(x=>!x.remove),all=live.map(amount);
 const known=all.reduce((a,x)=>a+(x??0),0),missing=all.some(x=>x===null);
 el('wholeOrderTotal').textContent='$'+known.toFixed(0)+(missing?'（另有未定價）':'');
 el('wholeOrderCount').textContent=live.length+' 個品項';
 el('wholeOrderSave').disabled=busy;
}
function renderLines(){
 el('wholeOrderItems').innerHTML=editing.lines.map(editorLine).join('');
 updateTotals();
}
function closeEditor(force=false){
 if(busy)return;
 if(!force&&dirty&&!confirm('尚未儲存這張訂單的修改，確定放棄？'))return;
 editing=null;dirty=false;
 el('wholeOrderEditor').classList.add('hidden');
 el('legacySingleEditor').classList.remove('hidden');
}
function openEditor(id){
 const selected=orders.find(x=>x.id===id&&x.status==='active');
 if(!selected)return;
 if(editing&&dirty&&!confirm('目前整張訂單有未儲存的修改，確定放棄並切換？'))return;
 const group=orders.filter(x=>x.customer.trim()===selected.customer.trim()&&x.pickup_date===selected.pickup_date);
 editing={customer:selected.customer,pickup_date:selected.pickup_date,lines:sourceLines(group)};
 dirty=false;
 if(!editing.lines.length)return;
 el('legacySingleEditor').classList.add('hidden');
 el('wholeOrderEditor').classList.remove('hidden');
 el('wholeOrderTitle').textContent='🧾 '+editing.customer+' 的原訂單';
 el('wholeOrderDate').textContent='取餐日期：'+editing.pickup_date;
 el('wholeOrderMessage').textContent='';
 renderLines();
 el('wholeOrderEditor').scrollIntoView({behavior:'smooth',block:'start'});
}
function setValue(i,k,v){
 if(!editing||!editing.lines[i])return;
 let next=v;
 if(k==='quantity')next=v===''?'':Number(v);
 else if(k==='price'||k==='total_override')next=v===''?null:Number(v);
 editing.lines[i][k]=next;dirty=true;
 const area=el('wholeOrderItems').querySelector('[data-item-index="'+i+'"] .whole-line-subtotal');
 if(area)area.textContent=amount(editing.lines[i])===null?'未定價':'$'+amount(editing.lines[i]).toFixed(0);
 updateTotals();
}
function addLine(){
 if(!editing)return;
 editing.lines.push({id:null,version:null,item:'',quantity:1,price:null,total_override:null,notes:'',remove:false});
 dirty=true;renderLines();
 el('wholeOrderItems').lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});
}
async function saveWholeOrder(){
 if(!editing||busy)return;
 const valid=editing.lines.filter(x=>!x.remove);
 if(!valid.length&&!confirm('這會取消原訂單內全部有效品項。確定要繼續嗎？'))return;
 for(let i=0;i<editing.lines.length;i++){
  const x=editing.lines[i];
  if(x.remove)continue;
  if(!x.item?.trim()||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>999||x.price!==null&&(!Number.isFinite(x.price)||x.price<0)||x.total_override!==null&&(!Number.isFinite(x.total_override)||x.total_override<0)){
   el('wholeOrderMessage').textContent='第 '+(i+1)+' 項的品名、數量或價格不完整，請先修正。';return;
  }
 }
 if(!confirm('確認一次儲存「'+editing.customer+'」在 '+editing.pickup_date+' 的整張訂單？\n將同步新增、修改或取消品項並保留異動紀錄。'))return;
 busy=true;updateTotals();
 el('wholeOrderMessage').textContent='正在儲存整張訂單…';
 const payload=editing.lines.map(x=>({...x,item:String(x.item||'').trim()}));
 try{
  const {data,error}=await client.rpc('save_breakfast_order_group',{p_customer:editing.customer,p_pickup_date:editing.pickup_date,p_lines:payload});
  if(error)throw error;
  editing=null;dirty=false;
  el('wholeOrderEditor').classList.add('hidden');
  el('legacySingleEditor').classList.remove('hidden');
  await reload();
  alert('✅ 整張訂單已儲存！新增 '+data.added+' 項、修改 '+data.updated+' 項、取消 '+data.cancelled+' 項。');
 }catch(e){
  el('wholeOrderMessage').textContent='整張訂單未儲存：'+(e.message||'發生錯誤')+'。若兩位管理者同時修改，請同步資料後重新開啟。';
 }finally{busy=false;updateTotals()}
}
function mount(){
 const current=el('orderList');
 if(!current||el('wholeOrderEditor'))return;
 current.insertAdjacentHTML('beforebegin','<p id="orderActiveSummary" class="hint" aria-live="polite"></p><p id="orderArchivedHint" class="hint"></p>');
 const history=el('history');
 if(history){history.insertAdjacentHTML('beforeend','<section class="card" id="archivedOrdersPanel"><h3>📚 歷史客人訂單</h3><p class="hint">每天台灣時間 11:00 後自動歸檔當天訂單，所有原始品項、備註與金額保留供日後分析客人喜好。</p><label>歷史取餐日期<select id="archivedOrderDate"><option value="all">全部歷史日期</option></select></label><label>搜尋歷史客人或品項<input id="archivedOrderSearch" placeholder="輸入客人名稱或品項"></label><p id="archivedOrderCount" class="hint"></p><div id="archivedOrderList"></div></section>');
 el('archivedOrderDate').addEventListener('change',()=>drawHistoryOrders());
 el('archivedOrderSearch').addEventListener('input',()=>drawHistoryOrders());
 }
 const legacy=current.nextElementSibling;
 legacy.id='legacySingleEditor';
 const form='<section id="wholeOrderEditor" class="card hidden" aria-label="整張訂單編輯">'+
 '<div class="row"><div><h2 id="wholeOrderTitle">整張訂單</h2><p id="wholeOrderDate" class="hint"></p></div><button type="button" class="secondary" id="wholeOrderBack">返回訂單列表</button></div>'+
 '<p class="whole-order-explain">在這一頁直接新增、修改或移除所有品項。全部確認後，按一次「儲存整張訂單」。</p>'+
 '<div id="wholeOrderItems"></div><button type="button" class="secondary whole-add-button" id="wholeOrderAdd">＋ 在原訂單內新增品項</button>'+
 '<div class="whole-order-summary row"><b>整張訂單合計</b><div><strong id="wholeOrderTotal">$0</strong><p id="wholeOrderCount" class="hint"></p></div></div>'+
 '<p class="status" id="wholeOrderMessage" role="status" aria-live="polite"></p>'+
 '<button type="button" id="wholeOrderSave">💾 一次儲存整張訂單</button></section>';
 current.insertAdjacentHTML('afterend',form);
 el('orderList').addEventListener('click',e=>{const button=e.target.closest('button[data-open-order]');if(button)openEditor(button.dataset.openOrder)});
 el('wholeOrderItems').addEventListener('input',e=>{const n=e.target;if(n.dataset.itemField!==undefined)setValue(Number(n.dataset.index),n.dataset.itemField,n.value)});
 el('wholeOrderItems').addEventListener('change',e=>{const n=e.target;if(n.dataset.itemMenu===undefined||!n.value||!editing)return;
  const m=(typeof menuRows==='undefined'?[]:menuRows).find(x=>x.id===n.value);
  if(!m)return;
  const index=Number(n.dataset.itemMenu);
  const x=editing.lines[index];x.item=m.name;
  const prefer=m.price??m.regular_price;x.price=prefer===null||prefer===undefined?null:Number(prefer);
  x.total_override=null;dirty=true;renderLines();
 });
 el('wholeOrderItems').addEventListener('click',e=>{const b=e.target.closest('[data-item-remove]');if(!b||!editing)return;
  const i=Number(b.dataset.itemRemove),x=editing.lines[i];
  if(!x.id&&!x.remove)editing.lines.splice(i,1);else x.remove=!x.remove;
  dirty=true;renderLines();
 });
 el('wholeOrderAdd').addEventListener('click',addLine);
 el('wholeOrderBack').addEventListener('click',()=>closeEditor());
 el('wholeOrderSave').addEventListener('click',saveWholeOrder);
}
const originalDraw=draw;
draw=function(){originalDraw();drawGrouped()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
// Refresh the cutoff independently of user activity; 11:00 needs no manual reload.
setInterval(()=>{if(typeof session!=='undefined'&&session&&document.visibilityState==='visible')drawGrouped()},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&typeof session!=='undefined'&&session)drawGrouped()});
window.BreakfastWholeOrderEditor={grouped,openEditor,drawGrouped,drawHistoryOrders,taipeiClock,archivedDate,visibleCurrentOrder};
})();