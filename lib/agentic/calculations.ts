import type {
  AmbitionLevel,
  CandidatePathway,
  CalculationTrace,
  FinancialProjectionMYR,
  MalaysianUserProfile,
  PathwayFlowchartResult,
  RiskLevel,
  ScoreBreakdownMYR,
  YearlyProjectionMYR,
} from "@/lib/agentic/types";
import {
  getCitySalaryMultiplier,
  getEducationTotalCost,
  getMalaysiaModelDefaults,
  getQualificationRank,
  getRequiredQualificationRank,
  resolveCareer,
  resolveCity,
  resolveEducation,
  resolveSector,
  selectCitationSources,
} from "@/lib/agentic/malaysia-data";

type RankedPathway = PathwayFlowchartResult & {
  decisionValue: number;
};

type CoreScoreFactors = Pick<
  ScoreBreakdownMYR,
  "financial" | "qualification" | "salaryFit" | "timeline" | "marketDemand" | "risk"
>;

const PROJECTION_HORIZON_YEARS = 15;
const AMBITION_CAPS: Record<AmbitionLevel, number> = {
  standard: 95,
  competitive: 75,
  elite: 45,
  global_elite: 18,
};

const AMBITION_ORDER: Record<AmbitionLevel, number> = {
  standard: 0,
  competitive: 1,
  elite: 2,
  global_elite: 3,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(a: number, b: number) {
  return (a + b) / 2;
}

function riskValue(risk: RiskLevel) {
  if (risk === "low") return 85;
  if (risk === "medium") return 68;
  return 50;
}

function riskPenalty(risk: RiskLevel) {
  if (risk === "low") return 0;
  if (risk === "medium") return 7;
  return 16;
}

function outlookGrowthAdjustment(outlook: "growing" | "stable" | "declining") {
  if (outlook === "growing") return 0.012;
  if (outlook === "stable") return 0;
  return -0.01;
}

function automationDemandAdjustment(risk: "low" | "medium" | "high") {
  if (risk === "low") return 8;
  if (risk === "medium") return 0;
  return -10;
}

function ambitionLabel(level: AmbitionLevel) {
  if (level === "global_elite") return "global elite";
  return level;
}

function harderAmbition(a: AmbitionLevel, b: AmbitionLevel) {
  return AMBITION_ORDER[a] >= AMBITION_ORDER[b] ? a : b;
}

function detectAmbitionFromText(text: string): AmbitionLevel {
  const normalised = text.toLowerCase();
  const globalEliteTerms = [
    "oscar",
    "academy award",
    "hollywood lead",
    "hollywood star",
    "olympic",
    "world cup",
    "grammy",
    "nobel",
    "billionaire",
    "unicorn founder",
    "world famous",
    "global superstar",
  ];
  const eliteTerms = [
    "hollywood",
    "international actor",
    "famous actor",
    "celebrity",
    "national team",
    "top university",
    "ivy league",
    "ceo of a public company",
  ];
  const competitiveTerms = [
    "singapore",
    "overseas",
    "scholarship",
    "pilot",
    "doctor",
    "lawyer",
    "investment banking",
    "startup founder",
  ];

  if (globalEliteTerms.some((term) => normalised.includes(term))) return "global_elite";
  if (eliteTerms.some((term) => normalised.includes(term))) return "elite";
  if (competitiveTerms.some((term) => normalised.includes(term))) return "competitive";
  return "standard";
}

function resolvedAmbitionLevel(profile: MalaysianUserProfile, candidate: CandidatePathway): AmbitionLevel {
  const declared = candidate.ambitionLevel ?? "standard";
  const combinedText = [
    profile.currentCondition,
    profile.dreamLife,
    profile.desiredCareer,
    profile.desiredLifestyle,
    candidate.title,
    candidate.rarityReason,
    ...candidate.flowSteps,
    ...candidate.assumptions,
  ]
    .filter(Boolean)
    .join(" ");

  return harderAmbition(declared, detectAmbitionFromText(combinedText));
}

function evidenceBoost(profile: MalaysianUserProfile, candidate: CandidatePathway) {
  const combinedText = [
    profile.currentCondition,
    profile.dreamLife,
    profile.fieldOfStudy,
    profile.desiredCareer,
    ...profile.skills,
    ...profile.assumptions,
    ...candidate.requiredSkills,
    ...candidate.assumptions,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const evidenceChecks = [
    { pattern: /\b(award|winner|won|finalist|festival selection|competition finalist)\b/, boost: 3, reason: "award or finalist evidence" },
    { pattern: /\b(portfolio|showreel|github|published|publication|imdb|patent)\b/, boost: 3, reason: "portfolio or public work evidence" },
    { pattern: /\b(agent|agency|represented|manager|mentor|industry network)\b/, boost: 3, reason: "industry representation or network evidence" },
    { pattern: /\b(professional|paid client|revenue|funding|investment|contract)\b/, boost: 3, reason: "paid professional or funding evidence" },
    { pattern: /\b(national|state level|elite admission|offer letter|licensed|registered)\b/, boost: 3, reason: "formal credential or selection evidence" },
  ];

  const reasons: string[] = [];
  const value = evidenceChecks.reduce((total, check) => {
    if (!check.pattern.test(combinedText)) return total;
    reasons.push(check.reason);
    return total + check.boost;
  }, 0);

  return {
    value: Math.min(12, value),
    reasons,
  };
}

function formatRM(value: number) {
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}

function formatPercent(value: number) {
  return `${round(value, 1)}%`;
}

function cleanAssumptions(values: string[]) {
  const blockedPrefixes = [
    "collectinfo summary used:",
    "career intent classifier:",
    "follow-up answer for",
    "auto web grounding reason:",
    "live web grounding query:",
    "web grounding cache status:",
    "web grounding cache save status:",
    "web grounding cache note:",
    "web grounding cache warning:",
    "planning agent web-search decision:",
  ];
  const seen = new Set<string>();

  return values.filter((value) => {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return false;
    seen.add(key);
    return !blockedPrefixes.some((prefix) => key.startsWith(prefix));
  });
}

function getStudyAnnualCost(totalEducationCostRM: number, durationYears: number) {
  if (durationYears <= 0) return 0;
  return totalEducationCostRM / durationYears;
}

function getScenarioSalaryMonth(
  year: number,
  studyYears: number,
  partTimeIncomeRM: number,
  entryMonthlyRM: number,
  seniorMonthlyRM: number,
  growthRate: number,
) {
  if (year <= Math.ceil(studyYears)) return partTimeIncomeRM;

  const careerYear = year - Math.ceil(studyYears) - 1;
  return Math.min(seniorMonthlyRM, entryMonthlyRM * (1 + growthRate) ** careerYear);
}

function buildYearlyProjection(params: {
  studyYears: number;
  totalEducationCostRM: number;
  studentMonthlyLivingRM: number;
  adultMonthlyLivingRM: number;
  partTimeIncomeRM: number;
  entryMonthlyRM: number;
  seniorMonthlyRM: number;
  growthRate: number;
  inflationRate: number;
  discountRate: number;
}): YearlyProjectionMYR[] {
  const studyAnnualCost = getStudyAnnualCost(params.totalEducationCostRM, params.studyYears);
  let cumulativeNpvRM = 0;

  return Array.from({ length: PROJECTION_HORIZON_YEARS }, (_, index) => {
    const year = index + 1;
    const studying = year <= Math.ceil(params.studyYears);
    const monthlySalaryRM = getScenarioSalaryMonth(
      year,
      params.studyYears,
      params.partTimeIncomeRM,
      params.entryMonthlyRM,
      params.seniorMonthlyRM,
      params.growthRate,
    );
    const monthlyLivingCostRM =
      (studying ? params.studentMonthlyLivingRM : params.adultMonthlyLivingRM) *
      (1 + params.inflationRate) ** (year - 1);
    const annualEducationCostRM = studying ? studyAnnualCost : 0;
    const annualSalaryRM = monthlySalaryRM * 12;
    const annualLivingCostRM = monthlyLivingCostRM * 12;
    const netCashFlowRM = annualSalaryRM - annualLivingCostRM - annualEducationCostRM;
    const discountedCashFlowRM = netCashFlowRM / (1 + params.discountRate) ** year;

    cumulativeNpvRM += discountedCashFlowRM;

    return {
      year,
      monthlySalaryRM: round(monthlySalaryRM),
      annualSalaryRM: round(annualSalaryRM),
      annualLivingCostRM: round(annualLivingCostRM),
      annualEducationCostRM: round(annualEducationCostRM),
      netCashFlowRM: round(netCashFlowRM),
      discountedCashFlowRM: round(discountedCashFlowRM),
      cumulativeNpvRM: round(cumulativeNpvRM),
    };
  });
}

function findBreakEvenYear(projection: YearlyProjectionMYR[]) {
  return projection.find((row) => row.cumulativeNpvRM >= 0)?.year ?? null;
}

function buildScoreBreakdown(params: {
  npvRM: number;
  educationCostRM: number;
  debtRM: number;
  currentQualificationRank: number;
  requiredQualificationRank: number;
  skillCount: number;
  projectedMonthlyAtTimelineRM: number;
  targetMonthlySalaryRM: number;
  studyYears: number;
  timelineYears: number;
  outlook: "growing" | "stable" | "declining";
  automationRisk: "low" | "medium" | "high";
  candidateRisk: RiskLevel;
  userRiskTolerance: RiskLevel | undefined;
}): CoreScoreFactors {
  const qualificationGap = Math.max(0, params.requiredQualificationRank - params.currentQualificationRank);
  const outlookBase = params.outlook === "growing" ? 82 : params.outlook === "stable" ? 68 : 45;
  const userRiskAdjustment =
    params.userRiskTolerance === "high" ? 8 : params.userRiskTolerance === "low" && params.candidateRisk === "high" ? -12 : 0;

  return {
    financial: round(clamp(55 + (params.npvRM / 250000) * 30 - (params.educationCostRM / 100000) * 15 - (params.debtRM / 50000) * 15, 10, 95)),
    qualification: round(clamp(100 - qualificationGap * 22 + params.skillCount * 2, 15, 100)),
    salaryFit: round(clamp((params.projectedMonthlyAtTimelineRM / Math.max(1, params.targetMonthlySalaryRM)) * 100, 10, 100)),
    timeline: round(
      clamp(
        params.studyYears <= params.timelineYears
          ? 100 - (params.studyYears / Math.max(1, params.timelineYears)) * 20
          : 100 - ((params.studyYears - params.timelineYears) / Math.max(1, params.timelineYears)) * 70,
        10,
        100,
      ),
    ),
    marketDemand: round(clamp(outlookBase + automationDemandAdjustment(params.automationRisk), 10, 95)),
    risk: round(clamp(riskValue(params.candidateRisk) + userRiskAdjustment, 10, 95)),
  };
}

function baseFeasibility(scores: CoreScoreFactors) {
  return round(
    clamp(
      scores.financial * 0.25 +
        scores.qualification * 0.2 +
        scores.salaryFit * 0.2 +
        scores.timeline * 0.15 +
        scores.marketDemand * 0.1 +
        scores.risk * 0.1,
      5,
      95,
    ),
  );
}

function buildFeasibilityBreakdown(params: {
  scores: CoreScoreFactors;
  ambitionLevel: AmbitionLevel;
  evidenceBoost: number;
}): ScoreBreakdownMYR {
  const base = baseFeasibility(params.scores);
  const ambitionCap = AMBITION_CAPS[params.ambitionLevel];
  const finalFeasibility = round(clamp(Math.min(base, ambitionCap + params.evidenceBoost), 5, 95));

  return {
    ...params.scores,
    baseFeasibility: base,
    ambitionCap,
    evidenceBoost: params.evidenceBoost,
    finalFeasibility,
  };
}

function sacrificeIndex(params: {
  educationCostRM: number;
  studyYears: number;
  housingRatio: number;
  salaryFitScore: number;
  risk: RiskLevel;
}) {
  const financialPressure = clamp((params.educationCostRM / 100000) * 100, 0, 100);
  const timePressure = clamp((params.studyYears / 6) * 100, 0, 100);
  const housingPressure = clamp((Math.max(0, params.housingRatio - 0.3) / 0.35) * 100, 0, 100);
  const salaryPressure = 100 - params.salaryFitScore;
  const riskPressure = 100 - riskValue(params.risk);

  return round(
    clamp(
      financialPressure * 0.28 + timePressure * 0.22 + housingPressure * 0.18 + salaryPressure * 0.22 + riskPressure * 0.1,
      0,
      100,
    ),
  );
}

function buildCalculationTraces(params: {
  careerField: string;
  cityName: string;
  educationLabel: string;
  entryAverageRM: number;
  cityMultiplier: number;
  adjustedEntryRM: number;
  growthRate: number;
  timelineYears: number;
  studyYears: number;
  projectedMonthlyAtTimelineRM: number;
  livingMonthlyRM: number;
  inflationRate: number;
  educationCostRM: number;
  discountRate: number;
  npvRM: number;
  breakEvenYear: number | null;
  feasibilityScore: number;
  expectedNpvRM: number;
  targetMonthlySalaryRM: number;
  housingRatio: number;
  purchasingPowerRatio: number;
  ambitionLevel: AmbitionLevel;
  rarityReason: string;
  evidenceReasons: string[];
  scores: ScoreBreakdownMYR;
  sacrificeIndexValue: number;
  decisionValue: number;
}) {
  const scores = params.scores;
  const traces: CalculationTrace[] = [
    {
      id: "salary_projection",
      label: "Monthly Salary Projection",
      formula: "salary_t = min(senior_cap, entry_average * city_multiplier * (1 + growth_rate)^(t - study_years - 1))",
      inputs: {
        career: params.careerField,
        city: params.cityName,
        entryAverageRM: round(params.entryAverageRM),
        cityMultiplier: params.cityMultiplier,
        growthRate: formatPercent(params.growthRate * 100),
        timelineYears: params.timelineYears,
        studyYears: params.studyYears,
      },
      steps: [
        `Entry midpoint for ${params.careerField}: ${formatRM(params.entryAverageRM)} per month.`,
        `Apply ${params.cityName} salary multiplier: ${formatRM(params.entryAverageRM)} x ${params.cityMultiplier} = ${formatRM(params.adjustedEntryRM)}.`,
        `Grow salary after study/training years until year ${params.timelineYears}.`,
      ],
      result: `${formatRM(params.projectedMonthlyAtTimelineRM)} projected monthly salary at timeline`,
    },
    {
      id: "living_cost_inflation",
      label: "Inflation-Adjusted Living Cost",
      formula: "living_cost_t = monthly_living_cost * 12 * (1 + inflation_rate)^(t - 1)",
      inputs: {
        city: params.cityName,
        monthlyLivingCostRM: params.livingMonthlyRM,
        inflationRate: formatPercent(params.inflationRate * 100),
      },
      steps: [
        `Use Malaysia city budget for ${params.cityName}: ${formatRM(params.livingMonthlyRM)} per month.`,
        `Escalate yearly expenses with inflation rate ${formatPercent(params.inflationRate * 100)}.`,
      ],
      result: "Year-by-year living costs are included in the projection table.",
    },
    {
      id: "education_cost",
      label: "Education / Training Cost",
      formula: "annual_education_cost = total_tuition / duration_years",
      inputs: {
        educationRoute: params.educationLabel,
        totalEducationCostRM: params.educationCostRM,
        durationYears: params.studyYears,
      },
      steps: [
        `Selected Malaysia education route: ${params.educationLabel}.`,
        `Spread ${formatRM(params.educationCostRM)} across ${params.studyYears} year(s) where applicable.`,
      ],
      result: `${formatRM(params.educationCostRM)} total estimated education/training cost`,
    },
    {
      id: "npv",
      label: "15-Year Net Value in Today's RM",
      formula: "net_value_today = sum((annual_salary - annual_living_cost - annual_education_cost) / (1 + discount_rate)^t)",
      inputs: {
        projectionYears: PROJECTION_HORIZON_YEARS,
        discountRate: formatPercent(params.discountRate * 100),
        netValueTodayRM: params.npvRM,
      },
      steps: [
        "Calculate annual net cash flow for each projected year.",
        `Discount every year using ${formatPercent(params.discountRate * 100)}.`,
        "Sum discounted cash flows across 15 years to estimate the value in today's RM.",
      ],
      result: `${formatRM(params.npvRM)} 15-year net value in today's RM`,
    },
    {
      id: "expected_npv",
      label: "Risk-Adjusted Long-Term Value",
      formula: "risk_adjusted_value = 15_year_net_value_today * estimated_feasibility_score",
      inputs: {
        netValueTodayRM: params.npvRM,
        estimatedFeasibility: formatPercent(params.feasibilityScore),
      },
      steps: [
        `${formatRM(params.npvRM)} x ${formatPercent(params.feasibilityScore)}.`,
        "This is a planning adjustment, not a guaranteed statistical expected value.",
      ],
      result: `${formatRM(params.expectedNpvRM)} risk-adjusted long-term value`,
    },
    {
      id: "payback_point",
      label: "Estimated Payback Point",
      formula: "payback_year = first year where cumulative discounted net value >= RM0",
      inputs: {
        breakEvenYear: params.breakEvenYear ?? "not within 15 years",
        projectionYears: PROJECTION_HORIZON_YEARS,
      },
      steps: [
        "Add the discounted net value year by year.",
        "The payback point is the first year the total reaches RM0 or above.",
      ],
      result: params.breakEvenYear ? `Year ${params.breakEvenYear}` : "Not within 15 years",
    },
    {
      id: "housing_affordability",
      label: "Housing Affordability",
      formula: "housing_ratio = monthly_living_cost / projected_monthly_salary",
      inputs: {
        monthlyLivingCostRM: params.livingMonthlyRM,
        projectedMonthlySalaryRM: params.projectedMonthlyAtTimelineRM,
      },
      steps: [
        `${formatRM(params.livingMonthlyRM)} / ${formatRM(params.projectedMonthlyAtTimelineRM)}.`,
        "Ratios above 0.30 indicate stronger affordability pressure.",
      ],
      result: `${round(params.housingRatio, 2)} housing affordability ratio`,
    },
    {
      id: "purchasing_power",
      label: "Purchasing Power",
      formula: "purchasing_power_ratio = projected_monthly_salary / monthly_living_cost",
      inputs: {
        projectedMonthlySalaryRM: params.projectedMonthlyAtTimelineRM,
        monthlyLivingCostRM: params.livingMonthlyRM,
      },
      steps: [`${formatRM(params.projectedMonthlyAtTimelineRM)} / ${formatRM(params.livingMonthlyRM)}.`],
      result: `${round(params.purchasingPowerRatio, 2)}x monthly living cost`,
    },
    {
      id: "estimated_feasibility",
      label: "Estimated Feasibility",
      formula:
        "final_feasibility = min(base_feasibility, ambition_cap + evidence_boost)",
      inputs: {
        financial: scores.financial,
        qualification: scores.qualification,
        salaryFit: scores.salaryFit,
        timeline: scores.timeline,
        marketDemand: scores.marketDemand,
        risk: scores.risk,
        baseFeasibility: scores.baseFeasibility,
        ambitionLevel: ambitionLabel(params.ambitionLevel),
        ambitionCap: scores.ambitionCap,
        evidenceBoost: scores.evidenceBoost,
      },
      steps: [
        `Base score = 0.25(${scores.financial}) + 0.20(${scores.qualification}) + 0.20(${scores.salaryFit}) + 0.15(${scores.timeline}) + 0.10(${scores.marketDemand}) + 0.10(${scores.risk}) = ${formatPercent(scores.baseFeasibility)}.`,
        `${ambitionLabel(params.ambitionLevel)} ambition cap = ${formatPercent(scores.ambitionCap)}. ${params.rarityReason}`,
        params.evidenceReasons.length
          ? `Evidence boost = ${formatPercent(scores.evidenceBoost)} from ${params.evidenceReasons.join(", ")}.`
          : "Evidence boost = 0% because no strong rare-outcome proof was detected in the profile.",
        `Final feasibility = min(${formatPercent(scores.baseFeasibility)}, ${formatPercent(scores.ambitionCap)} + ${formatPercent(scores.evidenceBoost)}).`,
      ],
      result: `${formatPercent(params.feasibilityScore)} estimated feasibility`,
    },
    {
      id: "sacrifice_index",
      label: "Sacrifice Index",
      formula:
        "sacrifice = 0.28(financial_pressure) + 0.22(time_pressure) + 0.18(housing_pressure) + 0.22(salary_pressure) + 0.10(risk_pressure)",
      inputs: {
        sacrificeIndex: params.sacrificeIndexValue,
      },
      steps: [
        "Higher tuition, longer training, weaker salary fit, housing pressure, and risk level increase the sacrifice score.",
      ],
      result: `${params.sacrificeIndexValue}/100 sacrifice index`,
    },
    {
      id: "decision_value",
      label: "Pathway Ranking Value",
      formula: "decision_value = estimated_feasibility - (0.4 * sacrifice_index)",
      inputs: {
        estimatedFeasibility: params.feasibilityScore,
        sacrificeIndex: params.sacrificeIndexValue,
      },
      steps: [`${params.feasibilityScore} - (0.4 x ${params.sacrificeIndexValue}).`],
      result: `${round(params.decisionValue, 1)} decision value score`,
    },
  ];

  return traces;
}

export function buildPathwayResult(profile: MalaysianUserProfile, candidate: CandidatePathway): RankedPathway {
  const career = resolveCareer(candidate.careerKey || profile.desiredCareer);
  const city = resolveCity(candidate.cityKey || profile.desiredLocation || profile.currentLocation);
  const education = resolveEducation(candidate.educationKey);
  const sector = resolveSector(candidate.sectorKey || career.record.field);
  const defaults = getMalaysiaModelDefaults();

  const totalEducationCostRM = getEducationTotalCost(education.record);
  const studyYears = Math.max(0, round(education.record.durationYears, 1));
  const timelineYears = Math.max(1, Math.min(20, round(candidate.timelineYears || profile.timelineYears || 5)));
  const cityMultiplier = getCitySalaryMultiplier(city.key);
  const entryAverageRM = average(career.record.entryMin, career.record.entryMax);
  const adjustedEntryRM = entryAverageRM * cityMultiplier;
  const adjustedSeniorCapRM = career.record.seniorMax * cityMultiplier;
  const growthRate = clamp(
    defaults.careerGrowthRate + outlookGrowthAdjustment(career.record.growthOutlook) - riskPenalty(candidate.riskLevel) / 1000,
    0.005,
    0.08,
  );
  const targetMonthlySalaryRM =
    profile.desiredMonthlyIncomeRM ?? Math.max(average(career.record.midMin, career.record.midMax), adjustedEntryRM);
  const partTimeIncomeRM = defaults.partTimeWorkPossible_perMonth;
  const yearlyProjection = buildYearlyProjection({
    studyYears,
    totalEducationCostRM,
    studentMonthlyLivingRM: city.record.total_budget_student,
    adultMonthlyLivingRM: city.record.total_budget_single,
    partTimeIncomeRM,
    entryMonthlyRM: adjustedEntryRM,
    seniorMonthlyRM: adjustedSeniorCapRM,
    growthRate,
    inflationRate: defaults.inflationRate,
    discountRate: defaults.discountRate,
  });
  const npvRM = round(yearlyProjection.at(-1)?.cumulativeNpvRM ?? 0);
  const breakEvenYear = findBreakEvenYear(yearlyProjection);
  const targetYearRow = yearlyProjection[Math.min(timelineYears, PROJECTION_HORIZON_YEARS) - 1] ?? yearlyProjection.at(-1);
  const projectedMonthlyAtTimelineRM = targetYearRow?.monthlySalaryRM ?? adjustedEntryRM;
  const monthlyLivingCostRM = timelineYears <= Math.ceil(studyYears) ? city.record.total_budget_student : city.record.total_budget_single;
  const housingAffordabilityRatio = monthlyLivingCostRM / Math.max(1, projectedMonthlyAtTimelineRM);
  const purchasingPowerRatio = projectedMonthlyAtTimelineRM / Math.max(1, monthlyLivingCostRM);

  const coreScores = buildScoreBreakdown({
    npvRM,
    educationCostRM: totalEducationCostRM,
    debtRM: profile.debtRM ?? 0,
    currentQualificationRank: getQualificationRank(profile.educationLevel),
    requiredQualificationRank: getRequiredQualificationRank(career.record.requiredQualification),
    skillCount: profile.skills.length + candidate.requiredSkills.length,
    projectedMonthlyAtTimelineRM,
    targetMonthlySalaryRM,
    studyYears,
    timelineYears,
    outlook: career.record.growthOutlook,
    automationRisk: career.record.automationRisk,
    candidateRisk: candidate.riskLevel,
    userRiskTolerance: profile.riskTolerance,
  });
  const ambitionLevel = resolvedAmbitionLevel(profile, candidate);
  const evidence = evidenceBoost(profile, candidate);
  const scores = buildFeasibilityBreakdown({
    scores: coreScores,
    ambitionLevel,
    evidenceBoost: evidence.value,
  });
  const feasibilityScore = scores.finalFeasibility;
  const expectedNpvRM = round(npvRM * (feasibilityScore / 100));
  const sacrificeIndexValue = sacrificeIndex({
    educationCostRM: totalEducationCostRM,
    studyYears,
    housingRatio: housingAffordabilityRatio,
    salaryFitScore: scores.salaryFit,
    risk: candidate.riskLevel,
  });
  const decisionValue = round(feasibilityScore - 0.4 * sacrificeIndexValue, 1);

  const calculationTraces = buildCalculationTraces({
    careerField: career.record.field,
    cityName: city.record.city,
    educationLabel: education.record.label,
    entryAverageRM,
    cityMultiplier,
    adjustedEntryRM,
    growthRate,
    timelineYears,
    studyYears,
    projectedMonthlyAtTimelineRM,
    livingMonthlyRM: monthlyLivingCostRM,
    inflationRate: defaults.inflationRate,
    educationCostRM: totalEducationCostRM,
    discountRate: defaults.discountRate,
    npvRM,
    breakEvenYear,
    feasibilityScore,
    expectedNpvRM,
    targetMonthlySalaryRM,
    housingRatio: housingAffordabilityRatio,
    purchasingPowerRatio,
    ambitionLevel,
    rarityReason: candidate.rarityReason,
    evidenceReasons: evidence.reasons,
    scores,
    sacrificeIndexValue,
    decisionValue,
  });

  const generatedMismatchNotes = [];

  if (projectedMonthlyAtTimelineRM < targetMonthlySalaryRM * 0.9) {
    generatedMismatchNotes.push(
      `Target salary is ${formatRM(targetMonthlySalaryRM)}, but the formula projection at year ${timelineYears} is ${formatRM(projectedMonthlyAtTimelineRM)}. A longer timeline or lower salary expectation may be needed.`,
    );
  }

  if (studyYears > timelineYears) {
    generatedMismatchNotes.push(
      `${education.record.label} takes about ${studyYears} year(s), which is longer than the stated ${timelineYears}-year timeline.`,
    );
  }

  if (housingAffordabilityRatio > 0.3) {
    generatedMismatchNotes.push(
      `Living cost in ${city.record.city} is high relative to projected salary: housing/living ratio ${round(housingAffordabilityRatio, 2)}.`,
    );
  }

  const sacrificeConditions = [
    ...candidate.sacrificeConditions,
    totalEducationCostRM > 0 ? `Estimated education/training cost: ${formatRM(totalEducationCostRM)} for ${education.record.label}.` : "",
    studyYears > 0 ? `Time sacrifice: around ${studyYears} year(s) before full salary ramp-up.` : "",
    candidate.riskLevel === "high" ? "High uncertainty pathway: the risk score reduces the estimated feasibility." : "",
    ambitionLevel !== "standard"
      ? `${ambitionLabel(ambitionLevel)} ambition cap applied: ${candidate.rarityReason}`
      : "",
  ].filter(Boolean);

  const financialModel: FinancialProjectionMYR = {
    npvRM,
    expectedNpvRM,
    breakEvenYear,
    targetMonthlySalaryRM: round(targetMonthlySalaryRM),
    projectedMonthlySalaryAtTimelineRM: round(projectedMonthlyAtTimelineRM),
    monthlyLivingCostRM,
    totalEducationCostRM,
    housingAffordabilityRatio: round(housingAffordabilityRatio, 2),
    purchasingPowerRatio: round(purchasingPowerRatio, 2),
    scoreBreakdown: scores,
    calculationTraces,
    yearlyProjection,
  };

  return {
    id: candidate.id,
    title: candidate.title,
    feasibilityScore,
    probability: feasibilityScore,
    flowSteps: candidate.flowSteps.slice(0, 8),
    executionSteps: candidate.executionSteps,
    sacrificeConditions,
    expectationMismatches: [...candidate.expectationMismatches, ...generatedMismatchNotes].filter(Boolean),
    details: {
      reasoning: [
        `Planning Agent selected ${candidate.title} because the profile maps to ${career.record.field} in ${city.record.city}.`,
        `Calculation Agent used RM salary ranges, city living cost, education cost, ${formatPercent(defaults.inflationRate * 100)} inflation, and ${formatPercent(defaults.discountRate * 100)} discount rate.`,
        `Calculation Agent checked qualification requirement: ${career.record.requiredQualification}.`,
        `Calculation Agent applied ${career.record.growthOutlook} market outlook and ${career.record.automationRisk} automation risk from the Malaysia dataset.`,
        `Calculation Agent classified ambition as ${ambitionLabel(ambitionLevel)} and capped the feasibility score at ${formatPercent(scores.ambitionCap)} before evidence boost.`,
        `Output Agent prepared this pathway with estimated feasibility ${feasibilityScore}% and decision value ${decisionValue}.`,
      ],
      financialModel,
      assumptions: cleanAssumptions([
        ...candidate.assumptions,
        ...profile.assumptions,
        `Salary data source keys: ${career.record.sources.join(", ")}.`,
        `Cost-of-living location: ${city.record.city}, ${city.record.state}.`,
        `Sector benchmark considered: ${sector.record?.sectorName ?? career.record.field}.`,
        `Feasibility score is a planning estimate, not a guaranteed probability.`,
      ]),
      dataSources: selectCitationSources([
        ...career.record.sources,
        ...city.record.sources,
        ...education.record.sources,
        sector.record?.source ?? "DOSM-SW",
        "MQA",
      ]).concat(
        (candidate.webGroundingSources ?? []).map((source, index) => ({
          id: `WEB-${index + 1}`,
          name: `${source.title} (${source.provider})`,
          url: source.url,
        })),
      ),
    },
    decisionValue,
  };
}

export function rankPathways(profile: MalaysianUserProfile, candidates: CandidatePathway[]) {
  return candidates
    .slice(0, 3)
    .map((candidate) => buildPathwayResult(profile, candidate))
    .sort((a, b) => b.decisionValue - a.decisionValue)
    .map(({ decisionValue: _decisionValue, ...pathway }) => pathway);
}
