'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PORT = Number(process.env.PORT) || 4000;
const OCR_BASE_URL = (process.env.OCR_BASE_URL || process.env.OCR_SERVICE_URL || 'http://localhost:8000')
  .replace(/\/ocr\/(label|plate|cart)\/?$/i, '')
  .replace(/\/+$/, '');
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 12000;
const DEMO_OTP = process.env.DEMO_OTP || '';
const FAST2SMS_API_KEY = (process.env.FAST2SMS_API_KEY || '').trim();

const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL_CANDIDATES = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
];

const SUPPORTED_LANGUAGES = ['English', 'Hindi', 'Bengali', 'Tamil', 'Marathi'];
const normLanguage = (lang) =>
  SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === String(lang || '').trim().toLowerCase()) || 'English';

const round1 = (n) => Math.round(n * 10) / 10;
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const normPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const timeIST = () =>
  new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
const RANK = { green: 0, amber: 1, red: 2 };
const worst = (a, b) => (RANK[a] >= RANK[b] ? a : b);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function loadJsonSafe(filename, fallback) {
  const p = path.resolve(path.join(__dirname, filename));
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`[data] Loaded ${filename}`);
    return data;
  } catch (e) {
    console.warn(`[data] ${filename} not found (${e.message}), using built-in defaults`);
    return fallback;
  }
}

const RULES = loadJsonSafe('health_rules.json', { conditions: {}, allergens: {}, bioBufferRules: { buffers: {} }, knownAdditives: [] });
const RAW_FAMILY = loadJsonSafe('demo_family.json', []);
const RAW_CART = loadJsonSafe('demo_cart.json', { items: [] });

function conditionKey(s) {
  const t = String(s).toLowerCase();
  if (t.includes('diabet')) return 'diabetes';
  if (t.includes('hypert') || /\bbp\b/.test(t)) return 'hypertension';
  if (t.includes('cholest')) return 'high_cholesterol';
  if (t.includes('heart')) return 'heart';
  if (t.includes('pcos') || t.includes('thyroid')) return 'pcos_thyroid';
  return null;
}

function allergenKey(s) {
  const t = String(s).toLowerCase();
  if (t.includes('peanut') || t.includes('groundnut') || t.includes('moongphali')) return 'peanuts';
  if (t.includes('tree nut') || t.includes('treenut') || /almond|cashew|walnut|pistachio|hazelnut|badam|kaju/.test(t)) return 'tree nuts';
  if (t.includes('soy')) return 'soy';
  if (t.includes('gluten') || t.includes('wheat') || t.includes('maida') || t.includes('atta')) return 'gluten';
  if (t.includes('lactose') || t.includes('dairy') || t.includes('milk') || t.includes('paneer')) return 'lactose';
  if (t.includes('shellfish') || /prawn|shrimp|crab|lobster/.test(t)) return 'shellfish';
  if (t.includes('egg')) return 'eggs';
  return null;
}

const ALLERGEN_LABELS = {
  peanuts: 'Peanuts',
  'tree nuts': 'Tree Nuts',
  gluten: 'Gluten',
  lactose: 'Lactose',
  soy: 'Soy',
  shellfish: 'Shellfish',
  eggs: 'Eggs',
};

const METRIC_TO_MACRO = { sugar: 'sugarG', satFat: 'satFatG', sodium: 'sodiumMg' };

/* ------------------------------------------------------------------ */
/*  Deterministic FSSAI Rules + Family Matrix                          */
/* ------------------------------------------------------------------ */
function runRules(profile, macros, ingredientsText, extraAllergens = []) {
  const conds = [...new Set((profile.conditions || []).map(conditionKey).filter(Boolean))];
  const userAllergens = new Set((profile.allergens || []).map(allergenKey).filter(Boolean));
  const findings = [];
  const detected = new Set();
  const triggeredConditions = new Set();
  const text = String(ingredientsText || '').toLowerCase();

  for (const [key, keywords] of Object.entries(RULES.allergens || {})) {
    const list = Array.isArray(keywords) ? keywords : keywords.keywords || [];
    if (list.some((k) => new RegExp(`\\b${escapeRe(k.toLowerCase())}\\b`).test(text))) {
      detected.add(key);
    }
  }
  extraAllergens.forEach((a) => {
    const k = allergenKey(a);
    if (k) detected.add(k);
  });

  for (const key of detected) {
    if (userAllergens.has(key)) {
      findings.push({ severity: 'red', text: `Contains ${ALLERGEN_LABELS[key] || key} (Allergy)` });
    }
  }

  const activeBlocks = conds.length
    ? conds.map((c) => RULES.conditions?.[c]).filter(Boolean)
    : RULES.general ? [RULES.general] : [];

  for (const block of activeBlocks) {
    const blockKey = conditionKey(block.label || '') || conds[0];
    for (const lim of block.limits || []) {
      const macroKey = METRIC_TO_MACRO[lim.metric] || lim.metric;
      const v = macros[macroKey];
      if (v === null || v === undefined) continue;
      const sev = v > lim.red ? 'red' : v > lim.amber ? 'amber' : null;
      if (sev) {
        if (blockKey) triggeredConditions.add(blockKey);
        findings.push({ severity: sev, text: `${round1(v)}${lim.unit} ${lim.label} (${block.label})` });
      }
    }
    for (const w of block.watchIngredients || []) {
      if (new RegExp(`\\b${escapeRe(w.toLowerCase())}\\b`).test(text)) {
        if (blockKey) triggeredConditions.add(blockKey);
        findings.push({ severity: 'amber', text: `Contains ${w} (watch ingredient for ${block.label})` });
        break;
      }
    }
  }

  let verdict = 'green';
  findings.forEach((f) => { verdict = worst(verdict, f.severity); });
  const top = [...new Set(findings.filter((f) => f.severity === verdict).map((f) => f.text))].slice(0, 2);
  const primaryAlert = verdict === 'green'
    ? 'Safe for your Health Shield.'
    : top.join(' & ') + '.';

  return { verdict, primaryAlert, detected: [...detected], findings, triggeredConditions: [...triggeredConditions] };
}

