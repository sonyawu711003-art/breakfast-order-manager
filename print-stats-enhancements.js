/* Daily statistics and print typography extensions. No database writes. */
(function(){
'use strict';
function amount(row){
 if(row.total_override!=null&&row.total_override!=='')return Number(row.total_override);
 if(row.price===null||row.price===undefined||row.price==='')return null;
 return Number(row.price)*Number(row.quantity);
}
const specialPattern=/(?:不加|不要|不放|不奶油|不抹|不切|別放|去掉|去除|去邊|不烤|對切|分開(?:裝|放|包)?|另外(?:裝|放|包)?|少(?:醬|糖|冰|鹽|菜|辣)|多(?:醬|糖|冰|鹽|菜|辣)|無醬|醬(?:料)?(?:另外|分開)|素食|全素|蛋奶素|過敏|客製|加購|加蛋|加厚蛋|加起司|加培根|加(?:一|兩|1|2)球|一球馬鈴薯|換(?:成|掉)|待確認|備註|特殊需求)/i;
// Only show an original LINE message on the date(s) it actually mentions.
// Date-free customization notes belong to that database order's pickup date.
function extractRequests(note,pickupDate){
 const value=String(note||'').replace(/\r\n?/g,'\n').trim();
 if(!value)return [];
 if(!pickupDate)return value.split('\n').map(x=>x.trim()).filter(x=>x&&specialPattern.test(x));
 const [year,month,day]=pickupDate.split('-').map(Number);
 const target=year*10000+month*100+day;
 const datePattern=/(?:20\d{2}[\/.\-年])?\d{1,2}\s*[\/.\-月]\s*\d{1,2}(?:日)?/g;
 const extractDate=token=>{
  const match=token.match(/^(?:(20\d{2})[\/.\-年])?(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})/);
  if(!match)return null;
  const yy=Number(match[1]||year),mm=Number(match[2]),dd=Number(match[3]);
  const d=new Date(yy,mm-1,dd);
  if(d.getFullYear()!==yy||d.getMonth()!==mm-1||d.getDate()!==dd)return null;
  return yy*10000+mm*100+dd;
 };
 const matched=[];
 // Split messages with multiple dates on the same line too:
 // "11/10 不加醬，11/11 正常" should only flag 11/10.
 for(const line of value.split('\n').map(x=>x.trim()).filter(Boolean)){
  const matches=[...line.matchAll(datePattern)];
  if(!matches.length){
   // A date-free note in a longer multi-day LINE message must not leak into every day.
   // It is safe to assign this only when the message has no dated entries.
   if(!datePattern.test(value)&&specialPattern.test(line))matched.push(line);
   datePattern.lastIndex=0;
   continue;
  }
  const first=matches[0];
  const header=line.slice(0,first.index).trim();
  if(header&&specialPattern.test(header)&&!datePattern.test(value.slice(0,value.indexOf(line)))) {
   // Don't infer a date for a free-standing header preceding multiple dated lines.
  }
  // Each dated clause may start with one or several adjacent dates and/or an explicit range.
  for(let i=0;i<matches.length;i++){
   const current=matches[i],next=matches[i+1];
   const here=extractDate(current[0]);if(here===null)continue;
   const between=line.slice(current.index+current[0].length,next?next.index:line.length);
   const justSeparator=/^\s*(?:[、,，+＆&／/~～\-至到]|\s)*\s*$/.test(between);
   if(next&&justSeparator)continue; // date-list group; process at final date in group
   let dates=[here],start=i;
   while(start>0){
    const preceding=matches[start-1];
    const separator=line.slice(preceding.index+preceding[0].length,matches[start].index);
    if(!/^\s*[、,，+＆&／/~～\-至到]\s*$/.test(separator))break;
    start--;
    const previous=extractDate(matches[start][0]);
    if(previous!==null)dates.unshift(previous);
   }
   const segment=line.slice(current.index+current[0].length,next?next.index:line.length).trim();
   if(!segment||!specialPattern.test(segment))continue;
   let applies=dates.includes(target);
   const rangeParts=line.slice(matches[start].index+matches[start][0].length,current.index);
   if(dates.length===2&&/[-~～至到]/.test(rangeParts)){
    const first=dates[0],last=dates[1];
    applies=target>=Math.min(first,last)&&target<=Math.max(first,last);
   }
   if(applies)matched.push(segment.replace(/^[\s、,，+＆&／/~～\-至到]+/,'').trim());
  }
 }
 return [...new Set(matched.filter(Boolean))];
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
   for(const request of extractRequests(row.notes,date)){
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