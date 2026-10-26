import {NextRequest,NextResponse} from 'next/server';
import {neon} from '@neondatabase/serverless';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'DB not connected'},{status:503});
 const p=request.nextUrl.searchParams,office=p.get('office')||'N10',code=p.get('code')||'8140270';
 if(!/^[A-Z]\d{2}$/.test(office)||!/^\d{7,12}$/.test(code))return NextResponse.json({error:'Invalid school'},{status:400});
 const db=neon(process.env.DATABASE_URL);
 try{
  const [data,sync,backfill]=await Promise.all([
   db`SELECT COUNT(*)::int AS meals,COUNT(DISTINCT meal_date)::int AS days,
    MIN(meal_date)::text AS oldest,MAX(meal_date)::text AS newest,
    MAX(fetched_at)::text AS last_fetched FROM meals WHERE office_code=${office} AND school_code=${code}`,
   db`SELECT status,meal_count AS count,started_at::text AS started,finished_at::text AS finished,
    error_message AS error FROM sync_runs WHERE office_code=${office} AND school_code=${code}
    ORDER BY started_at DESC LIMIT 1`,
   db`SELECT cursor_end::text AS cursor,completed,updated_at::text AS updated
    FROM backfill_cursors WHERE office_code=${office} AND school_code=${code}`
  ]);
  return NextResponse.json({data:data[0],sync:sync[0]||null,backfill:backfill[0]||null});
 }catch{return NextResponse.json({error:'Data status unavailable'},{status:500})}
}
