import { callLlmJson } from "@/lib/ai/client";
import type {
  CareerIntentClassification,
  CollectInfoSummary,
  MalaysianUserProfile,
  WebGroundingBundle,
  WebGroundingSource,
} from "@/lib/agentic/types";
import { getSupabaseAdmin, WEB_GROUNDING_CACHE_TABLE } from "@/lib/supabase/server";

type PlanningSearchDecision = {
  shouldSearch?: boolean;
  query?: string;
  reason?: string;
  classification?: CareerIntentClassification;
  autoSearchReason?: string;
};

export type WebGroundingCacheKey = {
  query: string;
  queryNormalized: string;
  queryTerms: string[];
  intentKey: string;
  intentLabel: string;
  careerFamily: string;
  locationScope: string;
  countryScope: string;
  isClearIntent: boolean;
  classification: CareerIntentClassification;
};

type WebGroundingCacheRow = {
  id: string;
  query: string;
  intent_key: string;
  summary: string | null;
  sources: unknown;
  provider: string | null;
  created_at: string;
  expires_at: string;
  score: number;
};

export type WebGroundingCacheLookup = {
  status: NonNullable<WebGroundingBundle["cacheStatus"]>;
  bundle: WebGroundingBundle | null;
  warning?: string;
};

export type WebGroundingCacheSaveResult = {
  status: "saved" | "skipped" | "error";
  warning?: string;
};

const CACHE_PROVIDER = "freellmapi-google";
const UNKNOWN_INTENT = "unknown";
const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.65;

const STOPWORDS = new Set([
  "about",
  "after",
  "and",
  "are",
  "career",
  "cost",
  "education",
  "for",
  "from",
  "job",
  "jobs",
  "market",
  "malaysia",
  "pathway",
  "requirements",
  "salary",
  "search",
  "skills",
  "the",
  "this",
  "with",
  "year",
  "years",
]);

