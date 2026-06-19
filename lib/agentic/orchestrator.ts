import { callLlmJson } from "@/lib/ai/client";
import { rankPathways } from "@/lib/agentic/calculations";
import { getDatasetContextForPrompt } from "@/lib/agentic/malaysia-data";
import { getWebGroundingForProfile } from "@/lib/agentic/web-search";
import type {
  AmbitionLevel,
  AnswerPathwayRequest,
  CandidatePathway,
  CollectInfoSummary,
  FollowUpAnswer,
  FollowUpQuestion,
  FollowUpState,
  GeneratePathwayRequest,
  GeneratePathwayResponse,
  MalaysianUserProfile,
  OverlookedIssue,
  PathwayExecutionStep,
  PathwayGenerationRun,
  PathwayGenerationStepResponse,
  PlanningSearchDecision,
  RiskLevel,
  StartPathwayResponse,
  WebGroundingBundle,
} from "@/lib/agentic/types";

const MAX_FOLLOW_UP_QUESTIONS = 10;
const MAX_GENERATION_STAGE_RETRIES = 2;
const RESPONSIBLE_AI_NOTICE =
  "Decision support only. The feasibility score is an estimate, not a guaranteed probability. NextChapter does not guarantee salary, job placement, admissions, scholarships, visas, awards, or life outcomes. Verify current Malaysian data before committing money or time.";

const FICTIONAL_OR_ROLEPLAY_TERMS = [
  "hogwarts",
  "dumbledore",
  "dumbuldor",
  "dumbledor",
  "voldemort",
  "quidditch",
  "wizard",
  "witch",
  "magic school",
  "sorcerer",
  "pokemon",
  "naruto",
  "minecraft",
];

const DOMAIN_KEYWORDS = [
  "career",
  "job",
  "work",
  "internship",
  "salary",
  "earn",
  "income",
  "money",
  "rm",
  "study",
  "education",
  "university",
  "college",
  "degree",
  "diploma",
  "spm",
  "stpm",
  "cgpa",
  "skill",
  "business",
  "startup",
  "finance",
  "debt",
  "saving",
  "savings",
  "budget",
  "house",
  "home",
  "relocate",
  "location",
  "malaysia",
  "kl",
  "selangor",
  "penang",
  "johor",
  "sabah",
  "sarawak",
  "future",
  "dream",
  "path",
  "kerja",
  "belajar",
  "universiti",
  "ijazah",
  "gaji",
  "pendapatan",
  "kerjaya",
  "kewangan",
  "hutang",
  "simpanan",
  "impian",
];

type CollectInfoLlmResult = {
  validation?: {
    isUsable?: boolean;
    message?: string;
    reasons?: string[];
  };
  profileDraft?: Partial<MalaysianUserProfile>;
  collectInfoSummary?: Partial<CollectInfoSummary>;
  overlookedIssues?: Array<Partial<OverlookedIssue>>;
  questionQueue?: Array<Partial<FollowUpQuestion>>;
  nextQuestion?: Partial<FollowUpQuestion> | null;
  readyToGenerate?: boolean;
};

type CandidateLlmResult = {
  pathways: CandidatePathway[];
};

export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

