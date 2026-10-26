import {NextRequest,NextResponse} from 'next/server';
import {fetchMeals,archiveMeals,archivedMeals} from '@/lib/meals';
import {validRange,shiftDay,kstDate} from '@/lib/time';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 const p=req.nextUrl.searchParams,office=p.get('office')||'N10',code=p.get('code')||'8140270';
 const name=(p.get('name')||'북일고등학교').slice(0,80);
 const from=p.get('from')||'',to=p.get('to')||'';
 if(!/^[A-Z]\d{2}$/.test(office)||!/^\d{7,12}$/.test(code)||!validRange(from,to,35))
 return NextResponse.json({error:'요청 범위를 확인해 주세요.'},{status:400});
 try{
  // 7일 이상 오래된 급식은 아카이브를 먼저 사용하여 빠르게 응답.
  if(to<shiftDay(kstDate(),-7)){
   const cached=await archivedMeals(office,code,from,to);
   if(cached.length)return NextResponse.json({meals:cached,source:'archive'});
  }
  const fresh=await fetchMeals(office,code,from,to);
  if(fresh.length===0){
   const archived=await archivedMeals(office,code,from,to).catch(()=>[]);
   if(archived.length)return NextResponse.json({meals:archived,source:'archive',stale:true});
  }
  // DB 에러 때문에 NEIS 조회까지 실패 처리하지 않는다.
  await archiveMeals(office,code,name,fresh).catch(e=>console.error('meal archive failure',e));
  return NextResponse.json({meals:fresh,source:'neis'},{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=600'}});
 }catch(e){
  const old=await archivedMeals(office,code,from,to).catch(()=>[]);
  if(old.length)return NextResponse.json({meals:old,source:'archive',stale:true});
  return NextResponse.json({error:e instanceof Error?e.message:'급식 조회 실패'},{status:502});
 }
}
