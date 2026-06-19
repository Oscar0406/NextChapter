import { callGeminiGoogleSearchJson } from "@/lib/ai/client";
import {
  buildWebGroundingCacheKey,
  getCachedWebGrounding,
  saveWebGroundingCache,
} from "@/lib/agentic/web-grounding-cache";
import type {
  CareerIntentClassification,
  CollectInfoSummary,
  MalaysianUserProfile,
  WebGroundingBundle,
  WebGroundingSource,
} from "@/lib/agentic/types";

type GeminiGroundingResponse = {
  summary?: string;
  shouldUseForPlanning?: boolean;
  extractionNote?: string;
  sources?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
  }>;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function searchMode() {
  return (readEnv("WEB_SEARCH_MODE") ?? "auto").toLowerCase();
}

function compactSnippet(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function uniqueSources(sources: WebGroundingSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export async function getWebGroundingForProfile(
  profile: MalaysianUserProfile,
  planningDecision?: {
    shouldSearch?: boolean;
    query?: string;
    reason?: string;
    classification?: CareerIntentClassification;
    autoSearchReason?: string;
  },
  collectInfoSummary?: CollectInfoSummary,
): Promise<WebGroundingBundle> {
  const mode = searchMode();
  const searchDisabled = mode === "disabled" || mode === "none" || mode === "off";

  if (searchDisabled) {
    return {
      enabled: false,
      warning: "Web grounding is disabled by WEB_SEARCH_MODE.",
      sources: [],
      cacheStatus: "disabled",
    };
  }

  const cacheKey = await buildWebGroundingCacheKey(profile, planningDecision, collectInfoSummary);
  const query = cacheKey.query;
  const cachedGrounding = await getCachedWebGrounding(cacheKey);

  if (cachedGrounding.bundle) {
    return cachedGrounding.bundle;
  }

  const autoSearchReason =
    mode === "auto" && !planningDecision?.shouldSearch && cacheKey.isClearIntent
      ? `Auto mode ran web grounding because the career intent classifier detected ${cacheKey.classification.intentLabel} with ${Math.round(
          cacheKey.classification.confidence * 100,
        )}% confidence and no reusable cache hit was found.`
      : planningDecision?.autoSearchReason;
  const shouldSearch = mode === "always" || Boolean(planningDecision?.shouldSearch) || Boolean(autoSearchReason);

  if (!shouldSearch) {
    return {
      enabled: false,
      query,
      warning: planningDecision?.reason ?? "Planning Agent decided live web grounding is not necessary.",
      sources: [],
      careerIntent: cacheKey.classification,
      cacheStatus: cachedGrounding.status,
      cacheIntentKey: cacheKey.intentKey,
      cacheWarning: [
        cachedGrounding.warning,
        `Career intent classifier detected ${cacheKey.classification.intentLabel} (${cacheKey.intentKey}) with ${Math.round(
          cacheKey.classification.confidence * 100,
        )}% confidence.`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  try {
    const result = await callGeminiGoogleSearchJson<GeminiGroundingResponse>(
      [
        {
          role: "system",
          content:
            "You are a Malaysia career-market web grounding tool. Use Google Search grounding only to collect current, relevant facts. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            query,
            userProfile: {
              currentCondition: profile.currentCondition,
              dreamLife: profile.dreamLife,
              desiredCareer: profile.desiredCareer,
              fieldOfStudy: profile.fieldOfStudy,
              currentLocation: profile.currentLocation,
              desiredLocation: profile.desiredLocation,
              timelineYears: profile.timelineYears,
            },
            rules: [
              "Search only for Malaysia-relevant career, education, salary, job-market, certification, scholarship, or hiring context.",
              "Prefer official Malaysian sources, employer/career pages, reputable salary reports, universities, and current job-market sources.",
              "Do not create pathway recommendations here.",
              "Do not calculate RM values here.",
              "If search results are weak or irrelevant, return shouldUseForPlanning=false.",
            ],
            outputSchema: {
              shouldUseForPlanning: "boolean",
              summary: "short summary of current web findings",
              sources: [
                {
                  title: "source title",
                  url: "source URL",
                  snippet: "short relevant snippet",
                },
              ],
            },
          }),
        },
      ],
      { temperature: 0.05 },
    );

    const sources = uniqueSources(
      (result.sources ?? []).map((source) => ({
        title: source.title ?? "Gemini grounded source",
        url: source.url ?? "",
        snippet: compactSnippet(source.snippet),
        provider: "freellmapi-google" as const,
      })),
    );
    const hasUsefulSummary = Boolean(result.summary?.trim());
    const shouldUseGrounding = Boolean(result.shouldUseForPlanning) && (sources.length > 0 || hasUsefulSummary);

    const bundle: WebGroundingBundle = {
      enabled: shouldUseGrounding,
      query,
      warning:
        shouldUseGrounding
          ? result.summary
          : result.summary ?? "Gemini Google Search grounding found no useful planning sources.",
      sources,
      careerIntent: cacheKey.classification,
      autoSearchReason,
      cacheStatus: cachedGrounding.status === "error" ? "error" : "miss",
      cacheIntentKey: cacheKey.intentKey,
      cacheWarning: [
        cachedGrounding.warning,
        result.extractionNote,
        `Career intent classifier detected ${cacheKey.classification.intentLabel} (${cacheKey.intentKey}) with ${Math.round(
          cacheKey.classification.confidence * 100,
        )}% confidence.`,
        autoSearchReason,
      ]
        .filter(Boolean)
        .join(" "),
    };

    const saveResult = await saveWebGroundingCache(cacheKey, bundle);

    return {
      ...bundle,
      cacheStatus: saveResult.status === "error" ? "error" : bundle.cacheStatus,
      cacheSaveStatus: saveResult.status,
      cacheWarning: [bundle.cacheWarning, saveResult.warning].filter(Boolean).join(" "),
    };
  } catch (error) {
    const searchFailureMessage = `Gemini Google Search grounding failed: ${
      error instanceof Error ? error.message : "unknown error"
    }. Falling back to curated Malaysia dataset.`;

    return {
      enabled: true,
      query,
      warning: searchFailureMessage,
      sources: [],
      careerIntent: cacheKey.classification,
      autoSearchReason,
      cacheStatus: cachedGrounding.status === "error" ? "error" : "miss",
      cacheSaveStatus: "skipped",
      cacheIntentKey: cacheKey.intentKey,
      cacheWarning: [
        cachedGrounding.warning,
        `Career intent classifier detected ${cacheKey.classification.intentLabel} (${cacheKey.intentKey}) with ${Math.round(
          cacheKey.classification.confidence * 100,
        )}% confidence.`,
        autoSearchReason,
        "Web grounding cache save skipped because Gemini did not return a cacheable result.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
}
