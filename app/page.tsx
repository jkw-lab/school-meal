'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {kstDate,shiftDay,mondayOf} from '@/lib/time';
import {normalizeNutrients,nutrientMeta,nutrientOrder,reference,macroRatio,type ReferenceProfile,type NutrientId} from '@/lib/nutrition';
type School={office:string;code:string;name:string};
type Meal={date:string;type:number;menu:string[];kcal:number|null;nutrients:Record<string,number>};
type Summary={count:number;days:number;kcal:number|null;oldest:string|null;newest:string|null};
type Group={count:number;kcal:number|null;type?:number;weekday?:number};
type NutritionRow={id:NutrientId;name:string;unit:string;average:number|null;min:number|null;max:number|null;sampleCount:number};
type Trend={month:string;count:number;kcal:number|null;uniqueMenus:number;protein:number|null;calcium:number|null;iron:number|null;vitc:number|null};
type Stats={summary:Summary;previous:{count:number;kcal:number|null}|null;byMeal:(Group&{type:number})[];byWeekday:(Group&{weekday:number})[];
 weekend:{weekday:Group;weekend:Group};nutrients:NutritionRow[];macroAverage:{carb:number;protein:number;fat:number}|null;
 topMenus:{name:string;category:string;count:number;mealRate:number;repeatDays:number|null}[];
 categories:{category:string;count:number;mealRate:number}[];
 heatmap:{category:string;weekday:number;type:number;meals:number;matched:number;rate:number|null}[];trend:Trend[];dataNote:string};