function invalidResponse(message: string, reasons: string[]): StartPathwayResponse {
  return {
    kind: "invalid",
    message,
    reasons: reasons.filter(Boolean),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function createGenerationRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `generation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readyGenerationState(state: FollowUpState): FollowUpState {
  return {
    ...state,
    readyToGenerate: true,
    nextQuestion: null,
    questionQueue: [],
  };
}

function createGenerationRun(state: FollowUpState): PathwayGenerationRun {
  const generationState = readyGenerationState(state);
  const timestamp = nowIso();

  return {
    id: createGenerationRunId(),
    stage: "search_decision",
    currentCondition: generationState.profileDraft.currentCondition,
    dreamLife: generationState.profileDraft.dreamLife,
    state: generationState,
    retryCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function updateGenerationRun(run: PathwayGenerationRun, patch: Partial<PathwayGenerationRun>): PathwayGenerationRun {
  return {
    ...run,
    ...patch,
    updatedAt: nowIso(),
  };
}

function generationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Pathway generation stage failed.";
}

function fallbackWebGrounding(
  searchDecision: PlanningSearchDecision | undefined,
  warning = "Web grounding timed out or failed; continuing with curated Malaysia dataset.",
): WebGroundingBundle {
  return {
    enabled: Boolean(searchDecision?.shouldSearch),
    query: searchDecision?.query,
    warning,
    sources: [],
    cacheStatus: "error",
    cacheSaveStatus: "skipped",
    cacheWarning: warning,
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : typeof value === "string" && value.trim()
      ? [value.trim()]
      : [];
}

function asRiskLevel(value: unknown): RiskLevel | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function asAmbitionLevel(value: unknown): AmbitionLevel | undefined {
  if (value === "standard" || value === "competitive" || value === "elite" || value === "global_elite") return value;
  return undefined;
}

function numberOrUndefined(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function moneyFromText(value: string) {
  const compact = value.toLowerCase().replace(/,/g, "");
  const match = compact.match(/(?:rm\s*)?(\d+(?:\.\d+)?)(\s*k)?/);
  if (!match) return undefined;

  const amount = Number(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(amount) ? Math.round(amount) : undefined;
}

function yearsFromText(value: string) {
  const match = value.toLowerCase().match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const years = Number(match[1]);
  return Number.isFinite(years) ? Math.max(1, Math.min(20, years)) : undefined;
}

function normaliseKey(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugFromText(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);

  return slug || fallback;
}

function systemPrompt() {
  return [
    "You are the backend for NextChapter Malaysia.",
    "Use exactly four product-facing agents: CollectInfo Agent, Planning Agent, Calculation Agent, Output Agent.",
    "The product is decision support only, never a guarantee.",
    "Default to Malaysian users, RM/MYR, Malaysian locations, Malaysian education routes, and Malaysia career assumptions.",
    "Do not limit pathways to Malaysia if the user explicitly asks for an international pathway, but keep calculations in MYR.",
    "Never create 30/60/90-day action plans.",
    "Return valid JSON only. Do not include Markdown.",
  ].join("\n");
}

function cheapInputPrecheck(request: GeneratePathwayRequest) {
  const combined = `${request.currentCondition} ${request.dreamLife}`.toLowerCase();
  const tokens = combined.match(/[a-z0-9]+/g) ?? [];
  const uniqueTokens = new Set(tokens);
  const repeatedNoise = /(.)\1{8,}/.test(combined);
  const hasFictionalScenario = FICTIONAL_OR_ROLEPLAY_TERMS.some((term) => combined.includes(term));
  const hasDomainKeyword = DOMAIN_KEYWORDS.some((keyword) => combined.includes(keyword));
  const reasons: string[] = [];

  if (request.currency !== "MYR") {
    reasons.push("This app only supports RM/MYR calculations.");
  }

  if (!["ms-MY", "en-MY"].includes(request.locale)) {
    reasons.push("This app only supports ms-MY or en-MY locales.");
  }

  if (request.currentCondition.trim().length < 10 || request.dreamLife.trim().length < 10) {
    reasons.push("Both boxes need a realistic current condition and dream life.");
  }

  if (tokens.length < 6 || uniqueTokens.size < 4 || repeatedNoise) {
    reasons.push("The input does not contain enough readable planning information.");
  }

  if (hasFictionalScenario) {
    reasons.push("The input appears to use fictional or roleplay entities instead of realistic schools, jobs, locations, or goals.");
  }

  if (!hasDomainKeyword && combined.length < 160) {
    reasons.push("The input does not look related to education, career, income, finance, relocation, or life-path planning.");
  }

  return reasons.length
    ? {
        ok: false,
        response: invalidResponse(
          "Please rewrite your current condition and dream life with realistic education, career, income, finance, location, or life-path details.",
          reasons,
        ),
      }
    : { ok: true, response: null };
}

function normaliseProfile(
  base: Pick<MalaysianUserProfile, "currentCondition" | "dreamLife">,
  profile: Partial<MalaysianUserProfile>,
): MalaysianUserProfile {
  return {
    currentCondition: base.currentCondition,
    dreamLife: base.dreamLife,
    age: numberOrUndefined(profile.age),
    currentLocation: profile.currentLocation,
    educationLevel: profile.educationLevel,
    fieldOfStudy: profile.fieldOfStudy,
    skills: asStringArray(profile.skills),
    workExperienceYears: numberOrUndefined(profile.workExperienceYears),
    monthlyIncomeRM: numberOrUndefined(profile.monthlyIncomeRM),
    savingsRM: numberOrUndefined(profile.savingsRM),
    debtRM: numberOrUndefined(profile.debtRM),
    familySupportRM: numberOrUndefined(profile.familySupportRM),
    desiredCareer: profile.desiredCareer,
    desiredMonthlyIncomeRM: numberOrUndefined(profile.desiredMonthlyIncomeRM),
    desiredLocation: profile.desiredLocation,
    desiredLifestyle: profile.desiredLifestyle,
    timelineYears: numberOrUndefined(profile.timelineYears),
    riskTolerance: asRiskLevel(profile.riskTolerance),
    relocationWillingness: asRiskLevel(profile.relocationWillingness),
    constraints: asStringArray(profile.constraints),
    preferences: asStringArray(profile.preferences),
    assumptions: asStringArray(profile.assumptions),
    missingVariables: asStringArray(profile.missingVariables),
  };
}

function emptySummary(profile: Pick<MalaysianUserProfile, "currentCondition" | "dreamLife">): CollectInfoSummary {
  return {
    currentConditionSummary: profile.currentCondition,
    dreamLifeSummary: profile.dreamLife,
    planningSummary: "The CollectInfo Agent has not produced a detailed summary yet.",
    malaysiaAssumptions: ["Use RM/MYR and Malaysia-relevant education, salary, and cost assumptions unless the user explicitly asks otherwise."],
    internationalAssumptions: [],
  };
}

function normaliseSummary(
  profile: Pick<MalaysianUserProfile, "currentCondition" | "dreamLife">,
  summary: Partial<CollectInfoSummary> | undefined,
): CollectInfoSummary {
  const fallback = emptySummary(profile);

  return {
    currentConditionSummary: summary?.currentConditionSummary?.trim() || fallback.currentConditionSummary,
    dreamLifeSummary: summary?.dreamLifeSummary?.trim() || fallback.dreamLifeSummary,
    planningSummary: summary?.planningSummary?.trim() || fallback.planningSummary,
    malaysiaAssumptions: asStringArray(summary?.malaysiaAssumptions).length
      ? asStringArray(summary?.malaysiaAssumptions)
      : fallback.malaysiaAssumptions,
    internationalAssumptions: asStringArray(summary?.internationalAssumptions),
  };
}

function normaliseIssue(issue: Partial<OverlookedIssue>, index: number): OverlookedIssue | null {
  const title = issue.title?.trim();
  const description = issue.description?.trim();
  if (!title || !description) return null;

  const severity =
    issue.severity === "critical" || issue.severity === "moderate" || issue.severity === "minor"
      ? issue.severity
      : "moderate";

  return {
    id: issue.id?.trim() || `issue-${slugFromText(title, String(index + 1))}`,
    title,
    description,
    severity,
    requiresAcceptance: Boolean(issue.requiresAcceptance),
    accepted: Boolean(issue.accepted),
  };
}

function mergeIssues(existing: OverlookedIssue[], incoming: Array<Partial<OverlookedIssue>> | undefined) {
  const byId = new Map(existing.map((issue) => [issue.id, issue]));

  for (const [index, rawIssue] of (incoming ?? []).entries()) {
    const issue = normaliseIssue(rawIssue, index);
    if (!issue) continue;

    const previous = byId.get(issue.id);
    byId.set(issue.id, {
      ...issue,
      accepted: previous?.accepted || issue.accepted,
    });
  }

  return Array.from(byId.values());
}

function markAcceptedIssue(issues: OverlookedIssue[], issueId: string | undefined, accepted: boolean) {
  if (!issueId || !accepted) return issues;

  return issues.map((issue) => (issue.id === issueId ? { ...issue, accepted: true } : issue));
}

function isAffirmative(value: string) {
  return /\b(yes|y|accept|accepted|agree|agreed|understand|understood|ok|okay|proceed|continue|confirm)\b/i.test(value);
}

function hasAnsweredQuestion(
  state: Pick<FollowUpState, "answeredQuestions">,
  question: Pick<FollowUpQuestion, "id" | "variableKey" | "question">,
) {
  const nextId = normaliseKey(question.id);
  const nextVariable = normaliseKey(question.variableKey);
  const nextQuestion = normaliseKey(question.question);

  return state.answeredQuestions.some((answer) => {
    const answeredId = normaliseKey(answer.questionId);
    const answeredVariable = normaliseKey(answer.variableKey);
    const answeredQuestion = normaliseKey(answer.question);

    return (
      answeredId === nextId ||
      answeredVariable === nextVariable ||
      answeredQuestion === nextQuestion ||
      Boolean(nextVariable && answeredQuestion.includes(nextVariable)) ||
      Boolean(nextQuestion && nextQuestion.includes(answeredQuestion))
    );
  });
}

function normaliseQuestion(question: Partial<FollowUpQuestion> | null | undefined): FollowUpQuestion | null {
  if (!question?.question?.trim()) return null;

  const variableKey = question.variableKey?.trim() || slugFromText(question.question, "follow-up");
  const purpose =
    question.purpose === "overlooked_issue_acceptance" || question.purpose === "missing_information"
      ? question.purpose
      : question.issueId
        ? "overlooked_issue_acceptance"
        : "missing_information";

  return {
    id: question.id?.trim() || `q-${slugFromText(variableKey, "follow-up")}`,
    question: question.question.trim(),
    variableKey,
    reason: question.reason?.trim() || "This answer changes the pathway assumptions.",
    purpose,
    issueId: question.issueId?.trim(),
    inputType: question.inputType === "number" || question.inputType === "choice" ? question.inputType : "text",
    options: asStringArray(question.options).slice(0, 4),
    placeholder: question.placeholder,
    prefix: question.prefix,
    suffix: question.suffix,
  };
}

function normaliseQuestionQueue(
  state: Pick<FollowUpState, "answeredQuestions">,
  questions: Array<Partial<FollowUpQuestion> | null | undefined>,
) {
  const seen = new Set<string>();

  return questions
    .map(normaliseQuestion)
    .filter((question): question is FollowUpQuestion => {
      if (!question || hasAnsweredQuestion(state, question)) return false;

      const key = `${normaliseKey(question.variableKey)}:${normaliseKey(question.question)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.purpose === b.purpose) return 0;
      return a.purpose === "overlooked_issue_acceptance" ? -1 : 1;
    })
    .slice(0, MAX_FOLLOW_UP_QUESTIONS);
}

