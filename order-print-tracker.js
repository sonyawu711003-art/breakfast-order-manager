/* 吃早餐：雙管理者共用訂單卡印製紀錄；只補印新增或已異動訂單。 */
(function(){
'use strict';
const elem=id=>document.getElementById(id);
const escapeText=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const printedByKey=new Map();
let printLogLoadedFor='',loadingFor='',loadSerial=0,printBatch=null,printBusy=false;
let defaultDateApplied=false;
function taipeiToday(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function keyFor(date,customer){return date+'\u001f'+customer}
function signature(rows){
 const snapshot=rows.map(x=>[
  String(x.id),Number(x.version),String(x.item),Number(x.quantity),
  x.price==null?null:Number(x.price),
  x.total_override==null?null:Number(x.total_override),
  String(x.notes??'')
 ]).sort((a,b)=>a[0].localeCompare(b[0]));
 return JSON.stringify(snapshot);
}
function groupedActive(date){
 const map=new Map();
 for(const x of orders){
  if(x.status!=='active'||(date!=='all'&&x.pickup_date!==date))continue;
  const key=keyFor(x.pickup_date,x.customer);
  if(!map.has(key))map.set(key,{date:x.pickup_date,customer:x.customer,lines:[]});
  map.get(key).lines.push(x);
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.customer.localeCompare(b.customer,'zh-TW')||0);
}
function ensureControls(){
 const view=elem('printview'),wrapper=view?.querySelector('.no-print');
 if(!wrapper||elem('printMode'))return;
 const dateInput=elem('printDateFilter');
 dateInput.insertAdjacentHTML('afterend',[
 '<label class="print-mode-selector">列印範圍<select id="printMode">',
 '<option value="pending">只印新增／異動訂單（建議）</option>',
 '<option value="all">重新列印所選日期全部訂單</option>',
 '</select></label>',
 '<p id="printTrackingStatus" class="hint" aria-live="polite">正在載入共用列印紀錄…</p>',
 '<div id="printAfterActions" class="card hidden">',
 '<b>🖨️ 列印視窗已開啟</b>',
 '<p class="hint">請確認紙張或 PDF 已成功輸出，再按「確認已列印」。若取消列印，請選「這次沒有印出」，訂單仍會保留在待印清單。</p>',
 '<button type="button" id="printConfirmBatch">✅ 確認已列印，記錄這批訂單</button>',
 '<button type="button" class="secondary" id="printDiscardBatch">這次沒有印出</button>',
 '</div>'
 ].join(''));
 elem('printMode').addEventListener('change',()=>{cancelBatch(false);drawPrintCards()});
 elem('printConfirmBatch').addEventListener('click',confirmBatch);
 elem('printDiscardBatch').addEventListener('click',()=>cancelBatch(true));
 const btn=elem('printOrderCards');
 btn.textContent='🖨️ 列印所選訂單卡';
}
function cancelBatch(notify){
 if(printBusy)return;
 printBatch=null;elem('printAfterActions')?.classList.add('hidden');
 if(elem('printDateFilter'))elem('printDateFilter').disabled=false;
 if(elem('printMode'))elem('printMode').disabled=false;
 if(notify)elem('printTrackingStatus').textContent='本次未列印，所有訂單仍保留在待印清單。';
 drawPrintCards();
}
async function fetchPrintLog(date,force=false){
 if(!client||!session||!date)return;
 if(!force&&printLogLoadedFor===date)return;
 if(!force&&loadingFor===date)return;
 const run=++loadSerial,loggedSession=session;
 loadingFor=date;
 const status=elem('printTrackingStatus');
 if(status)status.textContent='正在同步兩位管理者的列印紀錄…';
 try{
  let rows=[];
  if(date==='all'){
   let start=0;
   while(true){
    const {data,error}=await client.from('breakfast_order_print_log').select('pickup_date,customer,print_signature,printed_at').order('pickup_date').order('customer').range(start,start+999);
    if(error)throw error;
    rows.push(...(data||[]));
    if(!data||data.length<1000)break;
    start+=1000;
   }
  }else{
   const {data,error}=await client.from('breakfast_order_print_log').select('pickup_date,customer,print_signature,printed_at').eq('pickup_date',date);
   if(error)throw error;
   rows=data||[];
  }
  if(run!==loadSerial||session!==loggedSession||elem('printDateFilter')?.value!==date)return;
  printedByKey.clear();
  for(const row of rows)printedByKey.set(keyFor(row.pickup_date,row.customer),row.print_signature);
  printLogLoadedFor=date;
  if(status)status.textContent='✅ 列印紀錄已同步。只有確認印出的訂單才會排除補印。';
 }catch(e){
  if(run===loadSerial){
   printLogLoadedFor='';
   if(status)status.textContent='⚠️ 列印紀錄同步失敗：'+e.message+'，為避免重印，請先重新整理。';
  }
 }finally{
  if(run===loadSerial){
   loadingFor='';
   drawPrintCards();
  }
 }
}
drawPrintCards=function(activeOrders){
 ensureControls();
 const select=elem('printDateFilter');
 if(!select)return;
 // Do not silently change the print preview while the user is confirming a printed batch.
 if(printBatch){elem('printOrderCards').disabled=true;return}
 const current=select.value;
 const valid=orders.filter(x=>x.status==='active');
 const dates=[...new Set(valid.map(x=>x.pickup_date))].sort();
 select.innerHTML='<option value="all">全部日期</option>'+dates.map(date=>'<option value="'+date+'">'+date+'</option>').join('');
 if(dates.includes(current))select.value=current;
 else if(current==='all')select.value='all';
 else select.value='all';
 if(!defaultDateApplied&&dates.length){
  const today=taipeiToday();
  select.value=dates.includes(today)?today:dates.find(d=>d>today)||dates[dates.length-1];
  defaultDateApplied=true;
 }
 const date=select.value,mode=elem('printMode')?.value||'pending';
 if(date!==printLogLoadedFor&&date!==loadingFor){
  // Never treat unknown print history as unprinted; fetch first.
  void fetchPrintLog(date);
 }
 const ready=printLogLoadedFor===date;
 const grouped=groupedActive(date);
 const pending=grouped.filter(group=>printedByKey.get(keyFor(group.date,group.customer))!==signature(group.lines));
 const selected=mode==='all'?grouped:(ready?pending:[]);
 const extra=mode==='pending'?'｜待印 '+(ready?pending.length:'讀取中')+' 張':'｜本次全部 '+grouped.length+' 張';
 elem('printOrderCards').disabled=printBusy||!selected.length||!ready||!!printBatch;
 elem('printEmpty').classList.toggle('hidden',selected.length>0);
 elem('printDateSummary').textContent=(date==='all'?'全部日期':'取餐日 '+date)+'｜有效 '+grouped.length+' 張訂單卡'+extra;
 elem('printCards').innerHTML=selected.map(group=>{
  const changed=printedByKey.has(keyFor(group.date,group.customer));
  const badge=mode==='pending'?'<div class="print-pending-badge">'+(changed?'【已異動，重新補印】':'【新增訂單卡】')+'</div>':'';
  return renderPrintCard(group.date+'|'+group.customer,group.lines).replace('<div class="print-card">','<div class="print-card">'+badge);
 }).join('');
 if(ready&&!printBatch){
  elem('printTrackingStatus').textContent=mode==='pending'?
   (pending.length?'本次待印 '+pending.length+' 張；印出後請確認，才會從待印名單移除。':'✅ 目前所選日期沒有待補印的新訂單或異動訂單。'):
   '目前選擇重新列印全部訂單，列印後仍需確認以更新列印紀錄。';
 }
};
printSelectedOrderCards=function(){
 if(printBusy||printBatch||elem('printOrderCards').disabled||!elem('printCards')?.querySelector('.print-card'))return;
 const date=elem('printDateFilter').value,mode=elem('printMode').value;
 if(printLogLoadedFor!==date)return;
 const grouped=groupedActive(date);
 const selected=mode==='all'?grouped:grouped.filter(x=>printedByKey.get(keyFor(x.date,x.customer))!==signature(x.lines));
 if(!selected.length)return;
 printBatch=selected.map(x=>({pickup_date:x.date,customer:x.customer,print_signature:signature(x.lines)}));
 elem('printDateFilter').disabled=true;
 elem('printMode').disabled=true;
 elem('printAfterActions').classList.remove('hidden');
 elem('printOrderCards').disabled=true;
 try{window.print()}catch(e){cancelBatch(true);alert('列印視窗未開啟：'+e.message)}
};
async function confirmBatch(){
 if(!printBatch?.length||printBusy||!client||!session)return;
 if(!confirm('請確認這 '+printBatch.length+' 張訂單卡已成功列印或存成 PDF，確定標記為「已印」？'))return;
 printBusy=true;elem('printConfirmBatch').disabled=true;
 const batch=printBatch.map(x=>({...x}));
 try{
  const {error}=await client.from('breakfast_order_print_log').upsert(batch,{onConflict:'pickup_date,customer'});
  if(error)throw error;
  printBatch=null;elem('printAfterActions').classList.add('hidden');
  elem('printDateFilter').disabled=false;elem('printMode').disabled=false;
  const date=elem('printDateFilter').value;
  printLogLoadedFor='';await fetchPrintLog(date,true);
  elem('printTrackingStatus').textContent='✅ 已記錄 '+batch.length+' 張列印結果，兩位管理者同步；新訂單或後續異動會再顯示。';
 }catch(e){elem('printTrackingStatus').textContent='⚠️ 無法儲存列印紀錄：'+e.message+'，請勿重複列印，先重試確認。'}
 finally{printBusy=false;elem('printConfirmBatch').disabled=false;drawPrintCards()}
}
const previousTab=tab;
tab=function(name){
 previousTab(name);
 if(name==='printview'){
  // Recheck shared status when switching into print screen.
  printLogLoadedFor='';void fetchPrintLog(elem('printDateFilter')?.value,true);
 }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureControls);else ensureControls();
window.BreakfastOrderPrintTracker={signature,groupedActive,fetchPrintLog};
})();