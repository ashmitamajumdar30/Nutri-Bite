import { API_BASE_URL } from './config.js';

export const CONDITIONS = ['Diabetes', 'Hypertension', 'High Cholesterol', 'Heart Health', 'PCOS / Thyroid', 'No Conditions'];
export const ALLERGIES = ['Peanuts', 'Gluten', 'Lactose', 'Tree Nuts', 'Soy', 'Shellfish', 'Eggs'];
export const ZERO = { protein: 0, fiber: 0, iron: 0, sugar: 0, items: [] };

/* ---------------------------------------------------------------- API */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, body) {
  let res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Cannot reach the NutriBite server at ${API_BASE_URL}. Is the backend running?`, 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(data.error || data.message || `Request failed (${res.status})`, res.status);
  return data;
}

/* -------------------------------------------------------------- Maths */
export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const r1 = (n) => Math.round(n * 10) / 10;

// BMR (Mifflin-St Jeor) x 1.4 activity; protein = 1 g per kg; fiber/iron by gender; sugar cap 25 g
export function calcTargets({ age, gender, height, weight }) {
  const a = num(age), h = num(height), w = num(weight);
  if (!a || !h || !w) return null;
  const s = gender === 'Male' ? 5 : gender === 'Female' ? -161 : -78;
  const bmr = 10 * w + 6.25 * h - 5 * a + s;
  const male = gender === 'Male', female = gender === 'Female';
  return {
    kcal: Math.round(bmr * 1.4),
    protein: Math.round(w * 1.0),
    fiber: male ? 38 : female ? 25 : 31,
    iron: male ? 8 : female ? 18 : 13,
    sugar: 25,
  };
}

export function bmi(height, weight) {
  const m = num(height) / 100;
  if (!m || !num(weight)) return null;
  const v = num(weight) / (m * m);
  const label = v < 18.5 ? 'Underweight' : v < 25 ? 'Normal' : v < 30 ? 'Overweight' : 'Obese';
  return { value: v.toFixed(1), label };
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NB';

/* ------------------------------------------------------ Suggested meals */
const MEALS = [
  { name: 'Sprouts Chaat', emoji: '🥗', protein: 6, fiber: 7, iron: 2, sugar: 1, allergens: [] },
  { name: 'Moong Chilla', emoji: '🥞', protein: 14, fiber: 4, iron: 2.5, sugar: 1, allergens: [] },
  { name: 'Palak Dal', emoji: '🍲', protein: 9, fiber: 5, iron: 4.5, sugar: 1, allergens: [] },
  { name: 'Roasted Chana Bowl', emoji: '🫘', protein: 11, fiber: 8, iron: 4, sugar: 1, allergens: [] },
  { name: 'Ragi Dosa', emoji: '🫓', protein: 5, fiber: 4, iron: 3.5, sugar: 1, allergens: [] },
  { name: 'Paneer Bhurji', emoji: '🧀', protein: 18, fiber: 2, iron: 2, sugar: 2, allergens: ['Lactose'] },
  { name: 'Egg Bhurji', emoji: '🍳', protein: 13, fiber: 1, iron: 2, sugar: 1, allergens: ['Eggs'] },
  { name: 'Dalia Upma', emoji: '🥣', protein: 6, fiber: 6, iron: 2, sugar: 2, allergens: ['Gluten'] },
  { name: 'Peanut Chikki', emoji: '🥜', protein: 8, fiber: 3, iron: 1.5, sugar: 14, allergens: ['Peanuts'] },
];
const NUT = [['protein', 'Protein', 'g'], ['fiber', 'Fiber', 'g'], ['iron', 'Iron', 'mg']];

// Local fallback: filter by allergies/diabetes, rank by the biggest % gap the meal can fill.
export function suggestMeals(user, intake, targets) {
  if (!targets) return [];
  const diabetic = user.conditions.includes('Diabetes');
  const safe = MEALS.filter(
    (m) => !m.allergens.some((a) => user.allergies.includes(a)) && !(diabetic && m.sugar > 5)
  );
  const scored = safe
    .map((m) => {
      let best = null;
      for (const [k, label, unit] of NUT) {
        const gap = Math.max(0, 1 - intake[k] / targets[k]);
        const score = gap * (m[k] / targets[k]);
        if (!best || score > best.score) best = { k, label, unit, gap, score };
      }
      return { m, ...best };
    })
    .sort((a, b) => b.gap - a.gap || b.score - a.score);
  const picked = [];
  const seen = new Set();
  for (const s of scored) if (!seen.has(s.k) && picked.length < 3) { seen.add(s.k); picked.push(s); }
  for (const s of scored) if (!picked.includes(s) && picked.length < 3) picked.push(s);
  return picked.map((s) => ({
    name: s.m.name,
    emoji: s.m.emoji,
    fills: `Fills ${s.label} Gap`,
    gain: `+${s.m[s.k]}${s.unit} ${s.label}`,
  }));
}

export function normalizeMeals(list) {
  if (!Array.isArray(list)) return null;
  return list.map((m) => ({
    name: m.name || m.title || 'Meal',
    emoji: m.emoji || '🍽',
    fills: m.fills || m.reason || m.tag || '',
    gain: m.gain || m.benefit || m.highlight || '',
  }));
}

/* ------------------------------------------- Deterministic shield scoring */
const AL = {
  Peanuts: [/peanut/i, /groundnut/i, /arachis/i],
  Gluten: [/wheat/i, /\bmaida\b/i, /gluten/i, /barley/i, /\brye\b/i, /semolina/i, /\bsuji\b/i, /\batta\b/i],
  Lactose: [/\bmilk/i, /lactose/i, /whey/i, /curd/i, /paneer/i, /(?<!cocoa |shea |nut )butter/i, /\bghee\b/i, /\bcream/i, /casein/i, /cheese/i, /yogh?urt/i],
  'Tree Nuts': [/almond/i, /cashew/i, /walnut/i, /pistachio/i, /hazelnut/i, /pecan/i, /\bbadam\b/i, /\bkaju\b/i],
  Soy: [/\bsoy/i, /\bsoya/i],
  Shellfish: [/shrimp/i, /prawn/i, /\bcrab\b/i, /lobster/i, /shellfish/i],
  Eggs: [/\begg(?!plant)/i, /albumin/i, /mayonnaise/i],
};
export function detectAllergens(text, user) {
  return (user.allergies || []).filter((a) => (AL[a] || []).some((re) => re.test(text || '')));
}

const CHEM = [
  { re: /tbhq|ins\s*319/i, name: 'TBHQ (INS 319)', risk: 'red', note: 'Synthetic petroleum-derived antioxidant used to extend shelf life; avoid frequent intake.' },
  { re: /tartrazine|ins\s*102/i, name: 'Tartrazine (INS 102)', risk: 'red', note: 'Synthetic yellow colour; can trigger sensitivity reactions in some people.' },
  { re: /sunset yellow|ins\s*110/i, name: 'Sunset Yellow (INS 110)', risk: 'red', note: 'Synthetic azo colour used for appearance only; best limited.' },
  { re: /high[- ]fructose|hfcs/i, name: 'High-Fructose Syrup', risk: 'red', note: 'Concentrated refined sugar syrup that spikes blood sugar fast.' },
  { re: /liquid glucose/i, name: 'Liquid Glucose', risk: 'amber', note: 'Hidden refined sugar syrup that triggers rapid blood glucose spikes.' },
  { re: /palmolein|palm oil|palm kernel/i, name: 'Palmolein / Palm Oil', risk: 'amber', note: 'Refined, saturated-fat-rich oil common in packaged snacks.' },
  { re: /maltodextrin/i, name: 'Maltodextrin', risk: 'amber', note: 'Fast-digesting starch that raises blood sugar quickly.' },
  { re: /invert sugar|corn syrup|dextrose/i, name: 'Hidden Sugars', risk: 'amber', note: 'Sugar by another name; counts towards your daily sugar cap.' },
  { re: /\bmsg\b|ins\s*621|monosodium/i, name: 'MSG (INS 621)', risk: 'amber', note: 'Flavour enhancer that also adds sodium.' },
  { re: /sodium benzoate|ins\s*211/i, name: 'Sodium Benzoate (INS 211)', risk: 'amber', note: 'Preservative; keep intake modest.' },
  { re: /caramel colou?r|ins\s*150/i, name: 'Caramel Colour (INS 150)', risk: 'amber', note: 'Added for colour only; adds no nutrition.' },
  { re: /aspartame|ins\s*951|sucralose|acesulfame|artificial (flavou?r|sweetener)/i, name: 'Artificial Sweetener / Flavour', risk: 'amber', note: 'Synthetic taste additive; limit if eaten daily.' },
  { re: /(^|[,(]\s*)sugar\b/i, name: 'Added Sugar', risk: 'amber', note: 'Listed as an ingredient. The earlier it appears, the more the product contains.' },
  { re: /soy lecithin|ins\s*322/i, name: 'Soy Lecithin (INS 322)', risk: 'green', note: 'Common plant emulsifier. Fine unless you avoid soy.' },
  { re: /citric acid|ins\s*330/i, name: 'Citric Acid (INS 330)', risk: 'green', note: 'Natural acidity regulator; low concern.' },
];
export function decodeIngredients(text = '') {
  const order = { red: 0, amber: 1, green: 2 };
  return CHEM.filter((c) => c.re.test(text))
    .map(({ name, risk, note }) => ({ name, risk, note }))
    .sort((a, b) => order[a.risk] - order[b.risk])
    .slice(0, 6);
}

const SWAPS = [
  { name: 'Roasted Makhana & Seeds Mix', emoji: '🥣', sugar: 2, tags: 'High fiber', allergens: [] },
  { name: 'Roasted Chana', emoji: '🫘', sugar: 1, tags: 'High protein', allergens: [] },
  { name: 'Sprouts Chaat', emoji: '🥗', sugar: 1, tags: 'Fiber & iron rich', allergens: [] },
];
function pickSwap(user, sugar) {
  const s = SWAPS.find((x) => !x.allergens.some((a) => user.allergies.includes(a))) || SWAPS[0];
  const allergyNote = user.allergies.length ? `${user.allergies.slice(0, 2).join(' & ')}-free` : 'No known allergens';
  const sugarNote = sugar > s.sugar ? ` · −${r1(sugar - s.sugar)}g Sugar` : '';
  return { name: s.name, emoji: s.emoji, note: `${allergyNote}${sugarNote} · ${s.tags}` };
}

export const VERDICT = {
  GREEN: { title: 'Safe for Your Shield', icon: '✅', box: 'bg-emerald-50 border-brand text-emerald-800', chip: 'bg-brand' },
  AMBER: { title: 'Caution: Eat in Moderation', icon: '⚠️', box: 'bg-amber-50 border-amber-400 text-amber-800', chip: 'bg-amber-500' },
  RED: { title: 'Unsafe for Your Shield', icon: '⛔', box: 'bg-red-50 border-red-600 text-red-700', chip: 'bg-red-600' },
};

export function scoreLocal(item, user) {
  const n = item.nutrients;
  const conds = user.conditions || [];
  const reasons = [];
  let level = 0;
  const bump = (l, t) => { level = Math.max(level, l); reasons.push(t); };

  detectAllergens(`${item.ingredients} ${item.productName}`, user).forEach((a) => bump(2, `Contains ${a} (Allergy)`));

  let sugarFlagged = false;
  if (conds.includes('Diabetes')) {
    if (n.sugar > 10) { bump(2, `${r1(n.sugar)}g Sugar (Diabetes spike)`); sugarFlagged = true; }
    else if (n.sugar > 5) { bump(1, `${r1(n.sugar)}g Sugar (Diabetes caution)`); sugarFlagged = true; }
  }
  if (!sugarFlagged && conds.includes('PCOS / Thyroid') && n.sugar > 10) { bump(1, `${r1(n.sugar)}g Sugar (PCOS / Thyroid)`); sugarFlagged = true; }
  if (!sugarFlagged && n.sugar > 15) bump(1, `${r1(n.sugar)}g Sugar (high)`);
  if (conds.includes('Hypertension')) {
    if (n.sodium > 400) bump(2, `${Math.round(n.sodium)}mg Sodium (Hypertension)`);
    else if (n.sodium > 200) bump(1, `${Math.round(n.sodium)}mg Sodium (Hypertension)`);
  }
  if (conds.includes('High Cholesterol') || conds.includes('Heart Health')) {
    if (n.satFat > 5) bump(2, `${r1(n.satFat)}g Saturated Fat (Heart health)`);
    else if (n.satFat > 3) bump(1, `${r1(n.satFat)}g Saturated Fat (Heart health)`);
  }

  const chemicals = decodeIngredients(item.ingredients);
  if (level === 0 && chemicals.some((c) => c.risk === 'red')) bump(1, 'Contains a synthetic additive worth limiting');

  const verdict = ['GREEN', 'AMBER', 'RED'][level];
  return {
    productName: item.productName,
    verdict,
    reasons,
    detail: reasons.length ? `${reasons.join(' & ')}.` : 'No conflicts with your allergies or health conditions found.',
    nutrients: n,
    ingredients: item.ingredients,
    chemicals,
    swap: level === 0 ? null : pickSwap(user, n.sugar),
  };
}

export const SAMPLE = {
  productName: 'Chocolate Peanut Bar',
  ingredients: 'Roasted Peanuts (28%), Sugar, Liquid Glucose, Palmolein Oil, Cocoa Solids, Soy Lecithin (INS 322), Antioxidant (TBHQ - INS 319)',
  nutrients: { sugar: 24, satFat: 8, sodium: 150, protein: 8, fiber: 2, iron: 1.2 },
};

/* ----------------------------------------- Normalise backend responses */
export function normalizeUser(u = {}) {
  return {
    name: u.name || u.fullName || '',
    phone: String(u.phone || ''),
    age: u.age ?? '',
    gender: u.gender || 'Female',
    height: u.height ?? u.heightCm ?? '',
    weight: u.weight ?? u.weightKg ?? '',
    conditions: u.conditions || u.medicalConditions || [],
    allergies: u.allergies || [],
  };
}

export function normalizeIntake(i) {
  if (!i || typeof i !== 'object') return null;
  return {
    protein: num(i.protein), fiber: num(i.fiber), iron: num(i.iron), sugar: num(i.sugar ?? i.addedSugar),
    items: Array.isArray(i.items) ? i.items.map((x) => (typeof x === 'string' ? { name: x } : x)) : [],
  };
}

export function normalizeResult(d) {
  const n = d.nutrients || d.nutrition || {};
  const swap = d.swap || d.saferSwap || null;
  return {
    productName: d.productName || d.product || d.name || 'Scanned item',
    verdict: String(d.verdict || d.shield?.verdict || 'AMBER').toUpperCase(),
    reasons: d.reasons || d.triggers || [],
    detail: d.detail || d.summary || d.headline || (d.reasons || d.triggers || []).join(' & '),
    nutrients: {
      sugar: num(n.sugar ?? n.sugars ?? n.addedSugar),
      satFat: num(n.satFat ?? n.saturatedFat),
      protein: num(n.protein),
      sodium: num(n.sodium),
      fiber: num(n.fiber),
      iron: num(n.iron),
    },
    ingredients: Array.isArray(d.ingredients) ? d.ingredients.join(', ') : d.ingredients || '',
    chemicals: (d.chemicals || d.additives || []).map((c) => ({
      name: c.name || c.code || 'Additive',
      risk: String(c.risk || c.level || 'amber').toLowerCase(),
      note: c.note || c.truth || c.description || '',
    })),
    swap: typeof swap === 'string' ? { name: swap, emoji: '🥣', note: '' } : swap && { emoji: '🥣', note: '', ...swap },
  };
}
