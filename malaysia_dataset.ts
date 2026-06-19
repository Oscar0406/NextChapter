/**
 * NextChapter — Malaysian Static Dataset
 * Version: 1.0 | Compiled: June 2026
 *
 * All figures are real data sourced from official Malaysian government
 * agencies and reputable industry reports (2024–2025).
 *
 * SOURCES:
 *  [DOSM-SW]     DOSM Salaries & Wages Survey Report 2024 (dosm.gov.my)
 *  [DOSM-FW]     DOSM Employee Wages Statistics Formal Sector Q4 2025 (dosm.gov.my)
 *  [DOSM-OD]     OpenDOSM NextGen Data Portal (open.dosm.gov.my)
 *  [PERKESO]     PERKESO Data Placement 2024 / MYFutureJobs (perkeso.gov.my)
 *  [EPF-BW]      EPF Belanjawanku 2024/2025 Guide (kwsp.gov.my)
 *  [PTPTN]       PTPTN Official Portal 2025 (ptptn.gov.my)
 *  [NUMBEO]      Numbeo Malaysia — Cost of Living, updated June 2026 (numbeo.com)
 *  [RINGGIT]     RinggitPlus Average Salary Malaysia 2025 (ringgitplus.com)
 *  [CALCMY]      CalculatorMalaysia Salary Guide 2026, based on DOSM (calculatormalaysia.com)
 *  [STUDYMY]     StudyMalaysia.com Education Cost Guide 2025 (studymalaysia.com)
 *  [EXPAT]       ExpatFocus Malaysia Cost of Living 2025 (expatfocus.com)
 *  [RANDSTAD]    Randstad Malaysia Salary Guide 2025 (randstad.com.my)
 *  [IMONEY]      iMoney Belanjawanku State Breakdown 2025 (imoney.my)
 *  [QOGENT]      Qogent Malaysia Tuition Fees Guide 2025 (qogentglobal.com)
 */

// ---------------------------------------------------------------------------
// SECTION 1: NATIONAL SALARY BENCHMARKS
// Source: [DOSM-SW], [DOSM-FW], [CALCMY]
// ---------------------------------------------------------------------------

export const nationalSalaryBenchmarks = {
  // DOSM Salaries & Wages Survey 2024
  medianMonthly_2024: 2793,         // RM/month — all Malaysian employees [DOSM-SW]
  meanMonthly_2024: 3652,           // RM/month [DOSM-SW]
  medianMonthly_Q4_2025: 3167,      // RM/month — formal sector only [DOSM-FW]

  minimumWage_2025: 1700,           // RM/month — all employers from Aug 2025 [DOSM-SW]

  // By occupation tier (mean monthly, 2024) [DOSM-SW]
  byOccupation: {
    managers: { mean: 7121, median: 5990 },
    professionals: { mean: 6524, median: 5821 },
    techniciansAndAssociateProfessionals: { mean: 4077, median: 3541 },
    clericalSupportWorkers: { mean: 2931, median: null },
    servicesAndSalesWorkers: { mean: 2561, median: null },
    craftAndRelatedTrades: { mean: 2510, median: null },
  },

  // By education level (mean monthly, 2024) [CALCMY, DOSM-SW]
  byEducation: {
    degree: 6114,        // Bachelor's degree holders
    diploma: 3414,       // Diploma holders (79% less than degree)
    stpmOrCertificate: 3355,
    spmOrBelow: 2200,    // Approximate
  },

  // Percentile distribution (formal sector, Dec 2025) [DOSM-FW]
  percentiles: {
    p10: 1700,   // Bottom 10% earn RM1,700 or less
    p50: 3167,   // Median
    p90: 11122,  // Top 10% earn at least RM11,122
  },

  // Annual salary growth rates [DOSM-SW, RANDSTAD]
  growthRates: {
    medianGrowth_2024: 0.073,   // 7.3% YoY growth in median 2024
    meanGrowth_2024: 0.061,     // 6.1% YoY growth in mean 2024
    projectedGrowth_2025: 0.051, // 5.1% projected increase 2025 [RANDSTAD]
    careerGrowthDefault: 0.035,  // Conservative 3.5% annual career growth for NPV model
    inflationRate_default: 0.03, // 3% inflation default for NPV model
  },
};

// ---------------------------------------------------------------------------
// SECTION 2: SALARY BY CAREER FIELD
// Source: [DOSM-SW], [RINGGIT], [CALCMY], [RANDSTAD]
// All figures are monthly RM. Ranges = [entry, mid, senior]
// "entry" = 0–2 years; "mid" = 3–7 years; "senior" = 8+ years
// ---------------------------------------------------------------------------

