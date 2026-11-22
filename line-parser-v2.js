/* LINE 對話訂單候選 V2 — conservative: ambiguity stays review-required.
 * No automatic approval. OCR text is not a reliable substitute for message metadata.
 */
(function(){
"use strict";
const dateRE=/(?:20\d{2}[\/.年-])?(\d{1,2})\s*[\/.月-]\s*(\d{1,2})(?:日)?(?:\s*\([一二三四五六日]\))?/g;
const ignored=/^(?:【截圖\d+】|昨天|今天|已讀\s*\d+|以上收到|謝謝|感謝|收到|@|訂購方式|NEW|想預訂的朋友|汐科站|週二至週五)/i;
const catalog=[
'抹茶開心果','咖啡核桃','蔓越莓玫瑰紅寶石','蔓越莓紅寶石','巧克力阿華田','巧克力藍莓乳酪','藍莓乳酪','南瓜焦糖乳酪',
'鐵觀音桂圓','松露鹽之花','蜂蜜燕麥','起司三重奏','原味明太子','明太子貝果','大甲芋頭',
'原味明太子','原味肉桂','原味明太子','巧克力阿華田','阿華田','芋頭','抹茶卡士達',
'巧克力阿華田','抹茶開心果','原味明太子','巧克力藍莓',
'曼越梅紅寶石','蔓越莓玫瑰','原味明太子','花草檸檬雞腿吐司',
'花草檸檬雞','原味明太子','雞肉沙拉','檸檬雞沙拉','紐奧良沙拉','菲力雞沙拉','巧克力可頌',
'巧克力阿華田','薑越莓玫瑰紅寶石','碳金流沙','流金碳沙','流金鹹沙',
'抹茶開心果','原味明太子','紅茶','咖啡','沙拉'
].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>b.length-a.length);
function normal(s){return String(s||'').normalize('NFKC').replace(/[＊✕✖]/g,'×').replace(/[＋]/g,'+').replace(/[，、]/g,'，').replace(/[ \t]+/g,' ').trim();}
function canon(s){return normal(s).replace(/(?:蔓越梅|蔓越苺|曼越梅|曼越莓|薑越莓)/g,'蔓越莓').replace(/流金碳沙|流金碳砂|流金鹹沙|碳金流砂/g,'碳金流沙')}
function dates(s,year){const out=[];for(const m of String(s).matchAll(dateRE)){const y=(m[0].match(/20\d{2}/)||[])[0]||String(year);const month=+m[1],day=+m[2];const d=new Date(+y,month-1,day);if(month<1||month>12||day<1||d.getMonth()!==month-1)continue;out.push({start:m.index,end:m.index+m[0].length,date:y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')})}return out}
function itemMatches(s,extra){const names=[...new Set([...catalog,...(extra||[])])].filter(Boolean).sort((a,b)=>b.length-a.length);const hits=[];for(let i=0;i<s.length;i++){const name=names.find(n=>s.startsWith(n,i));if(!name)continue;hits.push({item:name,start:i,end:i+name.length});i+=name.length-1}return hits}
function qtyAfter(fragment){const m=fragment.match(/^\s*(?:[×xX*+]\s*(\d{1,2})|(\d{1,2})\s*(?:個|顆|份|杯|組)?(?=\s*(?:[，,、+]|$|謝謝|不加|不要|加蛋|加厚蛋)))/);return m?Number(m[1]||m[2]):1}
function explicitItemList(s,ctx,ds){
 // A compact list may span dates: "11/24芝麻奶霜×2+巧克力花生焦糖×1 11/26檸檬×1".
 // Require complete date-led segments so unrelated notes cannot become products.
 if(!ds.length||!/^\s*(?:20\d{2}[\/.年-])?\d{1,2}\s*[\/.月-]\s*\d{1,2}/.test(s))return null;
 const entries=[];
 for(let d=0;d<ds.length;d++){
  const body=s.slice(ds[d].end,ds[d+1]?.start||s.length).replace(/^\s*[，,、:：]?\s*/,'');
  const re=/\s*[+，,、]?\s*([^\d\s，,、;；+×xX*]{1,40}?)\s*(?:[×xX*+]\s*)?(\d{1,2})\s*(?:顆|個|份|杯|盒|組)?/gy;
  let at=0,m,found=0;
  while(at<body.length){re.lastIndex=at;m=re.exec(body);if(!m)return null;entries.push({date:ds[d].date,item:m[1].trim(),qty:Number(m[2])});at=re.lastIndex;found++}
  if(!found)return null;
 }
 if(entries.length<2||entries.some(x=>!x.item||x.qty<1||x.qty>50))return null;
 return entries.map((x,i)=>({customer:ctx.customer||'',date:x.date,item:x.item,qty:x.qty,notes:s,
  mode:'add',reviewRequired:true,reason:'連寫多品項；請逐項核對正式菜單與數量',
  sourceIndex:ctx.sourceIndex??0,line:(ctx.lineNo??0)*100+i}));
}
function separatedItemList(s,ctx,ds){
 // Keep both products when a customer writes "11/24巧克力花生貝果、明太子熏雞三明治謝謝".
 // A short ingredient inside a sandwich name must not be matched as a bagel.
 if(ds.length!==1||ds[0].start!==0)return null;
 const body=s.slice(ds[0].end).trim();
 if(!/[，,]/.test(body))return null;
 const parts=body.split(/[，,]/).map(x=>x.replace(/(?:謝謝|感謝|麻煩你|麻煩了)[!！。\s]*$/,'').trim());
 if(parts.length<2||parts.some(x=>!x))return null;
 const entries=[];
 for(const part of parts){
  const q=part.match(/^(.+?)\s*(?:[×xX*+]\s*(\d{1,2})|(\d{1,2})\s*(?:個|顆|份|杯|盒|組))$/);
  const item=(q?q[1]:part).trim().replace(/^(?:我要|想要|幫我留|預訂)\s*/,'');
  if(item.length<2||item.length>60)return null;
  if(!item||(!/(?:貝果|三明治|沙拉|吐司|漢堡|紅茶|奶茶|咖啡|可頌)/.test(item)&&
     !itemMatches(item,ctx.menu).some(h=>h.start===0&&h.end===item.length)&&!q))return null;
  entries.push({item,qty:Number(q?.[2]||q?.[3]||1)});
 }
 return entries.map((x,i)=>({customer:ctx.customer||'',date:ds[0].date,item:x.item,qty:x.qty,notes:s,
  mode:'add',reviewRequired:true,reason:'頓號分隔多品項；請逐項確認正式菜單',
  sourceIndex:ctx.sourceIndex??0,line:(ctx.lineNo??0)*100+i}));
}
function joinWrappedItemLists(lines,year){
 const out=[];
 for(let i=0;i<lines.length;i++){
  let line=lines[i],next=lines[i+1];
  // OCR or a narrow LINE bubble may wrap inside a product name (明\n太子1).
  if(next&&dates(line,year).length===1&&!dates(next,year).length&&
     /\d\s*[^\d\s，,、]+$/.test(line)&&/^\s*[^\d\s，,、]+\s*\d/.test(next)&&
     explicitItemList(canon(line+next),{year},dates(canon(line+next),year))){line+=next;i++}
  out.push(line);
 }
 return out;
}
function dateRangeEach(s,ctx){
 // A contiguous date range followed by one product and "each day" quantity.
 // Examples: 11/18~11/20生菜沙拉各一, 11/18-20沙拉每天1份.
 const match=s.match(/(?:(20\d{2})\s*[\/.年-])?(\d{1,2})\s*[\/.月-]\s*(\d{1,2})\s*(?:日)?\s*(?:[-~～至到]|(?:\s+到\s+))\s*(?:(20\d{2})\s*[\/.年-])?(?:(\d{1,2})\s*[\/.月-]\s*)?(\d{1,2})\s*(?:日)?\s*(.{1,100})$/);
 if(!match)return null;
 const year=Number(match[1]||ctx.year),month=Number(match[2]),day=Number(match[3]);
 const endYear=Number(match[4]||year),endMonth=Number(match[5]||month),endDay=Number(match[6]);
 let request=match[7].trim().replace(/^[，,、:：]/,'').trim();
 // Only expand when the author explicitly asks for EACH date. Never guess for "one of these days".
 const each=request.match(/(?:各\s*(?:[一二三四五六七八九十]|\d{1,3})\s*(?:顆|個|份|杯|盒|組)?|每(?:天|日)\s*(?:各)?\s*(?:[一二三四五六七八九十]|\d{1,3})\s*(?:顆|個|份|杯|盒|組)?|每(?:天|日)\s*(?:一|1)\s*(?:顆|個|份|杯|盒|組)?)/);
 if(!each||/(?:任一天|其中一天|擇一|隨便一天)/.test(request))return null;
 const digits={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
 const qtyMatch=each[0].match(/([一二三四五六七八九十]|\d{1,3})/);
 const qty=qtyMatch?(digits[qtyMatch[1]]||Number(qtyMatch[1])):1;
 request=request.replace(each[0],'').replace(/^[\s，,、]+|[\s，,、]+$/g,'').trim();
 if(!request||qty<1||qty>50)return null;
 const from=new Date(Date.UTC(year,month-1,day)),to=new Date(Date.UTC(endYear,endMonth-1,endDay));
 if(from.getUTCFullYear()!==year||from.getUTCMonth()!==month-1||from.getUTCDate()!==day||
   to.getUTCFullYear()!==endYear||to.getUTCMonth()!==endMonth-1||to.getUTCDate()!==endDay||
   to<from||(to-from)/86400000>14)return null;
 // Do not hide multiple products in one "request" or guess their quantities.
 if(/[，,、+＋]/.test(request))return null;
 const out=[];
 for(let i=0;i<=(to-from)/86400000;i++){
  const pickup=new Date(from.getTime()+i*86400000).toISOString().slice(0,10);
  out.push({customer:ctx.customer||'',date:pickup,item:request,qty,
   notes:s,mode:'add',reviewRequired:true,
   reason:'日期區間每天各 '+qty+' 份，請確認正式菜單品項及取餐日',
   sourceIndex:ctx.sourceIndex??0,line:(ctx.lineNo??0)*100+i});
 }
 return out;
}
function parseLine(line,ctx){const s=canon(line);
 const eachRange=dateRangeEach(s,ctx);if(eachRange)return eachRange;
 // Specific LINE order: "11/10-11/12 任一雞肉沙拉×1" means one garden salad
 // WITH one chicken add-on on EACH consecutive date, NOT a single flexible date.
 const chickenRange=s.match(/(?:(20\d{2})\s*[\/.年-])?(\d{1,2})\s*[\/.月]\s*(\d{1,2})\s*[-~～至到]\s*(?:(\d{1,2})\s*[\/.月])?(\d{1,2})\s*(?:日)?\s*(?:任一|任選|任何一款)?\s*(?:款|種)?\s*雞肉沙拉\s*(?:[×xX*+]\s*(\d{1,2}))?/);
 if(chickenRange){
  const year=+(chickenRange[1]||ctx.year),month=+chickenRange[2],start=+chickenRange[3],
    endMonth=+(chickenRange[4]||month),end=+chickenRange[5],qty=+(chickenRange[6]||1);
  const from=new Date(year,month-1,start),to=new Date(year,endMonth-1,end);
  if(from.getFullYear()===year&&from.getMonth()===month-1&&from.getDate()===start&&
    to.getFullYear()===year&&to.getMonth()===endMonth-1&&to.getDate()===end&&
    to>=from&&(to-from)/86400000<=14&&qty>=1&&qty<=50){
   const out=[];for(let d=new Date(from),i=0;d<=to;d.setDate(d.getDate()+1),i++){
    const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    out.push({customer:ctx.customer||'',date,item:'田園沙拉',qty,
     notes:'田園沙拉，每份加購任一款雞肉（雞肉口味待確認）；原文：'+s,
     mode:'add',reviewRequired:true,reason:'每天各一份田園沙拉＋雞肉加購；雞肉口味及加購價待確認',
     sourceIndex:ctx.sourceIndex??0,line:ctx.lineNo*100+i});
   }
   return out;
  }
 }
const ds=dates(s,ctx.year);if(!ds.length&&!ctx.defaultDate)return [];
// When each date has its own product text, parse each dated section independently.
// Keep paired dates such as "11/10＋11/11 咖啡核桃＋紅茶" for the shared-list rule below.
if(ds.length>1&&ds.every((d,i)=>/[一-龥A-Za-z]/.test(s.slice(d.end,ds[i+1]?.start||s.length)))&&
   !/(?:任一天|其中一天|擇一|隨便一天)/.test(s)){
 const separated=ds.flatMap((d,i)=>{
  const section=d.date+' '+s.slice(d.end,ds[i+1]?.start||s.length).trim();
  return parseLine(section,{...ctx,defaultDate:d.date,lineNo:(ctx.lineNo??0)*100+i}).map((x,k)=>({
   ...x,notes:s,line:(ctx.lineNo??0)*10000+i*100+k,
   reviewRequired:true,reason:x.reason||'依原文日期分配品項，請核對'
  }));
 });
 if(separated.length)return separated;
}
const explicitList=explicitItemList(s,ctx,ds);if(explicitList)return explicitList;
const separatedList=separatedItemList(s,ctx,ds);if(separatedList)return separatedList;
const hits=itemMatches(s,ctx.menu);
if(!hits.length){
 // Retain unrecognized product names when the customer explicitly provides an item AND a quantity.
 // This is a review-only fallback: never auto-pick a menu item or silently omit an order line.
 // Supports "1.起士三重奏*4", "起士三重奏×4", "藍莓乳酪 2顆" and OCR spacing variations.
 const bare=s.replace(/^(?:\d{1,2}\s*[.．、)）]\s*)/,'').replace(/^(?:20\d{2}[\/.-])?\d{1,2}\s*[\/月.-]\s*\d{1,2}\s*(?:日)?\s*(?:\([^)]*\))?\s*/,'').trim();
 const explicit=bare.match(/^([^\n，,;；:：]{2,80}?)\s*(?:[×xX*+]\s*(\d{1,3})|(\d{1,3})\s*(?:顆|個|份|杯|盒|組))\s*(?:[，,。.!！]\s*)?$/);
 if(!explicit)return [];
 const item=explicit[1].trim().replace(/^[+＋•\-–]\s*/,'');
 const quantity=Number(explicit[2]||explicit[3]);
 if(!item||quantity<1||quantity>999||/^(?:謝謝|收到|好的|已讀|共計|合計|總計|小計|售價|總額)/.test(item))return [];
 const day=ds.length===1?ds[0].date:ds.length>1?'':ctx.defaultDate||'';
 return [{customer:ctx.customer||'',date:day,item,qty:quantity,notes:s,
  mode:/取消|退訂|不要了/.test(s)?'cancel':/改成|改期|改為|更改|換成|修改/.test(s)?'edit':'add',
  reviewRequired:true,reason:'原文清楚有品項與數量，但未對應正式菜單；請在下拉選單確認品項',
  sourceIndex:ctx.sourceIndex??0,line:ctx.lineNo??0}];
}
const result=[];for(let i=0;i<hits.length;i++){const hit=hits[i];let day=ctx.defaultDate||'';for(const d of ds){if(d.start<hit.start)day=d.date}
const next=hits[i+1];const quantity=qtyAfter(s.slice(hit.end,next?.start||s.length));const flexible=/(?:任一|任一天|其中一天|擇一|隨便一天)/.test(s)&&ds.length>1; if(flexible)day='';
const unknownMultipleDates=ds.length>1&&ds.every(d=>d.start<hit.start)&&!/(?:各|每[天日])/.test(s);if(unknownMultipleDates)day='';
const genericBlueberry=hit.item==='藍莓乳酪';
const uncertain=genericBlueberry||!ctx.customer||!day||!Number.isInteger(quantity)||quantity<1||quantity>50;
result.push({customer:ctx.customer||'',date:day,item:hit.item,qty:quantity,notes:s,mode:/取消|退訂|不要了/.test(s)?'cancel':/改成|改期|改為|更改|換成|修改/.test(s)?'edit':'add',reviewRequired:uncertain||/取消|更改|改期|改成|改為|換成|追加|改訂/.test(s),reason:!ctx.customer?'無法確認發言者':flexible?'跨日期任選一天，需請客人確認':unknownMultipleDates?'多個日期未清楚分配品項':!day?'取餐日期不明':genericBlueberry?'「藍莓乳酪」為簡稱，須核對正式菜單品項':'需比對原訂單',sourceIndex:ctx.sourceIndex??0,line:ctx.lineNo??0})}// Explicitly paired pickup dates before a shared item list mean EACH date gets ALL items.
// e.g. "11/10＋11/11 咖啡核桃＋紅茶" => 4 individual order lines.
// Distinguish this from "11/10-11/12 任一天", which remains unresolved.
if(ds.length>1&&ds.every(d=>d.start<hits[0].start)&&
   !/(?:任一|任一天|其中一天|擇一|隨便一天|任選)/.test(s)){
 const prefix=s.slice(0,hits[0].start);
 const pieces=ds.slice(0,-1).map((d,i)=>prefix.slice(d.end,ds[i+1].start).trim());
 const explicitEach=pieces.every(c=>/^(?:[+＋、，,和與及&]|跟|以及)+$/.test(c));
 const eachOne=hits.length===1&&/(?:各一|各1|各\s*1\s*(?:顆|個|份|杯)?)/.test(s);
 if(explicitEach||eachOne){
   const expanded=[];
   for(let dayIndex=0;dayIndex<ds.length;dayIndex++){
     for(let itemIndex=0;itemIndex<result.length;itemIndex++){
       expanded.push({...result[itemIndex],date:ds[dayIndex].date,
         line:ctx.lineNo*100+dayIndex*result.length+itemIndex,
         reviewRequired:true,reason:'多個取餐日各有完整相同品項，請確認'});
     }
   }
   return expanded;
 }
}
return result}
function parse(text,opts={}){const year=opts.year||new Date().getFullYear();const menu=opts.menu||[];let customer='',sourceIndex=0,date=opts.defaultDate||'',lineNo=0,skipping=false;const out=[],rawLines=String(text).split(/\r?\n/);
const standaloneRange=/^(?:(?:20\d{2})[\/.-])?\d{1,2}\s*[\/.月-]\s*\d{1,2}\s*(?:日)?\s*[-~～至到]\s*(?:(?:20\d{2})[\/.-])?(?:\d{1,2}\s*[\/.月-]\s*)?\d{1,2}\s*(?:日)?$/;
const lines=[];
for(let i=0;i<rawLines.length;i++){
 if(standaloneRange.test(canon(rawLines[i]))&&i+1<rawLines.length&&
    !/^\s*(?:【截圖|(?:\d{1,2}:)?\d{1,2}:\d{2}\s)/.test(rawLines[i+1])){
  lines.push(rawLines[i]+' '+rawLines[++i]);
}else lines.push(rawLines[i]);
}
const joined=joinWrappedItemLists(lines,year);
for(let i=0;i<joined.length;i++){lineNo=i;const rawLine=joined[i];const parts=rawLine.split('\t');
let lineInput=rawLine;
if(parts.length>=3 && /^\s*(?:上午|下午)?\s*\d{1,2}:\d{2}/.test(parts[0])){
 customer=parts[1].trim();lineInput=parts.slice(2).join(' ');
}
const s=canon(lineInput);if(!s)continue;const src=s.match(/^【截圖\s*(\d+)】/);if(src){sourceIndex=+src[1]-1;customer='';date=opts.defaultDate||'';skipping=false;continue}
if(/吃早餐\s*[|｜]/.test(s)&&/口味|NEW|下週|預訂|限量/.test(s)){skipping=true;customer='';continue}
if(skipping){
 const next=canon(joined[i+1]||''),third=canon(joined[i+2]||'');
 const speaker=s.length<=25&&!dates(s,year).length&&!itemMatches(s,menu).length
   &&((dates(next,year).length&&itemMatches(next,menu).length)
   ||(dates(next,year).length&&itemMatches(third,menu).length));
 if(speaker){skipping=false;customer=s;continue}
 if(/^已讀|^@|^以上收到/.test(s))skipping=false;
 continue
}
if(ignored.test(s)){if(/^(?:已讀|@|以上收到)/.test(s))customer='';continue}
const nameHeader=s.match(/^(?:\d{1,2}:\d{2}\s*)?([^\d:：\s][^:：\n]{1,23})\s*[:：]\s*(.*)$/);
if(nameHeader&&!itemMatches(nameHeader[1],menu).length){customer=nameHeader[1].trim();if(!nameHeader[2])continue;out.push(...parseLine(nameHeader[2],{year,menu,customer,sourceIndex,defaultDate:date,lineNo}));continue}
// If a line is only a display name, it is too easy to mistake product words for names.
// Keep the name only when the next line clearly contains a date and item.
if(!dates(s,year).length&&!itemMatches(s,menu).length&&s.length<=25&&/[一-龥A-Za-z]/.test(s)&&!/^上午|下午/.test(s)){const next=canon(joined[i+1]||'');if((dates(next,year).length&&itemMatches(next,menu).length)||(dates(next,year).length&&itemMatches(canon(joined[i+2]||''),menu).length)){customer=s;continue}}
const d=dates(s,year);if(d.length)date=d[d.length-1].date;
out.push(...parseLine(s,{year,menu,customer,sourceIndex,defaultDate:date,lineNo}));
}
return out}
window.BreakfastLineParser={parse,parseLine,dates,joinWrappedItemLists};
})();