type Section='meals'|'analytics'|'settings';type AnalysisTab='overview'|'menu'|'nutrition'|'trend';
const defaultSchool:School={office:'N10',code:'8140270',name:'북일고등학교'};
const weekdays=['일','월','화','수','목','금','토'];
const mealNames=['','아침','점심','저녁'];
const kdrUrl='https://www.kns.or.kr/fileroom/fileroom_view.asp?BoardID=Kdr&idx=167';
const nfmt=(n:number|null|undefined,precision=0)=>n===null||n===undefined?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:precision});
const weekdayOf=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
function PillTabs<T extends string|number>({options,value,onChange}:{options:{value:T;label:string}[];value:T;onChange:(value:T)=>void}){
 return <div className="pill-tabs" role="group">{options.map(o=><button type="button" key={o.value} className={value===o.value?'is-active':''} aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div>;
}
function Meter({value,max,description}:{value:number;max:number;description?:string}){
 const rate=max>0?Math.round(value/max*100):0;
 return <div className="meter" aria-label={description||rate+'%'}><div style={{width:Math.min(100,Math.max(0,rate))+'%'}}/></div>;
}
function NutritionMeters({nutrients,profile,compact=false}:{nutrients:Record<string,number>;profile:ReferenceProfile;compact?:boolean}){
 const values=normalizeNutrients(nutrients);
 return <div className="nutrient-list">
 {nutrientOrder.map(id=>{const value=values[id],r=reference[profile][id];if(value===undefined||!r)return null;
 const rate=Math.round(value/r*100);
 return <div className="nutrient-item" key={id}>
   <div className="nutrient-heading"><span>{nutrientMeta[id].name}</span><span className="value">{nfmt(value,1)} {nutrientMeta[id].unit} <span className="quiet">/ {nfmt(r,1)} {nutrientMeta[id].unit}</span><strong>{rate}%</strong></span></div>
   <Meter value={value} max={r} description={nutrientMeta[id].name+' 하루 권장섭취량의 '+rate+'%'}/>
 </div>})}
 {!compact&&<p className="note">한 끼 급식의 영양소 제공량을 하루 권장섭취량과 비교한 값입니다. 실제 섭취량이나 영양 상태 판정이 아닙니다.</p>}
 </div>;
}
function MacroBar({nutrients}:{nutrients:Record<string,number>}){
 const n=normalizeNutrients(nutrients),m=macroRatio(n);if(!m)return null;
 return <div className="macro-box"><div className="subsection-heading"><span>에너지 구성 비율</span><span className="quiet">탄·단·지 추정</span></div>
 <div className="macro-bar" role="img" aria-label={`탄수화물 ${m.carb}%, 단백질 ${m.protein}%, 지방 ${m.fat}%`}><span style={{width:m.carb+'%'}}/><span style={{width:m.protein+'%'}}/><span style={{width:m.fat+'%'}}/></div>
 <div className="macro-labels"><span>탄수화물 {m.carb}%</span><span>단백질 {m.protein}%</span><span>지방 {m.fat}%</span></div>
 <p className="note">영양정보의 탄수화물·단백질·지방에 4·4·9 kcal/g을 적용한 비율입니다.</p>
 </div>;
}
function SmallBars({rows,maxValue}:{rows:{label:string;value:number|null;hint?:string}[];maxValue?:number}){
 const max=maxValue||Math.max(1,...rows.map(r=>r.value||0));
 return <div className="bars">{rows.map((x,i)=><div className="bar-row" key={x.label+i}>
 <span className="bar-label">{x.label}</span><div className="bar-track"><div className="bar-fill" style={{width:((x.value||0)/max*100)+'%'}}/></div>
 <strong className="bar-value">{nfmt(x.value,1)}{x.hint&&<small> {x.hint}</small>}</strong>
 </div>)}</div>;
}
function TrendBars({items,kind}:{items:Trend[];kind:'kcal'|'protein'|'calcium'|'iron'|'vitc'|'uniqueMenus'}){
 const max=Math.max(1,...items.map(t=>t[kind]||0));
 const units:{[key:string]:string}={kcal:'kcal',protein:'g',calcium:'mg',iron:'mg',vitc:'mg',uniqueMenus:'개'};
 return <div className="trend-scroll"><div className="trend-chart" style={{minWidth:Math.max(280,items.length*58)+'px'}}>
 {items.map(x=>{const n=x[kind];return <div className="trend-column" key={x.month}>
 <span className="trend-number">{nfmt(n,0)}</span><div className="trend-track"><div style={{height:n===null?'0%':Math.max(3,n/max*100)+'%'}}/></div>
 <span className="trend-month">{x.month.slice(2)}</span></div>})}
 </div><p className="note">기간별 급식 제공량 평균 · 단위 {units[kind]}</p></div>;
}
export default function Home(){
 const [school,setSchool]=useState<School>(defaultSchool),[date,setDate]=useState(''),[mealType,setMealType]=useState(2);
 const [section,setSection]=useState<Section>('meals'),[analysisTab,setAnalysisTab]=useState<AnalysisTab>('overview');
 const [period,setPeriod]=useState('90'),[filterType,setFilterType]=useState(0),[profile,setProfile]=useState<ReferenceProfile>('male');
 const [list,setList]=useState<Meal[]>([]),[stats,setStats]=useState<Stats|null>(null),[loading,setLoading]=useState(false),[statsLoading,setStatsLoading]=useState(false);
 const [notice,setNotice]=useState(''),[statsNotice,setStatsNotice]=useState(''),[search,setSearch]=useState(''),[searching,setSearching]=useState(false);
 const [matches,setMatches]=useState<School[]>([]),[dataStatus,setDataStatus]=useState<{data?:{meals:number;days:number;oldest:string;newest:string};sync?:{status:string;started:string;count:number};backfill?:{cursor:string;completed:boolean}}|null>(null);
 const [chosenCategory,setChosenCategory]=useState('국·찌개'),[metric,setMetric]=useState<TrendBarsProp>('kcal');
 const swipe=useRef<number|null>(null),mealCache=useRef<Map<string,Meal[]>>(new Map()),statsCache=useRef<Map<string,Stats>>(new Map());
 type TrendBarsProp='kcal'|'protein'|'calcium'|'iron'|'vitc'|'uniqueMenus';
 useEffect(()=>{setDate(kstDate());try{
  const stored=localStorage.getItem('school-meal-school');if(stored){const s=JSON.parse(stored);if(typeof s.office==='string'&&typeof s.code==='string'&&typeof s.name==='string')setSchool(s)}
  const pref=localStorage.getItem('school-meal-reference');if(pref==='male'||pref==='female')setProfile(pref);
 }catch{}},[]);
 const weekStart=useMemo(()=>date?mondayOf(date):'',[date]),weekEnd=weekStart?shiftDay(weekStart,6):'';
 const week=useMemo(()=>weekStart?Array.from({length:7},(_,i)=>shiftDay(weekStart,i)):[],[weekStart]);
 const mealKey=school.office+':'+school.code+':'+weekStart;
 useEffect(()=>{
  if(!weekStart)return;
  const cached=mealCache.current.get(mealKey);if(cached){setList(cached);setNotice('');setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setNotice('');
  const qs=new URLSearchParams({office:school.office,code:school.code,name:school.name,from:weekStart,to:weekEnd});
  fetch('/api/meals?'+qs,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'조회에 실패했어요');return d})
   .then(d=>{const meals=d.meals||[];mealCache.current.set(mealKey,meals);setList(meals);if(d.stale)setNotice('저장된 급식 기록을 표시하고 있어요.')})
   .catch(e=>{if(e.name!=='AbortError'){setList([]);setNotice(e.message)}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[mealKey,weekStart,weekEnd,school]);
 const statsKey=[school.office,school.code,period,filterType].join(':');
 useEffect(()=>{
  if(section!=='analytics')return;
  const cached=statsCache.current.get(statsKey);if(cached){setStats(cached);setStatsNotice('');setStatsLoading(false);return}
  const controller=new AbortController();setStats(null);setStatsLoading(true);setStatsNotice('');
  fetch('/api/analytics?'+new URLSearchParams({office:school.office,code:school.code,period,type:String(filterType)}),{signal:controller.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'분석 오류');return d})
   .then(d=>{statsCache.current.set(statsKey,d);setStats(d)}).catch(e=>{if(e.name!=='AbortError')setStatsNotice(e.message)})
   .finally(()=>{if(!controller.signal.aborted)setStatsLoading(false)});
  return()=>controller.abort();
 },[section,statsKey,school,period,filterType]);
 useEffect(()=>{
  if(section!=='settings')return;
  let live=true;
  fetch('/api/status?'+new URLSearchParams({office:school.office,code:school.code}))
   .then(r=>r.json()).then(x=>{if(live)setDataStatus(x)}).catch(()=>{if(live)setDataStatus(null)});
  return()=>{live=false};
 },[section,school]);
 const meal=list.find(m=>m.date===date&&m.type===mealType);
 const onProfile=(value:ReferenceProfile)=>{setProfile(value);try{localStorage.setItem('school-meal-reference',value)}catch{}};
 async function findSchool(){
  if(search.trim().length<2)return;
  setSearching(true);setNotice('');try{const response=await fetch('/api/schools?q='+encodeURIComponent(search.trim()));const data=await response.json();if(!response.ok)throw new Error(data.error||'검색 실패');setMatches(data.schools||[]);}catch(e){setNotice(String(e))}finally{setSearching(false)}
 }
 function chooseSchool(s:School){setSchool(s);setMatches([]);setSearch('');setList([]);setStats(null);setSection('meals');setNotice('');try{localStorage.setItem('school-meal-school',JSON.stringify(s))}catch{}}
 const navs:{tab:Section;label:string;icon:string}[]=[{tab:'meals',label:'식단',icon:'▤'},{tab:'analytics',label:'분석',icon:'▥'},{tab:'settings',label:'설정',icon:'⚙'}];
 return <div className="app-shell">
 <header className="topbar"><div className="eyebrow">SCHOOL MEAL</div><button className="school-select" onClick={()=>setSection('settings')}>{school.name} <span aria-hidden="true">⌄</span></button></header>
 <main className="main-area">
 {section==='meals'&&<section onTouchStart={e=>{swipe.current=e.touches[0]?.clientX??null}} onTouchEnd={e=>{const x=swipe.current;if(x!==null){const diff=e.changedTouches[0].clientX-x;if(Math.abs(diff)>85)setDate(d=>shiftDay(d,diff<0?1:-1));}swipe.current=null;}}>
 <div className="page-heading"><div><div className="eyebrow">WEEKLY MENU</div><h1>{date?new Date(date+'T12:00:00Z').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}):'급식'}</h1></div><button className="subtle-button" onClick={()=>setDate(kstDate())}>오늘</button></div>
 <div className="weekday-strip">{week.map(d=><button aria-pressed={d===date} className={d===date?'selected':''} key={d} onClick={()=>setDate(d)}><span>{weekdays[weekdayOf(d)]}</span><strong>{Number(d.slice(-2))}</strong></button>)}</div>
 <PillTabs options={[1,2,3].map(n=>({value:n,label:mealNames[n]}))} value={mealType} onChange={setMealType}/>
 <article className="surface meal-surface"><div className="eyebrow">{['','BREAKFAST','LUNCH','DINNER'][mealType]}</div>
 {loading&&!meal?<div className="skeleton-stack"><div/><div/><div/><div/></div>:
 meal?<><div className="meal-menu">{meal.menu.map((m,i)=><p key={i}>{m}</p>)}</div><div className="detail-line"><span>제공 열량</span><strong>{meal.kcal===null?'자료 없음':nfmt(meal.kcal,1)+' kcal'}</strong></div>
 <h2 className="inside-heading">영양소 비교</h2><div className="comparison-select"><span className="quiet">2025 KDRI · 15–18세 참고 기준</span><select value={profile} onChange={e=>onProfile(e.target.value as ReferenceProfile)} aria-label="권장섭취량 비교 기준"><option value="male">남</option><option value="female">여</option></select></div>
 <NutritionMeters nutrients={meal.nutrients} profile={profile}/><MacroBar nutrients={meal.nutrients}/></>:<div className="empty-state">{loading?'급식을 불러오는 중':'등록된 급식이 없어요.'}</div>}
 </article>{notice&&<p className="alert-text">{notice}</p>}<p className="note">급식 정보 출처: 교육부 NEIS · 날짜를 좌우로 넘길 수 있어요.</p>
 </section>}
 {section==='analytics'&&<section><div className="page-heading"><div><div className="eyebrow">ARCHIVE & INSIGHTS</div><h1>급식 분석</h1></div></div>
 <div className="filters"><label>기간<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="30">최근 30일</option><option value="90">최근 90일</option><option value="365">최근 1년</option><option value="all">전체 기록</option></select></label>
 <label>식사<select value={filterType} onChange={e=>setFilterType(Number(e.target.value))}><option value="0">전체</option><option value="1">아침</option><option value="2">점심</option><option value="3">저녁</option></select></label></div>
 <div className="subtabs">{[{value:'overview',label:'개요'},{value:'menu',label:'메뉴'},{value:'nutrition',label:'영양'},{value:'trend',label:'추세'}].map(o=><button key={o.value} className={analysisTab===o.value?'active':''} onClick={()=>setAnalysisTab(o.value as AnalysisTab)}>{o.label}</button>)}</div>
 {statsLoading?<div className="surface loading-state">기록을 분석하고 있어요…</div>:statsNotice?<div className="surface empty-state">{statsNotice}</div>:!stats?<div className="surface empty-state">분석 데이터를 불러오는 중…</div>:stats.summary.count===0?<div className="surface empty-state">선택한 기간의 기록이 아직 없어요.<p className="note">급식 조회·자동 수집 후 분석에 반영됩니다.</p></div>:<>
 {analysisTab==='overview'&&<><div className="summary-grid"><div className="surface"><span>누적 급식</span><strong>{nfmt(stats.summary.count)}<small> 끼</small></strong></div><div className="surface"><span>기록 날짜</span><strong>{nfmt(stats.summary.days)}<small> 일</small></strong></div></div>
 <article className="surface"><div className="eyebrow">MEAN ENERGY</div><div className="headline-number">{nfmt(stats.summary.kcal,1)} <small>kcal / 끼</small></div><p className="note">실제로 제공된 급식의 평균 열량이며 섭취 권장량이 아닙니다.</p></article>
 <h2>아침 · 점심 · 저녁</h2><div className="surface"><SmallBars rows={stats.byMeal.map(x=>({label:mealNames[x.type],value:x.kcal,hint:'kcal'}))}/></div>
 <h2>요일별 평균 열량</h2><div className="surface"><SmallBars rows={stats.byWeekday.map(x=>({label:weekdays[x.weekday],value:x.kcal,hint:'kcal'}))}/></div>
 <h2>주말과 평일</h2><div className="surface"><div className="detail-line"><span>평일 평균</span><strong>{nfmt(stats.weekend.weekday.kcal,1)} kcal</strong></div><div className="detail-line"><span>주말 평균</span><strong>{nfmt(stats.weekend.weekend.kcal,1)} kcal</strong></div><p className="note">평일 {stats.weekend.weekday.count}끼 · 주말 {stats.weekend.weekend.count}끼</p></div></>}
 {analysisTab==='menu'&&<><div className="surface"><div className="eyebrow">MENU FREQUENCY</div><div className="headline-number">{stats.topMenus.length?stats.topMenus[0].count:0}<small> 회</small></div><p className="quiet">가장 많이 등장한 음식의 기록 횟수</p></div>
 <h2>자주 나오는 메뉴</h2><div className="surface ranked-list">{stats.topMenus.map((m,i)=><div className="ranked-item" key={m.name}><span className="rank">{i+1}</span><div><strong>{m.name}</strong><small>{m.category} · 급식 등장률 {m.mealRate}%{m.repeatDays!==null?' · 평균 '+m.repeatDays+'일 간격':''}</small></div><b>{m.count}회</b></div>)}</div>
 <h2>음식 유형별 빈도</h2><div className="surface"><SmallBars rows={stats.categories.map(c=>({label:c.category,value:c.count,hint:'회'}))}/><p className="note">전체 메뉴 항목의 등장 횟수입니다. 한 끼에 같은 유형이 여러 번 포함될 수 있어요.</p></div>
 <h2>요일 × 식사 시간대</h2><div className="surface"><div className="comparison-select"><span className="quiet">확인할 음식 유형</span><select value={chosenCategory} onChange={e=>setChosenCategory(e.target.value)}>{['밥·죽','국·찌개','면','육류·달걀','해산물','채소·반찬','김치','과일','유제품','빵·디저트','음료','기타'].map(c=><option key={c}>{c}</option>)}</select></div>
 <div className="heatmap"><div className="heat-head">요일</div>{[1,2,3].map(n=><div className="heat-head" key={n}>{mealNames[n]}</div>)}
 {[1,2,3,4,5,6,0].map(day=><div className="heat-row" key={day}><div className="heat-day">{weekdays[day]}</div>{[1,2,3].map(type=>{const e=stats.heatmap.find(h=>h.category===chosenCategory&&h.weekday===day&&h.type===type);const rate=e?.rate;return <div className="heat-cell" key={type} title={rate===null||rate===undefined?'표본 없음':e?.matched+'/'+e?.meals+'끼'} style={{background:rate===null||rate===undefined?'var(--muted-panel)':`rgba(63,112,210,${0.08+rate/100*.83})`}}>{rate===null||rate===undefined?'–':rate+'%'}</div>})}</div>)}</div>
 <p className="note">각 칸은 해당 요일·식사의 기록 중 선택한 음식 유형이 등장한 비율입니다. 표본이 적으면 변동이 클 수 있어요.</p></div></>}
 {analysisTab==='nutrition'&&<><h2>탄수화물 · 단백질 · 지방</h2><div className="surface">{stats.macroAverage?<><div className="macro-bar"><span style={{width:stats.macroAverage.carb+'%'}}/><span style={{width:stats.macroAverage.protein+'%'}}/><span style={{width:stats.macroAverage.fat+'%'}}/></div><div className="macro-labels"><span>탄수 {nfmt(stats.macroAverage.carb)}%</span><span>단백질 {nfmt(stats.macroAverage.protein)}%</span><span>지방 {nfmt(stats.macroAverage.fat)}%</span></div></>:<p className="quiet">분석 가능한 영양 자료가 없습니다.</p>}<p className="note">각 끼니의 4·4·9 환산 비율을 평균한 수치입니다.</p></div>
 <h2>영양소별 평균 제공량</h2><div className="surface"><div className="comparison-select"><span className="quiet">2025 KDRI · 15–18세</span><select value={profile} onChange={e=>onProfile(e.target.value as ReferenceProfile)}><option value="male">남 기준</option><option value="female">여 기준</option></select></div>
 <NutritionMeters nutrients={Object.fromEntries(stats.nutrients.filter(x=>x.average!==null).map(x=>[x.id,x.average as number])) as Record<string,number>} profile={profile}/>
 <div className="detail-line"><span>자료 표본</span><strong>{stats.summary.count}끼</strong></div>
 <p className="note">평균은 해당 영양소가 기록된 식단만 사용하며, 하루 권장량과 제공량을 비교합니다.</p></div>
 <h2>영양소 자료 범위</h2><div className="surface">{stats.nutrients.filter(x=>x.sampleCount>0).map(n=><div className="detail-line" key={n.id}><span>{n.name}</span><strong>{nfmt(n.min,1)}–{nfmt(n.max,1)} {n.unit}</strong></div>)}</div>
 <a className="source-link" href={kdrUrl} target="_blank" rel="noreferrer">자료 출처 · 보건복지부·한국영양학회 (2025 KDRI)</a></>}
 {analysisTab==='trend'&&<><h2>월별 변화</h2><div className="surface"><div className="comparison-select"><span className="quiet">비교 항목</span><select value={metric} onChange={e=>setMetric(e.target.value as TrendBarsProp)}>
 <option value="kcal">평균 열량</option><option value="protein">단백질</option><option value="calcium">칼슘</option><option value="iron">철</option><option value="vitc">비타민 C</option><option value="uniqueMenus">메뉴 다양성</option></select></div>
 <TrendBars items={stats.trend} kind={metric}/></div>
 <h2>월별 기록</h2><div className="surface">{stats.trend.map(m=><div className="detail-line" key={m.month}><span>{m.month}</span><strong>{m.count}끼 · {m.uniqueMenus}종 메뉴</strong></div>)}</div><p className="note">메뉴 다양성은 월별 고유 정규화 메뉴명 수입니다. 날짜 수가 다른 달은 단순 비교에 유의해 주세요.</p></>}
 <p className="data-caption">분석 범위: {stats.summary.oldest} ~ {stats.summary.newest} · {stats.dataNote}</p>
 </>}
 </section>}
 {section==='settings'&&<section><div className="page-heading"><div><div className="eyebrow">PREFERENCES</div><h1>설정</h1></div></div>
 <h2>학교 선택</h2><div className="surface"><p className="strong-text">{school.name}</p><div className="school-search"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void findSchool()}} placeholder="학교 이름 입력" aria-label="학교 검색"/><button onClick={()=>void findSchool()} disabled={searching}>{searching?'검색 중':'검색'}</button></div>{matches.map(x=><button className="school-result" onClick={()=>chooseSchool(x)} key={x.office+x.code}>{x.name}<span>선택</span></button>)}</div>
 {notice&&<p className="alert-text">{notice}</p>}
 <h2>영양소 비교 기준</h2><div className="surface"><PillTabs options={[{value:'male' as const,label:'15–18세 남'},{value:'female' as const,label:'15–18세 여'}]} value={profile} onChange={onProfile}/>
 <p className="note">이 설정은 공식 참고 기준을 선택하는 기능이며, 사용자의 실제 필요량이나 건강 상태를 판단하지 않습니다.</p></div>
 <h2>데이터 수집 상태</h2><div className="surface">{dataStatus?.data?<><div className="detail-line"><span>저장된 식단</span><strong>{nfmt(dataStatus.data.meals)}끼</strong></div><div className="detail-line"><span>기록 날짜</span><strong>{nfmt(dataStatus.data.days)}일</strong></div><div className="detail-line"><span>가장 오래된 기록</span><strong>{dataStatus.data.oldest||'—'}</strong></div><div className="detail-line"><span>최근 기록</span><strong>{dataStatus.data.newest||'—'}</strong></div><div className="detail-line"><span>최근 자동 수집</span><strong>{dataStatus.sync?.status==='ok'?'성공':dataStatus.sync?.status==='failed'?'실패':'이력 없음'}</strong></div>
 {dataStatus.backfill&&<p className="note">과거 급식 수집: {dataStatus.backfill.completed?'완료':'진행 중'} · 탐색 기준 {dataStatus.backfill.cursor}</p>}</>:<p className="quiet">데이터 수집 정보를 조회하고 있어요.</p>}
 <p className="note">기록은 DB에 유지됩니다. 자동 수집은 기본 학교를 중심으로 실행되며 다른 학교는 조회한 날짜가 저장돼요.</p></div>
 <p className="data-caption">School Meal · NEIS 기반 학교 식단 아카이브 · 2025 KDRI</p></section>}
 </main>
 <nav className="bottom-nav" aria-label="기본 메뉴">{navs.map(n=><button key={n.tab} onClick={()=>setSection(n.tab)} className={section===n.tab?'on':''} aria-current={section===n.tab?'page':undefined}><span className="nav-icon" aria-hidden="true">{n.icon}</span><span>{n.label}</span></button>)}</nav>
 </div>;
}