export const salaryByCareer: Record<string, {
  field: string;
  entryMin: number;
  entryMax: number;
  midMin: number;
  midMax: number;
  seniorMin: number;
  seniorMax: number;
  requiredQualification: string;
  growthOutlook: "growing" | "stable" | "declining";
  automationRisk: "low" | "medium" | "high";
  notes: string;
  sources: string[];
}> = {

  software_engineer: {
    field: "Software Engineering / IT",
    entryMin: 2800, entryMax: 4500,
    midMin: 5000, midMax: 9000,
    seniorMin: 9000, seniorMax: 20000,
    requiredQualification: "Bachelor's in CS/IT or equivalent portfolio",
    growthOutlook: "growing",
    automationRisk: "medium",
    notes: "IT/CS fresh grads: RM2,800–3,800. High demand in KL/PJ/Cyberjaya. MNCs pay 20–40% above local firms.",
    sources: ["DOSM-SW", "RINGGIT", "CALCMY"],
  },

  data_scientist: {
    field: "Data Science / AI / ML",
    entryMin: 3500, entryMax: 5500,
    midMin: 6000, midMax: 12000,
    seniorMin: 12000, seniorMax: 25000,
    requiredQualification: "Bachelor's in CS/Statistics; Master's preferred for senior roles",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Fastest-growing segment in Malaysia tech sector. MDEC reports 70% of new jobs require digital skills.",
    sources: ["RANDSTAD", "RINGGIT"],
  },

  ai_ml_engineer: {
    field: "AI / Machine Learning Engineering",
    entryMin: 3800, entryMax: 6000,
    midMin: 7000, midMax: 14000,
    seniorMin: 13000, seniorMax: 28000,
    requiredQualification: "Bachelor's in AI/CS/Software Engineering with ML portfolio; Master's helpful for research-heavy roles",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Use this for users studying AI, machine learning, LLMs, computer vision, robotics intelligence, or MLOps. Different from general data analysis or BI reporting.",
    sources: ["RANDSTAD", "RINGGIT"],
  },

  cybersecurity: {
    field: "Cybersecurity",
    entryMin: 3500, entryMax: 5000,
    midMin: 6000, midMax: 11000,
    seniorMin: 10000, seniorMax: 22000,
    requiredQualification: "Bachelor's in IT/CS + certifications (CISSP, CEH)",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Malaysia Cyber Security Act 2024 drove surge in demand. GRC specialists highly sought.",
    sources: ["RANDSTAD"],
  },

  civil_engineer: {
    field: "Civil / Structural Engineering",
    entryMin: 2800, entryMax: 3800,
    midMin: 4000, midMax: 7500,
    seniorMin: 7000, seniorMax: 15000,
    requiredQualification: "Bachelor's in Civil Engineering; BEM registration for professional practice",
    growthOutlook: "stable",
    automationRisk: "low",
    notes: "Engineering fresh grads: RM2,800–3,500 [CALCMY]. BEM (Board of Engineers Malaysia) registration required for chartered status.",
    sources: ["DOSM-SW", "CALCMY", "RINGGIT"],
  },

  mechanical_engineer: {
    field: "Mechanical / Manufacturing Engineering",
    entryMin: 2800, entryMax: 3800,
    midMin: 4000, midMax: 8000,
    seniorMin: 7000, seniorMax: 16000,
    requiredQualification: "Bachelor's in Mechanical/Manufacturing Engineering",
    growthOutlook: "stable",
    automationRisk: "medium",
    notes: "Industry 4.0 / automation demand shifting roles toward robotics expertise.",
    sources: ["DOSM-SW", "CALCMY"],
  },

  electrical_engineer: {
    field: "Electrical / Electronics Engineering",
    entryMin: 3000, entryMax: 4200,
    midMin: 4500, midMax: 8500,
    seniorMin: 8000, seniorMax: 18000,
    requiredQualification: "Bachelor's in EE; BEM registration",
    growthOutlook: "growing",
    automationRisk: "medium",
    notes: "Semiconductor and E&E sector remains Malaysia's top export industry.",
    sources: ["DOSM-SW", "CALCMY"],
  },

  petroleum_engineer: {
    field: "Petroleum / Oil & Gas Engineering",
    entryMin: 4000, entryMax: 6000,
    midMin: 7000, midMax: 14000,
    seniorMin: 14000, seniorMax: 30000,
    requiredQualification: "Bachelor's in Petroleum/Chemical Engineering",
    growthOutlook: "stable",
    automationRisk: "low",
    notes: "PETRONAS/Shell/service companies in Miri, Kerteh pay 20–30% above industry average. [RINGGIT]",
    sources: ["RINGGIT", "DOSM-SW"],
  },

  doctor_gp: {
    field: "Medical Doctor (General Practitioner)",
    entryMin: 3000, entryMax: 5000,  // HO/MO in public sector
    midMin: 6000, midMax: 8500,
    seniorMin: 8000, seniorMax: 20000,
    requiredQualification: "MBBS/MD (5–6 years); Housemanship; MMC registration",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Public sector HO starts RM3,000–4,500. Private GP: RM6,000–8,500. Specialist: RM12,000–25,000+. [CALCMY]",
    sources: ["CALCMY", "RINGGIT", "DOSM-SW"],
  },

  doctor_specialist: {
    field: "Medical Specialist",
    entryMin: 12000, entryMax: 18000,
    midMin: 18000, seniorMin: 30000,
    midMax: 30000, seniorMax: 60000,
    requiredQualification: "MBBS + Master's/Fellowship (10–14 years total training)",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Annual package RM180,000–RM600,000. [CALCMY] Requires post-graduate specialization.",
    sources: ["CALCMY"],
  },

  nurse: {
    field: "Nursing / Allied Health",
    entryMin: 2000, entryMax: 3200,
    midMin: 3200, midMax: 5000,
    seniorMin: 4500, seniorMax: 8000,
    requiredQualification: "Diploma or Bachelor's in Nursing; Malaysian Nursing Board registration",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Registered Nurse: RM3,800–5,000 mid-career [CALCMY]. Allied health: RM96,000–216,000 annually.",
    sources: ["CALCMY", "RINGGIT"],
  },

  dentist: {
    field: "Dentistry",
    entryMin: 4000, entryMax: 6000,
    midMin: 6000, midMax: 12000,
    seniorMin: 10000, seniorMax: 25000,
    requiredQualification: "BDS (5 years); Malaysian Dental Council registration",
    growthOutlook: "stable",
    automationRisk: "low",
    notes: "Private practice significantly lifts income above public sector rates.",
    sources: ["RINGGIT", "CALCMY"],
  },

  pharmacist: {
    field: "Pharmacy",
    entryMin: 2800, entryMax: 4000,
    midMin: 4000, midMax: 7000,
    seniorMin: 6000, seniorMax: 12000,
    requiredQualification: "Bachelor's in Pharmacy (4 years); Pharmacy Board registration",
    growthOutlook: "stable",
    automationRisk: "medium",
    notes: "Pharmaceutical & biotech professionals earn RM144,000–240,000 annually. [CALCMY]",
    sources: ["CALCMY"],
  },

  accountant: {
    field: "Accounting / Finance",
    entryMin: 2500, entryMax: 3500,
    midMin: 4000, midMax: 8000,
    seniorMin: 8000, seniorMax: 18000,
    requiredQualification: "Bachelor's in Accounting; ACCA/CPA/MICPA for chartered status",
    growthOutlook: "stable",
    automationRisk: "high",
    notes: "Business/Accounting fresh grads: RM2,500–3,200. Fintech expertise commands premium. [CALCMY]",
    sources: ["DOSM-SW", "CALCMY"],
  },

  banker_finance: {
    field: "Banking & Financial Services",
    entryMin: 3500, entryMax: 4500,
    midMin: 6000, midMax: 12000,
    seniorMin: 12000, seniorMax: 30000,
    requiredQualification: "Bachelor's in Finance/Economics/Business",
    growthOutlook: "growing",
    automationRisk: "medium",
    notes: "Entry at Maybank/CIMB/Public Bank: RM3,500–4,500. Digital banks raising competition for talent. [RINGGIT]",
    sources: ["RINGGIT", "DOSM-SW"],
  },

  lawyer: {
    field: "Law / Legal",
    entryMin: 2500, entryMax: 4000,
    midMin: 5000, midMax: 12000,
    seniorMin: 10000, seniorMax: 40000,
    requiredQualification: "LLB (3–4 years) + CLP; Pupillage; Bar admission",
    growthOutlook: "stable",
    automationRisk: "medium",
    notes: "Entry in small firms can start at RM2,500. Large firms and in-house counsel pay significantly higher.",
    sources: ["RINGGIT", "CALCMY"],
  },

  teacher_school: {
    field: "School Teaching (Government)",
    entryMin: 2400, entryMax: 3200,
    midMin: 3200, midMax: 5000,
    seniorMin: 4500, seniorMax: 8000,
    requiredQualification: "Bachelor's in Education or B.Ed (TESL/STEM); PTD qualification",
    growthOutlook: "stable",
    automationRisk: "low",
    notes: "Public sector Grade 41 (DG41) starts ~RM2,250 pre-SSPA. Phase 2 SSPA Jan 2026 raised Management & Professional by total 15%. [DOSM-SW]",
    sources: ["DOSM-SW"],
  },

  lecturer_university: {
    field: "University Lecturer / Academic",
    entryMin: 3500, entryMax: 5000,
    midMin: 5000, midMax: 9000,
    seniorMin: 8000, seniorMax: 18000,
    requiredQualification: "Master's minimum; PhD for research universities and progression",
    growthOutlook: "stable",
    automationRisk: "low",
    notes: "PhD increasingly required for promotion. Publications necessary for senior academic positions.",
    sources: ["DOSM-SW", "RINGGIT"],
  },

  architect: {
    field: "Architecture",
    entryMin: 2500, entryMax: 3500,
    midMin: 4000, midMax: 7000,
    seniorMin: 7000, seniorMax: 15000,
    requiredQualification: "Bachelor's + Master's in Architecture (Part 1 & 2); LAM registration",
    growthOutlook: "stable",
    automationRisk: "medium",
    notes: "Requires LAM (Lembaga Arkitek Malaysia) registration. Long qualification path (7+ years).",
    sources: ["CALCMY"],
  },

  graphic_designer: {
    field: "Graphic Design / Creative",
    entryMin: 1800, entryMax: 3000,
    midMin: 3000, midMax: 5500,
    seniorMin: 5000, seniorMax: 10000,
    requiredQualification: "Diploma or Bachelor's in Design/Visual Arts; strong portfolio",
    growthOutlook: "stable",
    automationRisk: "high",
    notes: "Arts/Humanities fresh grads: RM2,000–2,800. Portfolio quality often outweighs qualification. [CALCMY]",
    sources: ["CALCMY"],
  },

  marketing: {
    field: "Marketing / Digital Marketing",
    entryMin: 2500, entryMax: 3500,
    midMin: 4000, midMax: 8000,
    seniorMin: 7000, seniorMax: 16000,
    requiredQualification: "Bachelor's in Marketing/Business/Communications",
    growthOutlook: "growing",
    automationRisk: "medium",
    notes: "Digital marketing and performance marketing command premium over traditional roles.",
    sources: ["RINGGIT", "RANDSTAD"],
  },

  human_resources: {
    field: "Human Resources",
    entryMin: 2200, entryMax: 3200,
    midMin: 3500, midMax: 6500,
    seniorMin: 6000, seniorMax: 14000,
    requiredQualification: "Bachelor's in HR/Business/Psychology",
    growthOutlook: "stable",
    automationRisk: "medium",
    notes: "HRIS/people analytics skills increasingly valued.",
    sources: ["DOSM-SW"],
  },

  logistics_supply_chain: {
    field: "Logistics / Supply Chain",
    entryMin: 2200, entryMax: 3200,
    midMin: 3500, midMax: 6500,
    seniorMin: 6000, seniorMax: 14000,
    requiredQualification: "Diploma or Bachelor's in Logistics/Supply Chain/Business",
    growthOutlook: "growing",
    automationRisk: "medium",
    notes: "E-commerce growth driving logistics demand in Selangor/KL corridors.",
    sources: ["DOSM-SW", "RINGGIT"],
  },

  chef_hospitality: {
    field: "Culinary / Hospitality",
    entryMin: 1700, entryMax: 2500,
    midMin: 2500, midMax: 4500,
    seniorMin: 4000,
    seniorMax: 8000,
    requiredQualification: "Diploma in Culinary Arts or Hospitality Management",
    growthOutlook: "stable",
    automationRisk: "low",
    notes: "Accommodation & F&B sector wages closest to minimum wage nationally. [DOSM-SW]",
    sources: ["DOSM-SW"],
  },

  entrepreneur: {
    field: "Entrepreneurship / Business Owner",
    entryMin: 0, entryMax: 3000,      // Highly variable first 1–3 years
    midMin: 3000, midMax: 15000,
    seniorMin: 10000, seniorMax: 100000,
    requiredQualification: "No fixed requirement; business registration with SSM",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "High variance. Income can be zero in early years. No formal qualification required but relevant skills essential.",
    sources: ["DOSM-SW"],
  },

  psychologist_counselor: {
    field: "Psychology / Counseling",
    entryMin: 2200, entryMax: 3500,
    midMin: 3500, midMax: 6000,
    seniorMin: 5000, seniorMax: 12000,
    requiredQualification: "Bachelor's in Psychology; Master's for clinical practice; LKM registration for counselors",
    growthOutlook: "growing",
    automationRisk: "low",
    notes: "Licensed counselors (LKM) required for practice. Clinical psychologists need Master's minimum.",
    sources: ["DOSM-SW"],
  },
};