function getDefaultFamilyForUser(profile) {
  const rawMembers = Array.isArray(RAW_FAMILY) ? RAW_FAMILY : RAW_FAMILY.members || [];
  const otherMembers = rawMembers
    .filter((m) => String(m.relation || '').toLowerCase() !== 'self')
    .map((m, i) => ({
      id: m.id || `fam_${i + 1}`,
      memberName: m.memberName || 'Family Member',
      relation: m.relation ? m.relation[0].toUpperCase() + m.relation.slice(1) : 'Family',
      conditions: Array.isArray(m.conditions)
        ? m.conditions.map((c) => {
            const k = conditionKey(c);
            if (k === 'pcos_thyroid') return 'PCOS / Thyroid';
            if (k === 'hypertension') return 'Hypertension';
            if (k === 'high_cholesterol') return 'High Cholesterol';
            if (k === 'diabetes') return 'Diabetes';
            if (k === 'heart') return 'Heart Health';
            return c;
          })
        : [],
      allergens: Array.isArray(m.allergens)
        ? m.allergens.map((a) => ALLERGEN_LABELS[allergenKey(a)] || a)
        : [],
    }));

  return [
    {
      id: 'self',
      memberName: profile?.name ? `${profile.name.split(' ')[0]} (You)` : 'You',
      relation: 'Self',
      conditions: profile?.conditions || [],
      allergens: profile?.allergens || [],
    },
    ...otherMembers,
  ];
}

function evaluateFamily(familyMembers, macros, ingredientsText, extraAllergens = []) {
  return (familyMembers || []).map((member) => {
    const res = runRules(member, macros, ingredientsText, extraAllergens);
    return {
      id: member.id || member.memberName,
      memberName: member.memberName || 'Family Member',
      relation: member.relation || 'Family',
      verdict: res.verdict,
      reason: res.primaryAlert,
    };
  });
}

function buildBioBuffer(profile, verdict, triggeredConditions = []) {
  if (verdict === 'green') return null;
  const buffers = RULES.bioBufferRules?.buffers || {};
  const cond = triggeredConditions[0] || (profile.conditions || []).map(conditionKey).find(Boolean) || 'diabetes';

  if (cond === 'hypertension' || cond === 'heart') {
    const b = buffers.hypertension_sodium_buffer;
    return {
      title: b?.title || 'Blood Pressure Sodium Buffer',
      pairingTip: b?.steps?.[0] || 'Pair with 1 glass of tender coconut water or a potassium-rich banana today.',
      postMealAction: b?.steps?.[1] || 'Drink 2 extra glasses of plain water and keep your next meal low-salt.',
    };
  }
  if (cond === 'high_cholesterol') {
    const b = buffers.cholesterol_oil_buffer;
    return {
      title: b?.title || 'Cholesterol & Saturated Fat Buffer',
      pairingTip: b?.steps?.[0] || 'Follow up with warm lemon water and soluble fiber (rolled oats, sprouts, or isabgol).',
      postMealAction: b?.steps?.[1] || 'Avoid deep-fried or palmolein-rich foods for your remaining meals today.',
    };
  }
  const b = buffers.diabetes_spike_buffer;
  return {
    title: b?.title || 'Glucose & Insulin Spike Buffer',
    pairingTip: b?.steps?.[0] || 'Pre-load 1 tbsp soaked chia/flax seeds or 4-5 cucumber slices to slow glucose absorption.',
    postMealAction: b?.steps?.[1] || 'Take a 12-minute brisk walk starting 15 minutes after eating.',
  };
}

function buildVernacularScript(language, productName, verdict, primaryAlert, swapName) {
  const lang = normLanguage(language);
  const safe = verdict === 'green';
  const scripts = {
    English: safe
      ? `${productName} is safe for your health shield. You can enjoy it within your daily limits.`
      : `Caution: ${productName} is ${verdict.toUpperCase()} because ${primaryAlert} Try ${swapName} instead.`,
    Hindi: safe
      ? `${productName} aapke health shield ke liye surakshit hai. Aap ise santulit matra mein kha sakte hain.`
      : `Savdhaan: ${productName} aapke health shield ke liye ${verdict === 'red' ? 'asurakshit' : 'madhyam'} hai. Iske bajay ${swapName} lena behtar rahega.`,
    Bengali: safe
      ? `${productName} apnar health shield-er jonno nirapod. Apni nischinte khete paren.`
      : `Sabdhan: ${productName} apnar health shield-er jonno ${verdict === 'red' ? 'bipojjonok' : 'sotorkota dorkar'}. Er bodole ${swapName} khaoai bhalo.`,
    Tamil: safe
      ? `${productName} ungal aarokkiya shield-kku paadhukaappaanadhu.`
      : `Echarikkai: ${productName} ungal aarokkiya shield-kku paadhukaappatradhu. Idharku badhilaaga ${swapName} saappidungal.`,
    Marathi: safe
      ? `${productName} tumchya health shield sathi surakshit aahe.`
      : `Savdhan: ${productName} tumchya health shield sathi ${verdict === 'red' ? 'asurakshit' : 'madhyam'} aahe. Tyachyaaivaji ${swapName} khane changle rahil.`,
  };
  return { language: lang, text: scripts[lang] || scripts.English };
}