function normaliseExecutionSteps(value: unknown, fallbackFlowSteps: string[]): PathwayExecutionStep[] {
  const rawSteps = Array.isArray(value) ? value : [];
  const normalisedFlowSteps = fallbackFlowSteps.slice(0, 8);

  return normalisedFlowSteps.map((flowStep, index) => {
    const rawStep = rawSteps[index];
    const step = rawStep && typeof rawStep === "object" ? (rawStep as Partial<PathwayExecutionStep>) : null;
    const actions = asStringArray(step?.specificActions).slice(0, 5);
    const proof = asStringArray(step?.proofOfProgress).slice(0, 4);

    return {
      timeframe: step?.timeframe?.trim() || `Phase ${index + 1}`,
      milestone: flowStep,
      specificActions: actions.length
        ? actions
        : [
            flowStep,
            "Break this milestone into weekly tasks based on your available time, budget, and location.",
          ],
      proofOfProgress: proof.length
        ? proof
        : ["Milestone completed with evidence that can be shown in a portfolio, application, interview, or personal tracker."],
      riskOrSacrifice:
        step?.riskOrSacrifice?.trim() || "The Planning Agent did not provide extra execution detail for this milestone.",
    };
  });
}

function mergeUniqueStrings(existing: string[], incoming: string[]) {
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const next = [...existing];

  for (const item of incoming) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    next.push(trimmed);
  }

  return next;
}

