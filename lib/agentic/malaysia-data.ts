import {
  citySalaryMultipliers,
  costOfLivingByCity,
  dataMetadata,
  educationCosts,
  modelDefaults,
  qualificationLevels,
  salaryByCareer,
  sectorWages,
} from "@/malaysia_dataset";

type SalaryRecord = (typeof salaryByCareer)[string];
type CityRecord = (typeof costOfLivingByCity)[string];
type EducationRecord = (typeof educationCosts)[string];
type SectorRecord = (typeof sectorWages)[string];

const CITY_TO_MULTIPLIER_KEY: Record<string, string> = {
  kuala_lumpur: "kuala_lumpur",
  petaling_jaya_selangor: "selangor",
  george_town_penang: "penang",
  johor_bahru: "johor",
  kota_kinabalu: "sabah",
  kuching: "sarawak",
  ipoh: "perak",
  alor_setar: "kedah",
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(target: string, query: string) {
  const targetTokens = new Set(normalise(target).split(" ").filter(Boolean));
  const queryTokens = normalise(query).split(" ").filter(Boolean);

  if (queryTokens.length === 0) return 0;

  return queryTokens.reduce((score, token) => score + (targetTokens.has(token) ? 1 : 0), 0) / queryTokens.length;
}

function resolveKey<T extends Record<string, unknown>>(
  records: Record<string, T>,
  query: string | undefined,
  labelBuilder: (key: string, record: T) => string,
  fallbackKey: string,
) {
  if (query && records[query]) return query;
  if (!query) return fallbackKey;

  let bestKey = fallbackKey;
  let bestScore = 0;

  for (const [key, record] of Object.entries(records)) {
    const score = Math.max(tokenScore(key, query), tokenScore(labelBuilder(key, record), query));
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  }

  return bestKey;
}

function resolveCareerAlias(input: string | undefined) {
  if (!input) return undefined;

  const text = normalise(input);
  const dataAnalysisTerms = ["data analyst", "business intelligence", "bi analyst", "dashboard", "reporting", "analytics"];
  const aiEngineeringTerms = [
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "llm",
    "computer vision",
    "mlops",
    "ai engineer",
    "ml engineer",
    "ai",
  ];

  if (dataAnalysisTerms.some((term) => text.includes(term))) return "data_scientist";
  if (aiEngineeringTerms.some((term) => text.includes(term)) && salaryByCareer.ai_ml_engineer) return "ai_ml_engineer";

  return undefined;
}

export function getDatasetContextForPrompt() {
  return {
    careerKeys: Object.entries(salaryByCareer).map(([key, value]) => ({
      key,
      field: value.field,
      entryMonthlyRM: [value.entryMin, value.entryMax],
      midMonthlyRM: [value.midMin, value.midMax],
      seniorMonthlyRM: [value.seniorMin, value.seniorMax],
      outlook: value.growthOutlook,
      automationRisk: value.automationRisk,
    })),
    cityKeys: Object.entries(costOfLivingByCity).map(([key, value]) => ({
      key,
      city: value.city,
      state: value.state,
      studentBudgetRM: value.total_budget_student,
      singleBudgetRM: value.total_budget_single,
      medianSalaryRM: value.medianSalary,
    })),
    educationKeys: Object.entries(educationCosts).map(([key, value]) => ({
      key,
      label: value.label,
      durationYears: value.durationYears,
      publicTuitionRM: value.tuitionTotal_public,
      privateTuitionRM: value.tuitionTotal_private,
      tvetTuitionRM: value.tuitionTotal_tvet,
      ptptnLoanTotalRM: value.ptptnLoanTotal,
    })),
    sectorKeys: Object.entries(sectorWages).map(([key, value]) => ({
      key,
      sectorName: value.sectorName,
      medianMonthlyRM: value.medianMonthly,
      outlook: value.outlook,
      automationRisk: value.automationRisk,
    })),
  };
}

export function resolveCareer(input: string | undefined): { key: string; record: SalaryRecord } {
  const key = resolveCareerAlias(input) ?? resolveKey(salaryByCareer, input, (_key, record) => record.field, "software_engineer");
  return { key, record: salaryByCareer[key] };
}

export function resolveCity(input: string | undefined): { key: string; record: CityRecord } {
  const key = resolveKey(
    costOfLivingByCity,
    input,
    (_key, record) => `${record.city} ${record.state}`,
    "kuala_lumpur",
  );
  return { key, record: costOfLivingByCity[key] };
}

export function resolveEducation(input: string | undefined): { key: string; record: EducationRecord } {
  const key = resolveKey(educationCosts, input, (_key, record) => record.label, "degree_public");
  return { key, record: educationCosts[key] };
}

export function resolveSector(input: string | undefined): { key: string; record: SectorRecord | null } {
  if (!input) return { key: "ict", record: sectorWages.ict };

  const key = resolveKey(sectorWages, input, (_key, record) => record.sectorName, "ict");
  return { key, record: sectorWages[key] ?? null };
}

export function getCitySalaryMultiplier(cityKey: string) {
  const multiplierKey = CITY_TO_MULTIPLIER_KEY[cityKey] ?? cityKey;
  return citySalaryMultipliers[multiplierKey]?.multiplier ?? 1;
}

export function getEducationTotalCost(record: EducationRecord) {
  return record.tuitionTotal_public ?? record.tuitionTotal_private ?? record.tuitionTotal_tvet ?? 0;
}

export function getQualificationRank(value: string | undefined) {
  if (!value) return 2;

  const text = normalise(value);
  const levels = qualificationLevels.levels;

  if (text.includes("phd") || text.includes("doctor")) return levels.phd;
  if (text.includes("master")) return levels.masters;
  if (text.includes("degree") || text.includes("bachelor")) return levels.degree_bachelor;
  if (text.includes("diploma")) return levels.diploma;
  if (text.includes("stpm") || text.includes("matric")) return levels.stpm_matriculation;
  if (text.includes("certificate") || text.includes("cert")) return levels.certificate;
  if (text.includes("spm")) return levels.spm;

  return 2;
}

export function getRequiredQualificationRank(requiredQualification: string) {
  const text = normalise(requiredQualification);

  if (text.includes("master") || text.includes("clinical")) return 5;
  if (text.includes("bachelor") || text.includes("degree")) return 4;
  if (text.includes("diploma")) return 3;
  if (text.includes("certificate")) return 2;

  return 2;
}

export function getMalaysiaModelDefaults() {
  return modelDefaults;
}

export function selectCitationSources(ids: string[]) {
  const wanted = new Set(ids);
  return dataMetadata.citationList
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
    }));
}