/* ------------------------------------------------------------------ */
/*  Profile & Daily Gap Maths + 12:00 AM IST Reset & 3-Day History     */
/* ------------------------------------------------------------------ */
function buildProfile(input, existing = {}) {
  const p = { ...existing, ...input };
  p.phone = normPhone(p.phone);
  p.conditions = Array.isArray(p.conditions) ? p.conditions : existing.conditions || [];
  p.allergens = Array.isArray(p.allergens) ? p.allergens : existing.allergens || [];
  p.preferredLanguage = normLanguage(input.preferredLanguage || existing.preferredLanguage || 'English');
  p.age = toNum(p.age);
  p.heightCm = toNum(p.heightCm ?? p.height);
  p.weightKg = toNum(p.weightKg ?? p.weight);
  const h = p.heightCm, w = p.weightKg;
  if (h && w) {
    const female = String(p.gender || '').toLowerCase().startsWith('f');
    const male = String(p.gender || '').toLowerCase().startsWith('m');
    const s = male ? 5 : female ? -161 : -78;
    const bmr = 10 * w + 6.25 * h - 5 * (p.age || 25) + s;
    const auto = {
      kcal: Math.round(bmr * 1.4),
      proteinG: Math.round(w * 1.0),
      fiberG: male ? 38 : female ? 25 : 31,
      ironMg: male ? 8 : female ? 18 : 13,
      addedSugarMaxG: 25,
    };
    p.goals = { ...auto, ...(existing.goals || {}), ...(input.targets || input.goals || {}) };
  } else {
    p.goals = p.goals || { kcal: 2000, proteinG: 60, fiberG: 25, ironMg: 18, addedSugarMaxG: 25 };
  }
  return p;
}

function buildProgress(profile, intake) {
  const g = profile.goals || {};
  const mk = (consumed, goal) => ({
    consumed: round1(consumed || 0),
    goal,
    percent: goal ? Math.min(999, Math.round(((consumed || 0) / goal) * 100)) : 0,
    need: round1(Math.max(0, goal - (consumed || 0))),
  });
  const sugar = mk(intake.sugar, g.addedSugarMaxG || 25);
  sugar.status = sugar.percent <= 60 ? 'safe' : sugar.percent <= 100 ? 'caution' : 'over';

  const loggedToday = [...(intake.items || [])].reverse().map((i, idx) => ({
    id: i.id || `meal_${idx}`,
    productName: i.productName || i.name || 'Scanned Item',
    verdict: (i.verdict || 'GREEN').toUpperCase(),
    time: i.time || i.at || '',
    date: i.date || todayIST(),
    nutrients: {
      protein: round1(i.nutrients?.protein || 0),
      fiber: round1(i.nutrients?.fiber || 0),
      iron: round1(i.nutrients?.iron || 0),
      sugar: round1(i.nutrients?.sugar || 0),
    },
  }));

  return {
    date: todayIST(),
    protein: mk(intake.protein, g.proteinG || 60),
    fiber: mk(intake.fiber, g.fiberG || 25),
    iron: mk(intake.iron, g.ironMg || 18),
    sugar,
    loggedToday,
    scanCount: (intake.items || []).length,
  };
}

const DEFAULT_MEALS = [
  { name: 'Moong Dal Chilla', emoji: '🥞', proteinG: 14.5, fiberG: 6.5, ironMg: 3.4, sugarG: 0, contains: [] },
  { name: 'Sprouts Chaat', emoji: '🥗', proteinG: 11.2, fiberG: 7.8, ironMg: 3.6, sugarG: 0.5, contains: [] },
  { name: 'Palak Dal', emoji: '🍲', proteinG: 12.4, fiberG: 7.2, ironMg: 4.9, sugarG: 0, contains: [] },
  { name: 'Ragi Dosa with Sambar', emoji: '🫓', proteinG: 8.6, fiberG: 7.4, ironMg: 4.1, sugarG: 0, contains: [] },
  { name: 'Roasted Makhana', emoji: '🥣', proteinG: 3.4, fiberG: 3.2, ironMg: 1.9, sugarG: 0, contains: [] },
];

function recommendMeals(profile, progress) {
  const avoid = new Set((profile.allergens || []).map(allergenKey).filter(Boolean));
  const diabetic = (profile.conditions || []).some((c) => conditionKey(c) === 'diabetes');
  const gaps = { protein: progress.protein, fiber: progress.fiber, iron: progress.iron };
  const mapKey = { protein: ['proteinG', 'Protein', 'g'], fiber: ['fiberG', 'Fiber', 'g'], iron: ['ironMg', 'Iron', 'mg'] };
  const pool = RULES.meals?.length ? RULES.meals : DEFAULT_MEALS;

  return pool
    .filter((m) => !(m.contains || []).some((a) => avoid.has(allergenKey(a) || a)) && !(diabetic && (m.sugarG || 0) > 5))
    .map((m) => {
      let best = null, bestScore = -1;
      for (const [k, [mk, label, unit]] of Object.entries(mapKey)) {
        const gapRatio = gaps[k].goal ? Math.max(0.05, gaps[k].need / gaps[k].goal) : 0;
        const score = gapRatio * ((m[mk] || 0) / (gaps[k].goal || 1));
        if (score > bestScore) { bestScore = score; best = { mk, label, unit }; }
      }
      return { m, bestScore, best };
    })
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 3)
    .map(({ m, best }) => ({
      name: m.name,
      emoji: m.emoji || '🍽',
      fills: `Fills ${best.label} Gap`,
      gain: `+${m[best.mk]}${best.unit} ${best.label}`,
    }));
}