function splitAnswerItems(answer: string) {
  return answer
    .split(/[,;\n]+|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyAnswerLocally(profile: MalaysianUserProfile, question: FollowUpQuestion, answer: string) {
  const trimmed = answer.trim();
  const lower = trimmed.toLowerCase();
  const variableKey = normaliseKey(question.variableKey || question.id);
  const questionText = question.question.toLowerCase();
  const update: Partial<MalaysianUserProfile> = {};

  if (variableKey.includes("career") || variableKey.includes("role") || variableKey.includes("industry")) {
    update.desiredCareer = trimmed;
  }

  if (variableKey.includes("fieldofstudy") || variableKey.includes("studyfield") || variableKey.includes("major")) {
    update.fieldOfStudy = trimmed;
  } else if (variableKey.includes("education") || variableKey.includes("qualification")) {
    update.educationLevel = trimmed;
  }

  if (variableKey.includes("location") || variableKey.includes("city") || variableKey.includes("state")) {
    if (
      variableKey.includes("desired") ||
      variableKey.includes("target") ||
      questionText.includes("dream") ||
      questionText.includes("prefer")
    ) {
      update.desiredLocation = trimmed;
    } else {
      update.currentLocation = trimmed;
    }
  }

  if (variableKey.includes("income") || variableKey.includes("salary") || variableKey.includes("earn")) {
    const amount = moneyFromText(trimmed);
    if (amount !== undefined) {
      if (variableKey.includes("current") || questionText.includes("current")) {
        update.monthlyIncomeRM = amount;
      } else {
        update.desiredMonthlyIncomeRM = amount;
      }
    }
  }

  if (variableKey.includes("timeline") || variableKey.includes("year") || variableKey.includes("duration")) {
    update.timelineYears = yearsFromText(trimmed);
  }

  if (variableKey.includes("age")) {
    update.age = yearsFromText(trimmed);
  }

  if (variableKey.includes("risk")) {
    if (lower.includes("low")) update.riskTolerance = "low";
    if (lower.includes("medium") || lower.includes("moderate")) update.riskTolerance = "medium";
    if (lower.includes("high")) update.riskTolerance = "high";
  }

  if (variableKey.includes("relocation") || variableKey.includes("relocate")) {
    if (lower.includes("low") || lower.includes("no")) update.relocationWillingness = "low";
    if (lower.includes("medium") || lower.includes("maybe")) update.relocationWillingness = "medium";
    if (lower.includes("high") || lower.includes("yes")) update.relocationWillingness = "high";
  }

  if (variableKey.includes("saving") || lower.includes("saving")) {
    update.savingsRM = moneyFromText(trimmed);
  }

  if (variableKey.includes("debt") || lower.includes("debt") || lower.includes("loan")) {
    update.debtRM = moneyFromText(trimmed);
  }

  if (variableKey.includes("support") || lower.includes("family") || lower.includes("parent")) {
    update.familySupportRM = moneyFromText(trimmed);
  }

  if (variableKey.includes("skill")) {
    update.skills = mergeUniqueStrings(profile.skills, splitAnswerItems(trimmed));
  }

  if (variableKey.includes("constraint")) {
    update.constraints = mergeUniqueStrings(profile.constraints, splitAnswerItems(trimmed));
  }

  if (variableKey.includes("preference") || variableKey.includes("lifestyle")) {
    update.preferences = mergeUniqueStrings(profile.preferences, splitAnswerItems(trimmed));
    if (variableKey.includes("lifestyle")) update.desiredLifestyle = trimmed;
  }

  return normaliseProfile(profile, {
    ...profile,
    ...update,
  });
}

function unacceptedRequiredIssue(issues: OverlookedIssue[]) {
  return issues.find((issue) => issue.requiresAcceptance && !issue.accepted);
}

async function runCollectInfoAgent(input: {
  request?: GeneratePathwayRequest;
  state?: FollowUpState;
  latestAnswer?: FollowUpAnswer;
}): Promise<StartPathwayResponse | FollowUpState> {
  const baseProfile =
    input.state?.profileDraft ??
    normaliseProfile(
      {
        currentCondition: input.request?.currentCondition ?? "",
        dreamLife: input.request?.dreamLife ?? "",
      },
      {},
    );

  const result = await callLlmJson<CollectInfoLlmResult>(
    [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          agent: "CollectInfo Agent",
          task:
            "Validate the user's request, summarize what the user wants, detect overlooked issues, update the structured profile, and generate a queue of follow-up questions needed before planning.",
          rules: [
            "If the input is irrelevant, fictional, impossible to treat as realistic planning, abusive, or not about education/career/income/finance/location/life-path planning, return validation.isUsable=false with helpful reasons.",
            "If usable, return validation.isUsable=true.",
            "Return questionQueue with 0 to 10 questions. The interface will display them one at a time.",
            "Do not repeat any answered question or issue acceptance.",
            "Follow-up questions must be generated by you from the user's actual profile, not from a fixed checklist.",
            "Ask 1 to 10 total follow-up questions only when they materially improve planning or calculations.",
            "If an overlooked issue could materially break the plan, set requiresAcceptance=true and include an overlooked_issue_acceptance question before missing-information questions.",
            "If enough information exists, return readyToGenerate=true and questionQueue=[].",
            "Keep JSON compact: each summary under 320 characters, each question under 180 characters, each reason under 160 characters, and each option under 70 characters.",
            "Prefer 1 to 5 follow-up questions. Use more only when truly necessary, never more than 10.",
            "Default all assumptions to Malaysia, RM/MYR, and Malaysian education/cost context unless the user explicitly asks for a non-Malaysia pathway.",
            "Preserve specific fields like AI engineering, cybersecurity, business, medicine, law, design, or finance. Do not default everything to data science.",
          ],
          currentProfile: baseProfile,
          currentSummary: input.state?.collectInfoSummary ?? emptySummary(baseProfile),
          existingOverlookedIssues: input.state?.overlookedIssues ?? [],
          answeredQuestions: input.state?.answeredQuestions ?? [],
          latestAnswer: input.latestAnswer,
          maxFollowUpQuestions: MAX_FOLLOW_UP_QUESTIONS,
          outputSchema: {
            validation: {
              isUsable: "boolean",
              message: "string optional",
              reasons: "string[] optional",
            },
            profileDraft: "updated MalaysianUserProfile fields",
            collectInfoSummary: {
              currentConditionSummary: "string",
              dreamLifeSummary: "string",
              planningSummary: "string",
              malaysiaAssumptions: "string[]",
              internationalAssumptions: "string[]",
            },
            overlookedIssues: [
              {
                id: "stable string",
                title: "string",
                description: "string",
                severity: "critical | moderate | minor",
                requiresAcceptance: "boolean",
                accepted: "boolean",
              },
            ],
            questionQueue: [
              {
                id: "string",
                question: "string",
                variableKey: "string",
                purpose: "overlooked_issue_acceptance | missing_information",
                issueId: "string optional",
                reason: "string",
                inputType: "text | number | choice",
                options: "string[] optional",
                placeholder: "string optional",
                prefix: "string optional",
                suffix: "string optional",
              },
            ],
            readyToGenerate: "boolean",
          },
        }),
      },
    ],
    { temperature: 0.1, maxTokens: 6144 },
  );

  if (result.validation?.isUsable === false) {
    return invalidResponse(
      result.validation.message?.trim() || "This input cannot be used for realistic pathway planning yet.",
      asStringArray(result.validation.reasons).length
        ? asStringArray(result.validation.reasons)
        : ["Please provide realistic education, career, income, finance, location, or life-path details."],
    );
  }

  const mergedProfile = normaliseProfile(baseProfile, {
    ...baseProfile,
    ...(result.profileDraft ?? {}),
  });
  const summary = normaliseSummary(mergedProfile, result.collectInfoSummary);
  const answeredQuestions = input.state?.answeredQuestions ?? [];
  const answerAcceptedIssue =
    input.latestAnswer?.purpose === "overlooked_issue_acceptance" && isAffirmative(input.latestAnswer.answer);
  const overlookedIssues = markAcceptedIssue(
    mergeIssues(input.state?.overlookedIssues ?? [], result.overlookedIssues),
    input.latestAnswer?.issueId,
    answerAcceptedIssue,
  );

  const baseState: FollowUpState = {
    profileDraft: mergedProfile,
    collectInfoSummary: summary,
    overlookedIssues,
    questionQueue: [],
    answeredQuestions,
    nextQuestion: null,
    readyToGenerate: false,
  };

  if (answeredQuestions.length >= MAX_FOLLOW_UP_QUESTIONS) {
    return {
      ...baseState,
      readyToGenerate: !unacceptedRequiredIssue(overlookedIssues),
    };
  }

  const rawQueuedQuestions = normaliseQuestionQueue(baseState, [
    ...(result.questionQueue ?? []),
    result.nextQuestion,
  ]);
  const requiredIssue = unacceptedRequiredIssue(overlookedIssues);
  const requiredAcceptanceIndex = requiredIssue
    ? rawQueuedQuestions.findIndex(
        (question) =>
          question.purpose === "overlooked_issue_acceptance" &&
          (!question.issueId || question.issueId === requiredIssue.id),
      )
    : -1;
  const queuedQuestions =
    requiredIssue && requiredAcceptanceIndex >= 0
      ? [
          rawQueuedQuestions[requiredAcceptanceIndex],
          ...rawQueuedQuestions.filter((_, index) => index !== requiredAcceptanceIndex),
        ]
      : requiredIssue
        ? []
        : rawQueuedQuestions;
  const nextQuestion = queuedQuestions[0] ?? null;
  const pendingQuestions = queuedQuestions.slice(1);

  if (nextQuestion) {
    return {
      ...baseState,
      questionQueue: pendingQuestions,
      nextQuestion,
      readyToGenerate: false,
    };
  }

  return {
    ...baseState,
    readyToGenerate: Boolean(result.readyToGenerate) && !requiredIssue,
  };
}

