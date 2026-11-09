/* LINE 對話訂單候選 V2 — conservative: ambiguity stays review-required.
 * No automatic approval. OCR text is not a reliable substitute for message metadata.
 */
(function(){
"use strict";
const dateRE=/(?:20\d{2}[\/.年-])?(\d{1,2})\s*[\/.月-]\s*(\d{1,2})(?:日)?(?:\s*\([一二三四五六日]\))?/g;
const ignored=/^(?:【截圖\d+】|昨天|今天|已讀\s*\d+|以上收到|謝謝|感謝|收到|@|訂購方式|NEW|想預訂的朋友|汐科站|週二至週五)/i;
const catalog=[
'抹茶開心果','咖啡核桃','蔓越莓玫瑰紅寶石','蔓越莓紅寶石','巧克力阿華田','巧克力藍莓乳酪','南瓜焦糖乳酪',
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
function parseLine(line,ctx){const s=canon(line);
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
const ds=dates(s,ctx.year);if(!ds.length&&!ctx.defaultDate)return [];const hits=itemMatches(s,ctx.menu);if(!hits.length)return [];
const result=[];for(let i=0;i<hits.length;i++){const hit=hits[i];let day=ctx.defaultDate||'';for(const d of ds){if(d.start<hit.start)day=d.date}
const next=hits[i+1];const quantity=qtyAfter(s.slice(hit.end,next?.start||s.length));const flexible=/(?:任一|任一天|其中一天|擇一|隨便一天)/.test(s)&&ds.length>1; if(flexible)day='';
const unknownMultipleDates=ds.length>1&&ds.every(d=>d.start<hit.start)&&!/(?:各|每[天日])/.test(s);if(unknownMultipleDates)day='';
const uncertain=!ctx.customer||!day||!Number.isInteger(quantity)||quantity<1||quantity>50;
result.push({customer:ctx.customer||'',date:day,item:hit.item,qty:quantity,notes:s,mode:/取消|退訂|不要了/.test(s)?'cancel':/改成|改期|改為|更改|換成|修改/.test(s)?'edit':'add',reviewRequired:uncertain||/取消|更改|改期|改成|改為|換成|追加|改訂/.test(s),reason:!ctx.customer?'無法確認發言者':flexible?'跨日期任選一天，需請客人確認':unknownMultipleDates?'多個日期未清楚分配品項':!day?'取餐日期不明':'需比對原訂單',sourceIndex:ctx.sourceIndex??0,line:ctx.lineNo??0})}// Explicitly paired pickup dates before a shared item list mean EACH date gets ALL items.
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
function parse(text,opts={}){const year=opts.year||new Date().getFullYear();const menu=opts.menu||[];let customer='',sourceIndex=0,date=opts.defaultDate||'',lineNo=0,skipping=false;const out=[],lines=String(text).split(/\r?\n/);
for(let i=0;i<lines.length;i++){lineNo=i;const rawLine=lines[i];const parts=rawLine.split('\t');
let lineInput=rawLine;
if(parts.length>=3 && /^\s*(?:上午|下午)?\s*\d{1,2}:\d{2}/.test(parts[0])){
 customer=parts[1].trim();lineInput=parts.slice(2).join(' ');
}
const s=canon(lineInput);if(!s)continue;const src=s.match(/^【截圖\s*(\d+)】/);if(src){sourceIndex=+src[1]-1;customer='';date=opts.defaultDate||'';skipping=false;continue}
if(/吃早餐\s*[|｜]/.test(s)&&/口味|NEW|下週|預訂|限量/.test(s)){skipping=true;customer='';continue}
if(skipping){
 const next=canon(lines[i+1]||''),third=canon(lines[i+2]||'');
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
if(!dates(s,year).length&&!itemMatches(s,menu).length&&s.length<=25&&/[一-龥A-Za-z]/.test(s)&&!/^上午|下午/.test(s)){const next=canon(lines[i+1]||'');if((dates(next,year).length&&itemMatches(next,menu).length)||(dates(next,year).length&&itemMatches(canon(lines[i+2]||''),menu).length)){customer=s;continue}}
const d=dates(s,year);if(d.length)date=d[d.length-1].date;
out.push(...parseLine(s,{year,menu,customer,sourceIndex,defaultDate:date,lineNo}));
}
return out}
window.BreakfastLineParser={parse,parseLine,dates};
})();