/* ------------------------------------------------------------------ */
/*  In-Memory Storage (Date-Partitioned by IST 12:00 AM)               */
/* ------------------------------------------------------------------ */
const emptyIntake = () => ({ protein: 0, fiber: 0, iron: 0, sugar: 0, items: [] });
const users = new Map();
const familyMap = new Map();
const intakeMap = new Map();
const otpStore = new Map();
const reports = [];

const getFamily = (phone, profile) => {
  if (!familyMap.has(phone)) {
    familyMap.set(phone, getDefaultFamilyForUser(profile));
  }
  return familyMap.get(phone);
};

// Automatically starts fresh at 0 after 12:00 AM IST because key changes with todayIST()
const getIntake = (phone) => intakeMap.get(`${phone}|${todayIST()}`) || emptyIntake();

const addIntake = (phone, d, item) => {
  const k = `${phone}|${todayIST()}`;
  const cur = intakeMap.get(k) || emptyIntake();
  cur.protein = round1(cur.protein + d.protein);
  cur.fiber = round1(cur.fiber + d.fiber);
  cur.iron = round1(cur.iron + d.iron);
  cur.sugar = round1(cur.sugar + d.sugar);
  cur.items.push(item);
  intakeMap.set(k, cur);
  return cur;
};

// Returns the last 3 previous days' nutritional intake summaries for the user
function getIntakeHistory(phone, profile) {
  const today = todayIST();
  const sugarGoal = profile?.goals?.addedSugarMaxG || 25;
  const history = [];

  for (const [key, val] of intakeMap.entries()) {
    if (!key.startsWith(`${phone}|`)) continue;
    const datePart = key.split('|')[1];
    if (!datePart || datePart === today) continue;
    if ((val.items?.length || 0) === 0 && (val.protein || 0) === 0 && (val.sugar || 0) === 0) continue;

    history.push({
      date: datePart,
      protein: round1(val.protein || 0),
      fiber: round1(val.fiber || 0),
      iron: round1(val.iron || 0),
      sugar: round1(val.sugar || 0),
      sugarGoal,
      mealsCount: val.items?.length || 0,
      meals: (val.items || []).map((m) => m.productName || m.name),
    });
  }

  return history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  Hybrid Groq + Fast-Gemini Vision & Research                        */
/* ------------------------------------------------------------------ */
const NUM = '([0-9]+(?:\\.[0-9]+)?)';
const NUTRIENT_RE = {
  sugarG: new RegExp(`(?:added\\s+)?sugars?[^0-9\\n]{0,15}${NUM}\\s*g\\b`, 'i'),
  satFatG: new RegExp(`sat(?:urated)?\\.?\\s*fat[^0-9\\n]{0,10}${NUM}\\s*g\\b`, 'i'),
  proteinG: new RegExp(`protein[^0-9\\n]{0,10}${NUM}\\s*g\\b`, 'i'),
  fiberG: new RegExp(`(?:dietary\\s+)?fib(?:re|er)[^0-9\\n]{0,10}${NUM}\\s*g\\b`, 'i'),
  ironMg: new RegExp(`iron[^0-9\\n]{0,10}${NUM}\\s*mg\\b`, 'i'),
  sodiumMg: new RegExp(`sodium[^0-9\\n]{0,10}${NUM}\\s*mg\\b`, 'i'),
};
const MACRO_KEYS = Object.keys(NUTRIENT_RE);
const emptyMacros = () => Object.fromEntries(MACRO_KEYS.map((k) => [k, null]));

function parseNutritionFromText(text) {
  const out = emptyMacros();
  for (const k of MACRO_KEYS) {
    const m = String(text || '').match(NUTRIENT_RE[k]);
    if (m) out[k] = parseFloat(m[1]);
  }
  return out;
}

function canonMacros(src = {}) {
  const alias = {
    sugarG: ['sugarG', 'sugar_g', 'sugars', 'sugar', 'added_sugar', 'addedSugarG', 'totalSugarG'],
    satFatG: ['satFatG', 'sat_fat_g', 'saturated_fat', 'satFat', 'sat_fat'],
    proteinG: ['proteinG', 'protein_g', 'protein'],
    fiberG: ['fiberG', 'fiber_g', 'fibre_g', 'fiber', 'fibre', 'dietary_fiber'],
    ironMg: ['ironMg', 'iron_mg', 'iron'],
    sodiumMg: ['sodiumMg', 'sodium_mg', 'sodium'],
  };
  const out = emptyMacros();
  for (const [k, names] of Object.entries(alias)) {
    for (const n of names) {
      if (src[n] !== undefined && toNum(src[n]) !== null) { out[k] = toNum(src[n]); break; }
    }
  }
  return out;
}

const mergeMacros = (...list) => {
  const out = emptyMacros();
  for (const k of MACRO_KEYS) {
    for (const m of list) {
      if (m && m[k] !== null && m[k] !== undefined) { out[k] = m[k]; break; }
    }
  }
  return out;
};

async function callGroqChat(messages, model = GROQ_TEXT_MODEL) {
  const groqKey = (process.env.GROQ_API_KEY || '').trim();
  if (!groqKey) return null;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.15, response_format: { type: 'json_object' }, messages }),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`Groq HTTP ${r.status}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn(`[groq] ${model} fallback (${e.message})`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithGeminiFallback(parts) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set in backend .env');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  let lastErr;
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const res = await model.generateContent(parts);
      return res.response.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function splitDataUrl(b64) {
  const m = String(b64).match(/^data:(.+?);base64,(.*)$/s);
  return m ? { mime: m[1], data: m[2] } : { mime: 'image/jpeg', data: String(b64) };
}

async function callPythonOcr(imageBase64, endpointPath = '/ocr/label') {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), OCR_TIMEOUT_MS);
  try {
    const { data } = splitDataUrl(imageBase64);
    const r = await fetch(`${OCR_BASE_URL}${endpointPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: data }),
      signal: ctl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 422 || j.isFood === false) {
      const err = new Error(j.detail || j.reason || 'No food product or nutrition label detected in the image.');
      err.status = 422;
      throw err;
    }
    if (!r.ok) throw new Error(`OCR service HTTP ${r.status}`);
    if (endpointPath === '/ocr/cart') return j;
    const ing = Array.isArray(j.ingredients) ? j.ingredients.join(', ') : (j.ingredientsText || j.ingredients || '');
    return {
      productName: j.productName || j.product_name || null,
      ingredientsText: ing,
      macros: mergeMacros(canonMacros(j.macros || j.nutrition || j), parseNutritionFromText(ing)),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function hybridVisionFallback(imageBase64, mode = 'label') {
  const { mime, data } = splitDataUrl(imageBase64);
  let prompt;
  if (mode === 'cart') {
    prompt = `First check if this image shows a grocery shopping cart or food products. If it shows a selfie, face, or non-food screen, return ONLY {"isFood":false,"reason":"No grocery cart or food products detected."}.
Otherwise extract every food/beverage item in the cart and estimate per-serving macros and likely ingredients/allergens. Return ONLY JSON:
{"isFood":true,"platform":"Quick-Commerce","items":[{"productName":"...","quantity":1,"macros":{"sugarG":0,"satFatG":0,"proteinG":0,"fiberG":0,"ironMg":0,"sodiumMg":0},"ingredientsText":"comma-separated ingredients","detectedAllergens":["Peanuts"]}]}`;
  } else if (mode === 'plate') {
    prompt = `First check if this image actually shows edible food on a plate/bowl. If it shows a human face, selfie, room, or non-food object, return ONLY {"isFood":false,"reason":"No food plate detected. Point the camera at a meal plate."}.
Otherwise identify the Indian/home dish(es) and estimate nutrition per visible plate. Return ONLY JSON:
{"isFood":true,"productName":"dish name","ingredientsText":"comma-separated ingredients incl. oils, sweeteners, nuts, dairy","nutrition":{"sugarG":0,"satFatG":0,"proteinG":0,"fiberG":0,"ironMg":0,"sodiumMg":0}}`;
  } else {
    prompt = `First check if this image actually shows a packaged food/beverage product, nutrition table, or ingredient list. If it shows a human face, selfie, hand, wall, or non-food object, return ONLY {"isFood":false,"reason":"No food product or nutrition label detected. Point the camera at a food label."}.
Otherwise transcribe the product name, full ingredients list (including INS/E codes and 'may contain'), and per-serving nutrition accurately. Return ONLY JSON:
{"isFood":true,"productName":"...","ingredientsText":"...","nutrition":{"sugarG":0,"satFatG":0,"proteinG":0,"fiberG":0,"ironMg":0,"sodiumMg":0}}`;
  }

  let rawText = await callGroqChat(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } },
        ],
      },
    ],
    GROQ_VISION_MODEL
  );

  if (!rawText) {
    rawText = await generateWithGeminiFallback([{ inlineData: { mimeType: mime, data } }, { text: prompt }]);
  }

  const j = JSON.parse(String(rawText).replace(/```json|```/g, '').trim());
  if (j.isFood === false) {
    const err = new Error(j.reason || 'No food product or nutrition label detected in the image.');
    err.status = 422;
    throw err;
  }
  if (mode === 'cart') return j;
  return {
    productName: j.productName || null,
    ingredientsText: j.ingredientsText || '',
    macros: mergeMacros(canonMacros(j.nutrition), parseNutritionFromText(j.ingredientsText)),
  };
}

