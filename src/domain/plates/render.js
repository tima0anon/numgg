export function renderRealPlate(plate, flag, size){
  const p = (plate||'').trim();
  const sz = size==='lg'?' lg':size==='md'?' md':'';
  const flagImg = '<span class="rp-flag flag '+flag+'"></span>';
  if(flag==='ru'){ const m = p.match(/^([А-ЯЁ]\d{3}[А-ЯЁ]{2})\s(\d{2,3})$/); if(m) return '<span class="realplate rp-ru'+sz+'"><span class="rp-main">'+m[1]+'</span><span class="rp-side">'+flagImg+'<span class="rp-code">'+m[2]+'</span><span class="rp-rus">RUS</span></span></span>'; }
  if(flag==='by'){ const m = p.match(/^(\d{4})\s([А-ЯІ]{2})-(\d)$/); if(m) return '<span class="realplate rp-by'+sz+'"><span class="rp-main">'+m[1]+' '+m[2]+'</span><span class="rp-side">'+flagImg+'<span class="rp-code">'+m[3]+'</span><span class="rp-rus">BY</span></span></span>'; }
  if(flag==='cn'){ const m = p.match(/^(.{1})([A-Z])\s(\d{3,6})$/); if(m) return '<span class="realplate rp-cn'+sz+'"><span class="rp-main"><span class="rp-prov">'+m[1]+'</span>'+m[2]+' '+m[3]+'</span></span>'; }
  if(flag==='ua'){ const m = p.match(/^([А-ЯІЇЄ]{2})\s(\d{4})\s([А-ЯІЇЄ]{2})$/); if(m) return '<span class="realplate rp-ua'+sz+'"><span class="rp-side rp-side-left">'+flagImg+'<span class="rp-code">UA</span></span><span class="rp-main">'+m[1]+' '+m[2]+' '+m[3]+'</span></span>'; }
  if(flag==='us') return '<span class="realplate rp-us'+sz+'"><span class="rp-main">'+p+'</span></span>';
  return '<span class="realplate'+sz+'"><span class="rp-main">'+p+'</span></span>';
}
