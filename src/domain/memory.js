export const recentPlates = [];

export function isRecentPlate(p, f){ for(let i=0;i<recentPlates.length;i++) if(recentPlates[i].plate===p && recentPlates[i].flag===f) return true; return false; }

export function rememberPlate(p, f){ recentPlates.push({plate:p, flag:f}); if(recentPlates.length > 400) recentPlates.shift(); }