function localChemicals(text) {
  const t = String(text || '').toLowerCase();
  const out = [];
  for (const item of RULES.knownAdditives || []) {
    if ((item.match || []).some((m) => t.includes(m.toLowerCase()))) {
      out.push({ name: item.name, note: item.truth, risk: item.risk || 'amber' });
    }
  }
  return out;
}

const FAMILY_SWAPS = [
  { name: 'Roasted Makhana & Pumpkin Seeds Mix', emoji: '🥣', note: 'Nut-free · Soy-free · Low Sugar · Safe for Whole Family', allergens: [] },
  { name: 'Dry-Roasted Chana (Bhuna Chana)', emoji: '🫘', note: 'High Protein · Iron-Rich · Zero Added Sugar', allergens: [] },
  { name: 'Sprouts Chaat with Lemon & Coriander', emoji: '🥗', note: 'High Fiber · Low GI · Whole-Family Safe', allergens: [] },
];

function localIntersectionSwap(profile, familyMembers = [], sugar = 0) {
  const avoid = new Set((profile.allergens || []).map(allergenKey).filter(Boolean));
  familyMembers.forEach((m) => (m.allergens || []).forEach((a) => { const k = allergenKey(a); if (k) avoid.add(k); }));
  const s = FAMILY_SWAPS.find((x) => !x.allergens.some((a) => avoid.has(a))) || FAMILY_SWAPS[0];
  const extra = sugar > 5 ? ` · −${round1(Math.max(1, sugar - 2))}g Sugar` : '';
  return { name: s.name, emoji: s.emoji, note: `${s.note}${extra}`, safeForWholeFamily: true };
}

