import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Upload, Sparkles, ShieldCheck, XCircle,
  CheckCircle2, ArrowLeft, Plus, LogOut, User,
  ChevronRight, RefreshCw, Edit3,
  Users, Volume2, Share2, ShoppingCart, HeartPulse, Trash2,
  Play, Pause, Square, Clock, Calendar
} from 'lucide-react';
import { API_BASE_URL, CONDITIONS, ALLERGENS, SAMPLE_PACKET_IMAGE } from './config';

const LANGUAGES = [
  { code: 'English', label: 'English', native: 'English', locale: 'en-IN' },
  { code: 'Bengali', label: 'Bengali', native: 'বাংলা', locale: 'bn-IN' },
  { code: 'Hindi', label: 'Hindi', native: 'हिंदी', locale: 'hi-IN' },
];

// Natural everyday UI dictionary (English terms written in Bengali & Hindi script)
const UI_TEXT = {
  English: {
    activeShield: 'Active Health Shield',
    familyMembers: 'Family Members',
    hello: 'Hello',
    familyAndShield: 'Family & Shield',
    scanTitle: 'Scan a Label, Plate, or Cart',
    activeGuards: 'Active Guards',
    generalWellness: 'General FSSAI Wellness',
    openScanner: 'Open Scanner',
    protein: 'Protein',
    fiber: 'Dietary Fiber',
    iron: 'Iron',
    sugarCap: 'Added Sugar Cap',
    sugar: 'Sugar',
    satFat: 'Sat Fat',
    sodium: 'Sodium',
    allergySafeMeals: 'Allergy-Safe Meals to Fill Your Gaps',
    todaysMealsTitle: "Today's Last Meals",
    resetsAtMidnight: 'Resets at 12:00 AM',
    noMealsYet: 'No meals logged yet today. Scan a label or plate and tap "Yes, Update Daily Gaps".',
    historyTitle: 'Last 3 Days Nutritional History',
    noHistoryYet: 'Past daily summaries will appear here automatically after 12:00 AM.',
    mealsLogged: 'meals',
    dashboard: 'Dashboard',
    scannerHeader: 'NUTRIBITE SCANNER',
    aiActive: 'AI VISION ENGINE ACTIVE',
    shields: 'Shields',
    decodingCart: 'Auditing Quick-Commerce Cart...',
    decodingPlate: 'Decoding Your Meal Plate...',
    decodingLabel: 'Decoding Your Label...',
    decodingSub: 'Extracting nutrition values, scanning INS chemical codes, and checking all family shields...',
    imgCaptured: 'Image captured & camera paused',
    runningHybrid: 'Running Hybrid AI Vision & FSSAI Family Rule Engine...',
    cartAuditTitle: 'Cart Health Audit',
    cartScore: 'Cart Score',
    safe: 'Safe',
    scanAnotherCart: 'Scan Another Item or Cart',
    foodLabel: '📄 Food Label',
    plateSnap: '🍽 Plate Snap',
    cartAudit: '🛒 Cart Audit',
    startingCam: 'Starting camera...',
    uploadCart: 'Upload Blinkit / Zepto Cart Screenshot',
    uploadPhoto: 'Upload Label or Plate Photo',
    samplePacket: 'Sample Packet',
    sampleCart: 'Sample Blinkit Cart',
    scanRejected: 'Scan Rejected / Error',
    tryAgain: 'Try Again',
    fixMisread: 'Fix Misread',
    verdictHeader: 'Health Shield Verdict',
    voiceSummary: 'Family Voice Summary',
    play: 'Play',
    pause: 'Pause',
    resume: 'Resume',
    whatsapp: 'WhatsApp',
    familyMatrixTitle: 'One Scan, Whole Family Matrix',
    householdShields: 'Household Shields',
    nutritionPerServing: 'Nutrition Per Serving',
    chemicalTruth: 'Additive & Chemical Truth',
    saferSwapTitle: 'Safer Indian Alternative · Safe for Whole Family',
    eatAnywayTitle: 'Eat-It-Anyway Protocol',
    immediatePairing: '1. Immediate Pairing:',
    postMealRecovery: '2. Post-Meal Recovery:',
    scanAnother: 'Scan Another',
    addedToGaps: '✓ Added to Daily Gaps',
    updateDailyGaps: 'Yes, Update Daily Gaps',
    back: 'Back',
    editHealthShield: 'Edit Health Shield',
    appLanguageLabel: 'App & Voice Language',
    conditionsLabel: 'Medical Conditions',
    allergensLabel: 'Food Allergies',
    saveShield: 'Save Health Shield',
    myFamilyShields: 'My Family Shields',
    oneScanMatrix: 'One-Scan Matrix',
    addMemberHeader: 'Add Household Member',
    addToFamily: 'Add to Family Shield',
  },
  Bengali: {
    activeShield: 'অ্যাক্টিভ হেলথ শিল্ড',
    familyMembers: 'ফ্যামিলি মেম্বার',
    hello: 'হ্যালো',
    familyAndShield: 'ফ্যামিলি ও শিল্ড',
    scanTitle: 'লেবেল, প্লেট বা কার্ট স্ক্যান করুন',
    activeGuards: 'অ্যাক্টিভ গার্ডস',
    generalWellness: 'জেনারেল FSSAI ওয়েলনেস',
    openScanner: 'স্ক্যানার খুলুন',
    protein: 'প্রোটিন',
    fiber: 'ডায়েটারি ফাইবার',
    iron: 'আয়রন',
    sugarCap: 'অ্যাডেড সুগার ক্যাপ',
    sugar: 'সুগার',
    satFat: 'স্যাট ফ্যাট',
    sodium: 'সোডিয়াম',
    allergySafeMeals: 'আপনার ডেইলি গ্যাপ পূরণ করতে অ্যালার্জি-সেফ মিলস',
    todaysMealsTitle: 'আজকের লাস্ট মিলস',
    resetsAtMidnight: 'রাত ১২:০০ টায় রিসেট হয়',
    noMealsYet: 'আজ এখনো কোনো মিল লগ করা হয়নি। লেবেল বা প্লেট স্ক্যান করে ডেইলি গ্যাপ আপডেট করুন।',
    historyTitle: 'গত ৩ দিনের নিউট্রিশন হিস্ট্রি',
    noHistoryYet: 'রাত ১২:০০ টার পর আগের দিনের নিউট্রিশন সামারি এখানে অটোমেটিক সেভ হবে।',
    mealsLogged: 'মিলস',
    dashboard: 'ড্যাশবোর্ড',
    scannerHeader: 'নিউট্রিবাইট স্ক্যানার',
    aiActive: 'AI ভিশন ইঞ্জিন অ্যাক্টিভ',
    shields: 'শিল্ডস',
    decodingCart: 'কুইক-কমার্স কার্ট অডিট হচ্ছে...',
    decodingPlate: 'আপনার মিল প্লেট ডিকোড হচ্ছে...',
    decodingLabel: 'আপনার ফুড লেবেল ডিকোড হচ্ছে...',
    decodingSub: 'নিউট্রিশন ভ্যালু, INS কেমিক্যাল কোড এবং সব ফ্যামিলি শিল্ড চেক করা হচ্ছে...',
    imgCaptured: 'ইমেজ ক্যাপচার হয়েছে ও ক্যামেরা পজ করা হয়েছে',
    runningHybrid: 'হাইব্রিড AI ভিশন ও FSSAI ফ্যামিলি রুল ইঞ্জিন চলছে...',
    cartAuditTitle: 'কার্ট হেলথ অডিট',
    cartScore: 'কার্ট স্কোর',
    safe: 'সেফ',
    scanAnotherCart: 'অন্য আইটেম বা কার্ট স্ক্যান করুন',
    foodLabel: '📄 ফুড লেবেল',
    plateSnap: '🍽 প্লেট স্ন্যাপ',
    cartAudit: '🛒 কার্ট অডিট',
    startingCam: 'ক্যামেরা চালু হচ্ছে...',
    uploadCart: 'Blinkit / Zepto কার্ট স্ক্রিনশট আপলোড করুন',
    uploadPhoto: 'লেবেল বা প্লেটের ফটো আপলোড করুন',
    samplePacket: 'স্যাম্পল প্যাকেট',
    sampleCart: 'স্যাম্পল Blinkit কার্ট',
    scanRejected: 'স্ক্যান রিজেক্টেড / এরর',
    tryAgain: 'আবার চেষ্টা করুন',
    fixMisread: 'মিসরিড ঠিক করুন',
    verdictHeader: 'হেলথ শিল্ড ভার্ডিক্ট',
    voiceSummary: 'ফ্যামিলি ভয়েস সামারি',
    play: 'প্লে',
    pause: 'পজ',
    resume: 'রিজিউম',
    whatsapp: 'হোয়াটসঅ্যাপ',
    familyMatrixTitle: 'ওয়ান স্ক্যান, হোল ফ্যামিলি ম্যাট্রিক্স',
    householdShields: 'হাউসহোল্ড শিল্ডস',
    nutritionPerServing: 'নিউট্রিশন পার সার্ভিং',
    chemicalTruth: 'অ্যাডিটিভ ও কেমিক্যাল ট্রুথ',
    saferSwapTitle: 'সেফার ইন্ডিয়ান অল্টারনেটিভ · পুরো ফ্যামিলির জন্য সেফ',
    eatAnywayTitle: 'ইট-ইট-এনিওয়ে প্রোটোকল',
    immediatePairing: '১. ইমিডিয়েট পেয়ারিং:',
    postMealRecovery: '২. পোস্ট-মিল রিকভারি:',
    scanAnother: 'আরেকটি স্ক্যান করুন',
    addedToGaps: '✓ ডেইলি গ্যাপে অ্যাড হয়েছে',
    updateDailyGaps: 'হ্যাঁ, ডেইলি গ্যাপ আপডেট করুন',
    back: 'ব্যাক',
    editHealthShield: 'হেলথ শিল্ড এডিট করুন',
    appLanguageLabel: 'অ্যাপ ও ভয়েস ল্যাঙ্গুয়েজ',
    conditionsLabel: 'মেডিক্যাল কন্ডিশনস',
    allergensLabel: 'ফুড অ্যালার্জি',
    saveShield: 'হেলথ শিল্ড সেভ করুন',
    myFamilyShields: 'মাই ফ্যামিলি শিল্ডস',
    oneScanMatrix: 'ওয়ান-স্ক্যান ম্যাট্রিক্স',
    addMemberHeader: 'হাউসহোল্ড মেম্বার অ্যাড করুন',
    addToFamily: 'ফ্যামিলি শিল্ডে অ্যাড করুন',
  },
  Hindi: {
    activeShield: 'एक्टिव हेल्थ शील्ड',
    familyMembers: 'फैमिली मेंबर्स',
    hello: 'हेलो',
    familyAndShield: 'फैमिली और शील्ड',
    scanTitle: 'लेबल, प्लेट या कार्ट स्कैन करें',
    activeGuards: 'एक्टिव गार्ड्स',
    generalWellness: 'जनरल FSSAI वेलनेस',
    openScanner: 'स्कैनर खोलें',
    protein: 'प्रोटीन',
    fiber: 'डायटरी फाइबर',
    iron: 'आयरन',
    sugarCap: 'एडेड शुगर कैप',
    sugar: 'शुगर',
    satFat: 'सैट फैट',
    sodium: 'सोडियम',
    allergySafeMeals: 'आपके डेली गैप्स भरने के लिए एलर्जी-सेफ मील्स',
    todaysMealsTitle: 'आज के लास्ट मील्स',
    resetsAtMidnight: 'रात 12:00 बजे रीसेट होता है',
    noMealsYet: 'आज अभी तक कोई मील लॉग नहीं हुआ है। लेबल या प्लेट स्कैन करके डेली गैप्स अपडेट करें।',
    historyTitle: 'पिछले 3 दिनों की न्यूट्रिशन हिस्ट्री',
    noHistoryYet: 'रात 12:00 बजे के बाद पिछले दिनों की न्यूट्रिशन समरी यहाँ अपने आप सेव होगी।',
    mealsLogged: 'मील्स',
    dashboard: 'डैशबोर्ड',
    scannerHeader: 'न्यूट्रीबाइट स्कैनर',
    aiActive: 'AI विज़न इंजन एक्टिव',
    shields: 'शील्ड्स',
    decodingCart: 'क्विक-कॉमर्स कार्ट ऑडिट हो रहा है...',
    decodingPlate: 'आपकी मील प्लेट डिकोड हो रही है...',
    decodingLabel: 'आपका फूड लेबल डिकोड हो रहा है...',
    decodingSub: 'न्यूट्रिशन वैल्यू, INS केमिकल कोड और सभी फैमिली शील्ड्स चेक हो रहे हैं...',
    imgCaptured: 'इमेज कैप्चर हो गई और कैमरा पॉज़ है',
    runningHybrid: 'हाइब्रिड AI विज़न और FSSAI फैमिली रूल इंजन चल रहा है...',
    cartAuditTitle: 'कार्ट हेल्थ ऑडिट',
    cartScore: 'कार्ट स्कोर',
    safe: 'सेफ',
    scanAnotherCart: 'दूसरा आइटम या कार्ट स्कैन करें',
    foodLabel: '📄 फूड लेबल',
    plateSnap: '🍽 प्लेट स्नैप',
    cartAudit: '🛒 कार्ट ऑडिट',
    startingCam: 'कैमरा स्टार्ट हो रहा है...',
    uploadCart: 'Blinkit / Zepto कार्ट स्क्रीनशॉट अपलोड करें',
    uploadPhoto: 'लेबल या प्लेट की फोटो अपलोड करें',
    samplePacket: 'सैंपल पैकेट',
    sampleCart: 'सैंपल Blinkit कार्ट',
    scanRejected: 'स्कैन रिजेक्टेड / एरर',
    tryAgain: 'फिर से ट्राई करें',
    fixMisread: 'मिसरीड ठीक करें',
    verdictHeader: 'हेल्थ शील्ड वर्डिक्ट',
    voiceSummary: 'फैमिली वॉइस समरी',
    play: 'प्ले',
    pause: 'पॉज़',
    resume: 'रिज़्यूम',
    whatsapp: 'व्हाट्सएप',
    familyMatrixTitle: 'वन स्कैन, होल फैमिली मैट्रिक्स',
    householdShields: 'हाउसहोल्ड शील्ड्स',
    nutritionPerServing: 'न्यूट्रिशन पर सर्विंग',
    chemicalTruth: 'एडिटिव और केमिकल ट्रुथ',
    saferSwapTitle: 'सेफर इंडियन अल्टरनेटिव · पूरी फैमिली के लिए सेफ',
    eatAnywayTitle: 'ईट-इट-एनीवे प्रोटोकॉल',
    immediatePairing: '1. इमीडिएट पेयरिंग:',
    postMealRecovery: '2. पोस्ट-मील रिकवरी:',
    scanAnother: 'दूसरा स्कैन करें',
    addedToGaps: '✓ डेली गैप्स में ऐड हो गया',
    updateDailyGaps: 'हाँ, डेली गैप्स अपडेट करें',
    back: 'बैक',
    editHealthShield: 'हेल्थ शील्ड एडिट करें',
    appLanguageLabel: 'ऐप और वॉइस लैंग्वेज',
    conditionsLabel: 'मेडिकल कंडीशंस',
    allergensLabel: 'फूड एलर्जी',
    saveShield: 'हेल्थ शील्ड सेव करें',
    myFamilyShields: 'माई फैमिली शील्ड्स',
    oneScanMatrix: 'वन-स्कैन मैट्रिक्स',
    addMemberHeader: 'हाउसहोल्ड मेंबर ऐड करें',
    addToFamily: 'फैमिली शील्ड में ऐड करें',
  },
};

