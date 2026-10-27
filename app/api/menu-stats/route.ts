import {NextRequest,NextResponse} from 'next/server';
import {neon} from '@neondatabase/serverless';
import {isArchivedSchool} from '@/lib/meals';
import {canonicalMenu} from '@/lib/menu';
import {kstDate,shiftDay} from '@/lib/time';
export const runtime='nodejs';
const rounded=(sum:number,n:number)=>n?Math.round(sum/n*10)/10:null;
type Hit={date:string;type:number;kcal:number|null};
export async function GET(req:NextRequest){
 const p=req.nextUrl.searchParams,office=p.get('office')||'N10',code=p.get('code')||'8140270',
 raw=p.get('menu')||'',period=p.get('period')||'all';
 if(!/^[A-Z]\d{2}$/.test(office)||!/^\d{7,12}$/.test(code)||!['30','90','365','all'].includes(period)
 ||raw.length>100||!canonicalMenu(raw))return NextResponse.json({error:'메뉴 또는 조회 범위를 확인해 주세요.'},{status:400});
 if(!isArchivedSchool(office,code))return NextResponse.json({error:'북일고 외 학교의 메뉴 기록은 저장하지 않으므로 통계를 제공하지 않아요.'},{status:422});
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'DB 연결이 필요합니다.'},{status:503});
 const name=canonicalMenu(raw),today=kstDate(),from=period==='all'?'2000-01-01':shiftDay(today,-Number(period)+1);
 try{
  const db=neon(process.env.DATABASE_URL);
  const [records,totals,future]=await Promise.all([
   db`SELECT DISTINCT m.id::text AS id,m.meal_date::text AS date,m.meal_type AS type,
     m.calorie_kcal AS kcal FROM meals m JOIN meal_items mi ON mi.meal_id=m.id
     WHERE m.office_code=${office} AND m.school_code=${code}
      AND m.meal_date BETWEEN ${from}::date AND ${today}::date
      AND mi.normalized_name=${name} ORDER BY date DESC,type ASC`,
   db`SELECT COUNT(*)::int AS total,COUNT(DISTINCT meal_date)::int AS days
     FROM meals WHERE office_code=${office} AND school_code=${code}
      AND meal_date BETWEEN ${from}::date AND ${today}::date`,
   db`SELECT DISTINCT m.meal_date::text AS date,m.meal_type AS type
     FROM meals m JOIN meal_items mi ON mi.meal_id=m.id
     WHERE m.office_code=${office} AND m.school_code=${code}
       AND m.meal_date>${today}::date AND mi.normalized_name=${name}
     ORDER BY date ASC,type ASC LIMIT 8`
  ]);
  const hits:Hit[]=records.map(r=>({date:String(r.date),type:Number(r.type),
    kcal:r.kcal===null?null:Number(r.kcal)}));
  const day=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
  const byMeal=[1,2,3].map(type=>({type,count:hits.filter(h=>h.type===type).length}));
  const byWeekday=Array.from({length:7},(_,weekday)=>({weekday,count:hits.filter(h=>day(h.date)===weekday).length}));
  const monthly=new Map<string,number>();for(const h of hits){const month=h.date.slice(0,7);monthly.set(month,(monthly.get(month)||0)+1)}
  const monthlyTrend=[...monthly].sort(([a],[b])=>a.localeCompare(b)).map(([month,count])=>({month,count}));
  const uniqueDates=[...new Set(hits.map(h=>h.date))].sort();
  const gaps=uniqueDates.slice(1).map((date,i)=>(Date.parse(date)-Date.parse(uniqueDates[i]))/86400000);
  const kcalValues=hits.flatMap(h=>h.kcal===null?[]:[h.kcal]);
  const denominator=Number(totals[0]?.total)||0;
  return NextResponse.json({name,period,from,to:today,
   summary:{count:hits.length,days:uniqueDates.length,totalMeals:denominator,
    mealRate:denominator?Math.round(hits.length/denominator*1000)/10:0,
    firstSeen:uniqueDates[0]||null,lastSeen:uniqueDates[uniqueDates.length-1]||null,
    averageGapDays:rounded(gaps.reduce((a,b)=>a+b,0),gaps.length),
    minGapDays:gaps.length?Math.min(...gaps):null,maxGapDays:gaps.length?Math.max(...gaps):null,
    averageMealKcal:rounded(kcalValues.reduce((a,b)=>a+b,0),kcalValues.length)},
   byMeal,byWeekday,monthlyTrend,appearances:hits.slice(0,30),
   upcoming:future.map(r=>({date:String(r.date),type:Number(r.type)})),
   note:'기록된 급식 중 정확히 일치하는 정규화 메뉴명만 집계합니다. 미래 예정 식단은 별도로 표시합니다.'},
   {headers:{'Cache-Control':'public,s-maxage=120,stale-while-revalidate=300'}});
 }catch(e){console.error('menu-stats',e);return NextResponse.json({error:'메뉴 통계를 불러오지 못했어요.'},{status:500})}
}
