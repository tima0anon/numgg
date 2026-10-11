export function haptic(p){ try { if(navigator.vibrate) navigator.vibrate(p); } catch(e){} }
