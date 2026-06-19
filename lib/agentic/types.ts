export type Locale = "ms-MY" | "en-MY";
export type Currency = "MYR";
export type RiskLevel = "low" | "medium" | "high";
export type AmbitionLevel = "standard" | "competitive" | "elite" | "global_elite";

export type GeneratePathwayRequest = {
  currentCondition: string;
  dreamLife: string;
  locale: Locale;
  currency: Currency;
};

export type FollowUpQuestion = {
  id: string;
  question: string;
  variableKey: string;
  reason: string;
  purpose: "overlooked_issue_acceptance" | "missing_information";
  issueId?: string;
  inputType: "text" | "number" | "choice";
  options?: string[];
  placeholder?: string;
  prefix?: string;
  suffix?: string;
};

export type FollowUpAnswer = {
  questionId: string;
  variableKey?: string;
  purpose?: FollowUpQuestion["purpose"];
  issueId?: string;
  question: string;
  answer: string;
};

export type OverlookedIssue = {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "moderate" | "minor";
  requiresAcceptance: boolean;
  accepted: boolean;
};

export type CollectInfoSummary = {
  currentConditionSummary: string;
  dreamLifeSummary: string;
  planningSummary: string;
  malaysiaAssumptions: string[];
  internationalAssumptions: string[];
};

export type MalaysianUserProfile = {
  currentCondition: string;
  dreamLife: string;
  age?: number;
  currentLocation?: string;
  educationLevel?: string;
  fieldOfStudy?: string;
  skills: string[];
  workExperienceYears?: number;
  monthlyIncomeRM?: number;
  savingsRM?: number;
  debtRM?: number;
  familySupportRM?: number;
  desiredCareer?: string;
  desiredMonthlyIncomeRM?: number;
  desiredLocation?: string;
  desiredLifestyle?: string;
  timelineYears?: number;
  riskTolerance?: RiskLevel;
  relocationWillingness?: RiskLevel;
  constraints: string[];
  preferences: string[];
  assumptions: string[];
  missingVariables: string[];
};

export type CareerIntentClassification = {
  intentKey: string;
  intentLabel: string;
  careerFamily: string;
  locationScope: string;
  countryScope: string;
  confidence: number;
  searchQuery: string;
  reason: string;
};

export type PlanningSearchDecision = {
  shouldSearch?: boolean;
  query?: string;
  reason?: string;
  classification?: CareerIntentClassification;
  autoSearchReason?: string;
};

export type FollowUpState = {
  profileDraft: MalaysianUserProfile;
  collectInfoSummary: CollectInfoSummary;
  overlookedIssues: OverlookedIssue[];
  questionQueue: FollowUpQuestion[];
  nextQuestion: FollowUpQuestion | null;
  answeredQuestions: FollowUpAnswer[];
  readyToGenerate: boolean;
};

export type PathwayExecutionStep = {
  timeframe: string;
  milestone: string;
  specificActions: string[];
  proofOfProgress: string[];
  riskOrSacrifice: string;
};

export type CandidatePathway = {
  id: string;
  title: string;
  careerKey: string;
  cityKey: string;
  educationKey: string;
  sectorKey?: string;
  timelineYears: number;
  flowSteps: string[];
  requiredSkills: string[];
  sacrificeConditions: string[];
  expectationMismatches: string[];
  riskLevel: RiskLevel;
  ambitionLevel: AmbitionLevel;
  rarityReason: string;
  executionSteps: PathwayExecutionStep[];
  assumptions: string[];
  webGroundingSources?: WebGroundingSource[];
};

export type WebGroundingSource = {
  title: string;
  url: string;
  snippet: string;
  provider: "freellmapi-google";
};

export type WebGroundingBundle = {
  enabled: boolean;
  query?: string;
  warning?: string;
  sources: WebGroundingSource[];
  careerIntent?: CareerIntentClassification;
  autoSearchReason?: string;
  cacheStatus?: "hit" | "miss" | "disabled" | "error";
  cacheSaveStatus?: "saved" | "skipped" | "error";
  cacheScore?: number;
  cacheIntentKey?: string;
  cacheWarning?: string;
};

export type CalculationTrace = {
  id: string;
  label: string;
  formula: string;
  inputs: Record<string, string | number>;
  steps: string[];
  result: string;
};

export type YearlyProjectionMYR = {
  year: number;
  monthlySalaryRM: number;
  annualSalaryRM: number;
  annualLivingCostRM: number;
  annualEducationCostRM: number;
  netCashFlowRM: number;
  discountedCashFlowRM: number;
  cumulativeNpvRM: number;
};

export type ScoreBreakdownMYR = {
  financial: number;
  qualification: number;
  salaryFit: number;
  timeline: number;
  marketDemand: number;
  risk: number;
  baseFeasibility: number;
  ambitionCap: number;
  evidenceBoost: number;
  finalFeasibility: number;
};

export type FinancialProjectionMYR = {
  npvRM: number;
  expectedNpvRM: number;
  breakEvenYear: number | null;
  targetMonthlySalaryRM: number;
  projectedMonthlySalaryAtTimelineRM: number;
  monthlyLivingCostRM: number;
  totalEducationCostRM: number;
  housingAffordabilityRatio: number;
  purchasingPowerRatio: number;
  scoreBreakdown: ScoreBreakdownMYR;
  calculationTraces: CalculationTrace[];
  yearlyProjection: YearlyProjectionMYR[];
};

export type PathwayFlowchartResult = {
  id: string;
  title: string;
  feasibilityScore: number;
  probability: number;
  flowSteps: string[];
  executionSteps: PathwayExecutionStep[];
  sacrificeConditions: string[];
  expectationMismatches: string[];
  details: {
    reasoning: string[];
    financialModel: FinancialProjectionMYR;
    assumptions: string[];
    dataSources: Array<{
      id: string;
      name: string;
      url: string;
    }>;
  };
};

export type GeneratePathwayResponse = {
  pathways: PathwayFlowchartResult[];
  responsibleAiNotice: string;
};

export type PathwayGenerationStage =
  | "search_decision"
  | "web_grounding"
  | "planning_candidates"
  | "calculation"
  | "complete";

export type PathwayGenerationRun = {
  id: string;
  stage: PathwayGenerationStage;
  currentCondition: string;
  dreamLife: string;
  state: FollowUpState;
  searchDecision?: PlanningSearchDecision;
  webGrounding?: WebGroundingBundle;
  candidatePathways?: CandidatePathway[];
  result?: GeneratePathwayResponse;
  retryCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type StartPathwayResponse =
  | {
      kind: "invalid";
      message: string;
      reasons: string[];
    }
  | {
      kind: "question";
      state: FollowUpState;
      nextQuestion: FollowUpQuestion;
    }
  | {
      kind: "result";
      state: FollowUpState;
      result: GeneratePathwayResponse;
    }
  | {
      kind: "generation";
      run: PathwayGenerationRun;
    };

export type AnswerPathwayRequest = {
  state: FollowUpState;
  answer: string;
};

export type PathwayGenerationStepRequest = {
  run: PathwayGenerationRun;
};

export type PathwayGenerationStepResponse =
  | {
      kind: "generation";
      run: PathwayGenerationRun;
    }
  | {
      kind: "result";
      state: FollowUpState;
      result: GeneratePathwayResponse;
      run: PathwayGenerationRun;
    };

export type LlmJsonMessage = {
  role: "system" | "user";
  content: string;
};
