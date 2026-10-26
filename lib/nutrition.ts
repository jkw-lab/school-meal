/** 2025 KDRI, 15–18세 권장섭취량(RNI) — 보건복지부·한국영양학회.
 * https://www.kns.or.kr/fileroom/fileroom_view.asp?BoardID=Kdr&idx=167
 * 제공된 음식의 함량을 하루 기준과 비교하는 교육용 지표, 실제 섭취량/개인 목표가 아님.
 */
export type ReferenceProfile='male'|'female';
export type NutrientId='carb'|'protein'|'fat'|'calcium'|'iron'|'vitc'|'thiamin'|'riboflavin';
export const reference:Record<ReferenceProfile,Partial<Record<NutrientId,number>>>={
 male:{protein:65,calcium:800,iron:11,vitc:100,thiamin:1.3,riboflavin:1.7},
 female:{protein:55,calcium:700,iron:12,vitc:100,thiamin:1.1,riboflavin:1.2}
};
export const nutrientMeta:Record<NutrientId,{name:string;unit:string}>={
 carb:{name:'탄수화물',unit:'g'},protein:{name:'단백질',unit:'g'},fat:{name:'지방',unit:'g'},
 calcium:{name:'칼슘',unit:'mg'},iron:{name:'철',unit:'mg'},vitc:{name:'비타민 C',unit:'mg'},
 thiamin:{name:'티아민',unit:'mg'},riboflavin:{name:'리보플라빈',unit:'mg'}
};
export const nutrientOrder:NutrientId[]=['protein','calcium','iron','vitc','thiamin','riboflavin'];
export function nutrientId(raw:string):NutrientId|null{
 const x=raw.toLowerCase().replace(/\s+/g,'');
 if(['carb','protein','fat','calcium','iron','vitc','thiamin','riboflavin'].includes(x))return x as NutrientId;
 if(x.startsWith('탄수화물'))return 'carb';if(x.startsWith('단백질'))return 'protein';
 if(x.startsWith('지방'))return 'fat';if(x.startsWith('칼슘'))return 'calcium';
 if(x.startsWith('철분')||x.startsWith('철('))return 'iron';
 if(x.startsWith('비타민c'))return 'vitc';if(x.startsWith('티아민'))return 'thiamin';
 if(x.startsWith('리보플라빈'))return 'riboflavin';return null;
}
export function normalizeNutrients(raw:Record<string,unknown>):Partial<Record<NutrientId,number>>{
 const result:Partial<Record<NutrientId,number>>={};
 for(const [key,value] of Object.entries(raw||{})){const id=nutrientId(key);const n=typeof value==='number'?value:Number(value);if(id!==null&&Number.isFinite(n)&&n>=0)result[id]=n;}return result;
}
export function macroRatio(n:Partial<Record<NutrientId,number>>){
 const c=(n.carb??0)*4,p=(n.protein??0)*4,f=(n.fat??0)*9,total=c+p+f;
 if(total<=0)return null;
 return {carb:Math.round(c/total*100),protein:Math.round(p/total*100),fat:Math.round(f/total*100)};
}
export function percentOfDay(n:number,target:number){return Math.round(n/target*100)}
