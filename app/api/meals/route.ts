import {NextRequest,NextResponse} from 'next/server';import {fetchMeals,archiveMeals,archivedMeals} from '@/lib/meals';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams,office=q.get('office')||'N10',code=q.get('code')||'8140270',name=(q.get('name')||'북일고등학교').slice(0,80),from=q.get('from')||'',to=q.get('to')||'';
 if(!/^[A-Z]\d{2}$/.test(office)||!/^\d{7,12}$/.test(code)||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||(Date.parse(to)-Date.parse(from))>34*86400000)return NextResponse.json({error:'잘못된 요청'},{status:400});
 try{const meals=await fetchMeals(office,code,from,to);await archiveMeals(office,code,name,meals).catch(e=>console.error('archive',e));return NextResponse.json({meals,source:'neis'});}
 catch(e){const archived=await archivedMeals(office,code,from,to).catch(()=>[]);if(archived.length)return NextResponse.json({meals:archived,source:'archive',stale:true});return NextResponse.json({error:e instanceof Error?e.message:'조회 실패'},{status:502})}
}