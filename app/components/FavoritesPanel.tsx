'use client';
import {useEffect,useMemo,useState} from 'react';
import {canonicalMenu} from '@/lib/menu';
import {kstDate} from '@/lib/time';
type School={office:string;code:string;name:string};
type MenuOption={name:string;category:string;count:number;latest:string|null};
type Occurrence={date:string;type:number};
type MenuStats={name:string;summary:{count:number;days:number;totalMeals:number;mealRate:number;firstSeen:string|null;lastSeen:string|null;averageGapDays:number|null;minGapDays:number|null;maxGapDays:number|null;averageMealKcal:number|null};
 byMeal:{type:number;count:number}[];byWeekday:{weekday:number;count:number}[];
 monthlyTrend:{month:string;count:number}[];appearances:Occurrence[];upcoming:Occurrence[];note:string};
const mealTypes=['','아침','점심','저녁'];
const weekdays=['일','월','화','수','목','금','토'];
const weekday=(date:string)=>weekdays[new Date(date+'T12:00:00Z').getUTCDay()];
const num=(n:number|null|undefined,digits=0)=>n===null||n===undefined?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:digits});
function FavoriteChart({label,data}:{label:string;data:{label:string;count:number}[]}){
 const max=Math.max(1,...data.map(d=>d.count));
 return <div className="favorite-chart" aria-label={label}>{data.map((d,i)=><div className="favorite-chart-row" key={i}><span>{d.label}</span><div><span style={{width:(d.count/max*100)+'%'}}/></div><strong>{d.count}</strong></div>)}</div>;
}
export default function FavoritesPanel({school,favorites,onToggle,selectedMenu,onSelect}:{school:School;favorites:string[];onToggle:(menu:string)=>void;selectedMenu:string;onSelect:(menu:string)=>void}){
 const [query,setQuery]=useState(''),[searchResults,setSearchResults]=useState<MenuOption[]>([]),[searchError,setSearchError]=useState('');
 const [period,setPeriod]=useState('all'),[stats,setStats]=useState<MenuStats|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const favoritesOrdered=useMemo(()=>[...favorites].sort((a,b)=>a.localeCompare(b,'ko')),[favorites]);
 useEffect(()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>{
   const q=query.trim();
   const p=new URLSearchParams({office:school.office,code:school.code,q});
   fetch('/api/menu-search?'+p,{signal:controller.signal}).then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error||'메뉴 검색 실패');return data})
    .then(data=>{setSearchResults(data.menus||[]);setSearchError('')})
    .catch(e=>{if(e.name!=='AbortError')setSearchError(e.message)});
  },query?240:0);
  return()=>{clearTimeout(timeout);controller.abort()};
 },[query,school.office,school.code]);
 useEffect(()=>{
  if(!selectedMenu){setStats(null);setError('');return}
  const controller=new AbortController();setStats(null);setLoading(true);setError('');
  const p=new URLSearchParams({office:school.office,code:school.code,menu:selectedMenu,period});
  fetch('/api/menu-stats?'+p,{signal:controller.signal}).then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error||'통계 조회 실패');return data})
   .then(setStats).catch(e=>{if(e.name!=='AbortError')setError(e.message)})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[selectedMenu,period,school.office,school.code]);
 const currentlyFavorited=favorites.includes(canonicalMenu(selectedMenu));
 return <section>
  <div className="page-heading"><div><div className="eyebrow">MY MENU LIBRARY</div><h1>즐겨찾기</h1></div></div>
  <p className="quiet">좋아하는 메뉴를 저장하고, 과거 등장 기록과 식사 시간대별 통계를 확인해 보세요.</p>
  <h2>저장한 메뉴 <span className="favorite-count">{favorites.length}</span></h2>
  {favoritesOrdered.length===0?<div className="surface favorite-empty">아직 즐겨찾기한 메뉴가 없어요.<p className="note">식단 화면의 ☆을 누르거나 아래에서 메뉴를 검색해 추가할 수 있어요.</p></div>
  :<div className="favorite-chips">{favoritesOrdered.map(menu=><button key={menu} className={selectedMenu===menu?'selected':''} onClick={()=>onSelect(menu)}>{menu} <span aria-hidden="true">★</span></button>)}</div>}
  <h2>메뉴 검색</h2>
  <div className="surface favorite-search">
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="메뉴명 검색 (예: 닭갈비)" aria-label="메뉴명 검색"/>
   <div className="favorite-search-results">
    {searchError?<p className="alert-text">{searchError}</p>:searchResults.length===0?<p className="note">{query?'해당 메뉴가 아직 기록되지 않았어요.':'데이터에 기록된 인기 메뉴'}</p>
    :searchResults.slice(0,query?20:6).map(option=><div className="favorite-result" key={option.name}>
       <button className="favorite-menu-name" onClick={()=>onSelect(option.name)}>
        <strong>{option.name}</strong><small>{option.category} · {option.count}회 등장</small>
       </button>
       <button className={'favorite-star '+(favorites.includes(option.name)?'is-on':'')} aria-label={option.name+(favorites.includes(option.name)?' 즐겨찾기 해제':' 즐겨찾기 추가')}
        aria-pressed={favorites.includes(option.name)} onClick={()=>onToggle(option.name)}>{favorites.includes(option.name)?'★':'☆'}</button>
     </div>)}
   </div>
  </div>
  {selectedMenu&&<section aria-label="선택한 메뉴 분석">
   <div className="favorite-detail-head"><div><div className="eyebrow">MENU INSIGHTS</div><h2>{selectedMenu}</h2></div>
    <button className={'favorite-star favorite-detail-star '+(currentlyFavorited?'is-on':'')} aria-pressed={currentlyFavorited}
      aria-label={currentlyFavorited?'즐겨찾기 해제':'즐겨찾기 추가'} onClick={()=>onToggle(selectedMenu)}>{currentlyFavorited?'★':'☆'}</button>
   </div>
   <div className="favorite-period">{[{v:'30',s:'30일'},{v:'90',s:'90일'},{v:'365',s:'1년'},{v:'all',s:'전체'}].map(p=>
     <button key={p.v} aria-pressed={period===p.v} className={period===p.v?'active':''} onClick={()=>setPeriod(p.v)}>{p.s}</button>)}</div>
   {loading?<div className="surface loading-state">메뉴 기록을 분석하고 있어요…</div>
   :error?<div className="surface alert-text">{error}</div>
   :stats?<div>
    <div className="summary-grid favorite-summary">
     <div className="surface"><span>등장 횟수</span><strong>{num(stats.summary.count)}<small> 회</small></strong></div>
     <div className="surface"><span>급식 등장률</span><strong>{num(stats.summary.mealRate,1)}<small> %</small></strong></div>
    </div>
    <article className="surface">
     <div className="detail-line"><span>첫 등장</span><strong>{stats.summary.firstSeen||'기록 없음'}</strong></div>
     <div className="detail-line"><span>최근 등장</span><strong>{stats.summary.lastSeen||'기록 없음'}</strong></div>
     <div className="detail-line"><span>평균 재등장 간격</span><strong>{stats.summary.averageGapDays===null?'자료 부족':num(stats.summary.averageGapDays,1)+'일'}</strong></div>
     <div className="detail-line"><span>등장한 식단의 평균 열량</span><strong>{stats.summary.averageMealKcal===null?'자료 없음':num(stats.summary.averageMealKcal,1)+' kcal'}</strong></div>
     <p className="note">열량은 해당 음식을 포함한 <strong>급식 전체</strong>의 열량이며, 개별 메뉴 열량이 아니에요.</p>
    </article>
    <h2>아침 · 점심 · 저녁 등장 횟수</h2><div className="surface"><FavoriteChart label="식사별 등장 횟수" data={stats.byMeal.map(x=>({label:mealTypes[x.type],count:x.count}))}/></div>
    <h2>요일별 등장 횟수</h2><div className="surface"><FavoriteChart label="요일별 등장 횟수" data={stats.byWeekday.map(x=>({label:weekdays[x.weekday],count:x.count}))}/></div>
    {stats.monthlyTrend.length>0&&<><h2>월별 등장 추세</h2><div className="surface"><FavoriteChart label="월별 등장 횟수" data={stats.monthlyTrend.map(x=>({label:x.month.slice(2),count:x.count}))}/></div></>}
    {stats.upcoming.length>0&&<><h2>앞으로 예정된 급식</h2><div className="surface">{stats.upcoming.map((m,i)=><div className="detail-line" key={i}><span>{m.date} ({weekday(m.date)})</span><strong>{mealTypes[m.type]} 예정</strong></div>)}<p className="note">학교에서 공지한 예정 식단으로, 실제 제공 전에 변경될 수 있어요.</p></div></>}
    <h2>최근 등장 기록</h2><div className="surface">{stats.appearances.length?stats.appearances.map((m,i)=><div className="detail-line" key={i}><span>{m.date} ({weekday(m.date)})</span><strong>{mealTypes[m.type]}</strong></div>):<p className="quiet">선택한 기간에 아직 등장 기록이 없어요.</p>}</div>
    <p className="data-caption">{stats.note} · 오늘({kstDate()}) 이전 및 오늘의 기록만 과거 통계에 포함돼요.</p>
   </div>:null}
  </section>}
  <p className="data-caption">즐겨찾기는 이 기기의 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않으며, 브라우저 데이터를 삭제하면 초기화될 수 있어요.</p>
 </section>;
}
