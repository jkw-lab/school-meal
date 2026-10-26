import {neon} from '@neondatabase/serverless';
export type Meal={date:string;type:number;menu:string[];kcal:number|null;nutrients:Record<string,number>};
export async function fetchMeals(office:string,code:string,start:string,end:string):Promise<Meal[]>{
 const key=process.env.NEIS_API_KEY;
 if(!key)throw new Error('NEIS_API_KEY 미설정');
 const all:Meal[]=[];
 for(let page=1;page<=20;page++){
 const params=new URLSearchParams({KEY:key,Type:'json',ATPT_OFCDC_SC_CODE:office,SD_SCHUL_CODE:code,MLSV_FROM_YMD:start.replaceAll('-',''),MLSV_TO_YMD:end.replaceAll('-',''),pIndex:String(page),pSize:'100'});
 const res=await fetch('https://open.neis.go.kr/hub/mealServiceDietInfo?'+params,{signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!res.ok)throw new Error('NEIS 연결 오류');
 const data=await res.json();if(data.RESULT?.CODE==='INFO-200')break;
 if(data.RESULT?.CODE&&data.RESULT.CODE!=='INFO-000')throw new Error('NEIS 응답 오류');
 const blocks=data.mealServiceDietInfo;const rows=blocks?.find((b:any)=>Array.isArray(b.row))?.row;
 if(!rows){if(all.length===0)break;throw new Error('NEIS 응답 형식 오류')}
 for(const x of rows){
 const date=String(x.MLSV_YMD||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
 const type=Number(x.MMEAL_SC_CODE);if(![1,2,3].includes(type)||!/^\d{4}-\d\d-\d\d$/.test(date))continue;
 const raw=String(x.DDISH_NM||'').replace(/<br\s*\/?\s*>/gi,'\n');
 const menu=raw.split(/\n+/).map(s=>s.replace(/\([\d.,\s]+\)/g,'').replace(/[★☆*]/g,'').trim()).filter(Boolean);
 const kcal=Number(String(x.CAL_INFO||'').replace(/,/g,'').match(/[\d.]+/)?.[0]||NaN);
 const nutrients:Record<string,number>={};
 String(x.NTR_INFO||'').replace(/<br\s*\/?\s*>/gi,'\n').split('\n').forEach((part:string)=>{const m=part.match(/^\s*([^:：]+?)\s*[:：]\s*([\d,.]+)/);if(m)nutrients[m[1].trim()]=Number(m[2].replace(/,/g,''))});
 all.push({date,type,menu,kcal:Number.isFinite(kcal)?kcal:null,nutrients});
 }
 if(rows.length<100)break;
 }
 return all;
}
export async function archiveMeals(office:string,code:string,name:string,meals:Meal[]){
 const url=process.env.DATABASE_URL;if(!url||!meals.length)return;
 const db=neon(url);
 await db`INSERT INTO schools(office_code,school_code,school_name) VALUES(${office},${code},${name}) ON CONFLICT(office_code,school_code) DO NOTHING`;
 for(const m of meals){
  await db`INSERT INTO meals(office_code,school_code,meal_date,meal_type,meal_name,raw_menu,calorie_kcal,nutrients) VALUES(${office},${code},${m.date}::date,${m.type},${['','조식','중식','석식'][m.type]},${m.menu.join('\n')},${m.kcal},${JSON.stringify(m.nutrients)}::jsonb) ON CONFLICT(office_code,school_code,meal_date,meal_type) DO UPDATE SET raw_menu=excluded.raw_menu,calorie_kcal=excluded.calorie_kcal,nutrients=excluded.nutrients,fetched_at=now()`;
 }
}
export async function archivedMeals(office:string,code:string,start:string,end:string):Promise<Meal[]>{
 if(!process.env.DATABASE_URL)return [];
 const db=neon(process.env.DATABASE_URL);
 const r=await db`SELECT meal_date::text as date,meal_type as type,raw_menu,calorie_kcal,nutrients FROM meals WHERE office_code=${office} AND school_code=${code} AND meal_date BETWEEN ${start}::date AND ${end}::date ORDER BY meal_date,meal_type`;
 return r.map(x=>({date:String(x.date),type:Number(x.type),menu:String(x.raw_menu).split('\n').filter(Boolean),kcal:x.calorie_kcal===null?null:Number(x.calorie_kcal),nutrients:x.nutrients||{}}));
}