async function hybridResearch({ productName, ingredientsText, macros, profile, det, familyMatrix, language }) {
  const lang = normLanguage(language);
  const prompt = `You are NutriBite's food-safety researcher for Indian households. Use simple plain English.
PRODUCT: ${productName || 'Unknown'}
INGREDIENTS: ${ingredientsText || 'not provided'}
NUTRITION PER SERVING: ${JSON.stringify(macros)}
USER CONDITIONS: ${JSON.stringify(profile.conditions || [])}
USER ALLERGENS: ${JSON.stringify(profile.allergens || [])}
DETERMINISTIC FINDINGS: ${JSON.stringify(det.findings)}
WHOLE FAMILY MATRIX: ${JSON.stringify(familyMatrix)}
VOICE LANGUAGE: ${lang}

Return ONLY JSON:
{
  "containsAllergens": ["Peanuts"],
  "chemicals": [{"name":"","note":"","risk":"red|amber|green"}],
  "swap": {"name":"","emoji":"🥣","note":"","safeForWholeFamily":true},
  "bioBuffer": {"title":"","pairingTip":"","postMealAction":""},
  "vernacularScript": {"language":"${lang}","text":"10-second spoken summary in ${lang}"}
}`;

  let rawText = await callGroqChat([{ role: 'user', content: prompt }], GROQ_TEXT_MODEL);
  if (!rawText) {
    rawText = await generateWithGeminiFallback(prompt);
  }
  return JSON.parse(String(rawText).replace(/```json|```/g, '').trim());
}

/* ------------------------------------------------------------------ */
/*  Express Routes                                                     */
/* ------------------------------------------------------------------ */
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    ocrBaseUrl: OCR_BASE_URL,
    dateIST: todayIST(),
    timeIST: timeIST(),
  });
});

// 1. Send OTP
app.post('/api/auth/send-otp', (req, res) => {
  const phone = normPhone(req.body.phone);
  const purpose = req.body.purpose || 'login';
  if (phone.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });

  const exists = users.has(phone);
  if (purpose === 'signup' && exists) {
    return res.status(409).json({ error: 'This mobile number is already registered. Please Log In instead.' });
  }
  if (purpose === 'login' && !exists) {
    return res.status(404).json({ error: `No account found for +91 ${phone}. Please Create Account / Sign Up first.` });
  }

  const otp = DEMO_OTP || String(1000 + crypto.randomInt(9000));
  otpStore.set(phone, { otp, purpose, verified: false, expiresAt: Date.now() + 5 * 60 * 1000 });
  console.log(`[auth] ${purpose.toUpperCase()} OTP for +91 ${phone}: ${otp}`);
  res.json({ sent: true, devOtp: otp });
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const phone = normPhone(req.body.phone);
  const otp = String(req.body.otp || '').trim();
  const rec = otpStore.get(phone);
  if (!rec || Date.now() > rec.expiresAt) return res.status(400).json({ error: 'OTP expired or not sent. Click Send OTP again.' });
  if (rec.otp !== otp) return res.status(401).json({ error: 'Incorrect 4-digit OTP. Please try again.' });
  rec.verified = true;
  res.json({ verified: true });
});

// 3. Sign Up
app.post('/api/auth/signup', (req, res) => {
  const phone = normPhone(req.body.phone);
  if (phone.length !== 10) return res.status(400).json({ error: 'Valid 10-digit phone is required.' });
  if (users.has(phone)) return res.status(409).json({ error: 'Account already exists. Please Log In.' });

  const rec = otpStore.get(phone);
  if (!rec || !rec.verified) return res.status(401).json({ error: 'Please verify your mobile OTP first.' });
  otpStore.delete(phone);

  const profile = buildProfile(req.body);
  users.set(phone, profile);
  const familyMembers = getFamily(phone, profile);

  const intake = emptyIntake();
  const progress = buildProgress(profile, intake);
  res.json({
    token: crypto.randomBytes(24).toString('hex'),
    user: profile,
    intake,
    progress,
    intakeHistory: [],
    suggestedMeals: recommendMeals(profile, progress),
    familyMembers,
  });
});

// 4. Login
app.post('/api/auth/login', (req, res) => {
  const phone = normPhone(req.body.phone);
  const otp = String(req.body.otp || '').trim();
  const profile = users.get(phone);
  if (!profile) return res.status(404).json({ error: `No account found for +91 ${phone}. Please Sign Up first.` });

  const rec = otpStore.get(phone);
  if (!rec || Date.now() > rec.expiresAt) return res.status(400).json({ error: 'OTP expired. Request a new OTP.' });
  if (rec.otp !== otp) return res.status(401).json({ error: 'Incorrect 4-digit OTP.' });
  otpStore.delete(phone);

  const intake = getIntake(phone);
  const progress = buildProgress(profile, intake);
  const intakeHistory = getIntakeHistory(phone, profile);
  const familyMembers = getFamily(phone, profile);
  res.json({
    token: crypto.randomBytes(24).toString('hex'),
    user: profile,
    intake,
    progress,
    intakeHistory,
    suggestedMeals: recommendMeals(profile, progress),
    familyMembers,
  });
});

// 5. Update Profile
app.post('/api/profile', (req, res) => {
  const body = req.body.profile || req.body;
  const phone = normPhone(body.phone);
  const existing = users.get(phone);
  if (!existing) return res.status(404).json({ error: 'User profile not found.' });

  const updated = buildProfile(body, existing);
  users.set(phone, updated);

  // Keep 'self' member in sync
  const fam = getFamily(phone, updated).map((m) =>
    m.id === 'self'
      ? { ...m, memberName: `${updated.name.split(' ')[0]} (You)`, conditions: updated.conditions, allergens: updated.allergens }
      : m
  );
  familyMap.set(phone, fam);

  const progress = buildProgress(updated, getIntake(phone));
  const intakeHistory = getIntakeHistory(phone, updated);
  res.json({
    user: updated,
    profile: updated,
    progress,
    intakeHistory,
    suggestedMeals: recommendMeals(updated, progress),
    familyMembers: fam,
  });
});