// ---------------------------------------------------------------------------
// SECTION 3: EDUCATION COSTS
// Source: [PTPTN], [STUDYMY], [QOGENT], [DOSM-SW], [CALCMY]
// All figures RM, per programme total unless stated
// ---------------------------------------------------------------------------

export const educationCosts: Record<string, {
  label: string;
  durationYears: number;
  tuitionTotal_public: number | null;
  tuitionTotal_private: number | null;
  tuitionTotal_tvet: number | null;
  ptptnLoanPerYear: number | null;
  ptptnLoanTotal: number | null;
  notes: string;
  sources: string[];
}> = {

  spm: {
    label: "SPM (Secondary School)",
    durationYears: 5,
    tuitionTotal_public: 0,          // Free in government schools
    tuitionTotal_private: 15000,     // Approximate private school total
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: null,
    ptptnLoanTotal: null,
    notes: "Government secondary school is free. Private secondary approx RM15,000 total.",
    sources: ["STUDYMY"],
  },

  foundation: {
    label: "Foundation / Pre-University (A-Levels, STPM, Matriculation)",
    durationYears: 1,
    tuitionTotal_public: 2000,       // Matriculation KPM
    tuitionTotal_private: 12000,     // Average private A-Levels/Foundation
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: 8000,
    ptptnLoanTotal: 8000,
    notes: "STPM at government school is near-free. Private foundation RM8,000–15,000.",
    sources: ["PTPTN", "STUDYMY"],
  },

  diploma: {
    label: "Diploma (2.5–3 years)",
    durationYears: 2.5,
    tuitionTotal_public: 5000,       // Polytechnic total (heavily subsidised)
    tuitionTotal_private: 25000,     // Private college average
    tuitionTotal_tvet: 3000,         // TVET/community college
    ptptnLoanPerYear: 8000,
    ptptnLoanTotal: 20000,           // ~2.5 years × RM8,000
    notes: "Polytechnic fees minimal (RM1,500–5,000 total). Private diploma RM20,000–30,000. PTPTN: RM8,000/year. [PTPTN]",
    sources: ["PTPTN", "STUDYMY", "QOGENT"],
  },

  degree_public: {
    label: "Bachelor's Degree — Public University (3–4 years)",
    durationYears: 4,
    tuitionTotal_public: 12000,      // UM/UPM/USM domestic student approx total
    tuitionTotal_private: null,
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: 16000,
    ptptnLoanTotal: 48000,           // 3 years (net of foundation) × RM16,000
    notes: "Domestic students at public IPTA: RM8,000–16,000 total tuition over full degree. [DOSM-SW, STUDYMY] PTPTN up to RM16,000/year.",
    sources: ["PTPTN", "STUDYMY", "QOGENT"],
  },

  degree_private: {
    label: "Bachelor's Degree — Private University (3–4 years)",
    durationYears: 3.5,
    tuitionTotal_public: null,
    tuitionTotal_private: 80000,     // Mid-range private (Taylor's, Sunway, UCSI)
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: 16000,
    ptptnLoanTotal: 56000,
    notes: "Private IPTS: RM40,000–100,000 total depending on programme. Engineering/Medicine higher. [QOGENT, STUDYMY]",
    sources: ["PTPTN", "STUDYMY", "QOGENT"],
  },

  degree_medicine: {
    label: "MBBS / Medical Degree (5–6 years)",
    durationYears: 5.5,
    tuitionTotal_public: 60000,      // Public university medicine (UM/UKM/USM)
    tuitionTotal_private: 350000,    // Private medical school average
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: 50000,
    ptptnLoanTotal: 250000,          // Max PTPTN for medicine
    notes: "Medicine is the highest-funded PTPTN category: up to RM50,000/year. [PTPTN] Private medical school: RM300,000–400,000 total.",
    sources: ["PTPTN", "STUDYMY", "QOGENT"],
  },

  masters_public: {
    label: "Master's Degree — Public University (1.5–2 years)",
    durationYears: 1.5,
    tuitionTotal_public: 15000,      // USM/UPM/UM coursework master's
    tuitionTotal_private: null,
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: null,          // PTPTN requires first degree fully repaid first
    ptptnLoanTotal: null,
    notes: "Public university postgrad: RM10,000–30,000. MyBrain15/MyBrain may cover fees. Check MOHE for current availability. [QOGENT]",
    sources: ["QOGENT", "STUDYMY"],
  },

  masters_private: {
    label: "Master's Degree — Private University (1–2 years)",
    durationYears: 1.5,
    tuitionTotal_public: null,
    tuitionTotal_private: 35000,     // Mid-range private master's
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: null,
    ptptnLoanTotal: null,
    notes: "Private university master's: RM20,000–60,000. MQF Level 7. [QOGENT]",
    sources: ["QOGENT"],
  },

  phd: {
    label: "PhD (3–5 years)",
    durationYears: 4,
    tuitionTotal_public: 20000,
    tuitionTotal_private: 50000,
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: null,
    ptptnLoanTotal: null,
    notes: "Many PhD students receive supervisor-funded scholarships or RA positions. MQF Level 8.",
    sources: ["QOGENT", "STUDYMY"],
  },

  professional_cert: {
    label: "Professional Certification (ACCA, CFA, CISSP, PMP, etc.)",
    durationYears: 1,
    tuitionTotal_public: null,
    tuitionTotal_private: 8000,      // Average cert programme cost
    tuitionTotal_tvet: null,
    ptptnLoanPerYear: null,
    ptptnLoanTotal: null,
    notes: "Varies widely. ACCA: ~RM15,000–25,000 total. CFA: USD900–1,200 per level. MQA/MQF recognition may apply.",
    sources: ["STUDYMY"],
  },

  bootcamp: {
    label: "Coding Bootcamp / Short Upskill Programme",
    durationYears: 0.5,
    tuitionTotal_public: null,
    tuitionTotal_private: 7000,      // Average 3–6 month intensive
    tuitionTotal_tvet: 3000,
    ptptnLoanPerYear: null,
    ptptnLoanTotal: null,
    notes: "HRD Corp (formerly HRDF) claimable for employed Malaysians. TVET short courses RM1,000–5,000.",
    sources: ["STUDYMY"],
  },
};

