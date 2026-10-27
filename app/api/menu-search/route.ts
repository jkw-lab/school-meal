import {NextRequest,NextResponse} from 'next/server';
import {neon} from '@neondatabase/serverless';
import {isArchivedSchool} from '@/lib/meals';
import {canonicalMenu} from '@/lib/menu';
import {kstDate} from '@/lib/time';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const p=req.nextUrl.searchParams,office=p.get('office')||'N10',code=p.get('code')||'8140270',
 raw=(p.get('q')||'').trim();
 if(!/^[A-Z]\d{2}$/.test(office)||!/^\d{7,12}$/.test(code)||raw.length>50)
  return NextResponse.json({error:'검색 조건을 확인해 주세요.'},{status:400});
 if(!isArchivedSchool(office,code))return NextResponse.json({error:'메뉴 검색과 즐겨찾기 통계는 북일고 기록만 제공해요.'},{status:422});
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'DB 연결이 필요합니다.'},{status:503});
 const query=canonicalMenu(raw);
 // Treat input as literal substring, not user-controlled SQL wildcard.
 const pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
 try{
  const db=neon(process.env.DATABASE_URL);
  const rows=await db`SELECT mi.normalized_name AS name,MAX(mi.category) AS category,
    COUNT(DISTINCT m.id)::int AS count,MAX(m.meal_date)::text AS latest
    FROM meal_items mi JOIN meals m ON m.id=mi.meal_id
    WHERE m.office_code=${office} AND m.school_code=${code}
    AND m.meal_date <= ${kstDate()}::date
    AND (${query}='' OR mi.normalized_name ILIKE ${pattern} ESCAPE '\\')
    GROUP BY mi.normalized_name ORDER BY COUNT(DISTINCT m.id) DESC, mi.normalized_name ASC LIMIT 40`;
  return NextResponse.json({menus:rows.map(x=>({name:String(x.name),category:String(x.category||'기타'),
    count:Number(x.count),latest:x.latest}))},{headers:{'Cache-Control':'public,s-maxage=120'}});
 }catch(e){console.error('menu-search',e);return NextResponse.json({error:'검색 정보를 불러오지 못했어요.'},{status:500})}
}
