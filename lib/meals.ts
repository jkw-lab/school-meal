import {neon} from '@neondatabase/serverless';
import {cleanDisplayName,parseMenu} from './menu';
import {normalizeNutrients} from './nutrition';
export type Meal={date:string;type:number;menu:string[];kcal:number|null;nutrients:Record<string,number>};
export type SourceMeal=Meal&{rawMenu:string;rawNutrition:string;rawOrigin:string;updatedAt:string|null};
const api='https://open.neis.go.kr/hub/mealServiceDietInfo';
/** Only Bukil High School is archived. Other schools remain NEIS-only read-through. */
export const ARCHIVE_SCHOOL={office:'N10',code:'8140270',name:'북일고등학교'} as const;
export function isArchivedSchool(office:string,code:string){return office===ARCHIVE_SCHOOL.office&&code===ARCHIVE_SCHOOL.code;}
function parseNutrients(text:string):Record<string,number>{
 const out:Record<string,number>={};
 for(const line of text.split(/<br\s*\/?\s*>|\n/gi)){
  const m=line.match(/^\s*([^:：]+?)\s*[:：]\s*([\d,.]+)/);
  if(m){const n=Number(m[2].replace(/,/g,''));if(Number.isFinite(n))out[m[1].trim()]=n;}
 }
 return out;
}
export async function fetchMeals(office:string,code:string,from:string,to:string):Promise<SourceMeal[]>{
 if(!process.env.NEIS_API_KEY)throw new Error('NEIS_API_KEY 미설정');
 const result=new Map<string,SourceMeal>();
 for(let page=1;page<=20;page++){
  const q=new URLSearchParams({KEY:process.env.NEIS_API_KEY,Type:'json',
   ATPT_OFCDC_SC_CODE:office,SD_SCHUL_CODE:code,MLSV_FROM_YMD:from.replaceAll('-',''),
   MLSV_TO_YMD:to.replaceAll('-',''),pIndex:String(page),pSize:'100'});
  const response=await fetch(api+'?'+q,{cache:'no-store',signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw new Error('NEIS 응답 오류: '+response.status);
  const body=await response.json();const data=body.mealServiceDietInfo;
  if(!data){if(body.RESULT?.CODE==='INFO-200')break;throw new Error('NEIS: '+(body.RESULT?.MESSAGE||'응답 형식 오류'));}
  const rows=data.find((x:{row?:unknown[]})=>Array.isArray(x.row))?.row;
  if(!Array.isArray(rows)||rows.length===0)break;
  for(const row of rows){
   const x=row as Record<string,unknown>,date=String(x.MLSV_YMD||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),type=Number(x.MMEAL_SC_CODE);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||![1,2,3].includes(type))continue;
   const rawMenu=String(x.DDISH_NM||'').replace(/<br\s*\/?\s*>/gi,'\n');
   const rawNutrition=String(x.NTR_INFO||'');const rawOrigin=String(x.ORPLC_INFO||'');
   const calorie=Number(String(x.CAL_INFO||'').replace(/,/g,'').match(/[\d.]+/)?.[0]??NaN);
   const modified=String(x.LOAD_DTM||'').slice(0,8);
   result.set(date+':'+type,{date,type,menu:rawMenu.split('\n').map(cleanDisplayName).filter(Boolean),
    kcal:Number.isFinite(calorie)?calorie:null,nutrients:parseNutrients(rawNutrition),
    rawMenu,rawNutrition,rawOrigin,updatedAt:/^\d{8}$/.test(modified)?modified.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):null});
  }
  if(rows.length<100)break;
 }
 return [...result.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.type-b.type);
}
export async function archiveMeals(office:string,code:string,name:string,meals:SourceMeal[]):Promise<number>{
 if(!isArchivedSchool(office,code)||!meals.length)return 0;
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL 미설정');
 const db=neon(process.env.DATABASE_URL);
 await db`INSERT INTO schools(office_code,school_code,school_name) VALUES(${office},${code},${name})
 ON CONFLICT (office_code,school_code) DO UPDATE SET school_name=EXCLUDED.school_name,updated_at=now()`;
 // 한 번의 SQL로 급식 upsert 및 메뉴 인덱스 갱신. 반복적인 HTTP DB 요청을 줄인다.
 const batch=meals.map(m=>({meal_date:m.date,meal_type:m.type,raw_menu:m.rawMenu,raw_nutrition:m.rawNutrition,
  raw_origin:m.rawOrigin,calorie_kcal:m.kcal,nutrients:normalizeNutrients(m.nutrients),
  source_updated_at:m.updatedAt,items:parseMenu(m.rawMenu)}));
 await db`WITH incoming AS (
  SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
  AS x(meal_date date,meal_type smallint,raw_menu text,raw_nutrition text,raw_origin text,
       calorie_kcal numeric,nutrients jsonb,source_updated_at date,items jsonb)
 ), saved AS (
  INSERT INTO meals(office_code,school_code,meal_date,meal_type,meal_name,raw_menu,
   raw_nutrition,raw_origin,calorie_kcal,nutrients,source_updated_at)
  SELECT ${office},${code},i.meal_date,i.meal_type,
   CASE i.meal_type WHEN 1 THEN '조식' WHEN 2 THEN '중식' ELSE '석식' END,
   i.raw_menu,i.raw_nutrition,i.raw_origin,i.calorie_kcal,i.nutrients,i.source_updated_at
  FROM incoming i
  ON CONFLICT(office_code,school_code,meal_date,meal_type) DO UPDATE SET
   raw_menu=EXCLUDED.raw_menu,raw_nutrition=EXCLUDED.raw_nutrition,raw_origin=EXCLUDED.raw_origin,
   calorie_kcal=EXCLUDED.calorie_kcal,nutrients=EXCLUDED.nutrients,
   source_updated_at=EXCLUDED.source_updated_at,fetched_at=now()
  RETURNING id,meal_date,meal_type
 )
 INSERT INTO meal_items(meal_id,item_order,raw_name,normalized_name,category)
 SELECT s.id,it.item_order,it.raw_name,it.normalized_name,it.category
 FROM saved s JOIN incoming i ON s.meal_date=i.meal_date AND s.meal_type=i.meal_type
 CROSS JOIN LATERAL jsonb_to_recordset(i.items)
  AS it(item_order integer,raw_name text,normalized_name text,category text)
 ON CONFLICT(meal_id,item_order) DO UPDATE SET
 raw_name=EXCLUDED.raw_name,normalized_name=EXCLUDED.normalized_name,category=EXCLUDED.category`;
 // 메뉴 수정으로 항목 수가 줄어든 경우, 예전 항목이 통계에 남지 않도록 정리한다.
 await db`WITH incoming AS (
   SELECT * FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
   AS x(meal_date date,meal_type smallint,items jsonb)
 )
 DELETE FROM meal_items mi USING meals m, incoming i
 WHERE mi.meal_id=m.id AND m.office_code=${office} AND m.school_code=${code}
  AND m.meal_date=i.meal_date AND m.meal_type=i.meal_type
  AND mi.item_order>=jsonb_array_length(i.items)`;
 return meals.length;
}
export async function archivedMeals(office:string,code:string,from:string,to:string):Promise<Meal[]>{
 if(!isArchivedSchool(office,code)||!process.env.DATABASE_URL)return [];
 const db=neon(process.env.DATABASE_URL);
 const rows=await db`SELECT meal_date::text AS date,meal_type AS type,raw_menu,calorie_kcal,nutrients
 FROM meals WHERE office_code=${office} AND school_code=${code} AND meal_date BETWEEN ${from}::date AND ${to}::date
 ORDER BY meal_date,meal_type`;
 return rows.map(x=>({date:String(x.date),type:Number(x.type),
  menu:String(x.raw_menu||'').split('\n').map(cleanDisplayName).filter(Boolean),
  kcal:x.calorie_kcal===null?null:Number(x.calorie_kcal),nutrients:x.nutrients||{}}));
}
export async function syncWindow(office:string,code:string,name:string,from:string,to:string){
 if(!isArchivedSchool(office,code))throw new Error('Only Bukil High School can be archived');
 const db=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
 const started=db?await db`INSERT INTO sync_runs(office_code,school_code,range_start,range_end,status)
 VALUES(${office},${code},${from}::date,${to}::date,'running') RETURNING id`:null;
 const id=started?.[0]?.id;
 try{
  const meals=await fetchMeals(office,code,from,to);
  const count=await archiveMeals(office,code,name,meals);
  if(db&&id)await db`UPDATE sync_runs SET status='ok',meal_count=${count},finished_at=now() WHERE id=${id}`;
  return {count,from,to};
 }catch(error){
  if(db&&id)await db`UPDATE sync_runs SET status='failed',error_message=${String(error).slice(0,400)},finished_at=now() WHERE id=${id}`.catch(()=>{});
  throw error;
 }
}
