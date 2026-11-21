export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const CONDITIONS = [
  'Diabetes',
  'Hypertension',
  'High Cholesterol',
  'Heart Condition',
  'PCOS / Thyroid',
];

export const ALLERGENS = [
  'Peanuts',
  'Tree Nuts',
  'Gluten',
  'Lactose',
  'Soy',
  'Shellfish',
  'Eggs',
];

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
  <rect width="600" height="420" fill="#ffffff"/>
  <rect x="20" y="20" width="560" height="380" rx="12" fill="#f8fafc" stroke="#0f172a" stroke-width="4"/>
  <text x="40" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#0f172a">ChocoCrunch Peanut Energy Bar</text>
  <text x="40" y="95" font-family="Arial, sans-serif" font-size="16" fill="#475569">NUTRITION FACTS - Per Serving (40g Pack)</text>
  <line x1="40" y1="110" x2="560" y2="110" stroke="#0f172a" stroke-width="3"/>
  <text x="40" y="145" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Added Sugar: 24.0g</text>
  <text x="320" y="145" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Saturated Fat: 8.0g</text>
  <text x="40" y="180" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Protein: 8.0g</text>
  <text x="320" y="180" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Sodium: 180mg</text>
  <text x="40" y="215" font-family="Arial, sans-serif" font-size="18" fill="#0f172a">Dietary Fiber: 2.5g | Iron: 1.8mg</text>
  <line x1="40" y1="235" x2="560" y2="235" stroke="#94a3b8" stroke-width="2"/>
  <text x="40" y="270" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">INGREDIENTS:</text>
  <text x="40" y="298" font-family="Arial, sans-serif" font-size="15" fill="#1e293b">Roasted Peanuts (32%), Liquid Glucose, Sugar, Palmolein Oil,</text>
  <text x="40" y="324" font-family="Arial, sans-serif" font-size="15" fill="#1e293b">Milk Solids, Soy Lecithin (INS 322), Antioxidant (INS 319).</text>
  <text x="40" y="362" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#b91c1c">ALLERGEN ADVICE: Contains Peanuts, Milk, and Soy.</text>
</svg>`;

export const SAMPLE_PACKET_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SAMPLE_SVG)}`;