const INTENT_FAMILIES: Record<string, string> = {
  ai_engineer: "technology",
  machine_learning_engineer: "technology",
  data_scientist: "technology",
  data_analyst: "technology",
  software_engineer: "technology",
  cybersecurity: "technology",
  medicine: "healthcare",
  nursing: "healthcare",
  finance: "finance",
  accounting: "finance",
  law: "law",
  design: "creative",
  business: "business",
  teaching: "education",
  engineering: "engineering",
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cacheMode() {
  return (readEnv("WEB_GROUNDING_CACHE_MODE") ?? "enabled").toLowerCase();
}

function isCacheEnabled() {
  const mode = cacheMode();
  return mode !== "disabled" && mode !== "off" && mode !== "none";
}

function cacheTtlDays() {
  return Math.max(1, Math.min(90, Math.round(readNumberEnv("WEB_GROUNDING_CACHE_TTL_DAYS", 7))));
}

function cacheMinScore() {
  return Math.max(0.1, Math.min(0.95, readNumberEnv("WEB_GROUNDING_CACHE_MIN_SCORE", 0.55)));
}

function compactText(value: string | undefined, limit = 500) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function slugify(value: string | undefined, fallback = UNKNOWN_INTENT) {
  const slug = (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);

  return slug || fallback;
}

function normalizeText(value: string | undefined) {
  return compactText(value, 500)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(value: string) {
  const seen = new Set<string>();

  return value
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOPWORDS.has(term))
    .filter((term) => {
      if (seen.has(term)) return false;
      seen.add(term);
      return true;
    })
    .slice(0, 24);
}

function buildQuery(profile: MalaysianUserProfile, planningDecision?: PlanningSearchDecision) {
  const explicitQuery = planningDecision?.query?.trim();
  if (explicitQuery) return compactText(explicitQuery, 320);

  const career = profile.desiredCareer ?? profile.fieldOfStudy ?? "career pathway";
  const location = profile.desiredLocation ?? profile.currentLocation ?? "Malaysia";
  const timeline = profile.timelineYears ? `${profile.timelineYears} year timeline` : "";

  return compactText(`${career} ${location} Malaysia job market salary requirements skills education pathway ${timeline} 2026`, 320);
}

function detectIntentInText(value: string | undefined) {
  const text = normalizeText(value);
  if (!text) return UNKNOWN_INTENT;

  if (/\b(machine learning engineer|ml engineer|mle|deep learning engineer|computer vision engineer|nlp engineer)\b/.test(text)) {
    return "machine_learning_engineer";
  }

  if (/\b(data scientist|data science|datascience)\b/.test(text)) return "data_scientist";
  if (/\b(data analyst|data analytics|business intelligence|bi analyst)\b/.test(text)) return "data_analyst";

  if (
    /\b(ai engineer|artificial intelligence engineer|ai developer|artificial intelligence developer)\b/.test(text) ||
    (/\b(ai|artificial intelligence)\b/.test(text) && !/\b(data science|data scientist|data analyst|analytics)\b/.test(text))
  ) {
    return "ai_engineer";
  }

  if (/\b(software engineer|software developer|full stack|frontend|front end|backend|back end|web developer|mobile developer)\b/.test(text)) {
    return "software_engineer";
  }

  if (/\b(cybersecurity|cyber security|security analyst|soc analyst|penetration tester|pentester)\b/.test(text)) return "cybersecurity";
  if (/\b(medicine|doctor|medical doctor|physician|mbbs)\b/.test(text)) return "medicine";
  if (/\b(nurse|nursing)\b/.test(text)) return "nursing";
  if (/\b(finance|financial analyst|investment|banking)\b/.test(text)) return "finance";
  if (/\b(accountant|accounting|audit|auditor)\b/.test(text)) return "accounting";
  if (/\b(lawyer|legal|law degree|advocate|solicitor)\b/.test(text)) return "law";
  if (/\b(designer|design|ux|ui designer|graphic designer)\b/.test(text)) return "design";
  if (/\b(business|entrepreneur|startup|founder)\b/.test(text)) return "business";
  if (/\b(teacher|teaching|lecturer|education)\b/.test(text)) return "teaching";
  if (/\b(engineer|engineering)\b/.test(text)) return "engineering";

  return UNKNOWN_INTENT;
}

function detectIntent(profile: MalaysianUserProfile, query: string) {
  const orderedSignals = [
    profile.desiredCareer,
    query,
    profile.dreamLife,
    profile.fieldOfStudy,
    profile.currentCondition,
  ];

  for (const signal of orderedSignals) {
    const intent = detectIntentInText(signal);
    if (intent !== UNKNOWN_INTENT) return intent;
  }

  return UNKNOWN_INTENT;
}

function labelFromIntentKey(intentKey: string) {
  return intentKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function detectLocationInText(value: string | undefined) {
  const text = normalizeText(value);
  if (!text) return "";

  if (/\b(singapore|sg)\b/.test(text)) return "singapore";
  if (/\b(kuala lumpur|kl)\b/.test(text)) return "kuala_lumpur";
  if (/\b(selangor|shah alam|petaling jaya|pj|subang|cyberjaya|putrajaya)\b/.test(text)) return "selangor";
  if (/\b(penang|pulau pinang|georgetown|george town)\b/.test(text)) return "penang";
  if (/\b(johor|johor bahru|jb|iskandar)\b/.test(text)) return "johor";
  if (/\b(sabah|kota kinabalu)\b/.test(text)) return "sabah";
  if (/\b(sarawak|kuching|miri)\b/.test(text)) return "sarawak";
  if (/\b(malaysia|my)\b/.test(text)) return "malaysia";

  return "";
}

function detectLocation(profile: MalaysianUserProfile, query: string) {
  const orderedSignals = [profile.desiredLocation, profile.currentLocation, query, profile.dreamLife, profile.currentCondition];

  for (const signal of orderedSignals) {
    const location = detectLocationInText(signal);
    if (location) return location;
  }

  return "malaysia";
}

function detectCountry(profile: MalaysianUserProfile, query: string) {
  const combined = normalizeText(
    [query, profile.desiredLocation, profile.currentLocation, profile.dreamLife, profile.currentCondition].filter(Boolean).join(" "),
  );

  if (/\b(singapore|sg)\b/.test(combined)) return "singapore";
  return "malaysia";
}

function normaliseCountry(value: string | undefined, profile: MalaysianUserProfile, query: string) {
  const country = slugify(value, detectCountry(profile, query));
  if (country.includes("singapore")) return "singapore";
  if (country.includes("malaysia")) return "malaysia";
  return country || "malaysia";
}

function normaliseLocation(value: string | undefined, profile: MalaysianUserProfile, query: string) {
  const location = slugify(value, detectLocation(profile, query));
  if (location === "kl") return "kuala_lumpur";
  if (location === "pj") return "selangor";
  return location || "malaysia";
}

function normaliseConfidence(value: unknown) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  if (confidence > 1) return Math.max(0, Math.min(1, confidence / 100));
  return Math.max(0, Math.min(1, confidence));
}

function normaliseClassifierResult(
  raw: Partial<CareerIntentClassification> | undefined,
  profile: MalaysianUserProfile,
  query: string,
  fallbackIntentKey: string,
): CareerIntentClassification {
  const rawLabel = compactText(raw?.intentLabel || labelFromIntentKey(fallbackIntentKey), 120);
  const rawIntentKey = slugify(raw?.intentKey, "");
  const labelIntentKey = slugify(rawLabel, fallbackIntentKey);
  const genericKeys = new Set(["career", "job", "work", "business", "healthcare", "creative", "technology", "unknown"]);
  const intentKey = genericKeys.has(rawIntentKey) && labelIntentKey !== UNKNOWN_INTENT ? labelIntentKey : rawIntentKey || labelIntentKey;
  const fallbackFamily = INTENT_FAMILIES[fallbackIntentKey] ?? "general";
  const searchQuery = compactText(
    raw?.searchQuery || `${rawLabel} ${profile.desiredLocation ?? profile.currentLocation ?? "Malaysia"} career path requirements salary Malaysia 2026`,
    320,
  );

  return {
    intentKey,
    intentLabel: rawLabel || labelFromIntentKey(intentKey),
    careerFamily: slugify(raw?.careerFamily, fallbackFamily),
    locationScope: normaliseLocation(raw?.locationScope, profile, query),
    countryScope: normaliseCountry(raw?.countryScope, profile, query),
    confidence: normaliseConfidence(raw?.confidence),
    searchQuery,
    reason: compactText(raw?.reason || "Career intent was inferred from the user's current condition and dream life.", 240),
  };
}

function deterministicClassification(profile: MalaysianUserProfile, query: string): CareerIntentClassification {
  const intentKey = detectIntent(profile, query);
  const label = intentKey === UNKNOWN_INTENT ? "Unknown career intent" : labelFromIntentKey(intentKey);

  return {
    intentKey,
    intentLabel: label,
    careerFamily: INTENT_FAMILIES[intentKey] ?? "general",
    locationScope: detectLocation(profile, query),
    countryScope: detectCountry(profile, query),
    confidence: intentKey === UNKNOWN_INTENT ? 0.25 : 0.75,
    searchQuery: query,
    reason:
      intentKey === UNKNOWN_INTENT
        ? "Deterministic fallback could not identify a specific career intent."
        : "Deterministic fallback identified a known career intent.",
  };
}

async function classifyCareerIntent(
  profile: MalaysianUserProfile,
  query: string,
  summary?: CollectInfoSummary,
): Promise<CareerIntentClassification> {
  const fallback = deterministicClassification(profile, query);

  try {
    const result = await callLlmJson<Partial<CareerIntentClassification>>(
      [
        {
          role: "system",
          content:
            "You classify open-ended career intent for NextChapter Malaysia. Return valid JSON only. Do not do web search.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Identify the user's specific career or business path for safe web-grounding cache keys and write a focused Malaysia-first search query.",
            rules: [
              "Use the most specific realistic career path, profession, business path, or industry role.",
              "Create a stable snake_case intentKey from the specific path, such as actor, traditional_chinese_medicine_practitioner, clinic_owner, chef, pilot, content_creator, ai_engineer.",
              "Do not collapse specific careers into broad families. TCM is not generic medicine; actor is not generic creative; clinic owner is not generic business.",
              "careerFamily may be broad, but intentKey must be specific.",
              "Default countryScope to malaysia unless the user explicitly asks for another country.",
              "Default locationScope to the user's stated Malaysian city/state, or malaysia if unknown.",
              "confidence must be 0 to 1. Use >=0.65 only when the career path is clear enough for cache reuse.",
              "searchQuery should be concise and include Malaysia plus requirements, salary, licensing, training, market, or pathway terms as relevant.",
            ],
            profile,
            collectInfoSummary: summary,
            initialSearchQuery: query,
            outputSchema: {
              intentKey: "snake_case specific career key",
              intentLabel: "human-readable career path",
              careerFamily: "broad family such as healthcare, creative, aviation, food_hospitality, technology, business",
              locationScope: "snake_case city/state/country scope",
              countryScope: "snake_case country scope",
              confidence: "number 0..1",
              searchQuery: "string",
              reason: "string",
            },
          }),
        },
      ],
      { temperature: 0.05, maxTokens: 1024 },
    );

    const classification = normaliseClassifierResult(result, profile, query, fallback.intentKey);
    if (classification.intentKey === UNKNOWN_INTENT && fallback.intentKey !== UNKNOWN_INTENT) return fallback;
    return classification;
  } catch {
    return fallback;
  }
}