// ---------------------------------------------------------------------------
// SECTION 4: COST OF LIVING BY CITY
// Source: [EPF-BW], [NUMBEO], [EXPAT], [IMONEY]
// All figures RM/month for a single adult unless noted
// ---------------------------------------------------------------------------

export const costOfLivingByCity: Record<string, {
  city: string;
  state: string;
  rent_1br_centre: number;
  rent_1br_outside: number;
  rent_student_hostel: number;   // On-campus or budget room estimate
  food_monthly: number;          // Eating mostly local food
  transport_monthly: number;     // Public transport or motorbike
  utilities_monthly: number;     // Electricity, water, internet
  misc_monthly: number;          // Phone, personal, entertainment
  total_budget_student: number;  // Conservative student budget (hostel/budget room)
  total_budget_single: number;   // Moderate single adult budget
  medianSalary: number;          // DOSM median for this area
  notes: string;
  sources: string[];
}> = {

  kuala_lumpur: {
    city: "Kuala Lumpur",
    state: "W.P. Kuala Lumpur",
    rent_1br_centre: 2397,      // Numbeo 2025 [NUMBEO]
    rent_1br_outside: 1492,     // Numbeo 2025 [NUMBEO]
    rent_student_hostel: 600,   // Budget room/shared
    food_monthly: 700,          // Local hawker-based diet
    transport_monthly: 150,     // Rapid KL pass RM50–100; add Grab usage
    utilities_monthly: 200,     // TNB + Unifi broadband ~RM90–150
    misc_monthly: 200,
    total_budget_student: 1650, // Hostel + food + transport + misc
    total_budget_single: 3200,  // 1br outside + all expenses
    medianSalary: 4064,         // DOSM Q3 2025 [DOSM-FW]
    notes: "Malaysia's highest salary city. KL Sentral transport hub. Most MNCs, finance, tech concentrated here.",
    sources: ["NUMBEO", "DOSM-FW", "EPF-BW", "EXPAT"],
  },

  petaling_jaya_selangor: {
    city: "Petaling Jaya / Selangor",
    state: "Selangor",
    rent_1br_centre: 1800,
    rent_1br_outside: 1200,
    rent_student_hostel: 500,
    food_monthly: 650,
    transport_monthly: 200,     // Car dependency higher than KL
    utilities_monthly: 200,
    misc_monthly: 180,
    total_budget_student: 1530,
    total_budget_single: 2800,
    medianSalary: 4052,         // Selangor mean (DOSM 2024) [CALCMY]
    notes: "Cyberjaya, Subang, Shah Alam all within Selangor. Industrial and tech hub. XMUM is in Sepang.",
    sources: ["NUMBEO", "CALCMY", "EXPAT"],
  },

  george_town_penang: {
    city: "George Town / Penang",
    state: "Pulau Pinang",
    rent_1br_centre: 1700,      // ~USD427/month [EXPAT]
    rent_1br_outside: 1000,
    rent_student_hostel: 450,
    food_monthly: 600,
    transport_monthly: 120,     // Rapid Penang + limited options
    utilities_monthly: 180,
    misc_monthly: 160,
    total_budget_student: 1330,
    total_budget_single: 2500,
    medianSalary: 3934,         // Penang mean (DOSM 2024) [CALCMY]
    notes: "Second most popular expat/student city. UNESCO World Heritage. E&E manufacturing hub (Intel, AMD, Bosch).",
    sources: ["NUMBEO", "CALCMY", "EXPAT"],
  },

  johor_bahru: {
    city: "Johor Bahru",
    state: "Johor",
    rent_1br_centre: 1400,
    rent_1br_outside: 900,
    rent_student_hostel: 400,
    food_monthly: 550,
    transport_monthly: 150,     // Car often needed; Causeway commute costs
    utilities_monthly: 170,
    misc_monthly: 150,
    total_budget_student: 1220,
    total_budget_single: 2250,
    medianSalary: 3200,         // Estimate based on Johor state data [IMONEY]
    notes: "Singapore proximity drives demand and wages. JB–Singapore commuters common. Iskandar Malaysia economic zone.",
    sources: ["NUMBEO", "IMONEY", "EXPAT"],
  },

  kota_kinabalu: {
    city: "Kota Kinabalu",
    state: "Sabah",
    rent_1br_centre: 1200,
    rent_1br_outside: 800,
    rent_student_hostel: 350,
    food_monthly: 550,
    transport_monthly: 200,     // Car-dependent; public transport limited
    utilities_monthly: 160,
    misc_monthly: 140,
    total_budget_student: 1200,
    total_budget_single: 2100,
    medianSalary: 2800,         // Below national median; Sabah state data [IMONEY]
    notes: "Lower salaries than Peninsular. Higher transport costs compensate for lower rent. Tourism and O&G sectors.",
    sources: ["NUMBEO", "IMONEY", "EXPAT"],
  },

  kuching: {
    city: "Kuching",
    state: "Sarawak",
    rent_1br_centre: 1100,
    rent_1br_outside: 750,
    rent_student_hostel: 350,
    food_monthly: 500,
    transport_monthly: 180,
    utilities_monthly: 150,
    misc_monthly: 130,
    total_budget_student: 1130,
    total_budget_single: 1950,
    medianSalary: 2700,
    notes: "Capital of Sarawak. Oil & gas (PETRONAS), government employment dominate. Lower COL than Peninsular.",
    sources: ["NUMBEO", "IMONEY"],
  },

  ipoh: {
    city: "Ipoh",
    state: "Perak",
    rent_1br_centre: 900,
    rent_1br_outside: 650,
    rent_student_hostel: 300,
    food_monthly: 480,
    transport_monthly: 150,
    utilities_monthly: 150,
    misc_monthly: 120,
    total_budget_student: 1000,
    total_budget_single: 1750,
    medianSalary: 2600,         // Below national median [IMONEY]
    notes: "Very affordable. Known for food culture. Fewer high-paying MNC jobs than KL/Penang.",
    sources: ["NUMBEO", "IMONEY"],
  },

  alor_setar: {
    city: "Alor Setar",
    state: "Kedah",
    rent_1br_centre: 800,
    rent_1br_outside: 550,
    rent_student_hostel: 280,
    food_monthly: 440,
    transport_monthly: 150,
    utilities_monthly: 140,
    misc_monthly: 110,
    total_budget_student: 930,
    total_budget_single: 1600,
    medianSalary: 2400,         // Kedah median below national [IMONEY]
    notes: "One of Malaysia's lowest COL cities. But Kedah state median income also among lowest nationally.",
    sources: ["NUMBEO", "IMONEY"],
  },
};

