/* Operational week: Sunday-to-Friday; close at Friday 23:59 Asia/Taipei.
   Saturday is a fresh/empty bridge period. Retain history in Supabase. */
(function(){
'use strict';
function taipeiParts(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {day:p.year+'-'+p.month+'-'+p.day,hour:+p.hour,minute:+p.minute};
}
function plusDays(value,num){
 const [y,m,d]=value.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+num)).toISOString().slice(0,10);
}
function dayOfWeek(value){
 const [y,m,d]=value.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d)).getUTCDay();
}
function week(now=new Date()){
 const parts=taipeiParts(now),dow=dayOfWeek(parts.day);
 // Closing occurs at exactly 23:59 Friday, one minute before Saturday.
 const closing=dow===5&&parts.hour===23&&parts.minute===59;
 const bridge=closing||dow===6;
 const sunday=bridge?plusDays(parts.day,closing?2:1):plusDays(parts.day,-dow);
 const friday=plusDays(sunday,5);
 const saturday=plusDays(sunday,-1);
 return {sunday,friday,saturday,bridge,closing,localDay:parts.day};
}
function currentStatsOrders(rows,now=new Date()){
 const w=week(now);
 // New week has not opened on Saturday / Friday's 23:59 closing minute.
 if(w.bridge)return [];
 return rows.filter(x=>x.pickup_date>=w.sunday&&x.pickup_date<=w.friday);
}
function currentCardOrders(rows,now=new Date()){
 const w=week(now);
 // Cards scheduled for the new operational week are kept; finished weeks are hidden.
 return rows.filter(x=>x.pickup_date>=w.saturday);
}
window.BreakfastWeekCycle={week,taipeiParts,plusDays,dayOfWeek,currentStatsOrders,currentCardOrders};
})();