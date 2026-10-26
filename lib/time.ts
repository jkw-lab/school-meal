export const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function kstDate(d:Date=new Date()):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const v=(kind:string)=>parts.find(p=>p.type===kind)?.value||'';
 return [v('year'),v('month'),v('day')].join('-');
}
export function shiftDay(date:string,offset:number):string{
 const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);
 return d.toISOString().slice(0,10);
}
export function dayDifference(from:string,to:string){return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)}
export function mondayOf(date:string){const d=new Date(date+'T12:00:00Z');return shiftDay(date,-(d.getUTCDay()+6)%7);}
export function validRange(from:string,to:string,maxDays=35){return datePattern.test(from)&&datePattern.test(to)&&!Number.isNaN(Date.parse(from))&&!Number.isNaN(Date.parse(to))&&dayDifference(from,to)>=0&&dayDifference(from,to)<=maxDays}