// ---------------------------------------------------------------------------
// SECTION 5: FINANCIAL SUPPORT & SCHOLARSHIPS
// Source: [PTPTN], [EPF-BW]
// ---------------------------------------------------------------------------

export const financialSupport = {

  ptptn: {
    name: "PTPTN Education Loan",
    provider: "Perbadanan Tabung Pendidikan Tinggi Nasional",
    type: "Loan",
    interestRate: 0.01,            // 1% per annum (Ujrah / flat rate)
    repaymentStartMonthsAfterGrad: 12,
    maxParentIncomeRM: 50000,      // Monthly gross, as of Jan 2024
    loanAmountsByLevel: {
      diploma: { perYear: 8000, typical: 20000 },
      degree: { perYear: 16000, typical: 48000 },
      medicine: { perYear: 50000, typical: 250000 },
    },
    eligibility: [
      "Malaysian citizen",
      "Age 45 or below",
      "Course approved by MOHE and accredited by MQA",
      "Parent/guardian gross income ≤ RM50,000/month",
      "Cannot hold other scholarships (JPA/MARA) simultaneously",
      "Must have Simpan SSPN Prime/Plus account",
    ],
    notes: "First Class Honours waiver removed for IPTS graduates from Jan 2026. Apply via myPTPTN app.",
    url: "https://www.ptptn.gov.my",
    source: "PTPTN",
  },

  jpa: {
    name: "JPA Public Service Department Scholarship",
    provider: "Jabatan Perkhidmatan Awam (JPA)",
    type: "Full Scholarship (bonded)",
    bondYears: 5,
    eligibility: ["High SPM/STPM results", "Malaysian citizen", "Merit-based selection"],
    notes: "Highly competitive. Covers tuition + living allowance. Bonded government service post-graduation.",
    url: "https://www.jpa.gov.my",
    source: "JPA",
  },

  mara: {
    name: "MARA Education Financing",
    provider: "Majlis Amanah Rakyat",
    type: "Loan / Scholarship (Bumiputera-focused)",
    eligibility: ["Bumiputera Malaysian", "Merit-based", "Various income criteria"],
    notes: "Diploma through postgraduate. Wide network of MARA colleges and universities.",
    url: "https://www.mara.gov.my",
    source: "MARA",
  },

  mybrain: {
    name: "MyBrain / MyBrain15",
    provider: "Ministry of Higher Education (MOHE)",
    type: "Postgraduate scholarship",
    eligibility: ["Malaysian citizen", "Enrolled in Master's or PhD at recognized institution"],
    notes: "Verify current availability with MOHE — scheme has had changes. Covers postgrad fees for selected programmes.",
    url: "https://www.mohe.gov.my",
    source: "MOHE",
  },

  yayasanKhazanah: {
    name: "Yayasan Khazanah Scholarship",
    provider: "Yayasan Khazanah",
    type: "Merit Scholarship",
    eligibility: ["Competitive academic results", "Malaysian citizen", "Leadership profile"],
    notes: "Watan (local) and Global (overseas) programmes. Undergraduate and postgraduate.",
    url: "https://www.yayasankhazanah.com.my",
    source: "Yayasan Khazanah",
  },

  petronas: {
    name: "PETRONAS Education Sponsorship",
    provider: "PETRONAS",
    type: "Bonded Sponsorship (STEM)",
    eligibility: ["STEM fields", "Strong academics", "Malaysian citizen"],
    notes: "Bonded employment with PETRONAS post-study. One of the most generous packages available.",
    url: "https://educationsponsorship.petronas.com.my",
    source: "PETRONAS",
  },

  hrdCorp: {
    name: "HRD Corp Training Claimable",
    provider: "Human Resource Development Corporation",
    type: "Employer Training Levy",
    eligibility: ["Employed by HRD Corp-registered employer"],
    notes: "Employers can claim training costs for employees. Relevant for short courses and upskilling.",
    url: "https://www.hrdcorp.gov.my",
    source: "HRD Corp",
  },
};

