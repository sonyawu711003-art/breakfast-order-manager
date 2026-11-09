/* 同客人、同取餐日期 = 同一張畫面訂單。
   資料庫仍採逐品項明細，才能保留版本、取消紀錄及每日品項統計。
   此模組不建立額外客人訂單，也不改寫已成立資料。 */
(function(){
'use strict';
const keyOf=(customer,date)=>String(date||'')+'\u001f'+String(customer||'').trim();
function groupLines(rows){
 const grouped=new Map();
 for(const row of rows){
  const key=keyOf(row.customer,row.pickup_date);
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(row);
 }
 return [...grouped.values()];
}
function groupMarkup(items){
 const first=items[0],active=items.filter(x=>x.status==='active');
 const total=active.reduce((sum,x)=>sum+Number(x.total_override??(x.price==null?0:Number(x.price)*x.quantity)),0);
 const unpriced=active.some(x=>x.total_override==null&&x.price==null);
 const h=htmlEscape;
 const lines=items.map(x=>{
  const price=x.total_override!=null?Number(x.total_override):x.price==null?null:Number(x.price)*x.quantity;
  return '<div class="order order-group-line'+(x.status==='cancelled'?' group-cancelled':'')+'">'+
   '<div class="row"><b>'+h(x.item)+' ×'+x.quantity+'</b><b>'+(x.status==='cancelled'?'已取消':price==null?'價格待確認':'$'+price.toFixed(0))+'</b></div>'+
   (x.notes?'<div class="note">'+h(x.notes)+'</div>':'')+
   '<div class="row"><small>明細版本 '+x.version+'</small><div><button type="button" class="secondary" data-edit-item="'+h(x.id)+'">修改品項</button> '+
   (x.status==='active'?'<button type="button" class="secondary" data-cancel-item="'+h(x.id)+'">取消品項</button>':'')+'</div></div></div>';
 }).join('');
 return '<section class="card customer-order-card"><div class="row"><div><h3>🧾 '+h(first.customer)+'</h3><p class="hint">取餐日 '+h(first.pickup_date)+' · '+active.length+' 個有效品項</p></div>'+
 '<b class="customer-order-amount">'+(unpriced?'已定價 ':'')+'$'+total.toFixed(0)+(unpriced?'＋待定價':'')+'</b></div>'+
 '<div class="customer-order-lines">'+lines+'</div>'+
 (active.length?'<button type="button" data-add-to-order="'+h(active[0].id)+'">＋ 加入這張訂單</button>':'<p class="hint">全部品項已取消</p>')+
 '</section>';
}
function drawGroupedOrders(){
 const q=document.getElementById('search')?.value.trim().toLowerCase()||'';
 const filtered=groupLines(orders).filter(items=>!q||items.some(x=>[x.customer,x.pickup_date,x.item,x.notes].join(' ').toLowerCase().includes(q)));
 const root=document.getElementById('orderList');
 if(root)root.innerHTML=filtered.map(groupMarkup).join('')||'<p class="card hint">沒有符合的客人訂單</p>';
}
function jumpToForm(){
 const el=document.getElementById('orderForm');
 el?.scrollIntoView({behavior:'smooth',block:'start'});
}
window.startOrderItemById=function(id){
 const x=orders.find(row=>row.id===id&&row.status==='active');
 if(!x)return;
 if(typeof orderSaving!=='undefined'&&orderSaving)return;
 if(typeof editDirty!=='undefined'&&editDirty&&!confirm('目前有尚未儲存的品項修改，要捨棄後改為追加品項嗎？'))return;
 startOrderItem(x.customer,x.pickup_date);
 jumpToForm();
};
const originalStart=startOrderItem;
startOrderItem=function(customer,date){
 originalStart(customer,date);
 document.getElementById('customer').readOnly=true;
 document.getElementById('pickup').readOnly=true;
 document.getElementById('formTitle').textContent='加入 '+customer+' 於 '+date+' 的原訂單';
 document.getElementById('orderGroupInfo').textContent='正在原訂單內增加品項，並非新建客人訂單。新增其他品項後，會列在同一張訂單卡內。';
 document.getElementById('orderGroupInfo').classList.remove('hidden');
};
const originalClear=clearForm;
clearForm=function(){
 originalClear();
 document.getElementById('customer').readOnly=false;
 document.getElementById('pickup').readOnly=false;
 document.getElementById('orderGroupInfo').classList.add('hidden');
};
const originalEdit=editOrder;
editOrder=function(id){
 const result=originalEdit(id);
 const x=orders.find(row=>row.id===id);
 if(x){
  document.getElementById('orderGroupInfo').textContent='正在修改 '+x.customer+' 於 '+x.pickup_date+' 的原訂單品項，會保留原品項版本紀錄。';
  document.getElementById('orderGroupInfo').classList.remove('hidden');
 }
 return result;
};
const originalDraw=draw;
draw=function(){
 originalDraw();
 drawGroupedOrders();
};
document.getElementById('orderList')?.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(!button)return;
 if(button.dataset.addToOrder)window.startOrderItemById(button.dataset.addToOrder);
 else if(button.dataset.editItem)editOrder(button.dataset.editItem);
 else if(button.dataset.cancelItem)cancelOrder(button.dataset.cancelItem);
});
window.BreakfastOrderGroupUI={groupLines,drawGroupedOrders};
})();