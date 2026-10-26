import {NextRequest,NextResponse} from 'next/server';
import {neon} from '@neondatabase/serverless';
import {syncWindow} from '@/lib/meals';
import {kstDate,shiftDay} from '@/lib/time';
export const runtime='nodejs';export const maxDuration=60;
const office='N10',code='8140270',name='북일고등학교',oldest='2021-01-01';
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)
  return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'DATABASE_URL required'},{status:503});
 const today=kstDate();const result:{current?:unknown;backfill?:unknown;error?:string}={};
 const db=neon(process.env.DATABASE_URL);
 try{
  result.current=await syncWindow(office,code,name,shiftDay(today,-7),shiftDay(today,21));
 }catch(e){result.error='current: '+String(e).slice(0,300);}
 try{
  let cursor=(await db`SELECT cursor_end::text AS date,completed FROM backfill_cursors WHERE office_code=${office} AND school_code=${code}`)[0];
  if(!cursor){
   // Current range starts today-7; start with the day before that.
   await db`INSERT INTO backfill_cursors(office_code,school_code,cursor_end)
    VALUES(${office},${code},${shiftDay(today,-8)}::date) ON CONFLICT DO NOTHING`;
   cursor=(await db`SELECT cursor_end::text AS date,completed FROM backfill_cursors WHERE office_code=${office} AND school_code=${code}`)[0];
  }
  if(cursor&&!cursor.completed){
   const end=String(cursor.date),from=shiftDay(end,-29);
   if(end<oldest){
    await db`UPDATE backfill_cursors SET completed=true,updated_at=now() WHERE office_code=${office} AND school_code=${code}`;
    result.backfill={completed:true};
   }else{
    const processed=await syncWindow(office,code,name,from<oldest?oldest:from,end);
    // Cursor progresses only after successful archival.
    await db`UPDATE backfill_cursors SET cursor_end=${shiftDay(from,-1)}::date,
     completed=${from<=oldest},last_error=NULL,updated_at=now()
     WHERE office_code=${office} AND school_code=${code}`;
    result.backfill=processed;
   }
  }
 }catch(e){const error=String(e).slice(0,350);result.error=[result.error,error].filter(Boolean).join('; ');await db`UPDATE backfill_cursors SET last_error=${error},updated_at=now() WHERE office_code=${office} AND school_code=${code}`.catch(()=>{});}
 return NextResponse.json(result,{status:result.error?207:200});
}
