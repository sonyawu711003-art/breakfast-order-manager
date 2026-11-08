/* LINE 對話訂單候選 V2 — conservative: ambiguity stays review-required.
 * No automatic approval. OCR text is not a reliable substitute for message metadata.
 */
(function(){
"use strict";
const dateRE=/(?:20\d{2}[\/.年-])?(\d{1,2})\s*[\/.月-]\s*(\d{1,2})(?:日)?(?:\s*\([一二三四五六日]\))?/g;
const ignored=/^(?:【截圖\d+】|昨天|今天|已讀\s*\d+|以上收到|謝謝|感謝|收到|@|訂購方式|NEW|想預訂的朋友|汐科站|週二至週五)/i;
const catalog=[
'抹茶開心果','咖啡核桃','蔓越莓玫瑰紅寶石','巧克力阿華田','巧克力藍莓乳酪','南瓜焦糖乳酪',
'鐵觀音桂圓','松露鹽之花','蜂蜜燕麥','起司三重奏','原味明太子','大甲芋頭',
'原味明太子','原味肉桂','原味明太子','巧克力阿華田','抹茶卡士達',
'巧克力阿華田','抹茶開心果','原味明太子','巧克力藍莓',
'曼越梅紅寶石','蔓越莓玫瑰','原味明太子','花草檸檬雞腿吐司',
'花草檸檬雞','原味明太子','雞肉沙拉','檸檬雞沙拉','紐奧良沙拉','菲力雞沙拉','巧克力可頌',
'巧克力阿華田','薑越莓玫瑰紅寶石','碳金流沙','流金碳沙','流金鹹沙',
'抹茶開心果','原味明太子','紅茶','咖啡','沙拉'
].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>b.length-a.length);
function normal(s){return String(s||'').normalize('NFKC').replace(/[＊✕✖]/g,'×').replace(/[＋]/g,'+').replace(/[，、]/g,'，').replace(/[ \t]+/g,' ').trim();}
function canon(s){return normal(s).replace(/曼越梅|薑越莓/g,'蔓越莓').replace(/流金碳沙|流金鹹沙/g,'碳金流沙')}
function dates(s,year){const out=[];for(const m of String(s).matchAll(dateRE)){const y=(m[0].match(/20\d{2}/)||[])[0]||String(year);const month=+m[1],day=+m[2];const d=new Date(+y,month-1,day);if(month<1||month>12||day<1||d.getMonth()!==month-1)continue;out.push({start:m.index,end:m.index+m[0].length,date:y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')})}return out}
function itemMatches(s,extra){const names=[...new Set([...catalog,...(extra||[])])].filter(Boolean).sort((a,b)=>b.length-a.length);const hits=[];for(let i=0;i<s.length;i++){const name=names.find(n=>s.startsWith(n,i));if(!name)continue;hits.push({item:name,start:i,end:i+name.length});i+=name.length-1}return hits}
function qtyAfter(fragment){const m=fragment.match(/^\s*(?:[×xX*+]\s*(\d{1,2})|(\d{1,2})\s*(?:個|顆|份|杯|組))/);return m?Number(m[1]||m[2]):1}
function parseLine(line,ctx){const s=canon(line);const ds=dates(s,ctx.year);if(!ds.length&&!ctx.defaultDate)return [];const hits=itemMatches(s,ctx.menu);if(!hits.length)return [];
const result=[];for(let i=0;i<hits.length;i++){const hit=hits[i];let day=ctx.defaultDate||'';for(const d of ds){if(d.start<hit.start)day=d.date}
const next=hits[i+1];const quantity=qtyAfter(s.slice(hit.end,next?.start||s.length));const uncertain=!ctx.customer||!day||!Number.isInteger(quantity)||quantity<1||quantity>50;
result.push({customer:ctx.customer||'',date:day,item:hit.item,qty:quantity,notes:s,mode:/取消|退訂|不要了/.test(s)?'cancel':/改成|改期|改為|更改|換成|修改/.test(s)?'edit':'add',reviewRequired:uncertain||/取消|更改|改期|改成|改為|換成|追加|改訂/.test(s),reason:!ctx.customer?'無法確認發言者':!day?'取餐日期不明':'需比對原訂單',sourceIndex:ctx.sourceIndex??0,line:ctx.lineNo??0})}return result}
function parse(text,opts={}){const year=opts.year||new Date().getFullYear();const menu=opts.menu||[];let customer='',sourceIndex=0,date=opts.defaultDate||'',lineNo=0,skipping=false;const out=[],lines=String(text).split(/\r?\n/);
for(let i=0;i<lines.length;i++){lineNo=i;const s=canon(lines[i]);if(!s)continue;const src=s.match(/^【截圖\s*(\d+)】/);if(src){sourceIndex=+src[1]-1;customer='';date=opts.defaultDate||'';skipping=false;continue}
if(/吃早餐\s*[|｜]/.test(s)&&/口味|NEW|下週|預訂|限量/.test(s)){skipping=true;customer='';continue}
if(skipping){if(/^已讀|^@|^以上收到/.test(s))skipping=false;continue}
if(ignored.test(s)){if(/^(?:已讀|@|以上收到)/.test(s))customer='';continue}
const nameHeader=s.match(/^(?:\d{1,2}:\d{2}\s*)?([^\d:：\s][^:：\n]{1,23})\s*[:：]\s*(.*)$/);
if(nameHeader&&!itemMatches(nameHeader[1],menu).length){customer=nameHeader[1].trim();if(!nameHeader[2])continue;out.push(...parseLine(nameHeader[2],{year,menu,customer,sourceIndex,defaultDate:date,lineNo}));continue}
// If a line is only a display name, it is too easy to mistake product words for names.
// Keep the name only when the next line clearly contains a date and item.
if(!dates(s,year).length&&!itemMatches(s,menu).length&&s.length<=25&&/[一-龥A-Za-z]/.test(s)&&!/^上午|下午/.test(s)){const next=canon(lines[i+1]||'');if(dates(next,year).length&&itemMatches(next,menu).length){customer=s;continue}}
const d=dates(s,year);if(d.length)date=d[d.length-1].date;
out.push(...parseLine(s,{year,menu,customer,sourceIndex,defaultDate:date,lineNo}));
}
return out}
window.BreakfastLineParser={parse,parseLine,dates};
})();