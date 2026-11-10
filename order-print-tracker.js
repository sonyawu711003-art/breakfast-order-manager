/* 吃早餐訂單卡 PDF：
 * Use the *order record's* created_at / updated_at Taipei calendar date.
 * Do not decide which cards are new by PDF export timestamps or print log.
 */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
function taipeiDay(timestamp){
 if(!timestamp)return '';
 const date=new Date(timestamp);
 if(Number.isNaN(date.getTime()))return '';
 const parts=Object.fromEntries(dayFormatter.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function changedOn(row,date){
 return taipeiDay(row.created_at)===date||taipeiDay(row.updated_at)===date;
}
function groupedOrders(pickupDate){
 const groupMap=new Map();
 for(const row of orders){
  if(pickupDate!=='all'&&row.pickup_date!==pickupDate)continue;
  const key=row.pickup_date+'\u001f'+row.customer;
  if(!groupMap.has(key))groupMap.set(key,{pickupDate:row.pickup_date,customer:row.customer,all:[],active:[]});
  const target=groupMap.get(key);
  target.all.push(row);
  if(row.status==='active')target.active.push(row);
 }
 return [...groupMap.values()].filter(x=>x.active.length)
  .sort((a,b)=>a.pickupDate.localeCompare(b.pickupDate)||a.customer.localeCompare(b.customer,'zh-TW'));
}
function computeCards(pickupDate,mode,editDate){
 const grouped=groupedOrders(pickupDate);
 return {grouped,selected:mode==='all'?grouped:grouped.filter(g=>g.all.some(row=>changedOn(row,editDate)))};
}
function mount(){
 const date=byId('printDateFilter');
 if(!date||byId('pdfChangeDate'))return;
 date.insertAdjacentHTML('afterend',[
  '<label class="pdf-print-filter">PDF 匯出範圍<select id="pdfExportMode">',
  '<option value="changed">只匯出指定日期新增／修改的訂單（建議）</option>',
  '<option value="all">匯出取餐日期全部訂單</option>',
  '</select></label>',
  '<label class="pdf-print-filter" id="pdfChangeDateLabel">資料新增／修改日期（台灣時間）',
  '<input id="pdfChangeDate" type="date"></label>',
  '<p id="pdfExportHelp" class="hint">依訂單實際新增／修改時間篩選，不以 PDF 儲存時間計算。</p>'
 ].join(''));
 byId('pdfChangeDate').value=taipeiDay(new Date());
 byId('pdfExportMode').addEventListener('change',()=>drawPrintCards());
 byId('pdfChangeDate').addEventListener('change',()=>drawPrintCards());
 byId('printOrderCards').textContent='📄 匯出目前畫面訂單卡 PDF';
}
drawPrintCards=function(){
 mount();
 const dateSelect=byId('printDateFilter');
 if(!dateSelect)return;
 const prior=dateSelect.value;
 const available=[...new Set(orders.filter(row=>row.status==='active').map(row=>row.pickup_date))].sort();
 dateSelect.innerHTML='<option value="all">全部取餐日期</option>'+
  available.map(date=>'<option value="'+esc(date)+'">'+esc(date)+'</option>').join('');
 dateSelect.value=available.includes(prior)?prior:'all';
 const pickupDate=dateSelect.value,mode=byId('pdfExportMode')?.value||'changed',editDate=byId('pdfChangeDate')?.value||taipeiDay(new Date());
 byId('pdfChangeDateLabel').classList.toggle('hidden',mode==='all');
 const {grouped,selected}=computeCards(pickupDate,mode,editDate);
 byId('printCards').innerHTML=selected.map(group=>{
  const key=group.pickupDate+'|'+group.customer;
  return renderPrintCard(key,group.active);
 }).join('');
 byId('printOrderCards').disabled=!selected.length;
 byId('printEmpty').classList.toggle('hidden',selected.length>0);
 byId('printDateSummary').textContent=
  (pickupDate==='all'?'全部取餐日期':'取餐日 '+pickupDate)+
  (mode==='changed'?'｜'+editDate+' 新增／異動':'｜全部訂單')+
  '｜符合 '+selected.length+' 張（有效總數 '+grouped.length+' 張）';
 byId('pdfExportHelp').textContent=mode==='changed'?
  '依訂單 created_at／updated_at 判斷當天新增或修改。一位客人的訂單只輸出一張完整訂單卡；如當天有取消品項但仍有有效品項，也會列入。與先前是否存過 PDF 無關。':
  '此模式會匯出取餐日期範圍內所有有效訂單卡，可能包含以前已匯出的訂單。';
};
printSelectedOrderCards=function(){
 if(byId('printOrderCards')?.disabled||!byId('printCards')?.querySelector('.print-card'))return;
 window.print();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.BreakfastOrderPdfChanges={taipeiDay,changedOn,groupedOrders,computeCards};
})();