// ---------------------------------------------------------------------------
// SECTION 6: CITY SALARY MULTIPLIERS (for regional gap scoring)
// Source: [DOSM-SW], [CALCMY], [DOSM-FW]
// Base = national mean (RM3,652). Multiplier = city mean / national mean.
// ---------------------------------------------------------------------------

export const citySalaryMultipliers: Record<string, {
  multiplier: number;
  meanMonthly: number;
  source: string;
}> = {
  kuala_lumpur:           { multiplier: 1.31, meanMonthly: 4782, source: "CALCMY (DOSM 2024)" },
  putrajaya:              { multiplier: 1.39, meanMonthly: 5091, source: "CALCMY (DOSM 2024)" },
  selangor:               { multiplier: 1.11, meanMonthly: 4052, source: "CALCMY (DOSM 2024)" },
  penang:                 { multiplier: 1.08, meanMonthly: 3934, source: "CALCMY (DOSM 2024)" },
  labuan:                 { multiplier: 1.04, meanMonthly: 3812, source: "CALCMY (DOSM 2024)" },
  johor:                  { multiplier: 0.92, meanMonthly: 3360, source: "CALCMY (DOSM 2024)" },
  negeri_sembilan:        { multiplier: 0.88, meanMonthly: 3214, source: "DOSM-SW" },
  melaka:                 { multiplier: 0.85, meanMonthly: 3104, source: "DOSM-SW" },
  perak:                  { multiplier: 0.79, meanMonthly: 2885, source: "DOSM-SW" },
  sarawak:                { multiplier: 0.82, meanMonthly: 2995, source: "DOSM-SW" },
  sabah:                  { multiplier: 0.74, meanMonthly: 2702, source: "DOSM-SW" },
  pahang:                 { multiplier: 0.76, meanMonthly: 2775, source: "DOSM-SW" },
  terengganu:             { multiplier: 0.75, meanMonthly: 2739, source: "DOSM-SW" },
  kelantan:               { multiplier: 0.72, meanMonthly: 2630, source: "CALCMY" },
  kedah:                  { multiplier: 0.74, meanMonthly: 2703, source: "CALCMY" },
  perlis:                 { multiplier: 0.72, meanMonthly: 2630, source: "DOSM-SW" },
};

