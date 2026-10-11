export const rnd = a => a[~~(Math.random()*a.length)];

export const rndLetter = l => l[~~(Math.random()*l.length)];

export const rndDigits = n => { let s=''; for(let i=0;i<n;i++) s += ~~(Math.random()*10); return s; };

export const threeDiff = l => { const s = new Set(); while(s.size<3) s.add(rndLetter(l)); return [...s]; };

export function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=~~(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }

// EXCHANGE
export function randGauss(){ let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
