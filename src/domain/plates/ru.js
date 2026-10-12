import {
  BEAUTIFUL_COMMON,
  BEAUTIFUL_EPIC,
  BEAUTIFUL_RARE,
  GOOD_REGIONS,
  NORMAL_REGIONS,
  RU_ELITE,
  RU_GRAIL_DIGITS,
  RU_LETTERS,
  RU_PRESTIGE_REGIONS,
  RU_REGIONS,
  RU_SPECIAL,
  containsSpecialSeries,
  isBeautifulDigits,
} from './lexicon.js';
import {
  rnd,
  rndDigits,
  rndLetter,
  threeDiff,
} from '../random.js';

export function genRU(rid){
  if(rid==='common'){ let l,d,a=0; do{ l=threeDiff(RU_LETTERS); d=rndDigits(3); a++; } while((isBeautifulDigits(d)||containsSpecialSeries(l))&&a<40); return { plate: l[0]+d+l[1]+l[2]+' '+rnd(NORMAL_REGIONS) }; }
  if(rid==='uncommon'){ let l,d,pretty,a=0; do { const [x,y]=threeDiff(RU_LETTERS); const pat=rnd([x+x+y,x+y+y,x+y+x,y+x+x]); l=[pat[0],pat[1],pat[2]]; pretty = Math.random()<0.18; d = pretty ? rnd(BEAUTIFUL_COMMON) : rndDigits(3); a++; } while(((!pretty && isBeautifulDigits(d)) || BEAUTIFUL_RARE.includes(d) || containsSpecialSeries(l)) && a<40); return { plate: l[0]+d+l[1]+l[2]+' '+rnd(RU_REGIONS) }; }
  if(rid==='rare'){ if(Math.random()<0.5){ const [x,y]=threeDiff(RU_LETTERS); const pat=rnd([x+x+y,x+y+y,x+y+x,y+x+x]); return { plate: pat[0]+rnd(BEAUTIFUL_RARE)+pat[1]+pat[2]+' '+(Math.random()<0.5?rnd(GOOD_REGIONS):rnd(RU_REGIONS)) }; } const s=rnd(RU_SPECIAL); const d=String(1+~~(Math.random()*999)).padStart(3,'0'); return { plate: s[0]+d+s[1]+s[2]+' '+rnd(RU_REGIONS) }; }
  if(rid==='epic'){ if(Math.random()<0.5){ const s=rnd(RU_SPECIAL); const d=rnd(['001','002','003','005','007','077','111','222','333','444','555','666','777','888','999']); return { plate: s[0]+d+s.slice(1)+' '+rnd(GOOD_REGIONS) }; } const l=rndLetter(RU_LETTERS); return { plate: l+rnd(BEAUTIFUL_EPIC)+l+l+' '+rnd(GOOD_REGIONS) }; }
  if(rid==='legendary'){ const s=rnd(RU_ELITE); const d=rnd(RU_GRAIL_DIGITS.concat(['111','222','333','444','555','666'])); return { plate: s[0]+d+s.slice(1)+' '+rnd(RU_PRESTIGE_REGIONS) }; }
  if(rid==='mythic'){ const s=rnd(['АМР','ЕКХ','СКР','ХКХ','ААА','МММ','ООО','АОО','ВОО','СОО']); const d=rnd(RU_GRAIL_DIGITS); return { plate: s[0]+d+s.slice(1)+' '+rnd(['77','97','99','199','777','799']) }; }
  const s=rnd(['АМР','ЕКХ','СКР','ААА','МММ']); const d=rnd(['001','007','777','888','000']);
  return { plate: s[0]+d+s.slice(1)+' '+rnd(['77','97','99']) };
}
