import {NextRequest,NextResponse} from 'next/server';
import {neon} from '@neondatabase/serverless';
import {kstDate,shiftDay} from '@/lib/time';
import {normalizeNutrients,nutrientMeta,nutrientOrder,macroRatio,type NutrientId} from '@/lib/nutrition';
export const runtime='nodejs';
const cats=['밥·죽','국·찌개','면','육류·달걀','해산물','채소·반찬','김치','과일','유제품','빵·디저트','음료','기타'];
type MealRow={id:string;date:string;type:number;kcal:number|null;nutrients:Record<string,number>};
type MenuRow={id:string;date:string;type:number;name:string;category:string};
const mean=(values:number[])=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null;
const countStats=(m:MealRow[])=>({count:m.length,kcal:mean(m.map(x=>x.kcal).filter((x):x is number=>x!==null))});
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams,office=q.get('office')||'N10',code=q.get('code')||'8140270',
  period=q.get('period')||'90',type=Number(q.get('type')||'0');
 if(!/^[A-Z]\d{2}$/.test(office)||!/^\d{7,12}$/.test(code)||!['30','90','365','all'].includes(period)||![0,1,2,3].includes(type))
  return NextResponse.json({error:'분석 필터 오류'},{status:400});
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'DB 연결 설정 필요'},{status:503});
 const today=kstDate(),from=period==='all'?'2000-01-01':shiftDay(today,-Number(period)+1);
 try{
  const db=neon(process.env.DATABASE_URL);
  const [records,items]=await Promise.all([
   db`SELECT id::text AS id,meal_date::text AS date,meal_type AS type,calorie_kcal AS kcal,nutrients
    FROM meals WHERE office_code=${office} AND school_code=${code}
    AND meal_date >= ${from}::date AND meal_date <= ${today}::date
    AND (${type}=0 OR meal_type=${type}) ORDER BY meal_date,meal_type`,
   db`SELECT m.id::text AS id,m.meal_date::text AS date,m.meal_type AS type,
    mi.normalized_name AS name,mi.category
    FROM meal_items mi JOIN meals m ON m.id=mi.meal_id
    WHERE m.office_code=${office} AND m.school_code=${code}
    AND m.meal_date >= ${from}::date AND m.meal_date <= ${today}::date
    AND (${type}=0 OR m.meal_type=${type})`
  ]);
  const meals:MealRow[]=records.map(r=>({id:String(r.id),date:String(r.date),type:Number(r.type),
   kcal:r.kcal===null?null:Number(r.kcal),nutrients:r.nutrients||{}}));
  const menus:MenuRow[]=items.map(r=>({id:String(r.id),date:String(r.date),type:Number(r.type),name:String(r.name||''),category:String(r.category||'기타')}));
  const summary=countStats(meals);
  const days=new Set(meals.map(m=>m.date)).size;
  const byMeal=[1,2,3].map(t=>({type:t,...countStats(meals.filter(m=>m.type===t))}));
  const weekdayOf=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
  const byWeekday=Array.from({length:7},(_,d)=>({weekday:d,...countStats(meals.filter(m=>weekdayOf(m.date)===d))}));
  const weekend={weekday:countStats(meals.filter(m=>![0,6].includes(weekdayOf(m.date)))),weekend:countStats(meals.filter(m=>[0,6].includes(weekdayOf(m.date))))};
  const nutrientData=meals.map(m=>normalizeNutrients(m.nutrients));
  const nutrientKeys:NutrientId[]=['carb','protein','fat',...nutrientOrder.filter(x=>x!=='protein')];
  const nutrients=nutrientKeys.map(id=>{
   const v=nutrientData.flatMap(m=>m[id]===undefined?[]:[m[id] as number]);
   return {id,name:nutrientMeta[id].name,unit:nutrientMeta[id].unit,average:mean(v),min:v.length?Math.min(...v):null,max:v.length?Math.max(...v):null,sampleCount:v.length};
  });
  const macro=nutrientData.map(m=>macroRatio(m)).filter((x):x is NonNullable<typeof x>=>x!==null);
  const macroAverage=macro.length?{carb:mean(macro.map(m=>m.carb)),protein:mean(macro.map(m=>m.protein)),fat:mean(macro.map(m=>m.fat))}:null;
  const menuGroups=new Map<string,{name:string;category:string;count:number;dates:Set<string>;ids:Set<string>}>();
  const categoryGroups=new Map<string,{count:number;mealIds:Set<string>}>();
  for(const m of menus){
   if(!m.name)continue;
   let entry=menuGroups.get(m.name);if(!entry){entry={name:m.name,category:m.category,count:0,dates:new Set(),ids:new Set()};menuGroups.set(m.name,entry)}
   entry.count++;entry.dates.add(m.date);entry.ids.add(m.id);
   const category=categoryGroups.get(m.category)||{count:0,mealIds:new Set<string>()};category.count++;category.mealIds.add(m.id);categoryGroups.set(m.category,category);
  }
  const topMenus=[...menuGroups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,30).map(m=>{
   const ordered=[...m.dates].sort(),gaps=ordered.slice(1).map((d,i)=>Math.round((Date.parse(d)-Date.parse(ordered[i]))/86400000));
   return {name:m.name,category:m.category,count:m.count,mealRate:meals.length?Math.round(m.ids.size/meals.length*100):0,repeatDays:mean(gaps)};
  });
  const categories=cats.map(category=>({category,count:categoryGroups.get(category)?.count||0,
   mealRate:meals.length?Math.round((categoryGroups.get(category)?.mealIds.size||0)/meals.length*100):0})).filter(x=>x.count>0);
  const mealSlots=new Map<string,string[]>();
  for(const m of menus){const current=mealSlots.get(m.id)||[];current.push(m.category);mealSlots.set(m.id,current)}
  const heatmap=cats.flatMap(category=>Array.from({length:7},(_,day)=>[1,2,3].map(t=>{
   const selected=meals.filter(m=>m.type===t&&weekdayOf(m.date)===day);
   const matched=selected.filter(m=>(mealSlots.get(m.id)||[]).includes(category)).length;
   return {category,weekday:day,type:t,meals:selected.length,matched,rate:selected.length?Math.round(matched/selected.length*100):null};
  })).flat());
  const trendMap=new Map<string,{meals:MealRow[];n:ReturnType<typeof normalizeNutrients>[];menuIds:Set<string>}>();
  for(let i=0;i<meals.length;i++){
   const m=meals[i],key=m.date.slice(0,7),g=trendMap.get(key)||{meals:[],n:[],menuIds:new Set<string>()};
   g.meals.push(m);g.n.push(nutrientData[i]);trendMap.set(key,g);
  }
  for(const m of menus){const key=m.date.slice(0,7),g=trendMap.get(key);if(g)g.menuIds.add(m.name)}
  const trend=[...trendMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,g])=>({
   month,count:g.meals.length,kcal:countStats(g.meals).kcal,uniqueMenus:g.menuIds.size,
   protein:mean(g.n.flatMap(n=>n.protein===undefined?[]:[n.protein])),
   calcium:mean(g.n.flatMap(n=>n.calcium===undefined?[]:[n.calcium])),
   iron:mean(g.n.flatMap(n=>n.iron===undefined?[]:[n.iron])),
   vitc:mean(g.n.flatMap(n=>n.vitc===undefined?[]:[n.vitc]))
  }));
  let previous:null|{count:number;kcal:number|null}=null;
  if(period!=='all'){
   const end=shiftDay(from,-1),start=shiftDay(from,-Number(period));
   const previousData=await db`SELECT COUNT(*)::int AS count,ROUND(AVG(calorie_kcal),1) AS kcal
    FROM meals WHERE office_code=${office} AND school_code=${code}
     AND meal_date >= ${start}::date AND meal_date <= ${end}::date
     AND (${type}=0 OR meal_type=${type})`;
   previous={count:Number(previousData[0]?.count)||0,kcal:previousData[0]?.kcal===null?null:Number(previousData[0].kcal)};
  }
  return NextResponse.json({period,type,from,to:today,summary:{...summary,days,oldest:meals[0]?.date||null,newest:meals[meals.length-1]?.date||null},
    previous,byMeal,byWeekday,weekend,nutrients,macroAverage,topMenus,categories,heatmap,trend,
    dataNote:'NEIS 제공 식단의 기록 기반 통계이며 실제 섭취량은 아닙니다.'},
   {headers:{'Cache-Control':'public, s-maxage=180, stale-while-revalidate=600'}});
 }catch(error){console.error('analytics error',error);return NextResponse.json({error:'분석 정보를 불러오지 못했어요.'},{status:500})}
}