function validateCandidates(pathways: CandidatePathway[]) {
  if (!Array.isArray(pathways) || pathways.length < 1 || pathways.length > 3) {
    throw new UserInputError("Planning Agent must return between 1 and 3 pathways.");
  }

  return pathways.map((pathway, index) => {
    if (!pathway.title || !pathway.careerKey || !pathway.cityKey || !pathway.educationKey) {
      throw new UserInputError("Planning Agent returned an incomplete pathway. Try adding more detail to the inputs.");
    }

    const flowSteps = asStringArray(pathway.flowSteps).slice(0, 8);
    const executionSteps = normaliseExecutionSteps(pathway.executionSteps, flowSteps);
    const derivedFlowSteps = flowSteps.length ? flowSteps : executionSteps.map((step) => `${step.timeframe}: ${step.milestone}`);

    if (derivedFlowSteps.length < 2) {
      throw new UserInputError("Planning Agent returned a pathway without enough flowchart steps.");
    }

    return {
      id: pathway.id || `pathway-${index + 1}`,
      title: pathway.title,
      careerKey: pathway.careerKey,
      cityKey: pathway.cityKey,
      educationKey: pathway.educationKey,
      sectorKey: pathway.sectorKey,
      timelineYears: Math.max(1, Math.min(20, Number(pathway.timelineYears || 5))),
      flowSteps: derivedFlowSteps.slice(0, 8),
      requiredSkills: asStringArray(pathway.requiredSkills),
      sacrificeConditions: asStringArray(pathway.sacrificeConditions),
      expectationMismatches: asStringArray(pathway.expectationMismatches),
      riskLevel: asRiskLevel(pathway.riskLevel) ?? "medium",
      ambitionLevel: asAmbitionLevel(pathway.ambitionLevel) ?? "standard",
      rarityReason: pathway.rarityReason?.trim() || "The Planning Agent did not mark this pathway as unusually rare.",
      executionSteps,
      assumptions: asStringArray(pathway.assumptions),
      webGroundingSources: pathway.webGroundingSources,
    };
  });
}