function apiFetch(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `Server error (${res.status})`);
    return data;
  });
}

// Natural everyday voice readout in English, Bengali (Banglish script), or Hindi (Hinglish script)
function getLocalizedVerdictText(scanResult, lang) {
  if (!scanResult) return '';
  if (scanResult.vernacularScripts && scanResult.vernacularScripts[lang]) {
    return scanResult.vernacularScripts[lang];
  }

  const name = scanResult.productName || 'এই ফুড আইটেম';
  const v = (scanResult.verdict || 'GREEN').toUpperCase();
  const swapName = scanResult.swap?.name;

  if (lang === 'Bengali') {
    if (v === 'RED') {
      return `অ্যালার্ট! ${name} আপনার ফ্যামিলির হেলথ শিল্ডের জন্য রেড ভার্ডিক্ট পেয়েছে। হাই সুগার বা অ্যালার্জেন রিস্ক আছে। ${swapName ? `এর বদলে সেফার অপশন হলো ${swapName}।` : 'এটি অ্যাভয়েড করুন।'}`;
    }
    if (v === 'AMBER') {
      return `সতর্ক থাকুন! ${name} অ্যাম্বার ক্যাটাগরিতে পড়েছে, তাই লিমিটেড পরিমাণে খান। ${swapName ? `বেটার অপশন হলো ${swapName}।` : ''}`;
    }
    return `গ্রেট চয়েস! ${name} গ্রিন ভার্ডিক্ট পেয়েছে এবং আপনার পুরো ফ্যামিলির জন্য সেফ।`;
  }

  if (lang === 'Hindi') {
    if (v === 'RED') {
      return `अलर्ट! ${name} को आपकी फैमिली हेल्थ शील्ड के लिए रेड वर्डिक्ट मिला है। इसमें हाई शुगर या एलर्जेन रिस्क है। ${swapName ? `इसकी जगह सेफर ऑप्शन ${swapName} ट्राई करें।` : 'इसे अवॉइड करें।'}`;
    }
    if (v === 'AMBER') {
      return `ध्यान दें! ${name} एम्बर कैटेगरी में है, इसे लिमिटेड क्वांटिटी में ही खाएं। ${swapName ? `बेटर ऑप्शन ${swapName} है।` : ''}`;
    }
    return `बढ़िया चॉइस! ${name} को ग्रीन वर्डिक्ट मिला है और यह आपकी पूरी फैमिली के लिए सेफ है।`;
  }

  return scanResult.vernacularScript?.text || `${name}: Verdict is ${v}. ${scanResult.detail || ''}`;
}

