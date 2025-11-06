import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
};

const ASIN_URL = __ENV.ASIN_URL;
const SWITCHED_URL = __ENV.SWITCHED_URL;
const AMADEUS_URL = __ENV.AMADEUS_URL;

export default function () {
  if (ASIN_URL) {
    http.get(`${ASIN_URL}/search?category=electronics&keywords=headphones`);
  }
  if (SWITCHED_URL) {
    http.post(`${SWITCHED_URL}/deals`, JSON.stringify({ merchant: 'UtilityCo', category: 'utilities' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (AMADEUS_URL) {
    http.get(`${AMADEUS_URL}/inspiration?theme=beach&budget=medium`);
  }
  sleep(1);
}