async function decideWebSearchNeed(profile: MalaysianUserProfile, summary: CollectInfoSummary) {
  const result = await callLlmJson<PlanningSearchDecision>(
    [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          agent: "Planning Agent",
          task:
            "Decide whether live Gemini Google Search grounding is necessary before generating pathway candidates.",
          rules: [
            "Return shouldSearch=true only when current external context materially affects planning, such as current job market, salary range, scholarship, certification, visa, internship, hiring demand, or international route requirements.",
            "Return shouldSearch=false when the curated Malaysia dataset and user profile are enough.",
            "If true, write one concise search query focused on Malaysia unless the user explicitly asks for an international path.",
          ],
          profile,
          collectInfoSummary: summary,
          outputSchema: {
            shouldSearch: "boolean",
            query: "string optional",
            reason: "string",
          },
        }),
      },
    ],
    { temperature: 0.05, maxTokens: 1024 },
  );

  return {
    shouldSearch: Boolean(result.shouldSearch),
    query: result.query?.trim(),
    reason: result.reason?.trim() || "Planning Agent did not provide a search reason.",
  };
}

async function generateCandidatesFromGrounding(
  state: FollowUpState,
  searchDecision: PlanningSearchDecision,
  webGrounding: WebGroundingBundle,
) {
  const datasetContext = getDatasetContextForPrompt();
  const result = await callLlmJson<CandidateLlmResult>(
    [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          agent: "Planning Agent",
          task:
            "Generate 1 to 3 pathway flowchart candidates from the finalized CollectInfo summary. Do not calculate probabilities or RM totals; the Calculation Agent will do deterministic formulas.",
          allowedDatasetKeys: datasetContext,
          collectInfoSummary: state.collectInfoSummary,
          answeredFollowUpQuestions: state.answeredQuestions,
          acceptedOverlookedIssues: state.overlookedIssues.filter((issue) => issue.accepted),
          liveWebGrounding: webGrounding.enabled
            ? {
                query: webGrounding.query,
                warning: webGrounding.warning,
                cache: {
                  status: webGrounding.cacheStatus ?? "miss",
                  saveStatus: webGrounding.cacheSaveStatus,
                  score: webGrounding.cacheScore,
                  intentKey: webGrounding.cacheIntentKey,
                  careerIntent: webGrounding.careerIntent,
                  autoSearchReason: webGrounding.autoSearchReason,
                  warning: webGrounding.cacheWarning,
                },
                sources: webGrounding.sources.map((source, index) => ({
                  id: `WEB-${index + 1}`,
                  title: source.title,
                  url: source.url,
                  snippet: source.snippet,
                  provider: source.provider,
                })),
              }
            : {
                enabled: false,
                warning: webGrounding.warning ?? "Planning Agent decided live web grounding is not necessary.",
                cache: {
                  status: webGrounding.cacheStatus ?? "disabled",
                  saveStatus: webGrounding.cacheSaveStatus,
                  intentKey: webGrounding.cacheIntentKey,
                  careerIntent: webGrounding.careerIntent,
                  autoSearchReason: webGrounding.autoSearchReason,
                  warning: webGrounding.cacheWarning,
                },
              },
          rules: [
            "Return 1 to 3 pathways only.",
            "Every pathway must use careerKey, cityKey, educationKey, and optional sectorKey from allowedDatasetKeys.",
            "Every pathway must include milestone flowSteps suitable for a flowchart. Each flow step should include a concrete action, target, or proof, not just a vague stage name.",
            "Every pathway must include executionSteps with timeframe, milestone, specificActions, proofOfProgress, and riskOrSacrifice.",
            "executionSteps.length must equal flowSteps.length.",
            "executionSteps[i] must describe the same milestone as flowSteps[i]. Do not reorder or skip final steps.",
            "Final roadmap steps must have the same detail quality as the early steps.",
            "Every pathway must include ambitionLevel. Use standard for normal local career routes, competitive for selective careers, elite for rare national-level outcomes, and global_elite for Oscar, Hollywood lead-role, Olympic, billionaire, unicorn-founder, or world-famous outcomes.",
            "Every pathway must include rarityReason explaining the ambitionLevel in plain language.",
            "Include sacrificeConditions and expectationMismatches in human language, but do not invent numeric probabilities.",
            "Default to Malaysia-relevant routes, salary context, and locations unless the user's dream explicitly asks otherwise.",
            "If an international route is explicit, explain the international assumption while keeping RM/MYR calculations.",
            "Use liveWebGrounding only as fresh context for market direction, requirements, and source-aware assumptions.",
            "Cached web grounding is source context only, not a career classifier. It must not override profile.desiredCareer, profile.fieldOfStudy, or the CollectInfo summary.",
            "Do not broaden AI engineering, machine learning engineering, data science, and data analysis into the same pathway just because cached sources are adjacent.",
            "If liveWebGrounding.cache.warning says the match is adjacent or weak, use it as weaker context and preserve the user's stated direction.",
            "Do not use web snippets to calculate RM values directly; deterministic formulas and Malaysia dataset own numbers.",
            "Do not default to data science or data analysis. Preserve the user's stated direction whenever realistic.",
            "Do not include dashboards, exports, extra buttons, or 30/60/90-day plans.",
          ],
          profile: state.profileDraft,
          outputSchema: {
            pathways: [
              {
                id: "string",
                title: "string",
                careerKey: "dataset career key",
                cityKey: "dataset city key",
                educationKey: "dataset education key",
                sectorKey: "optional dataset sector key",
                timelineYears: "number",
                flowSteps: "string[]",
                requiredSkills: "string[]",
                sacrificeConditions: "string[]",
                expectationMismatches: "string[]",
                riskLevel: "low | medium | high",
                ambitionLevel: "standard | competitive | elite | global_elite",
                rarityReason: "string",
                executionSteps: [
                  {
                    timeframe: "string",
                    milestone: "string",
                    specificActions: "string[]",
                    proofOfProgress: "string[]",
                    riskOrSacrifice: "string",
                  },
                ],
                assumptions: "string[]",
              },
            ],
          },
        }),
      },
    ],
    { temperature: 0.25, maxTokens: 4096 },
  );

  return validateCandidates(result.pathways).map((candidate) => ({
    ...candidate,
    assumptions: [
      ...candidate.assumptions,
      `CollectInfo summary used: ${state.collectInfoSummary.planningSummary}`,
      `Planning Agent web-search decision: ${searchDecision.reason}`,
      ...(webGrounding.careerIntent
        ? [
            `Career intent classifier: ${webGrounding.careerIntent.intentLabel} (${webGrounding.careerIntent.intentKey}, confidence ${Math.round(
              webGrounding.careerIntent.confidence * 100,
            )}%).`,
          ]
        : []),
      ...(webGrounding.autoSearchReason ? [`Auto web grounding reason: ${webGrounding.autoSearchReason}`] : []),
      ...(webGrounding.enabled && webGrounding.query ? [`Live web grounding query: ${webGrounding.query}`] : []),
      `Ambition level marked by Planning Agent: ${candidate.ambitionLevel}. ${candidate.rarityReason}`,
    ],
    webGroundingSources: webGrounding.sources,
  }));
}

