/** NEIS 음식명 정규화 및 투명한 규칙 기반 분류. 원문은 별도로 보존. */
export type MenuCategory='밥·죽'|'국·찌개'|'면'|'육류·달걀'|'해산물'|'채소·반찬'|'김치'|'과일'|'유제품'|'빵·디저트'|'음료'|'기타';
export function cleanDisplayName(raw:string):string{
 return raw.replace(/<[^>]+>/g,'').replace(/\(\s*\d+(?:[.,]\s*\d+)*\s*\)/g,'').replace(/[★☆*]/g,'').replace(/\s+/g,' ').trim();
}
export function splitMenuItems(menu:string[]):string[]{
 return menu.flatMap(raw=>cleanDisplayName(raw).split(/\s*\/\s*/)).map(x=>x.trim()).filter(Boolean);
}
export function canonicalMenu(raw:string):string{
 return cleanDisplayName(raw).replace(/\((?:국내산|국산|수입산|외국산|친환경|유기농)[^)]*\)/g,'').replace(/[\[\]{}]/g,'').replace(/\s+/g,'').replace(/[.,!~]/g,'').trim();
}
export function menuCategory(name:string):MenuCategory{
 const n=canonicalMenu(name);
 if(/김치|깍두기|겉절이|동치미/.test(n))return '김치';
 if(/(국수|라멘|우동|쌀국수|스파게티|파스타|쫄면|비빔면|냉면|짬뽕|짜장면|메밀면)/.test(n))return '면';
 if(/(국$|국\b|찌개|탕$|해장국|떡국|스프|미역국)/.test(n))return '국·찌개';
 if(/(밥|리조또|죽|덮밥|볶음밥|카레라이스|주먹밥)/.test(n))return '밥·죽';
 if(/(과일|사과|바나나|귤|포도|배$|수박|멜론|딸기|파인애플|황도|키위|토마토)/.test(n))return '과일';
 if(/(우유|요구르트|요플레|치즈|요거트)/.test(n))return '유제품';
 if(/(주스|쥬스|에이드|음료|식혜|콜라|차$)/.test(n))return '음료';
 if(/(빵|케이크|쿠키|머핀|과자|파이|푸딩|아이스크림|모찌|와플|도넛)/.test(n))return '빵·디저트';
 if(/(고등어|갈치|새우|오징어|명태|생선|연어|참치|조기|어묵|게살|해물|해산물|가자미)/.test(n))return '해산물';
 if(/(닭|돼지|쇠고기|소고기|한우|갈비|불고기|제육|오리|족발|스테이크|소시지|소세지|돈까스|치킨|계란|달걀|햄|장조림)/.test(n))return '육류·달걀';
 if(/(나물|샐러드|무침|시금치|콩나물|숙주|오이|호박|감자|가지|두부|김$|볶음)/.test(n))return '채소·반찬';
 return '기타';
}
export function parseMenu(raw:string):{raw_name:string;normalized_name:string;category:MenuCategory;item_order:number}[]{
 return splitMenuItems(raw.split('\n')).map((name,index)=>({raw_name:name,normalized_name:canonicalMenu(name),category:menuCategory(name),item_order:index}));
}
