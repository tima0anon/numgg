import { SOUND_KEY } from '../config/constants.js';

// SOUND
export const Sound = (function(){
  let enabled = true, ctx = null;
  try { if(localStorage.getItem(SOUND_KEY) === 'off') enabled = false; } catch(e){}
  function getCtx(){ if(!ctx){ try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; } } if(ctx.state === 'suspended'){ try { ctx.resume(); } catch(e){} } return ctx; }
  function tone(freq, dur, type, vol, delay){
    if(!enabled) return;
    const c = getCtx(); if(!c) return;
    const t0 = c.currentTime + (delay || 0);
    try {
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = type || 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol || 0.07, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch(e){}
  }
  return {
    setEnabled(v){ enabled = v; try{ localStorage.setItem(SOUND_KEY, v?'on':'off'); }catch(e){} },
    isEnabled(){ return enabled; },
    click(){ tone(520, 0.05, 'square', 0.035); },
    drop(){ tone(400, 0.06, 'triangle', 0.05); tone(700, 0.05, 'triangle', 0.04, 0.05); },
    coin(){ tone(880, 0.09, 'sine', 0.07); tone(1320, 0.11, 'sine', 0.06, 0.07); },
    sell(){ tone(660, 0.09, 'sine', 0.055); tone(990, 0.09, 'sine', 0.05, 0.07); },
    buy(){ tone(540, 0.08, 'sine', 0.06); tone(820, 0.09, 'sine', 0.05, 0.07); },
    rare(){ [523,659,784,1046].forEach((f,i)=>tone(f, 0.14, 'sine', 0.075, i*0.08)); },
    epic(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f, 0.16, 'sine', 0.08, i*0.09)); },
    divine(){ [523,659,784,1046,1318,1568,2093].forEach((f,i)=>tone(f, 0.22, 'sine', 0.09, i*0.11)); },
    error(){ tone(180, 0.16, 'sawtooth', 0.06); },
    coin_big(){ [880,1100,1320,1760].forEach((f,i)=>tone(f, 0.13, 'sine', 0.075, i*0.06)); }
  };
})();
