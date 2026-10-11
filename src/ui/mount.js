import drop from '../markup/drop.html?raw';
import earn from '../markup/earn.html?raw';
import exchange from '../markup/exchange.html?raw';
import garage from '../markup/garage.html?raw';
import accountant from '../markup/accountant.html?raw';
import news from '../markup/news.html?raw';
import rank from '../markup/rank.html?raw';
import info from '../markup/info.html?raw';

const pages = [drop, earn, exchange, garage, accountant, news, rank, info];

export function mountPages() {
  const host = document.getElementById('pages');
  host.innerHTML = pages.join('\n');
}
