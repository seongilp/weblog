// Generates public/sample-orders.csv — a varied dataset that shows off the
// Summary view: continuous numerics, categoricals, a boolean, dates, and nulls.
// Run: node scripts/gen-sample.mjs
import { writeFileSync } from "node:fs";

const N = 20000;

// Deterministic PRNG so the sample is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x5a17ed);

const pick = (arr) => arr[(rng() * arr.length) | 0];
const weighted = (pairs) => {
  const r = rng();
  let acc = 0;
  for (const [v, w] of pairs) {
    acc += w;
    if (r <= acc) return v;
  }
  return pairs[pairs.length - 1][0];
};
// Approx normal via central limit, clamped.
const normal = (mean, std, min, max) => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += rng();
  const v = mean + ((s - 3) / 3) * std * 1.7;
  return Math.min(max, Math.max(min, v));
};

const GENDERS = [["M", 0.48], ["F", 0.48], ["Other", 0.04]];
const COUNTRIES = [
  ["US", 0.3], ["KR", 0.18], ["JP", 0.12], ["DE", 0.1], ["GB", 0.08],
  ["FR", 0.06], ["CA", 0.05], ["AU", 0.04], ["BR", 0.04], ["IN", 0.03],
];
const PAYMENTS = [
  ["Card", 0.6], ["PayPal", 0.2], ["BankTransfer", 0.1],
  ["Crypto", 0.05], ["GiftCard", 0.05],
];
const STATUS = [
  ["delivered", 0.7], ["shipped", 0.15], ["cancelled", 0.08],
  ["returned", 0.04], ["pending", 0.03],
];
const CATEGORIES = {
  Electronics: [50, 800],
  Clothing: [10, 150],
  Home: [15, 300],
  Books: [5, 40],
  Beauty: [8, 120],
  Sports: [12, 250],
  Toys: [6, 80],
  Grocery: [2, 30],
};
const CAT_NAMES = Object.keys(CATEGORIES);

const baseDate = Date.UTC(2024, 0, 1);
const spanMs = Date.UTC(2024, 11, 31) - baseDate;

const header =
  "order_id,order_date,customer_age,gender,country,category,payment_method,quantity,unit_price,total_amount,discount_pct,is_member,rating,shipping_days,status";
const lines = [header];

for (let i = 1; i <= N; i++) {
  const date = new Date(baseDate + rng() * spanMs).toISOString().slice(0, 10);
  const age = Math.round(normal(38, 12, 18, 80));
  const gender = weighted(GENDERS);
  const country = weighted(COUNTRIES);
  const category = pick(CAT_NAMES);
  const payment = weighted(PAYMENTS);
  const quantity = 1 + Math.floor(Math.pow(rng(), 2.2) * 10); // skew toward small
  const [lo, hi] = CATEGORIES[category];
  const unitPrice = +(lo + rng() * (hi - lo)).toFixed(2);
  const discount = rng() < 0.7 ? 0 : Math.round(5 + rng() * 45);
  const total = +(quantity * unitPrice * (1 - discount / 100)).toFixed(2);
  const isMember = rng() < 0.4 ? "true" : "false";
  // ~15% of ratings missing (null) to demonstrate the null% stat.
  const rating = rng() < 0.15 ? "" : 1 + Math.floor(Math.pow(rng(), 0.6) * 5);
  const shipping = 1 + Math.floor(rng() * 14);
  const status = weighted(STATUS);

  lines.push(
    `${i},${date},${age},${gender},${country},${category},${payment},${quantity},${unitPrice},${total},${discount},${isMember},${rating},${shipping},${status}`,
  );
}

writeFileSync("public/sample-orders.csv", lines.join("\n") + "\n");
console.log(`Wrote public/sample-orders.csv (${N} rows)`);
