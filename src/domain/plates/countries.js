import { genBY } from './by.js';
import { genCN } from './cn.js';
import { genRU } from './ru.js';
import { genUA } from './ua.js';
import { genUS } from './us.js';

export const COUNTRIES = [
  {id:'ru', name:'Россия', flag:'ru', gen: genRU},
  {id:'by', name:'Беларусь', flag:'by', gen: genBY},
  {id:'cn', name:'Китай', flag:'cn', gen: genCN},
  {id:'us', name:'США', flag:'us', gen: genUS},
  {id:'ua', name:'Украина', flag:'ua', gen: genUA}
];

export function extractRegion(plate, flag){
  if(flag==='ru'){ const m = plate.match(/\s(\d{2,3})$/); return m ? m[1] : null; }
  if(flag==='cn'){ const m = plate.match(/^(.)/); return m ? m[1] : null; }
  return null;
}