function normaliseSources(value: unknown): WebGroundingSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .map((source) => {
      const item = source as Partial<WebGroundingSource>;
      return {
        title: compactText(item.title ?? "Cached grounded source", 160),
        url: compactText(item.url, 500),
        snippet: compactText(item.snippet, 500),
        provider: CACHE_PROVIDER as WebGroundingSource["provider"],
      };
    })
    .filter((source) => {
      if (!source.url || seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    })
    .slice(0, 8);
}

function cacheWarningForHit(row: WebGroundingCacheRow, key: WebGroundingCacheKey) {
  const score = Number(row.score).toFixed(2);
  const intent = row.intent_key.replace(/_/g, " ");
  const exactness =
    row.intent_key === key.intentKey
      ? `exact intent match for ${intent}`
      : `compatible adjacent intent match: ${key.intentKey.replace(/_/g, " ")} to ${intent}`;

  return `Cached web grounding reused (${exactness}, score ${score}). Cached sources are context only and must not redefine the user's stated career direction.`;
}

export async function buildWebGroundingCacheKey(
  profile: MalaysianUserProfile,
  planningDecision?: PlanningSearchDecision,
  summary?: CollectInfoSummary,
): Promise<WebGroundingCacheKey> {
  const initialQuery = buildQuery(profile, planningDecision);
  const classification =
    planningDecision?.classification ?? (await classifyCareerIntent(profile, initialQuery, summary));
  const query = compactText(classification.searchQuery || initialQuery, 320);
  const queryNormalized = normalizeText(query);
  const intentKey = classification.intentKey || UNKNOWN_INTENT;
  const confidence = normaliseConfidence(classification.confidence);

  return {
    query,
    queryNormalized,
    queryTerms: queryTerms(queryNormalized),
    intentKey,
    intentLabel: classification.intentLabel,
    careerFamily: classification.careerFamily,
    locationScope: classification.locationScope,
    countryScope: classification.countryScope,
    isClearIntent: intentKey !== UNKNOWN_INTENT && confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD,
    classification: {
      ...classification,
      intentKey,
      confidence,
      searchQuery: query,
    },
  };
}

