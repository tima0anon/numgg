// CONFETTI
const cc = document.getElementById('confetti');

const cctx = cc ? cc.getContext('2d') : null;

let confParts = [], confAnim = null;

export function resizeConf(){ if(cc){ cc.width = innerWidth; cc.height = innerHeight; } }

if(cc){ resizeConf(); addEventListener('resize', resizeConf); }

export function spawnConfetti(n, palette){
  if(!cctx) return;
  const W = cc.width, H = cc.height;
  const colors = palette || ['#ff2d55','#ff9500','#ffcc00','#34c759','#0a84ff','#af52de','#5ac8fa'];
  for(let i=0;i<n;i++){
    confParts.push({
      x: W/2 + (Math.random()-0.5)*W*0.4, y: H*0.35 + (Math.random()-0.5)*40,
      vx: (Math.random()-0.5)*9, vy: -6 - Math.random()*8,
      g: 0.32 + Math.random()*0.15, size: 5 + Math.random()*7,
      rot: Math.random()*Math.PI, vr: (Math.random()-0.5)*0.3,
      life: 90 + Math.random()*60, color: colors[~~(Math.random()*colors.length)],
      shape: Math.random()<0.5 ? 'rect' : 'circle'
    });
  }
  if(!confAnim) confAnim = requestAnimationFrame(tickConf);
}

export function tickConf(){
  if(!cctx){ confAnim = null; return; }
  const W = cc.width, H = cc.height;
  cctx.clearRect(0,0,W,H);
  for(let i=confParts.length-1;i>=0;i--){
    const p = confParts[i];
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vx *= 0.99; p.life--;
    cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot);
    cctx.fillStyle = p.color;
    cctx.globalAlpha = Math.max(0, Math.min(1, p.life/60));
    if(p.shape === 'rect') cctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
    else { cctx.beginPath(); cctx.arc(0,0,p.size/2,0,Math.PI*2); cctx.fill(); }
    cctx.restore();
    if(p.life <= 0 || p.y > H + 40) confParts.splice(i,1);
  }
  if(confParts.length) confAnim = requestAnimationFrame(tickConf);
  else { cctx.clearRect(0,0,W,H); confAnim = null; }
}

export function flashScreen(){ const el = document.getElementById('flash'); if(!el) return; el.classList.add('on'); setTimeout(()=>el.classList.remove('on'), 220); }
