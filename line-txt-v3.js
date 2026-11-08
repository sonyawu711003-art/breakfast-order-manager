/* LINE exported TXT: preserve message author, sent date and multiline content. */
(function(){
'use strict';
const dateHeader=/^[一二三四五六日],\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/;
const clock=/^(上午|下午)?\s*\d{1,2}:\d{2}$/;
const orderSignal=/預[訂定]|幫我留|請幫我|我要|想要|再加|追加|改成|改為|更改|修改|取消|不要了|\d{1,2}\s*[\/／]\s*\d{1,2}|×\s*\d|\+\s*\d/;
const changeSignal=/改|換|取消|退訂|不要了|共(?:計|總)|原訂|修正|不需要|不用了/;
const canon=s=>String(s||'').normalize('NFKC').replace(/[／]/g,'/').trim();
function iso(y,m,d){const v=new Date(y,m-1,d);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d?y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):''}
function plus(date,days){const d=new Date(date+'T12:00:00');if(Number.isNaN(d.getTime()))return '';d.setDate(d.getDate()+days);return iso(d.getFullYear(),d.getMonth()+1,d.getDate())}
function messageTime24(raw){
 const m=String(raw||'').trim().match(/^(上午|下午)?\s*(\d{1,2}):(\d{2})$/);
 if(!m)return null;
 let hour=Number(m[2]),minute=Number(m[3]);
 if(minute>59||hour>(m[1]?12:23)||hour<(m[1]?1:0))return null;
 if(m[1]==='上午')hour=hour%12;
 else if(m[1]==='下午')hour=hour%12+12;
 return String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
function parseMessages(text){
 let day='',current=null;const messages=[];
 function flush(){if(current){current.body=current.parts.join('\n').replace(/^"|"$/g,'').trim();delete current.parts;if(current.body)messages.push(current);current=null}}
 const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const l=lines[i],match=l.trim().match(dateHeader);
  if(match){flush();day=iso(+match[3],+match[1],+match[2]);continue}
  const cells=l.split('\t');
  if(cells.length>=3&&clock.test(cells[0].trim())){
   flush();const sender=cells[1].trim();if(!sender)continue;
   current={sender,posted:day,time:cells[0].trim(),line:i+1,parts:[cells.slice(2).join('\t')]};continue
  }
  if(current&&l.trim())current.parts.push(l);
 }
 flush();return messages
}
function candidates(text,opts){
 opts=opts||{};
 const from=opts.from||'',to=opts.to||'',fromDateTime=opts.fromDateTime||'',toDateTime=opts.toDateTime||'',names=opts.menu||[];
 const messages=parseMessages(text),results=[],unresolved=[];
 const staff=new Set((opts.staff||['Sonya','老公']).map(canon));
 for(const msg of messages){
  if(!msg.posted||(from&&msg.posted<from)||(to&&msg.posted>to))continue;
  const sentTime=messageTime24(msg.time),sentAt=sentTime?msg.posted+'T'+sentTime:null;
  // A time-window must never silently include messages whose times are unreadable.
  if(fromDateTime||toDateTime){
   if(!sentAt){unresolved.push({sender:msg.sender,posted:msg.posted,time:msg.time,line:msg.line,body:msg.body,reason:'訊息時間無法判讀，未列入時段篩選'});continue}
   if(fromDateTime&&sentAt<fromDateTime||toDateTime&&sentAt>toDateTime)continue;
  }
  if(staff.has(canon(msg.sender)))continue;
  const raw=canon(msg.body);
  if(!raw||/^\s*\[(?:貼圖|照片|記事本|影片|檔案)\]/.test(raw))continue;
  if(!orderSignal.test(raw)&&!names.some(n=>raw.includes(n)))continue;
  if(/^(?:謝謝|感謝|好|有|沒事)/.test(raw)&&!names.some(n=>raw.includes(n)))continue;
  const lines=raw.split(/\n/).map(canon).filter(Boolean);
  let current=msg.posted,extracted=[];
  for(let j=0;j<lines.length;j++){
   const line=lines[j],yy=+msg.posted.slice(0,4);
   if(/明天|明早|明日/.test(line)&&!/\d{1,2}\s*\/\s*\d{1,2}/.test(line))current=plus(msg.posted,1);
   else if(/後天/.test(line)&&!/\d{1,2}\s*\/\s*\d{1,2}/.test(line))current=plus(msg.posted,2);
   else if(/今天|今早|今日/.test(line)&&!/\d{1,2}\s*\/\s*\d{1,2}/.test(line))current=msg.posted;
   const ds=window.BreakfastLineParser.dates(line,yy);
   if(ds.length===1)current=ds[0].date;
   const found=window.BreakfastLineParser.parseLine(line,{customer:msg.sender,year:yy,menu:names,defaultDate:current,sourceIndex:0,lineNo:msg.line*100+j});
   for(let k=0;k<found.length;k++){
    const x=found[k];
    x.notes=x.item==='田園沙拉'&&/任一|任選|任何一款/.test(raw)&&/雞肉沙拉/.test(raw)?'每份田園沙拉加購任一款雞肉（雞肉口味與加購價待確認）；原始訊息：'+raw:raw;x.messageDate=msg.posted;x.messageTime=msg.time;x.sourceLine=msg.line;
    x.line=msg.line*100000+j*1000+k;
    x.reviewRequired=Boolean(x.reviewRequired)||changeSignal.test(raw)||ds.length>1;
    x.reason=x.reviewRequired?(changeSignal.test(raw)?'包含改單／取消／追加語意，需對照既有訂單':x.reason||'日期或數量需要核對'):'';
    extracted.push(x);
   }
  }
  if(extracted.length)results.push(...extracted);
  else if(changeSignal.test(raw)||/幫我留|預訂|我要|再加/.test(raw)){
   unresolved.push({sender:msg.sender,posted:msg.posted,time:msg.time,line:msg.line,body:raw,reason:'無法可靠判讀，需人工核對原始對話'});
  }
 }
 return {messagesRead:messages.length,candidates:results,unresolved}
}
window.BreakfastLineTxt={parseMessages,candidates,messageTime24};
})();