async function generateCandidates(state: FollowUpState) {
  const searchDecision = await decideWebSearchNeed(state.profileDraft, state.collectInfoSummary);
  const webGrounding = await getWebGroundingForProfile(state.profileDraft, searchDecision, state.collectInfoSummary);
  return generateCandidatesFromGrounding(state, searchDecision, webGrounding);
}

function generateResult(state: FollowUpState): Promise<GeneratePathwayResponse> {
  return generateCandidates(state).then((candidates) => {
    return buildGeneratePathwayResponse(state, candidates);
  });
}

function buildGeneratePathwayResponse(state: FollowUpState, candidates: CandidatePathway[]): GeneratePathwayResponse {
  return {
    pathways: rankPathways(state.profileDraft, candidates),
    responsibleAiNotice: RESPONSIBLE_AI_NOTICE,
  };
}

export async function advancePathwayGeneration(run: PathwayGenerationRun): Promise<PathwayGenerationStepResponse> {
  const activeRun = updateGenerationRun(run, {
    state: readyGenerationState(run.state),
  });

  try {
    if (activeRun.stage === "complete" && activeRun.result) {
      return {
        kind: "result",
        state: activeRun.state,
        result: activeRun.result,
        run: activeRun,
      };
    }

    if (activeRun.stage === "search_decision") {
      const searchDecision = await decideWebSearchNeed(activeRun.state.profileDraft, activeRun.state.collectInfoSummary);

      return {
        kind: "generation",
        run: updateGenerationRun(activeRun, {
          stage: "web_grounding",
          searchDecision,
          retryCount: 0,
          error: undefined,
        }),
      };
    }

    if (activeRun.stage === "web_grounding") {
      const searchDecision =
        activeRun.searchDecision ??
        (await decideWebSearchNeed(activeRun.state.profileDraft, activeRun.state.collectInfoSummary));

      try {
        const webGrounding = await getWebGroundingForProfile(
          activeRun.state.profileDraft,
          searchDecision,
          activeRun.state.collectInfoSummary,
        );

        return {
          kind: "generation",
          run: updateGenerationRun(activeRun, {
            stage: "planning_candidates",
            searchDecision,
            webGrounding,
            retryCount: 0,
            error: undefined,
          }),
        };
      } catch (error) {
        if (activeRun.retryCount >= MAX_GENERATION_STAGE_RETRIES) {
          const warning = `${generationErrorMessage(error)} Continuing with curated Malaysia dataset.`;

          return {
            kind: "generation",
            run: updateGenerationRun(activeRun, {
              stage: "planning_candidates",
              searchDecision,
              webGrounding: fallbackWebGrounding(searchDecision, warning),
              retryCount: 0,
              error: undefined,
            }),
          };
        }

        throw error;
      }
    }

    if (activeRun.stage === "planning_candidates") {
      const searchDecision =
        activeRun.searchDecision ??
        ({
          shouldSearch: false,
          reason: "No saved web-search decision was found; Planning Agent continues with curated Malaysia dataset.",
        } satisfies PlanningSearchDecision);
      const webGrounding =
        activeRun.webGrounding ??
        fallbackWebGrounding(
          searchDecision,
          "No saved web-grounding bundle was found; Planning Agent continues with curated Malaysia dataset.",
        );
      const candidates = await generateCandidatesFromGrounding(activeRun.state, searchDecision, webGrounding);

      return {
        kind: "generation",
        run: updateGenerationRun(activeRun, {
          stage: "calculation",
          searchDecision,
          webGrounding,
          candidatePathways: candidates,
          retryCount: 0,
          error: undefined,
        }),
      };
    }

    if (activeRun.stage === "calculation") {
      if (!activeRun.candidatePathways?.length) {
        throw new UserInputError("Planning candidates are missing, so calculation cannot continue yet.");
      }

      const result = buildGeneratePathwayResponse(activeRun.state, activeRun.candidatePathways);
      const completeRun = updateGenerationRun(activeRun, {
        stage: "complete",
        result,
        retryCount: 0,
        error: undefined,
      });

      return {
        kind: "result",
        state: completeRun.state,
        result,
        run: completeRun,
      };
    }

    throw new UserInputError("Unknown generation stage.");
  } catch (error) {
    return {
      kind: "generation",
      run: updateGenerationRun(activeRun, {
        retryCount: activeRun.retryCount + 1,
        error: generationErrorMessage(error),
      }),
    };
  }
}

