/* Daily statistics and print typography extensions. No database writes. */
(function(){
'use strict';
function amount(row){
 if(row.total_override!=null&&row.total_override!=='')return Number(row.total_override);
 if(row.price===null||row.price===undefined||row.price==='')return null;
 return Number(row.price)*Number(row.quantity);
}
const specialPattern=/(?:不加|不要|不放|不奶油|不抹|不切|別放|去掉|去除|去邊|不烤|對切|分開(?:裝|放|包)?|另外(?:裝|放|包)?|少(?:醬|糖|冰|鹽|菜|辣)|多(?:醬|糖|冰|鹽|菜|辣)|無醬|醬(?:料)?(?:另外|分開)|素食|全素|蛋奶素|過敏|客製|加購|加蛋|加厚蛋|加起司|加培根|加(?:一|兩|1|2)球|一球馬鈴薯|換(?:成|掉)|待確認|備註|特殊需求)/i;
function extractRequests(note){
 return String(note||'').replace(/\r\n?/g,'\n').split('\n').map(x=>x.trim()).filter(x=>x&&specialPattern.test(x));
}
function finance(rows){
 return {sum:rows.reduce((a,x)=>a+(amount(x)??0),0),missing:rows.filter(x=>amount(x)===null)};
}
function currency(value){return '$'+Number(value).toLocaleString('zh-TW',{minimumFractionDigits:0,maximumFractionDigits:2})}
drawMealStats=function(dates,groups){
 const days=new Map(dates.map(d=>[d,{count:0,sections:[]}]));
 const inRange=orders.filter(x=>x.status==='active'&&days.has(x.pickup_date));
 let totalCount=0;
 const summaries=groups.map(({label,unit,orders:lines})=>{
  const byDate=new Map();
  for(const row of lines){
   if(!days.has(row.pickup_date))continue;
   if(!byDate.has(row.pickup_date))byDate.set(row.pickup_date,new Map());
   const item=byDate.get(row.pickup_date);
   item.set(row.item,(item.get(row.item)||0)+row.quantity);
  }
  for(const [date,items] of byDate){
   const sum=[...items.values()].reduce((a,b)=>a+b,0);
   const html=[...items].sort(([a],[b])=>a.localeCompare(b,'zh-TW')).map(([item,qty])=>'<div class="order row"><span>'+htmlEscape(item)+'</span><b>'+qty+' '+unit+'</b></div>').join('');
   days.get(date).count+=sum;
   days.get(date).sections.push('<h4 class="row"><span>'+label+'</span><span>'+sum+' '+unit+'</span></h4>'+html);
  }
  const n=lines.filter(x=>days.has(x.pickup_date)).reduce((a,x)=>a+x.quantity,0);
  totalCount+=n;
  return '<span>'+label+' '+n+' '+unit+'</span>';
 }).join('');
 const daily=[...days].map(([date,summary])=>{
  const dayLines=inRange.filter(x=>x.pickup_date===date),revenue=finance(dayLines);
  const requests=new Map();
  for(const row of dayLines){
   const customer=String(row.customer||'').trim();
   for(const request of extractRequests(row.notes)){
    const key=customer+'|'+request;
    if(!requests.has(key))requests.set(key,{customer,request});
   }
  }
  const customs=[...requests.values()].map(x=>'<div class="special-request-line"><b>'+htmlEscape(x.customer)+'</b>：'+htmlEscape(x.request)+'</div>').join('');
  return '<section class="card"><div class="row"><strong>'+htmlEscape(date)+'</strong><strong>當日小計 '+summary.count+' 件</strong></div>'+
   '<div class="daily-sales">當日銷售額 <strong>'+currency(revenue.sum)+'</strong></div>'+
   (revenue.missing.length?'<p class="unpriced-warning">有 '+revenue.missing.length+' 筆未定價，尚未包含在銷售額：'+htmlEscape(revenue.missing.map(x=>x.customer+'／'+x.item).join('、'))+'</p>':'')+
   summary.sections.join('')+
   (customs?'<div class="special-request-panel"><h4>客人特殊要求（請核對原始留言）</h4>'+customs+'</div>':'')+
   '</section>';
 }).join('');
 const grand=finance(inRange);
 $('mealStats').innerHTML='<div class="card"><div class="row"><strong>'+(dates.length===1?'所選日期總計':'全部日期總計')+'</strong><strong>'+totalCount+' 件</strong></div>'+
  '<div class="row hint">'+summaries+'</div>'+
  '<div class="all-dates-sales">銷售額合計 <strong>'+currency(grand.sum)+'</strong></div>'+
  (grand.missing.length?'<div class="unpriced-warning">注意：'+grand.missing.length+' 筆未定價，以上銷售額僅計入已定價品項。</div>':'')+
  '</div>'+(daily||'<p class="hint">目前沒有有效訂單</p>');
};
renderPrintCard=function(key,items){
 const lines=items.map(row=>'<div class="detail">'+htmlEscape(row.item)+' ×'+row.quantity+(amount(row)===null?'':' $'+amount(row))+'</div>').join('');
 const sum=finance(items);
 const missing=sum.missing.length?'（另有未定價）':'';
 const messages=new Set(items.map(x=>String(x.notes??'').replace(/\r\n?/g,'\n').trim()).filter(Boolean));
 const notes=[...messages].map(x=>'<div class="customer-message"><span class="message-star">*</span> <span class="customer-message-text">'+htmlEscape(x)+'</span></div>').join('');
 return '<div class="print-card"><div>'+htmlEscape(key.replace('|','　'))+'</div>'+lines+
  '<div class="print-total">合計 <span class="print-total-amount">'+currency(sum.sum)+missing+'</span></div>'+notes+'</div>';
};
window.BreakfastPrintStats={amount,extractRequests,finance};
})();