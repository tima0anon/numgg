const FLAGS = {
  ru: '<svg class="rp-flag" viewBox="0 0 9 6" aria-hidden="true"><rect width="9" height="6" fill="#fff"/><rect y="2" width="9" height="2" fill="#0039a6"/><rect y="4" width="9" height="2" fill="#d52b1e"/></svg>',
  ua: '<svg class="rp-flag" viewBox="0 0 9 6" aria-hidden="true"><rect width="9" height="3" fill="#0057b7"/><rect y="3" width="9" height="3" fill="#ffd700"/></svg>',
  by: '<svg class="rp-flag" viewBox="0 0 18 10" preserveAspectRatio="none" aria-hidden="true"><rect width="18" height="6.6" fill="#c8313e"/><rect y="6.6" width="18" height="3.4" fill="#4aa657"/><rect width="3.2" height="10" fill="#c8313e"/><g fill="#fff"><path d="M1.6.7 2.3 1.5 1.6 2.3.9 1.5zM1.6 2.8 2.3 3.6 1.6 4.4.9 3.6zM1.6 4.9 2.3 5.7 1.6 6.5.9 5.7zM1.6 7 2.3 7.8 1.6 8.6.9 7.8zM1.6 9.1 2.3 9.9 1.6 10.7.9 9.9z"/></g></svg>',
  us: '<svg class="rp-flag" viewBox="0 0 19 10" aria-hidden="true"><rect width="19" height="10" fill="#fff"/><g fill="#b22234"><rect width="19" height="1"/><rect y="2" width="19" height="1"/><rect y="4" width="19" height="1"/><rect y="6" width="19" height="1"/><rect y="8" width="19" height="1"/></g><rect width="8" height="5.2" fill="#3c3b6e"/><g fill="#fff"><circle cx="1.3" cy="1" r=".35"/><circle cx="3" cy="1" r=".35"/><circle cx="4.7" cy="1" r=".35"/><circle cx="6.4" cy="1" r=".35"/><circle cx="2.15" cy="2.1" r=".35"/><circle cx="3.85" cy="2.1" r=".35"/><circle cx="5.55" cy="2.1" r=".35"/><circle cx="1.3" cy="3.2" r=".35"/><circle cx="3" cy="3.2" r=".35"/><circle cx="4.7" cy="3.2" r=".35"/><circle cx="6.4" cy="3.2" r=".35"/></g></svg>',
  cn: '<svg class="rp-flag" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#de2910"/><polygon fill="#ffde00" points="6,2.2 7.5,6.6 3.2,3.9 8.8,3.9 4.5,6.6"/></svg>'
};

function esc(s){
  return String(s).replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]));
}

function glyphs(text){
  return [...String(text)].map(ch => {
    if(ch === '*') return '<i class="rp-wild">*</i>';
    if(ch === ' ') return '<i class="rp-gap"></i>';
    return '<i>'+esc(ch)+'</i>';
  }).join('');
}

function plate(flag, size, inner){
  const sz = size === 'lg' ? ' lg' : size === 'md' ? ' md' : '';
  return '<span class="realplate rp-'+flag+sz+'">'+inner+'</span>';
}

export function renderRealPlate(plateText, flag, size){
  const p = (plateText || '').trim();
  const flagSvg = FLAGS[flag] || '';

  if(flag === 'ru'){
    const m = p.match(/^([А-ЯЁ*][\d*]{3}[А-ЯЁ*]{2})\s([\d*]{2,3})$/);
    if(m){
      return plate('ru', size,
        '<span class="rp-main">'+glyphs(m[1])+'</span>'+
        '<span class="rp-side"><span class="rp-code">'+glyphs(m[2])+'</span><span class="rp-meta">'+flagSvg+'<span class="rp-rus">RUS</span></span></span>');
    }
  }
  if(flag === 'by'){
    const m = p.match(/^([\d*]{4})\s([А-ЯІ*]{2})-([\d*])$/);
    if(m){
      return plate('by', size,
        '<span class="rp-hoist">'+flagSvg+'</span>'+
        '<span class="rp-main">'+glyphs(m[1]+' '+m[2]+'-'+m[3])+'</span>');
    }
  }
  if(flag === 'ua'){
    const m = p.match(/^([А-ЯІЇЄ*]{2})\s([\d*]{4})\s([А-ЯІЇЄ*]{2})$/);
    if(m){
      return plate('ua', size,
        '<span class="rp-eu">'+flagSvg+'<span class="rp-rus">UA</span></span>'+
        '<span class="rp-main">'+glyphs(m[1]+' '+m[2]+' '+m[3])+'</span>');
    }
  }
  if(flag === 'cn'){
    const m = p.match(/^(.?)([A-Z*])\s([A-Z0-9*]{3,6})$/);
    if(m){
      return plate('cn', size,
        '<span class="rp-main"><span class="rp-prov">'+glyphs(m[1])+'</span><span class="rp-letter">'+glyphs(m[2])+'</span><i class="rp-dot">·</i>'+glyphs(m[3])+'</span>');
    }
  }
  if(flag === 'us'){
    return plate('us', size,
      '<span class="rp-top">'+flagSvg+'<span class="rp-rus">USA</span></span>'+
      '<span class="rp-main">'+glyphs(p)+'</span>');
  }
  return plate(flag || 'xx', size, '<span class="rp-main">'+glyphs(p)+'</span>');
}
