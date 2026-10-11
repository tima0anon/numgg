export function copyText(t){
  try {
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t);
    else { const ta = document.createElement('textarea'); ta.value = t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    return true;
  } catch(e){ return false; }
}