async function continueOrGenerate(state: FollowUpState): Promise<StartPathwayResponse> {
  if (unacceptedRequiredIssue(state.overlookedIssues) && !state.nextQuestion) {
    return invalidResponse(
      "Planning is paused because a material overlooked issue still needs explicit acceptance.",
      ["Please answer the CollectInfo acceptance question before generating pathways."],
    );
  }

  if (!state.readyToGenerate && state.nextQuestion) {
    return {
      kind: "question",
      state,
      nextQuestion: state.nextQuestion,
    };
  }

  return {
    kind: "generation",
    run: createGenerationRun(state),
  };
}

export async function startPathway(request: GeneratePathwayRequest): Promise<StartPathwayResponse> {
  const precheck = cheapInputPrecheck(request);
  if (!precheck.ok && precheck.response) return precheck.response;

  const collectInfoResult = await runCollectInfoAgent({ request });
  if ("kind" in collectInfoResult) return collectInfoResult;

  return continueOrGenerate(collectInfoResult);
}

export async function answerPathway(request: AnswerPathwayRequest): Promise<StartPathwayResponse> {
  const currentQuestion = request.state.nextQuestion;

  if (!currentQuestion) {
    throw new UserInputError("No active follow-up question exists.");
  }

  if (!request.answer.trim()) {
    throw new UserInputError("Please answer the follow-up question before continuing.");
  }

  if (currentQuestion.purpose === "overlooked_issue_acceptance" && !isAffirmative(request.answer)) {
    return invalidResponse(
      "Planning cannot continue until you explicitly accept the overlooked issue or revise your original input.",
      [`Issue requiring acceptance: ${currentQuestion.question}`],
    );
  }

  const answer: FollowUpAnswer = {
    questionId: currentQuestion.id,
    variableKey: currentQuestion.variableKey,
    purpose: currentQuestion.purpose,
    issueId: currentQuestion.issueId,
    question: currentQuestion.question,
    answer: request.answer.trim(),
  };

  const answeredQuestions = [...request.state.answeredQuestions, answer];
  const acceptedIssues = markAcceptedIssue(
    request.state.overlookedIssues,
    currentQuestion.issueId,
    currentQuestion.purpose === "overlooked_issue_acceptance" && isAffirmative(answer.answer),
  );
  const profileDraft = applyAnswerLocally(request.state.profileDraft, currentQuestion, answer.answer);
  const existingQueue = request.state.questionQueue ?? [];
  const nextQuestion = existingQueue[0] ?? null;
  const questionQueue = existingQueue.slice(1);
  const nextState: FollowUpState = {
    ...request.state,
    profileDraft,
    overlookedIssues: acceptedIssues,
    answeredQuestions,
    questionQueue,
    nextQuestion,
    readyToGenerate: !nextQuestion,
  };

  if (nextQuestion) {
    return {
      kind: "question",
      state: nextState,
      nextQuestion,
    };
  }

  return continueOrGenerate(nextState);
}