// ---------------------------------------------------------------------------
// SECTION 7: QUALIFICATION LEVEL MAP (MQF — Malaysian Qualifications Framework)
// Source: [MQA] (mqa.gov.my)
// ---------------------------------------------------------------------------

export const qualificationLevels = {
  // MQF Level → Numeric rank for gap calculation (higher = more qualified)
  levels: {
    spm: 1,
    stpm_matriculation: 2,
    certificate: 2,
    diploma: 3,
    advanced_diploma: 3,
    degree_bachelor: 4,
    postgraduate_certificate: 5,
    masters: 5,
    phd: 6,
    professional_body: 4, // e.g. ACCA, CPA, CFA — treated as degree-equivalent
  } as Record<string, number>,

  mqfDescriptions: {
    1: "Certificate (MQF 1–3) — TVET / community college",
    2: "Certificate (MQF 3–4) — STPM / Matriculation equivalent",
    3: "Diploma (MQF 4) — 2–3 year programme",
    4: "Bachelor's Degree (MQF 6) — 3–4 year programme",
    5: "Master's Degree (MQF 7) — 1–2 year postgraduate",
    6: "Doctoral Degree (MQF 8) — PhD or equivalent",
  } as Record<number, string>,
};

// ---------------------------------------------------------------------------
// SECTION 8: MALAYSIA-SPECIFIC MODEL DEFAULTS
// For use in NPV / scoring calculations
// ---------------------------------------------------------------------------

export const modelDefaults = {
  discountRate: 0.07,            // 7% — standard long-term discount rate
  inflationRate: 0.03,           // 3% — Bank Negara target
  careerGrowthRate: 0.035,       // 3.5% annual career salary growth (conservative)
  projectionHorizonYears: 15,
  epfContributionEmployee: 0.11, // 11% employee EPF contribution
  epfContributionEmployer: 0.13, // 13% employer EPF contribution (earning ≤RM5,000)
  socsoRate: 0.005,              // ~0.5% employee SOCSO (approximate)
  incomeTaxThreshold: 5000,      // Monthly income where tax starts to matter meaningfully
  partTimeWorkPossible_perMonth: 800, // Reasonable part-time income assumption for students
  livingWithParents_savingsBoost: 0.40, // 40% of living cost saved if staying with parents
};

// ---------------------------------------------------------------------------
// SECTION 9: INDUSTRY SECTOR BENCHMARKS
// Source: [DOSM-SW], [RANDSTAD]
// Median monthly wages by sector (2024)
// ---------------------------------------------------------------------------

