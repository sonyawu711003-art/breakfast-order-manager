/* 吃早餐每週貝果庫存：期初 + 補貨 + 退回 - 已確認訂單 - 現場零售 */
(function(){
'use strict';
const $i=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let week='',stock=[],ledger=[],catalog=[],dirty=false,busy=false,fetching=false,pendingId=null,readSeq=0,loadedWeek='',reloadQueued=false;
function tpeToday(date=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function plusDays(s,n){const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)}
function sunday(s){const [y,m,d]=s.split('-').map(Number);return plusDays(s,-new Date(Date.UTC(y,m-1,d)).getUTCDay())}
function endOfWeek(){return plusDays(week,6)}
function bagelName(item){
 try{return bagelNameLookup()(item)||null}catch(e){return null}
}
function menuBagels(){
 const rows=(typeof menuRows!=='undefined'&&menuRows.length?menuRows:(window.BREAKFAST_GOOGLE_MENU_20261108||[]));
 return [...new Set(rows.filter(x=>x.category==='貝果'&&x.active!==false).map(x=>String(x.name).trim()).filter(Boolean))];
}
function canonicalBagel(name,names){
 if(names.includes(name))return name;
 const aliases={
  '玫瑰蔓越莓紅寶石':'蔓越莓玫瑰紅寶石',
  '蔓越莓紅寶石':'蔓越莓玫瑰紅寶石',
  '蔓越莓紅寶石貝果':'蔓越莓玫瑰紅寶石',
  '流沙乳酪碳金貝果':'碳金流沙乳酪貝果',
  '碳金流沙乳酪碳金貝果':'碳金流沙乳酪貝果',
  '大甲芋頭貝果':'大甲香芋貝果',
  '原味明太子貝果':'原味炙燒北海道明太子貝果'
 };
 const alias=aliases[name];
 if(alias&&names.includes(alias))return alias;
 const recognized=bagelName(name);
 if(recognized&&names.includes(recognized))return recognized;
 return null;
}
function model(){
 const names=menuBagels(),booked=new Map(),unknown=[];
 for(const x of orders){
  if(x.status!=='active'||x.pickup_date<week||x.pickup_date>endOfWeek())continue;
  const name=canonicalBagel(x.item,names);
  if(name)booked.set(name,(booked.get(name)||0)+Number(x.quantity));
  else if(/貝果|明太子|芋頭|阿華田|紅寶石|流沙/.test(x.item)&&!/吐司|三明治|漢堡|沙拉/.test(x.item))unknown.push(x.item);
 }
 const stockGroups=new Map(),movement=new Map(),legacy=[];
 for(const row of stock){
  const name=canonicalBagel(row.item_name,names);
  if(!name){legacy.push('期初：'+row.item_name+' '+row.opening_qty+' 顆');continue}
  if(!stockGroups.has(name))stockGroups.set(name,[]);
  stockGroups.get(name).push(row);
 }
 for(const entry of ledger){
  const name=canonicalBagel(entry.item_name,names);
  if(!name){legacy.push('異動：'+entry.item_name+' '+entry.quantity+' 顆');continue}
  const m=movement.get(name)||{retail:0,restock:0,correction:0};
  if(entry.event_type==='retail_sale')m.retail+=Number(entry.quantity);
  else if(entry.event_type==='restock')m.restock+=Number(entry.quantity);
  else if(entry.event_type==='sale_correction')m.correction+=Number(entry.quantity);
  movement.set(name,m);
 }
 const ambiguous=[];
 catalog=names;
 const rows=names.map(name=>{
  const sources=stockGroups.get(name)||[];
  // Never sum two distinct opening inventory records, even when their aliases match.
  // Leave duplicate stock unresolved for manager review to avoid inventing inventory.
  if(sources.length>1)ambiguous.push(name+'：'+sources.map(x=>x.item_name+' '+x.opening_qty+' 顆').join('／'));
  const source=sources.length===1?sources[0]:null;
  const m=movement.get(name)||{retail:0,restock:0,correction:0};
  const opening=source?Number(source.opening_qty):null,reserved=booked.get(name)||0;
  const remaining=opening===null?null:opening+m.restock+m.correction-reserved-m.retail;
  return {name,opening,reserved,...m,remaining,low:remaining!==null&&remaining<3,ambiguous:sources.length>1};
 });
 return {rows,unknown:[...new Set(unknown)],legacy,ambiguous};
}
function mount(){
 const main=$i('main'),nav=$i('nav');if(!main||!nav||$i('bagelInventory'))return;
 main.insertAdjacentHTML('beforeend',[
 '<section id="bagelInventory" class="screen hidden"><h2>🥯 每週貝果庫存控管</h2>',
 '<p class="hint">每週日輸入各口味期初庫存。正式訂單按取餐日自動預留；現場零售另行登記。少於 3 顆即紅字警示。</p>',
 '<div class="card"><label>庫存週次（選任何日期，自動換算週日）<input id="biWeek" type="date"></label>',
 '<div class="row"><b id="biRange"></b><button type="button" class="secondary" id="biRefresh">更新庫存</button></div>',
 '<p id="biStatus" class="hint" role="status"></p></div>',
 '<div id="biWarning" role="alert"></div>',
 '<div class="card"><h3>📦 每週期初庫存</h3><p class="hint">空白＝未設定；填 0＝零庫存。整週自動扣除已確認訂單。</p>',
 '<form id="biOpeningForm"><div id="biOpenRows"></div><button type="submit" id="biSaveOpening">儲存本週期初庫存</button></form></div>',
 '<div class="card"><h3>📊 本週庫存與訂單預留</h3>',
 '<p class="hint">可用庫存＝期初＋補貨＋零售更正−本週有效訂單−現場零售；尚未核准的訂單不計入。</p>',
 '<div class="bi-table-wrap"><table class="bi-table"><thead><tr><th>品項</th><th>期初</th><th>訂單</th><th>零售</th><th>補回</th><th>剩餘</th></tr></thead><tbody id="biBalances"></tbody></table></div>',
 '<p id="biUnknown" class="hint"></p></div>',
 '<div class="card"><h3>🏪 現場零售／補貨登記</h3>',
 '<form id="biMovementForm"><label>日期<input id="biDate" type="date" required></label>',
 '<label>貝果<select id="biItem" required></select></label>',
 '<label>異動類型<select id="biType"><option value="retail_sale">現場零售（減少）</option><option value="restock">補貨（增加）</option><option value="sale_correction">退回／更正（增加）</option></select></label>',
 '<label>顆數<input id="biQty" type="number" min="1" max="99999" value="1" required></label>',
 '<label>備註<input id="biNote" maxlength="300" placeholder="例如：現場售出 2 顆"></label>',
 '<button type="submit" id="biSaveEvent">記錄庫存異動</button></form>',
 '<p class="hint">更正時新增一筆相反方向紀錄，不刪除歷史資料。</p></div>',
 '<div class="card"><h3>🕘 本週異動明細</h3><div id="biHistory"></div></div></section>'
 ].join(''));
 nav.insertAdjacentHTML('beforeend','<button onclick="tab(\'bagelInventory\')">庫存</button>');
 if($i('dashboard')){const stats=$i('dashboard');const anchor=$i('cards');if(anchor)anchor.insertAdjacentHTML('afterend','<div id="biDashboardWarning" class="hidden" role="alert" aria-live="polite"></div>');else stats.insertAdjacentHTML('afterbegin','<div id="biDashboardWarning" class="hidden" role="alert" aria-live="polite"></div>');}
 week=sunday(tpeToday());$i('biWeek').value=week;
 $i('biWeek').addEventListener('change',()=>{
  if(dirty&&!confirm('期初庫存有未儲存的修改，確定切換週次？')){$i('biWeek').value=week;return}
  if(!$i('biWeek').value)return;week=sunday($i('biWeek').value);$i('biWeek').value=week;dirty=false;load();
 });
 $i('biRefresh').addEventListener('click',()=>{if(dirty&&!confirm('放棄未儲存的期初庫存並重新整理？'))return;dirty=false;load()});
 $i('biOpeningForm').addEventListener('input',()=>dirty=true);
 $i('biOpeningForm').addEventListener('submit',saveOpening);
 $i('biMovementForm').addEventListener('submit',saveEvent);
 $i('biMovementForm').addEventListener('input',()=>pendingId=null);
 $i('biMovementForm').addEventListener('change',()=>pendingId=null);
 show();
}
function show(){
 if(!$i('bagelInventory')||!week)return;
 const {rows,unknown,legacy,ambiguous}=model(),low=rows.filter(x=>x.low);
 $i('biRange').textContent=week+' ～ '+endOfWeek();
 const date=$i('biDate'),today=tpeToday();
 date.min=week;date.max=endOfWeek();
 if(!date.value||date.value<week||date.value>endOfWeek())date.value=today>=week&&today<=endOfWeek()?today:week;
 $i('biOpenRows').innerHTML=rows.map(x=>'<label class="bi-open-row"><span>'+esc(x.name)+'</span><input type="number" inputmode="numeric" min="0" max="99999" data-bi-name="'+esc(x.name)+'" placeholder="未設定" value="'+(x.opening??'')+'"></label>').join('');
 $i('biBalances').innerHTML=rows.map(x=>'<tr'+(x.low?' class="bi-low"':'')+'><td>'+esc(x.name)+'</td><td>'+(x.opening??'—')+'</td><td>'+x.reserved+'</td><td>'+x.retail+'</td><td>'+(x.restock+x.correction)+'</td><td class="'+(x.low?'bi-low-number':'')+'">'+(x.remaining===null?'未設定':x.remaining+' 顆')+(x.low?' ⚠️':'')+'</td></tr>').join('');
 $i('biWarning').innerHTML=low.length?'<div class="bi-alert"><b>⚠️ 庫存低於 3 顆（'+low.length+' 款）</b><div>'+low.map(x=>'<div>'+esc(x.name)+'：'+x.remaining+' 顆</div>').join('')+'</div></div>':'';
 $i('biUnknown').textContent=(rows.filter(x=>x.opening===null).length+' 個菜單貝果尚未設定期初數量。')+
 (ambiguous.length?' ⚠️ 同一貝果有不同名稱的期初紀錄，暫不合計，請核對後再輸入正確期初：'+ambiguous.join('；'):'')+
 (legacy.length?' ⚠️ 菜單外的舊庫存資料已隱藏，但未刪除：'+legacy.join('；'):'')+
 (unknown.length?' ⚠️ 無法對應菜單的正式訂單，請檢查：'+unknown.join('、'):'');
 const select=$i('biItem'),previous=select.value;
 select.innerHTML='<option value="">請選擇貝果口味</option>'+catalog.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 if(catalog.includes(previous))select.value=previous;
 $i('biHistory').innerHTML=ledger.length?[...ledger].reverse().map(x=>'<div class="bi-event">'+esc(x.event_date)+'｜'+esc(x.item_name)+'｜'+(x.event_type==='retail_sale'?'售出 −':x.event_type==='restock'?'補貨 +':'更正 +')+x.quantity+' 顆'+(x.note?'｜'+esc(x.note):'')+'</div>').join(''):'<p class="hint">本週尚無現場銷售或補貨紀錄。</p>';
 const dash=$i('biDashboardWarning');
 if(dash){if(week===sunday(tpeToday())&&loadedWeek===week&&low.length){
 dash.classList.remove('hidden');
 const first=low.slice(0,3),extra=low.slice(3);
 dash.innerHTML='<b>⚠️ 貝果低庫存 '+low.length+' 款（少於 3 顆）</b><div class="bi-dashboard-low-list">'+first.map(x=>'<div>'+esc(x.name)+'：'+x.remaining+' 顆</div>').join('')+'</div>'+
 (extra.length?'<details class="bi-low-more"><summary>展開其餘 '+extra.length+' 款低庫存</summary><div class="bi-dashboard-low-list">'+extra.map(x=>'<div>'+esc(x.name)+'：'+x.remaining+' 顆</div>').join('')+'</div></details>':'')+
 '<button type="button" onclick="tab(\'bagelInventory\')">查看庫存明細</button>';
 }else dash.classList.add('hidden')}
}
async function load(){
 if(!client||!session||!week)return;
 if(fetching){reloadQueued=true;return}
 fetching=true;const selected=week,seq=++readSeq;
 $i('biStatus').textContent='正在同步雲端庫存…';
 try{
  const [a,b]=await Promise.all([
   client.from('breakfast_bagel_weekly_stock').select('*').eq('week_start',selected),
   client.from('breakfast_bagel_inventory_events').select('*').eq('week_start',selected).order('created_at')
  ]);
  if(a.error||b.error)throw new Error(a.error?.message||b.error?.message);
  if(week!==selected||seq!==readSeq)return;
  stock=a.data||[];ledger=b.data||[];dirty=false;loadedWeek=selected;show();
  $i('biStatus').textContent='✅ 庫存已同步 '+new Date().toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'});
 }catch(e){$i('biStatus').textContent='同步失敗：'+e.message}
 finally{fetching=false;if(reloadQueued){reloadQueued=false;load()}}
}
async function saveOpening(event){
 event.preventDefault();if(!client||!session||busy)return;
 const entries=[...$i('biOpenRows').querySelectorAll('[data-bi-name]')].filter(x=>x.value!=='').map(x=>({week_start:week,item_name:x.dataset.biName,opening_qty:Number(x.value)}));
 if(!entries.length){alert('至少填入一項期初庫存');return}
 if(entries.some(x=>!Number.isInteger(x.opening_qty)||x.opening_qty<0||x.opening_qty>99999)){alert('期初數量需為 0～99999 的整數');return}
 if(!confirm('確定儲存 '+week+' 開始的 '+entries.length+' 個口味期初庫存？'))return;
 busy=true;$i('biSaveOpening').disabled=true;
 try{
  const {error}=await client.from('breakfast_bagel_weekly_stock').upsert(entries,{onConflict:'week_start,item_name'});
  if(error)throw error;dirty=false;await load();alert('✅ 本週期初庫存已儲存');
 }catch(e){alert('儲存失敗：'+e.message)}
 finally{busy=false;$i('biSaveOpening').disabled=false}
}
async function saveEvent(event){
 event.preventDefault();if(!client||!session||busy)return;
 const date=$i('biDate').value,item=$i('biItem').value,type=$i('biType').value,quantity=Number($i('biQty').value),note=$i('biNote').value.trim();
 if(date<week||date>endOfWeek()||!catalog.includes(item)||!['retail_sale','restock','sale_correction'].includes(type)||!Number.isInteger(quantity)||quantity<1){alert('請檢查日期、口味與數量');return}
 if(!confirm('確認記錄 '+date+' '+item+' '+quantity+' 顆 '+(type==='retail_sale'?'現場零售':type==='restock'?'補貨':'退回更正')+'？'))return;
 busy=true;$i('biSaveEvent').disabled=true;
 if(!pendingId)pendingId=crypto.randomUUID();
 try{
  const {error}=await client.from('breakfast_bagel_inventory_events').insert({id:pendingId,week_start:week,event_date:date,item_name:item,event_type:type,quantity,note});
  if(error&&error.code!=='23505')throw error;
  pendingId=null;$i('biQty').value='1';$i('biNote').value='';await load();
  alert('✅ 庫存異動已登記');
 }catch(e){alert('尚未確認寫入成功：'+e.message+'；請先重新同步再決定是否補登，以免重複')}
 finally{busy=false;$i('biSaveEvent').disabled=false}
}
const oldTab=tab;
tab=function(name){oldTab(name);if(name==='bagelInventory')load()};
const oldDraw=draw;
draw=function(){
 oldDraw();
 if(!session||!$i('bagelInventory'))return;
 const current=sunday(tpeToday()),screenVisible=!$i('bagelInventory').classList.contains('hidden');
 // Default to a fresh Sunday week without taking the user away from deliberate history browsing.
 if(!screenVisible&&!dirty&&week!==current){week=current;$i('biWeek').value=week;loadedWeek='';}
 if(!dirty&&loadedWeek!==week&&!fetching)load();
 else if(!dirty)show();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
setInterval(()=>{if(session&&document.visibilityState==='visible'&&!dirty&&week===sunday(tpeToday()))load()},90000);
window.BreakfastBagelInventory={tpeToday,sunday,plusDays,model,load};
})();