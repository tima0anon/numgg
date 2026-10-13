export const SPIN_COST_ALL = 102000;

export const SPIN_COST_BY_COUNTRY = {
  all: 102000,
  ru: 130000,
  by: 39000,
  ua: 40000,
  us: 67000,
  cn: 245000
};

export const START_RUB = 250000;

export const EARN_BASE = 3000;

export const KEY = 'numdrop_save_v13';

export const SOCIAL_PAUSED = true;

export const THEME_KEY = 'numdrop_theme';

export const PAGE_KEY = 'numdrop_page_v13';

export const SOUND_KEY = 'numdrop_sound';

export const DAILY_KEY = 'numdrop_daily_v13';

export const HISTORY_MAX = 25;

export const MAX_CUSTOM_SPIN = 1000;

export const SESSION_MS = 60000;
export const OFFER_TTL_MS = 30000;

export const TICK_MS = 500;
export const SALE_ROLL_MS = 25000;

export const PROMO_REWARD = 200000;

export const PROMO_CODES = ['ЩЕДРОСТЬ', 'ПРОМОКОД'];

export const TEST_ADMIN_ON = '007123';

export const TEST_ADMIN_OFF = '035123';

export const ACCT_HIRE_COST = 2200000;

export const ACCT_AUTO_COST = 11000000;

export const UPGRADE_MAX = 8;

export function luckCost(level){
  return Math.round(150000 * Math.pow(1.75, level));
}

export function luckBump(level){
  return Math.min(0.32, level * 0.04);
}

export function autoCost(level){
  return Math.round(80000 * Math.pow(1.7, level));
}

export function autoPerSec(level){
  return level * 60;
}

export const NEWS_MAX_ACTIVE = 6;

export const NEWS_MIN_LIFE = 180000;

export const NEWS_LIFE_RANGE = 240000;

export const NEWS_CHECK_INTERVAL = 40000;
