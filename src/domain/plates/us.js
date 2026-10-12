import {
  US_LETTERS,
  US_PRETTY_4,
  US_VANITY_WORDS,
} from './lexicon.js';
import {
  rnd,
  rndDigits,
  threeDiff,
} from '../random.js';

export function genUS(rid){
  if(rid==='common'){ const arr=threeDiff(US_LETTERS); let d,a=0; do{ d=rndDigits(4); a++; } while((/^(\d)\1\1\1$/.test(d)||d==='0001')&&a<20); return { plate: arr[0]+arr[1]+arr[2]+' '+d }; }
  if(rid==='uncommon'){ const [x,y]=threeDiff(US_LETTERS); const l=Math.random()<0.5?x+y+x:x+x+y; const d=Math.random()<0.5?rnd(['2000','3000','4000','5000','6000','7000','8000','9000']):rndDigits(4); return { plate: l+' '+d }; }
  if(rid==='rare'){ const [x,y]=threeDiff(US_LETTERS); const l=Math.random()<0.5?x+x+y:x+y+x; return { plate: l+' '+rnd(US_PRETTY_4) }; }
  if(rid==='epic'){ const [x,y]=threeDiff(US_LETTERS); const l=Math.random()<0.5?x+y+x:x+x+y; return { plate: l+' '+rnd(US_PRETTY_4) }; }
  return { plate: rnd(US_VANITY_WORDS)+' '+rnd(US_PRETTY_4) };
}