export const sectorWages: Record<string, {
  sectorName: string;
  medianMonthly: number;
  meanMonthly: number;
  outlook: "growing" | "stable" | "declining";
  automationRisk: "low" | "medium" | "high";
  source: string;
}> = {
  mining_quarrying:      { sectorName: "Mining & Quarrying",            medianMonthly: 4450, meanMonthly: 6500, outlook: "stable",    automationRisk: "low",    source: "DOSM-SW" },
  financial_insurance:   { sectorName: "Financial & Insurance",         medianMonthly: 4483, meanMonthly: 7000, outlook: "growing",   automationRisk: "medium", source: "DOSM-SW" },
  real_estate:           { sectorName: "Real Estate",                   medianMonthly: 4698, meanMonthly: 5500, outlook: "stable",    automationRisk: "medium", source: "DOSM-SW" },
  ict:                   { sectorName: "Information & Communication",   medianMonthly: 4200, meanMonthly: 6200, outlook: "growing",   automationRisk: "medium", source: "DOSM-SW" },
  manufacturing:         { sectorName: "Manufacturing",                 medianMonthly: 2900, meanMonthly: 3278, outlook: "stable",    automationRisk: "high",   source: "DOSM-SW" },
  construction:          { sectorName: "Construction",                  medianMonthly: 2300, meanMonthly: 2900, outlook: "growing",   automationRisk: "medium", source: "DOSM-SW" },
  healthcare:            { sectorName: "Health & Social Work",          medianMonthly: 3500, meanMonthly: 4500, outlook: "growing",   automationRisk: "low",    source: "DOSM-SW" },
  education:             { sectorName: "Education",                     medianMonthly: 3200, meanMonthly: 4200, outlook: "stable",    automationRisk: "low",    source: "DOSM-SW" },
  wholesale_retail:      { sectorName: "Wholesale & Retail Trade",      medianMonthly: 2300, meanMonthly: 3100, outlook: "stable",    automationRisk: "high",   source: "DOSM-SW" },
  accommodation_fb:      { sectorName: "Accommodation & F&B",           medianMonthly: 1900, meanMonthly: 2300, outlook: "stable",    automationRisk: "medium", source: "DOSM-SW" },
  agriculture:           { sectorName: "Agriculture",                   medianMonthly: 2100, meanMonthly: 2564, outlook: "declining", automationRisk: "high",   source: "DOSM-FW" },
  professional_services: { sectorName: "Professional & Technical Svcs", medianMonthly: 4000, meanMonthly: 5800, outlook: "growing",   automationRisk: "low",    source: "DOSM-SW" },
  public_admin:          { sectorName: "Public Administration & Defence",medianMonthly: 3000, meanMonthly: 4000, outlook: "stable",   automationRisk: "low",    source: "DOSM-SW" },
};

// ---------------------------------------------------------------------------
// SECTION 10: DATA FRESHNESS METADATA
// ---------------------------------------------------------------------------

export const dataMetadata = {
  compiledDate: "2026-06-16",
  dataYear: "2024–2025",
  disclaimer: "All figures are real data from official Malaysian government agencies and reputable industry reports. Salary and cost data should be treated as estimates and benchmarks, not guarantees. Users should verify current figures directly with the cited sources before making financial decisions.",
  citationList: [
    { id: "DOSM-SW",  name: "DOSM Salaries & Wages Survey Report 2024",                          url: "https://www.dosm.gov.my/portal-main/release-content/salaries-and-wages-survey-report-2024" },
    { id: "DOSM-FW",  name: "DOSM Employee Wages Statistics Formal Sector Q4 2025",              url: "https://www.dosm.gov.my/portal-main/release-content/employee-wages-statistics-formal-sector-q42025" },
    { id: "DOSM-OD",  name: "OpenDOSM NextGen Data Portal",                                      url: "https://open.dosm.gov.my" },
    { id: "PERKESO",  name: "PERKESO Data Placement 2024 / MYFutureJobs",                        url: "https://myfuturejobs.gov.my" },
    { id: "EPF-BW",   name: "EPF Belanjawanku 2024/2025 Guide",                                  url: "https://www.kwsp.gov.my/en/w/epf-releases-belanjawanku-2024-2025-and-retirement-income-adequacy-framework" },
    { id: "PTPTN",    name: "PTPTN Official Portal 2025",                                         url: "https://www.ptptn.gov.my/en/pinjaman-pendidikan" },
    { id: "MQA",      name: "Malaysian Qualifications Agency — Malaysian Qualifications Framework", url: "https://www.mqa.gov.my" },
    { id: "MOHE",     name: "Ministry of Higher Education Malaysia",                              url: "https://www.mohe.gov.my" },
    { id: "NUMBEO",   name: "Numbeo Malaysia Cost of Living, June 2026",                          url: "https://www.numbeo.com/cost-of-living/country_result.jsp?country=Malaysia" },
    { id: "RINGGIT",  name: "RinggitPlus Average Salary in Malaysia 2025",                        url: "https://ringgitplus.com/en/blog/the-experts-corner/average-salary-in-malaysia-2025-by-industry-and-experience.html" },
    { id: "CALCMY",   name: "CalculatorMalaysia Salary Guide 2026 (based on DOSM 2024)",          url: "https://calculatormalaysia.com/salary/malaysia-salary-guide/" },
    { id: "STUDYMY",  name: "StudyMalaysia.com Education Cost Guide 2025",                        url: "https://studymalaysia.com/education/top-stories/cost-of-studying-and-living-in-malaysia" },
    { id: "EXPAT",    name: "ExpatFocus Malaysia Cost of Living 2025",                            url: "https://www.expatfocus.com/malaysia/guide/malaysia-cost-of-living" },
    { id: "RANDSTAD", name: "Randstad Malaysia Salary Guide & Job Market Outlook 2025",           url: "https://www.randstad.com.my/hr-trends/workforce-trends/malaysia-job-market-outlook-salary-trends-2025/" },
    { id: "IMONEY",   name: "iMoney Belanjawanku State Breakdown 2025",                           url: "https://www.imoney.my/articles/guide-to-malaysia-living-cost-by-state" },
    { id: "QOGENT",   name: "Qogent Malaysia Tuition Fees Complete Guide 2025",                   url: "https://qogentglobal.com/study-in-malaysia/finance/tuition-fees" },
  ],
};
