import {
  CN_LETTERS,
  CN_LUCKY_5,
  CN_PROVINCES,
} from './lexicon.js';
import {
  rnd,
  rndDigits,
  rndLetter,
} from '../random.js';

export function genCN(rid){
  const prestige=['京','沪','粤','津','渝','苏','浙']; const all=CN_PROVINCES;
  if(rid==='common'){ let d,a=0; do{ d=rndDigits(5); a++; } while((/^(\d)\1\1\1\1$/.test(d)||d==='00001')&&a<20); return { plate: rnd(all)+rndLetter(CN_LETTERS)+' '+d }; }
  if(rid==='uncommon'){ const d=Math.random()<0.5?rnd(['11000','22000','33000','44000','55000','66000','77000','88000','99000','10100','20200','30300','40400','50500','60600','70700','80800','90900']):rndDigits(5); return { plate: rnd(all)+rndLetter(CN_LETTERS)+' '+d }; }
  if(rid==='rare'){ const d=rnd(CN_LUCKY_5); return { plate: rnd(prestige.concat(all))+rndLetter(CN_LETTERS)+' '+d }; }
  if(rid==='epic' || rid==='legendary'){ const d=rnd(CN_LUCKY_5); return { plate: rnd(['京','沪','粤','川','苏','浙'])+rndLetter(CN_LETTERS)+' '+d }; }
  const d=rnd(['00001','88888','66666','99999','16888','18888','88888']);
  return { plate: rnd(['京','沪','粤'])+rndLetter('ABCDEFGH')+' '+d };
}
