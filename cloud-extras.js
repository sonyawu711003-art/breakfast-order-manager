
/* 雙管理者共用菜單、審核與訂單金額。 */
let menuRows=[],proposalRows=[],extrasChannel=null;
const money=v=>v===null||v===undefined?'未定價':'$'+Number(v).toFixed(0);
function extrasMount(){
const root=document.getElementById('main'),nav=document.getElementById('nav');
root.insertAdjacentHTML('beforeend','<div id="reviewQueue" class="screen hidden"><h2>✅ 共同審核</h2><p class="hint">兩位管理者都可以核准或退回；核准後才更新正式訂單。</p><button onclick="refreshExtras()">重新整理</button><div id="proposalList"></div></div><div id="menuScreen" class="screen hidden"><h2>📋 菜單及價格管理</h2><p class="hint">菜單改價不會追溯更改已成立訂單。</p><div class="card"><b>📥 Google 商家菜單＋3 款新品</b><p class="hint">65 項、12 類；新增的 3 款為照片上的試吃價，正式售價待確認。原訂單價格不變。已停用的舊口味不會自動重新上架。</p><button type="button" id="importGoogleMenu" onclick="importGoogleMenu()">匯入／更新 65 項菜單</button><p id="importGoogleStatus" class="hint"></p></div><div class="card"><form id="menuForm"><input type="hidden" id="menuId"><label>品項名稱<input id="menuName" required maxlength="150"></label><label>類別<select id="menuCategory"><option>貝果</option><option>三明治</option><option>漢堡</option><option>吐司</option><option>沙拉</option><option>輕食</option><option>沙拉加購</option><option>韓式吐司</option><option>小漢堡</option><option>輕食堡</option><option>歐式</option><option>飲品</option><option>飲料</option><option>甜點</option><option>禮盒</option><option>小禮盒</option><option>其他</option></select></label><label id="menuPriceLabel">售價<input id="menuPrice" type="number" min="0" step=".01" placeholder="未定價可留空"></label><label id="menuRegularLabel">一般售價<input id="menuRegularPrice" type="number" min="0" step=".01" placeholder="未定價可留空"></label><p class="hint" id="menuPriceHelp">僅貝果、甜點可設定群友價，其他類別只有單一售價。</p><label>品項介紹<textarea id="menuDescription" rows="3"></textarea></label><label><input id="menuActive" type="checkbox" style="width:auto;display:inline" checked> 啟用</label><p><button type="submit">儲存菜單</button> <button type="button" class="secondary" onclick="clearMenuForm()">清空</button></p></form></div><input id="menuSearch" placeholder="搜尋品項" oninput="drawMenu()"><div id="menuList"></div></div>');
nav.insertAdjacentHTML('beforeend','<button onclick="tab(\'reviewQueue\')">審核</button><button onclick="tab(\'menuScreen\')">菜單</button>');
document.getElementById('dashboard').insertAdjacentHTML('afterbegin','<div class="card"><b>📸 LINE 截圖辨識與送審</b><p class="hint">可由兩位管理者上傳，OCR 需人工核對，正式訂單不會直接變更。</p><a href="./cloud-capture.html?v=20261108-time1" style="display:inline-block;padding:12px;border-radius:9px;background:#265b4c;color:#fff;text-decoration:none">上傳 LINE 截圖</a></div><div class="card" id="cloudRevenue">訂單金額載入中…</div>');
document.getElementById('item').insertAdjacentHTML('beforebegin','<label>菜單快捷選擇<select id="menuChooser"><option value="">可挑選菜單或手動輸入品名</option></select></label><label id="orderPriceTypeLabel" class="hidden">本筆訂單價格類型<select id="menuPriceType"><option value="member">群友價</option><option value="regular">一般售價</option></select></label>');
document.getElementById('notes').insertAdjacentHTML('afterend','<label>手動調整整筆總金額（留空＝單價×數量）<input type="number" min="0" step=".01" id="totalOverride"></label><p id="totalPreview" class="hint"></p>');
document.getElementById('menuChooser').addEventListener('change',function(){const m=menuRows.find(x=>x.id===this.value);if(!m)return;document.getElementById('item').value=m.name;document.getElementById('price').value=menuSelectedPrice(m);updateOrderPriceType(m);document.getElementById('totalOverride').value='';previewAmount()});
document.getElementById('menuPriceType').addEventListener('change',function(){const m=menuRows.find(x=>x.id===document.getElementById('menuChooser').value);if(!m||document.getElementById('editId').value)return;document.getElementById('price').value=menuSelectedPrice(m);document.getElementById('totalOverride').value='';previewAmount()});
['price','qty','totalOverride'].forEach(id=>document.getElementById(id).addEventListener('input',previewAmount));
document.getElementById('item').addEventListener('change',function(){if(document.getElementById('editId').value)return;const m=menuRows.find(x=>x.active&&x.name===this.value.trim());if(m){document.getElementById('price').value=menuSelectedPrice(m);updateOrderPriceType(m);previewAmount()}else updateOrderPriceType(null)});
document.getElementById('menuForm').addEventListener('submit',saveMenu);
document.getElementById('menuCategory').addEventListener('change',updateMenuPriceLabels);
updateMenuPriceLabels();
previewAmount();
}
async function importGoogleMenu(){
 const data=window.BREAKFAST_GOOGLE_MENU_20261108||[];
 const status=document.getElementById('importGoogleStatus'),button=document.getElementById('importGoogleMenu');
 if(!client||!session){alert('請先登入管理者帳號');return}
 if(data.length!==65){alert('菜單資料尚未載入完整，請重新整理頁面');return}
 if(!confirm('確定匯入 Google 商家菜單與新品共 65 項？\n這會新增或更新菜單售價，但不會回溯修改任何已成立訂單。'))return;
 button.disabled=true;let added=0,updated=0,failed=0;const errors=[];
 const aliases={
  '布里歐帕瑪森-奶油蒜香菲力雞':['布里歐帕瑪森（手寫副名待確認）'],
  '原味炙燒北海道明太子貝果':['原味明太子','原味炙燒明太子'],
  '巧克力藍莓乳酪貝果':['巧克力藍莓乳酪'],
  '牛奶芝麻奶霜貝果':['牛奶芝麻奶霜'],
  '大甲香芋貝果':['大甲芋頭'],
  '南瓜焦糖乳酪貝果':['南瓜焦糖'],
  '起司培根貝果':['起司培根'],
  '鐵觀音桂圓貝果':['鐵觀音桂圓'],
  '松露鹽之花貝果':['松露鹽之花'],
  '抹茶卡士達貝果':['抹茶卡士達'],
  '巧克力阿華田貝果':['巧克力阿華田'],
  '蜂蜜燕麥貝果':['蜂蜜燕麥'],
  '玫瑰蔓越莓紅寶石':['蔓越莓玫瑰紅寶石'],
  '咖啡核桃貝果':['咖啡核桃'],
  '抹茶開心果貝果':['抹茶開心果'],
  '古早味紅茶':['紅茶']
 };
 try{
  const {data:current,error:fetchError}=await client.from('breakfast_menu').select('id,name');
  if(fetchError)throw new Error(fetchError.message);
  const byName=new Map((current||[]).map(x=>[x.name,x.id]));
  for(const original of data){
   const rec={...original};if(!canHaveMemberPrice(rec.category))rec.regular_price=rec.price;
   const exact=byName.get(rec.name);
   const alias=!exact?(aliases[rec.name]||[]).find(a=>byName.has(a)):null;
   const existingId=exact||(alias?byName.get(alias):null);
   const payload={...rec};
   const result=existingId
    ?await client.from('breakfast_menu').update(payload).eq('id',existingId).select('id')
    :await client.from('breakfast_menu').insert(payload).select('id');
   if(result.error||!result.data?.length){
    failed++;errors.push(rec.name+'：'+(result.error?.message||'儲存未成功'));
   }else{
    if(existingId)updated++;else added++;
    byName.set(rec.name,result.data[0].id);
    if(alias)byName.delete(alias);
   }
   status.textContent='正在匯入 '+(added+updated+failed)+'／'+data.length+' 項…';
  }
  status.textContent='菜單匯入結果：新增 '+added+'、更新 '+updated+'、失敗 '+failed+'。'+(failed?'前幾項錯誤：'+errors.slice(0,3).join('；'):'已完成；歷史訂單未變更。');
  await refreshExtras();
  if(failed)alert(status.textContent+'\n如顯示找不到 regular_price 或 description 欄位，請先執行 Supabase 菜單欄位升級 SQL。');
 }catch(e){status.textContent='無法匯入：'+e.message}
 finally{button.disabled=false}
}
function canHaveMemberPrice(category){return category==='貝果'||category==='甜點'}
function menuPriceCaption(m){
 const std=m.regular_price??m.price;
 if(!canHaveMemberPrice(m.category))return '售價 '+money(std);
 if(m.price==null&&std==null)return '售價待確認';
 if(m.price!=null&&std!=null&&Number(m.price)!==Number(std))return '一般 '+money(std)+'｜群友 '+money(m.price);
 return '售價 '+money(std);
}
function updateMenuPriceLabels(){
 const eligible=canHaveMemberPrice(document.getElementById('menuCategory').value);
 document.getElementById('menuPriceLabel').firstChild.textContent=eligible?'群友價（可不另設優惠）':'售價';
 document.getElementById('menuRegularLabel').classList.toggle('hidden',!eligible);
 document.getElementById('menuPriceHelp').textContent=eligible?'可分別設定一般售價與群友價；沒有群友優惠時兩者填相同金額。':'此類商品只有單一售價，沒有群友價。';
}
function updateOrderPriceType(m){
 const eligible=m&&canHaveMemberPrice(m.category)&&m.price!=null&&m.regular_price!=null&&Number(m.price)!==Number(m.regular_price);
 document.getElementById('orderPriceTypeLabel').classList.toggle('hidden',!eligible);
 if(!eligible)document.getElementById('menuPriceType').value='regular';
}
function menuSelectedPrice(m){
 const typ=document.getElementById('menuPriceType').value;
 const p=canHaveMemberPrice(m.category)&&typ==='member'?(m.price??m.regular_price):(m.regular_price??m.price);
 return p===null||p===undefined?'':p
}
function previewAmount(){const p=document.getElementById('price').value,q=Number(document.getElementById('qty').value),o=document.getElementById('totalOverride').value;document.getElementById('totalPreview').textContent='訂單金額：'+(o!==''?money(Number(o))+'（手動）':p!==''?money(Number(p)*q)+'（自動）':'未定價')}
function clearMenuForm(){document.getElementById('menuForm').reset();document.getElementById('menuId').value='';document.getElementById('menuActive').checked=true;updateMenuPriceLabels()}
async function saveMenu(e){e.preventDefault();if(!client||!session)return;const id=document.getElementById('menuId').value;const rec={name:document.getElementById('menuName').value.trim(),category:document.getElementById('menuCategory').value,price:document.getElementById('menuPrice').value===''?null:Number(document.getElementById('menuPrice').value),regular_price:document.getElementById('menuRegularPrice').value===''?null:Number(document.getElementById('menuRegularPrice').value),description:document.getElementById('menuDescription').value,active:document.getElementById('menuActive').checked};
if(!canHaveMemberPrice(rec.category))rec.regular_price=rec.price;
const r=id?await client.from('breakfast_menu').update(rec).eq('id',id).select('id'):await client.from('breakfast_menu').insert(rec).select('id');if(r.error||!r.data?.length){alert('儲存失敗：'+(r.error?.message||'無權限'));return}clearMenuForm();await refreshExtras()}
function editMenu(id){const m=menuRows.find(x=>x.id===id);if(!m)return;tab('menuScreen');document.getElementById('menuId').value=m.id;document.getElementById('menuName').value=m.name;document.getElementById('menuCategory').value=m.category;document.getElementById('menuPrice').value=m.price===null?'':m.price;document.getElementById('menuRegularPrice').value=m.regular_price??'';document.getElementById('menuDescription').value=m.description??'';document.getElementById('menuActive').checked=m.active;updateMenuPriceLabels();window.scrollTo(0,0)}
function drawMenu(){const q=document.getElementById('menuSearch').value.toLowerCase();document.getElementById('menuList').innerHTML=menuRows.filter(m=>(m.name+m.category).toLowerCase().includes(q)).map(m=>'<div class="card row"><span><b>'+htmlEscape(m.name)+'</b> <span class="hint">'+htmlEscape(m.category)+'</span><br>'+menuPriceCaption(m)+(m.description?'<p class="hint">'+htmlEscape(m.description)+'</p>':'')+(m.active?'':'（停用）')+'</span><button class="secondary" data-m="'+m.id+'">修改</button></div>').join('')||'<p>尚無菜單資料</p>';document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>editMenu(b.dataset.m));
const select=document.getElementById('menuChooser'),prev=select.value;select.innerHTML='<option value="">可挑選菜單或手動輸入品名</option>'+menuRows.filter(m=>m.active).map(m=>'<option value="'+m.id+'">'+htmlEscape(m.category)+'｜'+htmlEscape(m.name)+' '+menuPriceCaption(m)+'</option>').join('');select.value=prev}
async function refreshExtras(){if(!client||!session)return;const [a,b]=await Promise.all([client.from('breakfast_menu').select('*').order('category').order('name'),client.from('breakfast_proposals').select('*').order('submitted_at',{ascending:false}).limit(300)]);if(a.error||b.error){window.BREAKFAST_UPGRADE_READY=false;const msg=a.error?.message||b.error?.message;document.getElementById('proposalList').textContent='請先執行 Supabase 升級 SQL：'+msg;document.getElementById('menuList').textContent='菜單表尚未建立';return}window.BREAKFAST_UPGRADE_READY=true;menuRows=a.data||[];proposalRows=b.data||[];drawMenu();drawProposals();previewAmount()}
function groupPendingProposals(){
 const groups=new Map();
 for(const p of proposalRows.filter(p=>p.status==='pending')){
  const key=p.customer.trim()+'\u001f'+p.pickup_date;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(p);
 }
 return [...groups.values()];
}
function pendingAmount(p){return p.total_override!=null?Number(p.total_override):p.price!=null?Number(p.price)*p.quantity:null}
function drawProposals(){
 const grouped=groupPendingProposals(),pending=grouped.reduce((sum,ps)=>sum+ps.length,0);
 document.getElementById('proposalList').innerHTML=
 '<p class="hint">待審：'+grouped.length+' 組客人／取餐日，共 '+pending+' 個品項</p>'+
 grouped.map((ps,g)=>{
 const first=ps[0],totals=ps.map(pendingAmount),complete=totals.every(t=>t!==null);
 const total=complete?money(totals.reduce((sum,n)=>sum+n,0)):'部分品項尚未定價';
 const originalTexts=[...new Set(ps.map(p=>p.ocr_text).filter(Boolean))];
 return '<div class="card" style="border:1px solid #c5dfce">'+
   '<div class="row"><b>🧾 '+htmlEscape(first.customer)+'</b><b>'+htmlEscape(first.pickup_date)+'</b></div>'+
   '<p class="hint">同客人同日期，共 '+ps.length+' 個待審品項</p>'+
   ps.map(p=>'<div style="border-top:1px solid #e0e9e2;padding:9px 0">'+
    '<div class="row"><span><b>'+htmlEscape(p.item)+'</b> ×'+p.quantity+'</span><span>'+money(pendingAmount(p))+'</span></div>'+
    '<div class="hint">處理：'+htmlEscape(p.change_type)+'</div>'+
    '<p class="note">'+htmlEscape(p.notes)+'</p>'+
    '<div class="row"><button class="secondary" data-image="'+p.id+'" '+(p.screenshot_path?'':'disabled')+'>查看截圖</button>'+
    '<button class="secondary" data-review="'+p.id+'" data-decision="approve">單項核准</button>'+
    '<button class="secondary" data-review="'+p.id+'" data-decision="reject">單項退回</button></div></div>').join('')+
   '<p><b>整單合計：'+total+'</b></p>'+
   '<details><summary>原始文字（去重）</summary>'+originalTexts.map(t=>'<pre style="white-space:pre-wrap">'+htmlEscape(t)+'</pre>').join('')+'</details>'+
   '<div class="row"><button data-review-group="'+g+'" data-group-decision="approve">整單核准</button>'+
   '<button class="secondary" data-review-group="'+g+'" data-group-decision="reject">整單退回</button></div></div>';
 }).join('')||'<p>沒有待審核訂單</p>';
 document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewProposal(b.dataset.review,b.dataset.decision));
 document.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>openShot(b.dataset.image));
 document.querySelectorAll('[data-review-group]').forEach(b=>b.onclick=()=>reviewProposalGroup(Number(b.dataset.reviewGroup),b.dataset.groupDecision));
}
async function reviewProposalGroup(index,decision){
 const ps=groupPendingProposals()[index];if(!ps||!ps.length)return;
 const group=ps[0].customer+'｜'+ps[0].pickup_date;
 let note='';
 if(decision==='approve'){
  if(!confirm('確定核准 '+group+' 共 '+ps.length+' 個品項？\n將逐品項更新正式訂單。請確認所有品名、數量及客製備註。'))return;
 }else{
  const v=prompt('整單退回原因（可留空）','');if(v===null)return;note=v;
 }
 document.querySelectorAll('[data-review-group],[data-review]').forEach(b=>b.disabled=true);
 let done=0;let failure='';
 try{
  for(const p of ps){
   const {error}=await client.rpc('breakfast_review_proposal',{proposal_id:p.id,decision,note});
   if(error){failure=error.message;break}
   done++;
  }
  await reload();await refreshExtras();
  if(failure)alert('整單處理未全部完成：已處理 '+done+'/'+ps.length+' 項。\n'+failure+'\n請重新整理並確認剩餘待審品項，避免重複核准。');
 }finally{
  document.querySelectorAll('[data-review-group],[data-review]').forEach(b=>b.disabled=false);
 }
}
async function openShot(id){const p=proposalRows.find(x=>x.id===id);if(!p||!p.screenshot_path)return;const {data,error}=await client.storage.from('breakfast-line-shots').createSignedUrl(p.screenshot_path,120);if(error){alert(error.message);return}window.open(data.signedUrl,'_blank','noopener')}
async function reviewProposal(id,decision){const p=proposalRows.find(x=>x.id===id);if(!p)return;let note='';if(decision==='approve'){if(!confirm('確定核准 '+p.customer+'｜'+p.item+' ×'+p.quantity+'？將更新正式訂單。'))return}else{const v=prompt('退回原因（可留空）','');if(v===null)return;note=v}
const {error}=await client.rpc('breakfast_review_proposal',{proposal_id:id,decision,note});if(error){alert('審核失敗：'+error.message);return}await reload();await refreshExtras()}
function updateAmount(){const active=orders.filter(x=>x.status==='active');let sum=0,unknown=0;for(const o of active){const amount=o.total_override!==null&&o.total_override!==undefined?Number(o.total_override):o.price!==null?Number(o.price)*o.quantity:null;if(amount===null)unknown++;else sum+=amount}document.getElementById('cloudRevenue').textContent='已定價訂單合計 '+money(sum)+'；另有 '+unknown+' 筆未定價（未計入合計）'}
extrasMount();
const originalSetSession=setSession;setSession=async function(s){await originalSetSession(s);if(s){await refreshExtras();if(!extrasChannel&&client){extrasChannel=client.channel('breakfast-extra').on('postgres_changes',{event:'*',schema:'public',table:'breakfast_menu'},()=>refreshExtras()).on('postgres_changes',{event:'*',schema:'public',table:'breakfast_proposals'},()=>refreshExtras()).subscribe()}}else if(extrasChannel&&client){await client.removeChannel(extrasChannel);extrasChannel=null}};
const originalDraw=draw;draw=function(){originalDraw();updateAmount()};
const originalEdit=editOrder;editOrder=function(id){originalEdit(id);const o=orders.find(x=>x.id===id);document.getElementById('totalOverride').value=o?.total_override??'';previewAmount()};
const originalClear=clearForm;clearForm=function(){originalClear();document.getElementById('totalOverride').value='';document.getElementById('menuChooser').value='';previewAmount()};
if(session)refreshExtras();
