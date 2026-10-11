export function notify(text){
  const old = document.getElementById('notify'); if(old) old.remove();
  const el = document.createElement('div');
  el.id = 'notify'; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 400); }, 2400);
}
