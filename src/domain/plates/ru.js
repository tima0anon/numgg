import {
  BEAUTIFUL_COMMON,
  BEAUTIFUL_EPIC,
  BEAUTIFUL_RARE,
  GOOD_REGIONS,
  NORMAL_REGIONS,
  RU_ELITE,
  RU_LETTERS,
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
  if(rid==='legendary'){ const s=rnd(RU_ELITE.concat(['МММ','ХКХ','ВОО','КМР','МКМ','ННН','РРР','ЕЕЕ','ССС','ТТТ','УУУ','ФФФ','ХХХ','ЦЦЦ','ЧЧЧ','ШШШ','ЭЭЭ','ЮЮЮ','ЯЯЯ'])); const d=rnd(['001','002','003','005','007','077','111','222','333','444','555','666','777','888','999']); return { plate: s[0]+d+s.slice(1)+' '+rnd(['97','99','77','199','01','02','102','777','799']) }; }
  const l=rndLetter('АОЕСМКВНТРХ'), l2=rndLetter('АОЕСМКВНТРХ'), l3=rndLetter('АОЕСМКВНТРХ');
  const d=rnd(['001','002','003','005','007','077','111','222','333','444','555','666','777','888','999']);
  return { plate: l+d+l2+l3+' '+rnd(['97','99','77','199','01']) };
}
