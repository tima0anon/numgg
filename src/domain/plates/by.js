import { BY_LETTERS } from './lexicon.js';
import {
  rnd,
  rndDigits,
  rndLetter,
} from '../random.js';

export function genBY(rid){
  if(rid==='common'){ let d,a=0; do{ d=rndDigits(4); a++; } while((/^(\d)\1\1\1$/.test(d)||d==='0001'||d==='1234')&&a<20); return { plate: d+' '+rndLetter(BY_LETTERS)+rndLetter(BY_LETTERS)+'-'+(1+~~(Math.random()*7)) }; }
  if(rid==='uncommon'){ const a=rndLetter(BY_LETTERS); const l=Math.random()<0.5?a+a:rndLetter(BY_LETTERS)+rndLetter(BY_LETTERS); const d=Math.random()<0.5?rnd(['2000','3000','4000','5000','6000','7000','8000','9000','1000']):rndDigits(4); return { plate: d+' '+l+'-'+(1+~~(Math.random()*7)) }; }
  if(rid==='rare'){ const d=rnd(['0001','0002','0003','0004','0005','0006','0007','0008','0009','0010','0100','1000','2000','3000','4000','5000','6000','7000','8000','9000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','1010','2020']); const a=rndLetter(BY_LETTERS), b=rndLetter(BY_LETTERS); return { plate: d+' '+a+b+'-'+(1+~~(Math.random()*7)) }; }
  if(rid==='epic'){ const p=rnd(['МВ','АА','ВВ','АВ','ММ','КК','ЕЕ','НН','ОО','РР','ТТ','СС','УУ','ФФ','ХХ']); const d=rnd(['0001','0002','0003','0004','0005','0007','0010','0070','0700','7000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','1000','2000','9000']); return { plate: d+' '+p+'-'+(Math.random()<0.7?7:1+~~(Math.random()*7)) }; }
  const p=rnd(['МВ','АА','ВВ','ЕЕ','СС']); const d=rnd(['0001','0002','0003','0004','0005','0007','1111','2222','3333','7777','8888','9999']);
  return { plate: d+' '+p+'-7' };
}
