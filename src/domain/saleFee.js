export function saleCut(gross, bought){
  const amount = Math.max(0, Math.round(Number(gross) || 0));
  const cost = bought == null || bought === '' ? null : Number(bought);
  const profit = cost == null || !isFinite(cost) ? amount : amount - cost;
  let rate = 0;
  if(profit > 200000) rate = 0.22;
  else if(profit > 75000) rate = 0.15;
  const fee = Math.round(amount * rate);
  return { net: Math.max(0, amount - fee), fee, rate };
}

export function feeNote(fee){
  return fee > 0 ? ' · комиссия ' + fee.toLocaleString('ru-RU') + ' ₽' : '';
}