// 6. Family Shield Endpoints
app.get('/api/family', (req, res) => {
  const phone = normPhone(req.query.phone);
  const profile = users.get(phone);
  res.json({ familyMembers: getFamily(phone, profile) });
});

app.post('/api/family', (req, res) => {
  const phone = normPhone(req.body.phone);
  const members = req.body.familyMembers;
  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: 'Provide at least one family member.' });
  }
  const cleaned = members.slice(0, 5).map((m, i) => ({
    id: m.id || `fam_${Date.now()}_${i}`,
    memberName: String(m.memberName || `Member ${i + 1}`).trim(),
    relation: String(m.relation || 'Family').trim(),
    conditions: Array.isArray(m.conditions) ? m.conditions : [],
    allergens: Array.isArray(m.allergens) ? m.allergens : [],
  }));
  familyMap.set(phone, cleaned);
  res.json({ familyMembers: cleaned });
});

// 7. Analyze Food Label or Plate (with Family Matrix + Bio-Buffer + Vernacular Voice)
app.post('/api/analyze', wrap(async (req, res) => {
  const { imageBase64, manualIngredientsText, isPlate = false, overrides = null, phone } = req.body;
  const normP = normPhone(phone);
  const storedUser = normP ? users.get(normP) : null;
  const profile = { ...(storedUser || {}), ...(req.body.userProfile || {}) };
  const familyMembers = Array.isArray(req.body.familyMembers) && req.body.familyMembers.length
    ? req.body.familyMembers
    : getFamily(normP, profile);
  const language = normLanguage(req.body.language || profile.preferredLanguage || 'English');

  let read = { productName: null, ingredientsText: '', macros: emptyMacros() };

  if (imageBase64 && !overrides) {
    let usedPython = false;
    try {
      read = await callPythonOcr(imageBase64, isPlate ? '/ocr/plate' : '/ocr/label');
      usedPython = true;
    } catch (e) {
      if (e.status === 422) return res.status(422).json({ error: e.message });
      console.warn(`[analyze] Python OCR unavailable (${e.message}) -> using Hybrid Vision`);
    }
    if (!usedPython) {
      try {
        read = await hybridVisionFallback(imageBase64, isPlate ? 'plate' : 'label');
      } catch (e) {
        if (e.status === 422) return res.status(422).json({ error: e.message });
        return res.status(502).json({ error: 'Vision servers are temporarily busy. Please tap Try Again.' });
      }
    }
  }

  if (manualIngredientsText) {
    read.ingredientsText = [read.ingredientsText, manualIngredientsText].filter(Boolean).join('\n');
    read.macros = mergeMacros(parseNutritionFromText(manualIngredientsText), read.macros);
  }

  if (overrides) {
    if (overrides.productName) read.productName = overrides.productName;
    if (overrides.ingredients !== undefined) read.ingredientsText = overrides.ingredients;
    read.macros = mergeMacros(canonMacros(overrides), read.macros);
  }

  const det = runRules(profile, read.macros, read.ingredientsText);
  const preFamily = evaluateFamily(familyMembers, read.macros, read.ingredientsText);

  let ai = null;
  try {
    ai = await hybridResearch({
      productName: read.productName,
      ingredientsText: read.ingredientsText,
      macros: read.macros,
      profile,
      det,
      familyMatrix: preFamily,
      language,
    });
  } catch (e) {
    console.warn(`[analyze] AI research fallback (${e.message})`);
  }

  const finalMacros = Object.fromEntries(MACRO_KEYS.map((k) => [k, read.macros[k] ?? 0]));
  const aiAllergens = Array.isArray(ai?.containsAllergens) ? ai.containsAllergens : [];
  const fin = runRules(profile, finalMacros, read.ingredientsText, aiAllergens);
  const familyMatrix = evaluateFamily(familyMembers, finalMacros, read.ingredientsText, aiAllergens);

  const chemicals = (Array.isArray(ai?.chemicals) ? ai.chemicals : [])
    .filter((c) => c && c.name)
    .map((c) => ({ name: String(c.name), note: String(c.note || c.truth || ''), risk: ['red', 'amber', 'green'].includes(c.risk) ? c.risk : 'amber' }));

  for (const kc of localChemicals(read.ingredientsText)) {
    if (!chemicals.some((c) => c.name.toLowerCase().includes(kc.name.toLowerCase().slice(0, 6)))) {
      chemicals.push(kc);
    }
  }
  chemicals.sort((a, b) => RANK[b.risk] - RANK[a.risk]);

  let verdict = fin.verdict;
  let detail = fin.primaryAlert;
  const redChem = chemicals.find((c) => c.risk === 'red');
  if (verdict === 'green' && redChem) {
    verdict = 'amber';
    detail = `Contains ${redChem.name}, an additive worth limiting.`;
  }

  const productName = read.productName || (isPlate ? 'Scanned Indian Plate' : 'Scanned Food Label');
  const swap = verdict === 'green'
    ? null
    : (ai?.swap?.name ? { emoji: '🥣', safeForWholeFamily: true, ...ai.swap } : localIntersectionSwap(profile, familyMembers, finalMacros.sugarG));

  const bioBuffer = verdict === 'green'
    ? null
    : (ai?.bioBuffer?.pairingTip ? ai.bioBuffer : buildBioBuffer(profile, verdict, fin.triggeredConditions));

  const vernacularScript = ai?.vernacularScript?.text
    ? { language, text: ai.vernacularScript.text }
    : buildVernacularScript(language, productName, verdict, detail, swap?.name || 'Roasted Makhana');

  res.json({
    productName,
    verdict: verdict.toUpperCase(),
    detail,
    nutrients: {
      sugar: finalMacros.sugarG,
      satFat: finalMacros.satFatG,
      protein: finalMacros.proteinG,
      sodium: finalMacros.sodiumMg,
      fiber: finalMacros.fiberG,
      iron: finalMacros.ironMg,
    },
    ingredients: read.ingredientsText,
    chemicals,
    familyMatrix,
    swap,
    bioBuffer,
    vernacularScript,
  });
}));

