export const COUNTRY_MULT = { ru:1.0, by:0.55, ua:0.70, cn:1.80, us:1.40 };

export const REGION_MULT = {'77':1.5,'97':1.8,'99':2.0,'199':1.7,'777':1.6,'799':1.5,'01':1.3,'02':1.3,'102':1.3};

export const COUNTRY_FLAGS = {ru:'🇷🇺 Россия',by:'🇧🇾 Беларусь',cn:'🇨🇳 Китай',us:'🇺🇸 США',ua:'🇺🇦 Украина'};

export function countryMult(f){ return COUNTRY_MULT[f] || 1.0; }

export function regionMult(r){ return (r && REGION_MULT[r]) ? REGION_MULT[r] : 1.0; }
