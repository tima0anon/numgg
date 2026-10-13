import {
  UA_ELITE_PAIRS,
  UA_LETTERS,
  UA_PRETTY_4,
} from './lexicon.js';
import {
  rnd,
  rndDigits,
  rndLetter,
} from '../random.js';

export function genUA(rid){
  if(rid==='common'){ let d,a=0; do{ d=rndDigits(4); a++; } while((/^(\d)\1\1\1$/.test(d)||d==='0001')&&a<20); return { plate: rndLetter(UA_LETTERS)+rndLetter(UA_LETTERS)+' '+d+' '+rndLetter(UA_LETTERS)+rndLetter(UA_LETTERS) }; }
  if(rid==='uncommon'){ const a=rndLetter(UA_LETTERS); const l1=Math.random()<0.5?a+a:rndLetter(UA_LETTERS)+rndLetter(UA_LETTERS); const l2=Math.random()<0.5?a+a:rndLetter(UA_LETTERS)+rndLetter(UA_LETTERS); const d=Math.random()<0.5?rnd(['1000','2000','3000','4000','5000','6000','7000','8000','9000','1100','2200','3300','4400','5500','6600','7700']):rndDigits(4); return { plate: l1+' '+d+' '+l2 }; }
  if(rid==='rare'){ const a=rndLetter(UA_LETTERS), b=rndLetter(UA_LETTERS); const d=rnd(UA_PRETTY_4); return { plate: a+b+' '+d+' '+b+a }; }
  if(rid==='epic'){ const a=rndLetter(UA_LETTERS); const d=rnd(UA_PRETTY_4); return { plate: a+a+' '+d+' '+a+a }; }
  const p=rnd(UA_ELITE_PAIRS); const d=rnd(['0001','0002','0003','0004','0005','0007','0008','0009','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234']);
  return { plate: p+' '+d+' '+p };
}