// 8. Quick-Commerce Cart Audit Endpoint
app.post('/api/analyze-cart', wrap(async (req, res) => {
  const { imageBase64, useDemoCart = false, phone } = req.body;
  const normP = normPhone(phone);
  const storedUser = normP ? users.get(normP) : null;
  const profile = { ...(storedUser || {}), ...(req.body.userProfile || {}) };
  const familyMembers = Array.isArray(req.body.familyMembers) && req.body.familyMembers.length
    ? req.body.familyMembers
    : getFamily(normP, profile);

  let rawCart = RAW_CART;
  if (imageBase64 && !useDemoCart) {
    let usedPython = false;
    try {
      const pyCart = await callPythonOcr(imageBase64, '/ocr/cart');
      if (pyCart && Array.isArray(pyCart.items) && pyCart.items.length) {
        rawCart = pyCart;
        usedPython = true;
      }
    } catch (e) {
      if (e.status === 422) return res.status(422).json({ error: e.message });
    }
    if (!usedPython) {
      try {
        const aiCart = await hybridVisionFallback(imageBase64, 'cart');
        if (aiCart && Array.isArray(aiCart.items) && aiCart.items.length) {
          rawCart = aiCart;
        }
      } catch (e) {
        if (e.status === 422) return res.status(422).json({ error: e.message });
        return res.status(502).json({ error: 'Could not read cart screenshot. Try a clearer image or use Sample Blinkit Cart.' });
      }
    }
  }

  const swap = localIntersectionSwap(profile, familyMembers, 10);
  let safeCount = 0;

  const items = (rawCart.items || []).map((it, idx) => {
    const macros = canonMacros(it.macros || it.nutritionPerServing || it.estimatedMacros || {});
    const ing = it.ingredientsText || it.ingredientsSnippet || (Array.isArray(it.likelyIngredients) ? it.likelyIngredients.join(', ') : '');
    const allergens = it.detectedAllergens || it.allergens || it.likelyAllergens || [];

    const primary = runRules(profile, macros, ing, allergens);
    const familyMatrix = evaluateFamily(familyMembers, macros, ing, allergens);
    if (primary.verdict === 'green') safeCount++;

    return {
      id: it.cartItemId || `cart_${idx + 1}`,
      productName: it.productName || it.name || 'Grocery Item',
      quantity: it.quantity || 1,
      verdict: primary.verdict.toUpperCase(),
      detail: primary.primaryAlert,
      macros,
      familyMatrix,
      saferSwap: primary.verdict === 'green' ? null : swap,
    };
  });

  const totalItems = items.length;
  const cartHealthScore = totalItems ? Math.round((safeCount / totalItems) * 100) : 100;

  res.json({
    platform: rawCart.platform || rawCart.sourcePlatform || 'Blinkit / Zepto',
    cartHealthScore,
    totalItems,
    safeCount,
    flaggedCount: totalItems - safeCount,
    items,
  });
}));

// 9. Log Intake ("Yes, Update Daily Gaps" + Today's Last Meals + 3-Day History + activeBioBuffer)
app.post('/api/log-intake', (req, res) => {
  const phone = normPhone(req.body.phone);
  const profile = users.get(phone);
  if (!profile) return res.status(404).json({ error: 'User profile not found.' });

  const n = req.body.nutrients || req.body.macros || {};
  const d = {
    protein: toNum(n.protein ?? n.proteinG) || 0,
    fiber: toNum(n.fiber ?? n.fiberG) || 0,
    iron: toNum(n.iron ?? n.ironMg) || 0,
    sugar: toNum(n.sugar ?? n.sugarG) || 0,
  };
  const verdict = String(req.body.verdict || 'GREEN').toLowerCase();
  const activeBioBuffer = (verdict === 'red' || verdict === 'amber')
    ? (req.body.bioBuffer || buildBioBuffer(profile, verdict))
    : null;

  const productName = req.body.productName || 'Scanned Item';
  const intake = addIntake(phone, d, {
    id: `meal_${Date.now()}`,
    name: productName,
    productName,
    verdict: verdict.toUpperCase(),
    time: timeIST(),
    at: timeIST(),
    date: todayIST(),
    nutrients: d,
  });
  const progress = buildProgress(profile, intake);
  const intakeHistory = getIntakeHistory(phone, profile);
  res.json({
    intake,
    progress,
    intakeHistory,
    suggestedMeals: recommendMeals(profile, progress),
    activeBioBuffer,
  });
});

// 10. Report Label Misread
app.post('/api/report', (req, res) => {
  reports.push({ ...req.body, at: new Date().toISOString() });
  res.json({ ok: true });
});

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[server error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[NutriBite] API v2.0 ready -> http://localhost:${PORT} (IST Date: ${todayIST()})`);
  console.log(`  Hybrid AI: Groq=${process.env.GROQ_API_KEY ? 'READY' : 'OFF'} | Gemini=${process.env.GEMINI_API_KEY ? 'READY' : 'OFF'} | Family + Cart + BioBuffer + Voice ACTIVE`);
});