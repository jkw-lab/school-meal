import {canonicalMenu} from './menu';

/** Common staples in the rank chart only. Other statistics and favorites remain unchanged.
 * No broad suffix rule: kimchi stew, kimchi fried rice and mixed rice dishes stay visible.
 */
const routineRice=/^(?:(?:흰|백미|쌀|잡곡|현미|찰현미|찹쌀|흑미|찰흑미|보리|찰보리|기장|차조|오곡|오색|혼합곡|수수|귀리|흰쌀|백|강황)밥|밥|추가밥|공기밥|흰죽|쌀죽|흰밥흰죽)$/;
const routineKimchi=/^(?:배추김치|김치|깍두기|총각김치|열무김치|백김치|파김치|석박지|동치미|보쌈김치|깻잎김치|나박김치|갓김치|배추겉절이|무김치|겉절이|오이소박이|알타리김치|깍두기김치)$/;
export function isRoutineMenu(name:string):boolean{
 const n=canonicalMenu(name);
 return routineRice.test(n)||routineKimchi.test(n);
}