export default function App() {
  // Navigation & Auth State
  const [screen, setScreen] = useState('landing'); // landing | auth | dashboard | scanner | result | profile
  const [authMode, setAuthMode] = useState('signup'); // signup | login
  const [signupStep, setSignupStep] = useState(1); // 1: phone+otp | 2: profile+shield

  // User, Family, Daily Progress & 3-Day History State
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [intakeHistory, setIntakeHistory] = useState([]);
  const [suggestedMeals, setSuggestedMeals] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);

  // Add Family Member Form (inside Profile screen)
  const [newFamName, setNewFamName] = useState('');
  const [newFamRel, setNewFamRel] = useState('Mother');
  const [newFamConds, setNewFamConds] = useState([]);
  const [newFamAllergens, setNewFamAllergens] = useState([]);

  // Auth Form Fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Profile Form Fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('22');
  const [gender, setGender] = useState('Male');
  const [heightCm, setHeightCm] = useState('172');
  const [weightKg, setWeightKg] = useState('68');
  const [conditions, setConditions] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [preferredLanguage, setPreferredLanguage] = useState('English');

  // Global App & Voice Language ('English' | 'Bengali' | 'Hindi')
  const [selectedLang, setSelectedLang] = useState('English');
  const t = UI_TEXT[selectedLang] || UI_TEXT.English;

  // Scanner & Decoding State
  const [scanMode, setScanMode] = useState('label'); // label | plate | cart
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [cartResult, setCartResult] = useState(null);
  const [loggedFeedback, setLoggedFeedback] = useState(false);
  const [activeBioBuffer, setActiveBioBuffer] = useState(null);

  // Voice Speech Playback State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Manual Correction Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ productName: '', sugarG: '', satFatG: '', proteinG: '', sodiumMg: '', ingredients: '' });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper to immediately stop any active voice synthesis
  function stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
  }

  // Preload browser TTS voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Live 12:00 AM midnight watcher: archives today's meals & resets intake to 0 if tab stays open past midnight
  useEffect(() => {
    const getTodayKey = () => new Date().toLocaleDateString('en-CA');
    let activeDate = getTodayKey();

    const timer = setInterval(() => {
      const nowDate = getTodayKey();
      if (nowDate !== activeDate) {
        const previousDate = activeDate;
        activeDate = nowDate;

        setProgress((prev) => {
          if (!prev) return prev;
          if ((prev.loggedToday?.length || 0) > 0) {
            setIntakeHistory((hist) =>
              [
                {
                  date: prev.date || previousDate,
                  protein: prev.protein?.consumed || 0,
                  fiber: prev.fiber?.consumed || 0,
                  iron: prev.iron?.consumed || 0,
                  sugar: prev.sugar?.consumed || 0,
                  sugarGoal: prev.sugar?.goal || 25,
                  mealsCount: prev.loggedToday.length,
                },
                ...hist.filter((h) => h.date !== (prev.date || previousDate)),
              ].slice(0, 3)
            );
          }

          return {
            ...prev,
            date: nowDate,
            protein: { ...prev.protein, consumed: 0, percent: 0, need: prev.protein.goal },
            fiber: { ...prev.fiber, consumed: 0, percent: 0, need: prev.fiber.goal },
            iron: { ...prev.iron, consumed: 0, percent: 0, need: prev.iron.goal },
            sugar: { ...prev.sugar, consumed: 0, percent: 0, need: prev.sugar.goal, status: 'safe' },
            loggedToday: [],
          };
        });
      }
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // Automatically stop speech whenever leaving the 'result' screen or on unmount
  useEffect(() => {
    if (screen !== 'result') {
      stopSpeech();
    }
    return () => stopSpeech();
  }, [screen]);

  // Start / Stop Camera cleanly whenever screen or decoding state changes
  useEffect(() => {
    if (screen === 'scanner' && !decoding && !cartResult) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [screen, decoding, cartResult]);

  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setCameraActive(false);
      setCameraError('Camera unavailable or permission denied. You can upload a photo instead.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function toggleChip(list, setList, value) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  // Change Global App & Voice Language from Dashboard Settings
  async function handleChangeGlobalLanguage(newLang) {
    stopSpeech();
    setSelectedLang(newLang);
    setPreferredLanguage(newLang);

    if (user?.phone) {
      setUser((prev) => (prev ? { ...prev, preferredLanguage: newLang } : prev));
      try {
        await apiFetch('/api/profile', {
          method: 'POST',
          body: JSON.stringify({
            phone: user.phone,
            name: user.name,
            age: user.age,
            gender: user.gender,
            heightCm: user.heightCm,
            weightKg: user.weightKg,
            conditions: user.conditions || [],
            allergens: user.allergens || [],
            preferredLanguage: newLang,
          }),
        });
      } catch {
        // Non-blocking sync
      }
    }
  }

  // Auth Handlers
  async function handleSendOtp() {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, purpose: authMode }),
      });
      setOtpSent(true);
      setDevOtpHint(res.devOtp || '');
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifySignupOtp() {
    setAuthError('');
    setAuthLoading(true);
    try {
      await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });
      setSignupStep(2);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCompleteSignup(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const validLang = LANGUAGES.some((l) => l.code === preferredLanguage) ? preferredLanguage : 'English';
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          name: name.trim() || 'NutriBite User',
          age,
          gender,
          heightCm,
          weightKg,
          conditions,
          allergens,
          preferredLanguage: validLang,
        }),
      });
      setUser(res.user);
      setProgress(res.progress);
      setIntakeHistory(res.intakeHistory || []);
      setSuggestedMeals(res.suggestedMeals || []);
      setFamilyMembers(res.familyMembers || []);
      setSelectedLang(validLang);
      setScreen('dashboard');
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
      });
      const userLang = LANGUAGES.some((l) => l.code === res.user?.preferredLanguage)
        ? res.user.preferredLanguage
        : 'English';
      setUser(res.user);
      setProgress(res.progress);
      setIntakeHistory(res.intakeHistory || []);
      setSuggestedMeals(res.suggestedMeals || []);
      setFamilyMembers(res.familyMembers || []);
      setSelectedLang(userLang);
      setScreen('dashboard');
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const validLang = LANGUAGES.some((l) => l.code === preferredLanguage) ? preferredLanguage : 'English';
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          phone: user.phone,
          name,
          age,
          gender,
          heightCm,
          weightKg,
          conditions,
          allergens,
          preferredLanguage: validLang,
        }),
      });
      setUser(res.user);
      setProgress(res.progress);
      setIntakeHistory(res.intakeHistory || []);
      setSuggestedMeals(res.suggestedMeals || []);
      if (res.familyMembers) setFamilyMembers(res.familyMembers);
      setSelectedLang(validLang);
      setScreen('dashboard');
    } catch (e) {
      alert(e.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAddFamilyMember() {
    if (!newFamName.trim() || !user) return;
    const updated = [
      ...familyMembers,
      {
        id: `fam_${Date.now()}`,
        memberName: newFamName.trim(),
        relation: newFamRel,
        conditions: newFamConds,
        allergens: newFamAllergens,
      },
    ];
    try {
      const res = await apiFetch('/api/family', {
        method: 'POST',
        body: JSON.stringify({ phone: user.phone, familyMembers: updated }),
      });
      setFamilyMembers(res.familyMembers);
      setNewFamName('');
      setNewFamConds([]);
      setNewFamAllergens([]);
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleRemoveFamilyMember(id) {
    if (!user || id === 'self') return;
    const updated = familyMembers.filter((m) => m.id !== id);
    try {
      const res = await apiFetch('/api/family', {
        method: 'POST',
        body: JSON.stringify({ phone: user.phone, familyMembers: updated }),
      });
      setFamilyMembers(res.familyMembers);
    } catch (e) {
      alert(e.message);
    }
  }

  // Analyze Image Pipeline (Label, Plate, or Quick-Commerce Cart)
  async function analyzeBase64Image(base64Data, forceDemoCart = false) {
    stopSpeech();
    stopCamera();
    setCapturedPreview(base64Data);
    setScanError('');
    setCartResult(null);
    setDecoding(true);

    try {
      if (scanMode === 'cart' || forceDemoCart) {
        const res = await apiFetch('/api/analyze-cart', {
          method: 'POST',
          body: JSON.stringify({
            phone: user?.phone,
            userProfile: user,
            familyMembers,
            imageBase64: forceDemoCart ? null : base64Data,
            useDemoCart: forceDemoCart,
          }),
        });
        setCartResult(res);
        setDecoding(false);
        return;
      }

      const res = await apiFetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          phone: user?.phone,
          userProfile: user,
          familyMembers,
          language: selectedLang,
          imageBase64: base64Data,
          isPlate: scanMode === 'plate',
        }),
      });
      setScanResult(res);
      setLoggedFeedback(false);
      setActiveBioBuffer(null);
      setEditForm({
        productName: res.productName || '',
        sugarG: String(res.nutrients?.sugar ?? 0),
        satFatG: String(res.nutrients?.satFat ?? 0),
        proteinG: String(res.nutrients?.protein ?? 0),
        sodiumMg: String(res.nutrients?.sodium ?? 0),
        ingredients: res.ingredients || '',
      });
      setDecoding(false);
      setScreen('result');
    } catch (e) {
      setDecoding(false);
      setScanError(e.message || 'Could not decode image. Please try a clearer photo.');
    }
  }

  function handleCaptureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    analyzeBase64Image(dataUrl);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        analyzeBase64Image(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRetryScan() {
    stopSpeech();
    setScanError('');
    setCapturedPreview(null);
    setCartResult(null);
    setDecoding(false);
    setScreen('scanner');
  }

  async function handleLogIntake() {
    if (!scanResult || !user) return;
    try {
      const res = await apiFetch('/api/log-intake', {
        method: 'POST',
        body: JSON.stringify({
          phone: user.phone,
          productName: scanResult.productName,
          verdict: scanResult.verdict,
          nutrients: scanResult.nutrients,
          bioBuffer: scanResult.bioBuffer,
        }),
      });
      setProgress(res.progress);
      if (res.intakeHistory) setIntakeHistory(res.intakeHistory);
      setSuggestedMeals(res.suggestedMeals || []);
      setLoggedFeedback(true);
      if (res.activeBioBuffer) {
        setActiveBioBuffer(res.activeBioBuffer);
      }
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleApplyManualEdit(e) {
    e.preventDefault();
    stopSpeech();
    setEditOpen(false);
    setDecoding(true);
    setScreen('scanner');
    try {
      const res = await apiFetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          phone: user?.phone,
          userProfile: user,
          familyMembers,
          language: selectedLang,
          isPlate: scanMode === 'plate',
          overrides: editForm,
        }),
      });
      setScanResult(res);
      setDecoding(false);
      setScreen('result');
    } catch (err) {
      setDecoding(false);
      setScanError(err.message);
    }
  }

  // Play / Pause / Resume Toggle for Voice Verdict in active selectedLang
  function handleTogglePlayPause(text, lang) {
    if (!('speechSynthesis' in window) || !text) return;

    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel();
    const langObj = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langObj.locale;
    utter.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const prefix = langObj.locale.split('-')[0].toLowerCase();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === langObj.locale.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (matchedVoice) {
      utter.voice = matchedVoice;
    }

    utter.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utter.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utter.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    setIsSpeaking(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utter);
  }

  function handleShareWhatsApp() {
    if (!scanResult) return;
    const summaryText = getLocalizedVerdictText(scanResult, selectedLang);
    const msg = `🛡️ *NutriBite Family Shield Verdict (${selectedLang})*\n*Item:* ${scanResult.productName}\n*Verdict:* ${scanResult.verdict}\n*Summary:* ${summaryText}\n${scanResult.swap ? `*Safer Whole-Family Swap:* ${scanResult.swap.name}` : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  // ------------------------------------------------------------------
  // 1. LANDING SCREEN
  // ------------------------------------------------------------------
  if (screen === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-slate-900 flex flex-col">
        <header className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              N
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">NutriBite</span>
              <span className="block text-[10px] font-bold tracking-widest text-emerald-700 uppercase">Decode · Score · Protect</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); setOtpSent(false); setScreen('auth'); }}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-700 transition"
            >
              Log In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setSignupStep(1); setAuthError(''); setOtpSent(false); setScreen('auth'); }}
              className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition"
            >
              Create Account
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4"/> English · বাংলা · हिंदी App & Voice Shield
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-slate-900">
              Know what’s inside every bite <span className="text-emerald-600">before you eat.</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Scan any Indian packaged food label, home-cooked thali, or Blinkit/Zepto cart. NutriBite decodes hidden sugars, INS chemical codes, and allergens across your whole family in English, Bengali, and Hindi.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => { setAuthMode('signup'); setSignupStep(1); setAuthError(''); setOtpSent(false); setScreen('auth'); }}
                className="px-7 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition"
              >
                Get Started Free <ChevronRight className="w-5 h-5"/>
              </button>
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); setOtpSent(false); setScreen('auth'); }}
                className="px-7 py-4 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-2xl border border-slate-200 transition"
              >
                Existing User Log In
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-7 shadow-xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">One Scan · Whole Family Preview</p>
                <h3 className="text-lg font-bold text-slate-900">Chocolate Peanut Bar (40g)</h3>
              </div>
              <span className="px-3.5 py-1.5 rounded-full bg-rose-100 text-rose-700 font-extrabold text-xs">RED · AVOID</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 text-sm font-medium">
              Contains Peanuts (Allergy) & 24g Added Sugar (Diabetes Limit Exceeded).
            </div>
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <p className="text-[11px] font-bold text-slate-600">You (Diabetes)</p>
                <p className="text-xs font-extrabold text-rose-600 mt-0.5">⛔ RED</p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <p className="text-[11px] font-bold text-slate-600">Mom (PCOS/Soy)</p>
                <p className="text-xs font-extrabold text-rose-600 mt-0.5">⛔ RED</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-[11px] font-bold text-slate-600">Dad (BP)</p>
                <p className="text-xs font-extrabold text-emerald-700 mt-0.5">✅ GREEN</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase">Whole-Family Safe Indian Swap</p>
                <p className="text-sm font-bold text-slate-900">Roasted Makhana & Pumpkin Seeds Mix</p>
              </div>
              <span className="text-2xl">🥣</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. AUTH SCREEN (SIGN UP & LOGIN)
  // ------------------------------------------------------------------
  if (screen === 'auth') {
    return (
      <div className="min-h-screen bg-emerald-50/60 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-7 space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setScreen('landing')} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-semibold">
              <ArrowLeft className="w-4 h-4"/> Back
            </button>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => { setAuthMode('signup'); setSignupStep(1); setAuthError(''); setOtpSent(false); }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${authMode === 'signup' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
              >
                Sign Up
              </button>
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); setOtpSent(false); }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${authMode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
              >
                Log In
              </button>
            </div>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Welcome Back</h2>
                <p className="text-sm text-slate-500">Log in with your registered Indian mobile number.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Registered Phone Number</label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500">
                  <span className="text-sm font-bold text-slate-500 mr-2">IN +91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full outline-none text-base font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  disabled={authLoading || phone.length !== 10}
                  onClick={handleSendOtp}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition"
                >
                  {authLoading ? 'Sending...' : 'Send OTP'}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Enter 4-Digit OTP</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-center tracking-widest text-lg font-extrabold"
                      required
                    />
                    {devOtpHint && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1.5 text-center">
                        Demo OTP: <span className="font-mono font-bold">{devOtpHint}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading || otp.length !== 4}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition"
                  >
                    {authLoading ? 'Logging In...' : 'Verify & Log In'}
                  </button>
                </>
              )}

              {authError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {authError}
                </div>
              )}
            </form>
          ) : signupStep === 1 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Create Your Health Shield</h2>
                <p className="text-sm text-slate-500">Step 1 of 2 — Verify your mobile number</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mobile Number</label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500">
                  <span className="text-sm font-bold text-slate-500 mr-2">IN +91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full outline-none text-base font-semibold text-slate-900"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  disabled={authLoading || phone.length !== 10}
                  onClick={handleSendOtp}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition"
                >
                  {authLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">4-Digit OTP</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-center tracking-widest text-lg font-extrabold"
                    />
                    {devOtpHint && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1.5 text-center">
                        Demo OTP: <span className="font-mono font-bold">{devOtpHint}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={authLoading || otp.length !== 4}
                    onClick={handleVerifySignupOtp}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition"
                  >
                    {authLoading ? 'Verifying...' : 'Continue to Health Shield ->'}
                  </button>
                </>
              )}

              {authError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCompleteSignup} className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Personalize Health Shield</h2>
                <p className="text-xs text-slate-500">Step 2 of 2 — Set medical conditions, allergies & app language</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav Sharma" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Height (cm)</label>
                  <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Weight (kg)</label>
                  <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">App & Voice Language</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        type="button"
                        key={l.code}
                        onClick={() => setPreferredLanguage(l.code)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                          preferredLanguage === l.code
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {l.native}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Medical Conditions</label>
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => toggleChip(conditions, setConditions, c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        conditions.includes(c)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Food Allergies</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => toggleChip(allergens, setAllergens, a)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        allergens.includes(a)
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
              >
                {authLoading ? 'Creating Account...' : 'Launch NutriBite Dashboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 3. SCANNER, DECODING & QUICK-COMMERCE CART AUDIT SCREEN
  // ------------------------------------------------------------------
  if (screen === 'scanner') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <header className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <button
            onClick={() => { stopSpeech(); stopCamera(); setDecoding(false); setCartResult(null); setScanError(''); setScreen('dashboard'); }}
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4"/> {t.dashboard}
          </button>
          <span className="text-sm font-bold tracking-wide text-emerald-400">
            {decoding ? t.aiActive : t.scannerHeader}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-700/60 text-[11px] font-bold text-emerald-300 flex items-center gap-1">
            <Users className="w-3 h-3"/> {familyMembers.length || 3} {t.shields}
          </span>
        </header>

        <main className="flex-1 max-w-xl w-full mx-auto px-5 py-6 flex flex-col justify-center">
          {decoding ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
              {capturedPreview && (
                <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-lg">
                  <img src={capturedPreview} alt="Captured food" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                </div>
              )}

              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                <h2 className="text-2xl font-extrabold text-white">
                  {scanMode === 'cart'
                    ? t.decodingCart
                    : scanMode === 'plate'
                    ? t.decodingPlate
                    : t.decodingLabel}
                </h2>
                <p className="text-sm text-slate-400 max-w-sm">
                  {t.decodingSub}
                </p>
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-300 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4"/> {t.imgCaptured}
                </div>
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <RefreshCw className="w-4 h-4 animate-spin"/> {t.runningHybrid}
                </div>
              </div>
            </div>
          ) : cartResult ? (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                      {cartResult.platform} · {t.cartAuditTitle}
                    </span>
                    <h2 className="text-2xl font-extrabold text-white mt-0.5">
                      {t.cartScore}: {cartResult.cartHealthScore}% {t.safe}
                    </h2>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-slate-800 text-xs font-extrabold text-slate-200">
                    {cartResult.safeCount}/{cartResult.totalItems} {t.safe}
                  </span>
                </div>

                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {(cartResult.items || []).map((item) => {
                    const badge =
                      item.verdict === 'RED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : item.verdict === 'AMBER'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    return (
                      <div key={item.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-white">
                              {item.productName} <span className="text-slate-400">×{item.quantity}</span>
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badge}`}>
                            {item.verdict}
                          </span>
                        </div>

                        {item.familyMatrix?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.familyMatrix.map((fm) => (
                              <span
                                key={fm.id}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  fm.verdict === 'red'
                                    ? 'bg-rose-950 text-rose-300'
                                    : fm.verdict === 'amber'
                                    ? 'bg-amber-950 text-amber-300'
                                    : 'bg-emerald-950 text-emerald-300'
                                }`}
                              >
                                {fm.memberName}: {fm.verdict.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.saferSwap && (
                          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/40 text-xs text-emerald-200 flex items-center justify-between">
                            <span>Swap: <strong>{item.saferSwap.name}</strong></span>
                            <span>{item.saferSwap.emoji || '🥣'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleRetryScan}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition"
              >
                {t.scanAnotherCart}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1">
                <button
                  onClick={() => setScanMode('label')}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                    scanMode === 'label' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.foodLabel}
                </button>
                <button
                  onClick={() => setScanMode('plate')}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                    scanMode === 'plate' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.plateSnap}
                </button>
                <button
                  onClick={() => setScanMode('cart')}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                    scanMode === 'cart' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.cartAudit}
                </button>
              </div>

              <div className="relative aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraActive && (
                  <div className="p-6 text-center space-y-2">
                    <Camera className="w-10 h-10 text-slate-500 mx-auto"/>
                    <p className="text-sm text-slate-400">{cameraError || t.startingCam}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-3">
                {cameraActive && (
                  <button
                    onClick={handleCaptureFrame}
                    className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 shadow-lg active:scale-95 transition"
                    title="Capture & Decode"
                  />
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <Upload className="w-4 h-4"/>
                  {scanMode === 'cart' ? t.uploadCart : t.uploadPhoto}
                </button>

                <div className="grid grid-cols-2 gap-2.5 w-full">
                  <button
                    onClick={() => { setScanMode('label'); analyzeBase64Image(SAMPLE_PACKET_IMAGE, false); }}
                    className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0"/> {t.samplePacket}
                  </button>
                  <button
                    onClick={() => { setScanMode('cart'); analyzeBase64Image(null, true); }}
                    className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0"/> {t.sampleCart}
                  </button>
                </div>
              </div>

              {scanError && (
                <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-sm space-y-2">
                  <div className="font-bold flex items-center gap-2 text-rose-300">
                    <XCircle className="w-5 h-5 shrink-0"/> {t.scanRejected}
                  </div>
                  <p>{scanError}</p>
                  <button
                    onClick={handleRetryScan}
                    className="mt-1 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    {t.tryAgain}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 4. VERDICT RESULT SCREEN
  // ------------------------------------------------------------------
  if (screen === 'result' && scanResult) {
    const v = (scanResult.verdict || 'GREEN').toUpperCase();
    const bannerStyle =
      v === 'RED'
        ? 'bg-rose-600 text-white'
        : v === 'AMBER'
        ? 'bg-amber-500 text-slate-950'
        : 'bg-emerald-600 text-white';

    const activeSpeechText = getLocalizedVerdictText(scanResult, selectedLang);
    const activeLangBadge = LANGUAGES.find((l) => l.code === selectedLang)?.native || selectedLang;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
        <header className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={() => { stopSpeech(); setScreen('dashboard'); }}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-700"
          >
            <ArrowLeft className="w-4 h-4"/> {t.dashboard}
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            <Edit3 className="w-3.5 h-3.5"/> {t.fixMisread}
          </button>
        </header>

        <main className="max-w-2xl mx-auto px-5 pt-6 space-y-5">
          {/* Primary Verdict Card */}
          <div className={`rounded-3xl p-6 shadow-lg ${bannerStyle} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest opacity-90">{t.verdictHeader}</span>
              <span className="px-3 py-1 rounded-full bg-black/20 text-xs font-extrabold">{v}</span>
            </div>
            <h1 className="text-2xl font-extrabold">{scanResult.productName}</h1>
            <p className="text-sm font-medium opacity-95">{scanResult.detail}</p>
          </div>

          {/* Voice Summary Card in Active App Language + Play / Pause / Stop */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5"/> {t.voiceSummary} ({activeLangBadge})
              </p>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">{activeSpeechText}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleTogglePlayPause(activeSpeechText, selectedLang)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                {isSpeaking && !isPaused ? (
                  <>
                    <Pause className="w-3.5 h-3.5"/> {t.pause}
                  </>
                ) : isSpeaking && isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5"/> {t.resume}
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5"/> {t.play}
                  </>
                )}
              </button>

              {isSpeaking && (
                <button
                  onClick={stopSpeech}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center transition"
                  title="Stop"
                >
                  <Square className="w-3.5 h-3.5"/>
                </button>
              )}

              <button
                onClick={handleShareWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5"/> {t.whatsapp}
              </button>
            </div>
          </div>

          {/* One Scan, Whole Family Matrix */}
          {scanResult.familyMatrix?.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600"/> {t.familyMatrixTitle}
                </h3>
                <span className="text-[11px] font-bold text-slate-400">{scanResult.familyMatrix.length} {t.householdShields}</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {scanResult.familyMatrix.map((fm) => {
                  const style =
                    fm.verdict === 'red'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : fm.verdict === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800';
                  return (
                    <div key={fm.id} className={`p-3 rounded-2xl border ${style} space-y-1`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold">{fm.memberName}</span>
                        <span className="text-[10px] font-black uppercase">{fm.verdict}</span>
                      </div>
                      <p className="text-[11px] leading-snug opacity-90">{fm.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nutrition Per Serving */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{t.nutritionPerServing}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 text-center">
              {[
                [t.sugar, `${scanResult.nutrients?.sugar ?? 0}g`],
                [t.satFat, `${scanResult.nutrients?.satFat ?? 0}g`],
                [t.protein, `${scanResult.nutrients?.protein ?? 0}g`],
                [t.fiber, `${scanResult.nutrients?.fiber ?? 0}g`],
                [t.iron, `${scanResult.nutrients?.iron ?? 0}mg`],
                [t.sodium, `${scanResult.nutrients?.sodium ?? 0}mg`],
              ].map(([label, val]) => (
                <div key={label} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Additive & Chemical Truth */}
          {scanResult.chemicals?.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{t.chemicalTruth}</h3>
              <div className="space-y-2.5">
                {scanResult.chemicals.map((c, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{c.note}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        c.risk === 'red'
                          ? 'bg-rose-100 text-rose-700'
                          : c.risk === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {c.risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safer Whole-Family Indian Swap */}
          {scanResult.swap && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  {t.saferSwapTitle}
                </p>
                <h4 className="text-base font-extrabold text-slate-900 mt-0.5">{scanResult.swap.name}</h4>
                <p className="text-xs text-emerald-800 mt-0.5">{scanResult.swap.note}</p>
              </div>
              <span className="text-3xl">{scanResult.swap.emoji || '🥣'}</span>
            </div>
          )}

          {/* Eat-It-Anyway Bio-Buffer Damage Control Card */}
          {activeBioBuffer && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 space-y-2.5 shadow-md">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                <HeartPulse className="w-5 h-5 text-amber-600"/> {t.eatAnywayTitle}: {activeBioBuffer.title}
              </div>
              <p className="text-xs text-amber-950">
                <strong>{t.immediatePairing}</strong> {activeBioBuffer.pairingTip}
              </p>
              <p className="text-xs text-amber-950">
                <strong>{t.postMealRecovery}</strong> {activeBioBuffer.postMealAction}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleRetryScan}
              className="py-3.5 rounded-2xl bg-white border border-slate-300 font-bold text-sm text-slate-800 hover:bg-slate-100 transition"
            >
              {t.scanAnother}
            </button>
            <button
              disabled={loggedFeedback}
              onClick={handleLogIntake}
              className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold text-sm transition"
            >
              {loggedFeedback ? t.addedToGaps : t.updateDailyGaps}
            </button>
          </div>
        </main>

        {editOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <form onSubmit={handleApplyManualEdit} className="bg-white rounded-3xl p-6 max-w-md w-full space-y-3">
              <h3 className="text-lg font-extrabold">{t.fixMisread}</h3>
              <input value={editForm.productName} onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })} placeholder="Product Name" className="w-full border rounded-xl px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.1" value={editForm.sugarG} onChange={(e) => setEditForm({ ...editForm, sugarG: e.target.value })} placeholder="Sugar (g)" className="border rounded-xl px-3 py-2 text-sm" />
                <input type="number" step="0.1" value={editForm.satFatG} onChange={(e) => setEditForm({ ...editForm, satFatG: e.target.value })} placeholder="Sat Fat (g)" className="border rounded-xl px-3 py-2 text-sm" />
                <input type="number" step="0.1" value={editForm.proteinG} onChange={(e) => setEditForm({ ...editForm, proteinG: e.target.value })} placeholder="Protein (g)" className="border rounded-xl px-3 py-2 text-sm" />
                <input type="number" step="0.1" value={editForm.sodiumMg} onChange={(e) => setEditForm({ ...editForm, sodiumMg: e.target.value })} placeholder="Sodium (mg)" className="border rounded-xl px-3 py-2 text-sm" />
              </div>
              <textarea rows={3} value={editForm.ingredients} onChange={(e) => setEditForm({ ...editForm, ingredients: e.target.value })} placeholder="Ingredients list..." className="w-full border rounded-xl px-3 py-2 text-sm" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 font-bold text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">Recalculate</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 5. PROFILE & FAMILY SHIELD SETTINGS SCREEN
  // ------------------------------------------------------------------
  if (screen === 'profile' && user) {
    return (
      <div className="min-h-screen bg-slate-50 p-5 space-y-5">
        <form onSubmit={handleSaveProfile} className="max-w-lg mx-auto bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setScreen('dashboard')} className="text-sm font-bold text-slate-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4"/> {t.back}
            </button>
            <h2 className="text-lg font-extrabold">{t.editHealthShield}</h2>
            <div className="w-10" />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="w-full border rounded-xl px-3 py-2 text-sm" />
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.appLanguageLabel}</label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  type="button"
                  key={l.code}
                  onClick={() => setPreferredLanguage(l.code)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                    preferredLanguage === l.code
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.conditionsLabel}</label>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleChip(conditions, setConditions, c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    conditions.includes(c) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.allergensLabel}</label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleChip(allergens, setAllergens, a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    allergens.includes(a) ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl">
            {t.saveShield}
          </button>
        </form>

        {/* My Family Shields Management Card */}
        <div className="max-w-lg mx-auto bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600"/> {t.myFamilyShields} ({familyMembers.length})
            </h3>
            <span className="text-[11px] font-bold text-emerald-700">{t.oneScanMatrix}</span>
          </div>

          <div className="space-y-2">
            {familyMembers.map((m) => (
              <div key={m.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {m.memberName} <span className="text-xs font-normal text-slate-500">({m.relation})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {[...(m.conditions || []), ...(m.allergens || [])].join(', ') || 'General Wellness'}
                  </p>
                </div>
                {m.id !== 'self' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFamilyMember(m.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{t.addMemberHeader}</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newFamName}
                onChange={(e) => setNewFamName(e.target.value)}
                placeholder="Name (e.g. Grandma)"
                className="border rounded-xl px-3 py-2 text-xs"
              />
              <select value={newFamRel} onChange={(e) => setNewFamRel(e.target.value)} className="border rounded-xl px-3 py-2 text-xs">
                <option>Mother</option>
                <option>Father</option>
                <option>Spouse</option>
                <option>Child</option>
                <option>Grandparent</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1">
              {CONDITIONS.slice(0, 5).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleChip(newFamConds, setNewFamConds, c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    newFamConds.includes(c) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddFamilyMember}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5"/> {t.addToFamily}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 6. MAIN DASHBOARD (With Today's Last Meals & Last 3 Days History)
  // ------------------------------------------------------------------
  const todayDateStr = new Date().toLocaleDateString('en-CA');
  const p = progress || {
    date: todayDateStr,
    protein: { consumed: 0, goal: 60, percent: 0, need: 60 },
    fiber: { consumed: 0, goal: 25, percent: 0, need: 25 },
    iron: { consumed: 0, goal: 18, percent: 0, need: 18 },
    sugar: { consumed: 0, goal: 25, percent: 0, need: 25, status: 'safe' },
    loggedToday: [],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-14">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              {t.activeShield} · {familyMembers.length || 3} {t.familyMembers}
            </p>
            <h1 className="text-xl font-extrabold text-slate-900">{t.hello}, {user?.name || 'User'}</h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Global App & Voice Language Setting on Dashboard */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleChangeGlobalLanguage(l.code)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    selectedLang === l.code
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setName(user?.name || '');
                setConditions(user?.conditions || []);
                setAllergens(user?.allergens || []);
                setPreferredLanguage(selectedLang);
                setScreen('profile');
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5"/> {t.familyAndShield}
            </button>
            <button
              onClick={() => { stopSpeech(); setUser(null); setScreen('landing'); }}
              className="p-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              title="Log Out"
            >
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
        {/* Scanner Hero Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold">{t.scanTitle}</h2>
            <p className="text-sm text-emerald-50">
              {t.activeGuards}: {[...(user?.conditions || []), ...(user?.allergens || [])].join(', ') || t.generalWellness}
            </p>
          </div>
          <button
            onClick={handleRetryScan}
            className="px-6 py-3.5 rounded-2xl bg-white text-emerald-700 font-extrabold text-sm shadow hover:bg-emerald-50 flex items-center gap-2 shrink-0"
          >
            <Camera className="w-4 h-4"/> {t.openScanner}
          </button>
        </div>

        {/* Daily Macro Progress Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t.protein, data: p.protein, unit: 'g', color: 'bg-emerald-600' },
            { label: t.fiber, data: p.fiber, unit: 'g', color: 'bg-teal-600' },
            { label: t.iron, data: p.iron, unit: 'mg', color: 'bg-indigo-600' },
            { label: t.sugarCap, data: p.sugar, unit: 'g', color: p.sugar.status === 'over' ? 'bg-rose-600' : 'bg-amber-500' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-500 uppercase">{item.label}</span>
                <span className="text-xs font-black text-slate-900">{item.data.percent}%</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {item.data.consumed}
                <span className="text-sm font-semibold text-slate-400"> / {item.data.goal}{item.unit}</span>
              </p>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${item.color}`} style={{ width: `${Math.min(100, item.data.percent)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Today's Last Meals & Last 3 Days Nutritional History */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Today's Last Meals Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600"/> {t.todaysMealsTitle} ({p.date || todayDateStr})
              </h3>
              <span className="text-[11px] font-bold text-slate-400">{t.resetsAtMidnight}</span>
            </div>

            {p.loggedToday && p.loggedToday.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {p.loggedToday.map((meal, idx) => {
                  const v = (meal.verdict || 'GREEN').toUpperCase();
                  const badgeStyle =
                    v === 'RED'
                      ? 'bg-rose-100 text-rose-700'
                      : v === 'AMBER'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-700';

                  return (
                    <div
                      key={meal.id || idx}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">{meal.productName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${badgeStyle}`}>
                            {v}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {t.protein}: <strong>{meal.nutrients?.protein ?? 0}g</strong> · {t.fiber}:{' '}
                          <strong>{meal.nutrients?.fiber ?? 0}g</strong> · {t.iron}:{' '}
                          <strong>{meal.nutrients?.iron ?? 0}mg</strong> · {t.sugar}:{' '}
                          <strong>{meal.nutrients?.sugar ?? 0}g</strong>
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 shrink-0">{meal.time}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                {t.noMealsYet}
              </div>
            )}
          </div>

          {/* Last 3 Days Nutritional History Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600"/> {t.historyTitle}
              </h3>
              <span className="text-[11px] font-bold text-emerald-700">IST 12:00 AM</span>
            </div>

            {intakeHistory && intakeHistory.length > 0 ? (
              <div className="space-y-2.5">
                {intakeHistory.slice(0, 3).map((day, idx) => (
                  <div
                    key={day.date || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">{day.date}</span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {day.mealsCount || 0} {t.mealsLogged}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center pt-1">
                      <div className="p-1.5 rounded-xl bg-white border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold">{t.protein}</p>
                        <p className="text-xs font-extrabold text-emerald-700">{day.protein}g</p>
                      </div>
                      <div className="p-1.5 rounded-xl bg-white border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold">{t.fiber}</p>
                        <p className="text-xs font-extrabold text-teal-700">{day.fiber}g</p>
                      </div>
                      <div className="p-1.5 rounded-xl bg-white border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold">{t.iron}</p>
                        <p className="text-xs font-extrabold text-indigo-700">{day.iron}mg</p>
                      </div>
                      <div className="p-1.5 rounded-xl bg-white border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold">{t.sugar}</p>
                        <p
                          className={`text-xs font-extrabold ${
                            day.sugar > (day.sugarGoal || 25) ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        >
                          {day.sugar}g
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                {t.noHistoryYet}
              </div>
            )}
          </div>
        </div>

        {/* Allergy-Safe Meal Suggestions */}
        {suggestedMeals.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
              {t.allergySafeMeals}
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {suggestedMeals.map((m, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <span className="text-3xl">{m.emoji}</span>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{m.name}</p>
                    <p className="text-xs font-semibold text-emerald-700">{m.fills} · {m.gain}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}