export async function getCachedWebGrounding(cacheKey: WebGroundingCacheKey): Promise<WebGroundingCacheLookup> {
  if (!isCacheEnabled()) {
    return { status: "disabled", bundle: null };
  }

  if (!cacheKey.isClearIntent) {
    return {
      status: "miss",
      bundle: null,
      warning: "Web grounding cache skipped because the career intent is not specific enough for safe reuse.",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("match_web_grounding_cache", {
      p_search_query: cacheKey.queryNormalized,
      p_search_terms: cacheKey.queryTerms,
      p_intent_key: cacheKey.intentKey,
      p_career_family: cacheKey.careerFamily,
      p_location_scope: cacheKey.locationScope,
      p_country_scope: cacheKey.countryScope,
      p_min_score: cacheMinScore(),
      p_max_age_days: cacheTtlDays(),
    });

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : null) as WebGroundingCacheRow | null;
    if (!row) return { status: "miss", bundle: null };

    const sources = normaliseSources(row.sources);
    if (!sources.length && !row.summary?.trim()) return { status: "miss", bundle: null };

    await markWebGroundingCacheHit(row.id);

    return {
      status: "hit",
      bundle: {
        enabled: true,
        query: cacheKey.query,
        warning: row.summary ?? cacheWarningForHit(row, cacheKey),
        sources,
        careerIntent: cacheKey.classification,
        cacheStatus: "hit",
        cacheScore: Number(row.score),
        cacheIntentKey: row.intent_key,
        cacheWarning: cacheWarningForHit(row, cacheKey),
      },
    };
  } catch (error) {
    return {
      status: "error",
      bundle: null,
      warning: `Web grounding cache unavailable: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }
}

export async function saveWebGroundingCache(
  cacheKey: WebGroundingCacheKey,
  bundle: WebGroundingBundle,
): Promise<WebGroundingCacheSaveResult> {
  if (!isCacheEnabled()) {
    return {
      status: "skipped",
      warning: "Web grounding cache save skipped because WEB_GROUNDING_CACHE_MODE is disabled.",
    };
  }

  if (!cacheKey.isClearIntent) {
    return {
      status: "skipped",
      warning: `Web grounding cache save skipped because the career intent is not specific enough for safe reuse (${cacheKey.classification.intentLabel}, confidence ${Math.round(
        cacheKey.classification.confidence * 100,
      )}%).`,
    };
  }

  if (!bundle.enabled || (!bundle.sources.length && !bundle.warning?.trim())) {
    return {
      status: "skipped",
      warning: "Web grounding cache save skipped because Gemini did not return usable planning sources.",
    };
  }

  try {
    const now = Date.now();
    const expiresAt = new Date(now + cacheTtlDays() * 24 * 60 * 60 * 1000).toISOString();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from(WEB_GROUNDING_CACHE_TABLE).upsert(
      {
        query: cacheKey.query,
        query_normalized: cacheKey.queryNormalized,
        query_terms: cacheKey.queryTerms,
        intent_key: cacheKey.intentKey,
        career_family: cacheKey.careerFamily,
        location_scope: cacheKey.locationScope,
        country_scope: cacheKey.countryScope,
        summary: compactText(bundle.warning, 1200),
        sources: bundle.sources.map((source) => ({
          title: compactText(source.title, 160),
          url: compactText(source.url, 500),
          snippet: compactText(source.snippet, 500),
          provider: CACHE_PROVIDER,
        })),
        should_use_for_planning: true,
        provider: CACHE_PROVIDER,
        expires_at: expiresAt,
        last_used_at: new Date(now).toISOString(),
      },
      {
        onConflict: "query_normalized,intent_key,location_scope,country_scope",
      },
    );

    if (error) {
      const details = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ");
      throw new Error(details || "Supabase upsert returned an unknown error.");
    }

    return {
      status: "saved",
      warning: `Web grounding cache saved for ${cacheKey.classification.intentLabel} (${cacheKey.intentKey}, confidence ${Math.round(
        cacheKey.classification.confidence * 100,
      )}%) in ${cacheKey.locationScope.replace(/_/g, " ")}.`,
    };
  } catch (error) {
    return {
      status: "error",
      warning: `Web grounding cache save failed: ${
        error instanceof Error ? error.message : "unknown Supabase error"
      }. Confirm public.web_grounding_cache and the RPC functions from supabase/web_grounding_cache.sql exist in the connected Supabase project.`,
    };
  }
}

export async function markWebGroundingCacheHit(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.rpc("mark_web_grounding_cache_hit", {
      p_cache_id: id,
    });
  } catch {
    // Ignore hit-count failures; the cached grounding has already been read.
  }
}
