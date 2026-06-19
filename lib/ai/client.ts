import type { LlmJsonMessage } from "@/lib/agentic/types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

type GroundingSourceLike = {
  title?: string;
  url?: string;
  snippet?: string;
};

type GeminiGroundingLike = {
  shouldUseForPlanning?: boolean;
  summary?: string;
  sources?: GroundingSourceLike[];
  extractionNote?: string;
};

type ExtractedGroundingSources = {
  sources?: GroundingSourceLike[];
};

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

export type AiProviderConfig = {
  provider: "freellmapi";
  model: string;
  apiKey: string;
  baseUrl: string;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normaliseBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAiProviderConfig(): AiProviderConfig {
  const apiKey = readEnv("FREELLMAPI_API_KEY");

  if (!apiKey) {
    throw new AiConfigurationError(
      "AI generation requires FREELLMAPI_API_KEY in .env.local. FreeLLMAPI manages upstream provider keys separately.",
    );
  }

  return {
    provider: "freellmapi",
    apiKey,
    model: readEnv("FREELLMAPI_MODEL") ?? "auto",
    baseUrl: normaliseBaseUrl(readEnv("FREELLMAPI_BASE_URL") ?? "http://localhost:3001/v1"),
  };
}

function stripMarkdownFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonObject(value: string) {
  const start = value.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) return value.slice(start, index + 1);
  }

  return null;
}

function parseJsonContent<T>(content: string): T {
  const candidate = stripMarkdownFence(content);

  try {
    return JSON.parse(candidate) as T;
  } catch (firstError) {
    const extracted = extractFirstJsonObject(candidate);

    if (extracted) {
      try {
        return JSON.parse(stripMarkdownFence(extracted)) as T;
      } catch (secondError) {
        throw new AiProviderError(
          `AI provider returned invalid JSON: ${
            secondError instanceof Error ? secondError.message : firstError instanceof Error ? firstError.message : "unknown parse error"
          }`,
        );
      }
    }

    throw new AiProviderError(
      `AI provider returned invalid JSON: ${firstError instanceof Error ? firstError.message : "unknown parse error"}`,
    );
  }
}

function readableProviderError(status: number, body: string, config: AiProviderConfig) {
  const compactBody = body.replace(/\s+/g, " ").trim();

  return [
    `FreeLLMAPI request failed (${status}).`,
    `Base URL: ${config.baseUrl}.`,
    `Model: ${config.model}.`,
    compactBody ? `Provider message: ${compactBody.slice(0, 500)}` : "No provider message returned.",
  ].join(" ");
}

function compactText(value: string, limit: number) {
  return value.replace(/\s+/g, " ").replace(/```(?:json)?/gi, "").trim().slice(0, limit);
}

function fallbackGeminiGrounding<T>(content: string): T {
  const summary = compactText(stripMarkdownFence(content), 1200);
  const urls = Array.from(new Set(summary.match(/https?:\/\/[^\s"',)]+/g) ?? [])).slice(0, 6);

  return {
    shouldUseForPlanning: summary.length > 40,
    summary: summary || "Gemini Google Search returned malformed JSON, but no usable summary text could be extracted.",
    sources: urls.map((url, index) => ({
      title: `Gemini grounded source ${index + 1}`,
      url,
      snippet: "",
    })),
  } as T;
}

function hasSources(value: unknown) {
  const sources = (value as GeminiGroundingLike | undefined)?.sources;
  return Array.isArray(sources) && sources.some((source) => typeof source?.url === "string" && source.url.trim());
}

function hasUsefulSummary(value: unknown) {
  const summary = (value as GeminiGroundingLike | undefined)?.summary;
  return typeof summary === "string" && summary.trim().length > 40;
}

function normaliseExtractedSources(value: ExtractedGroundingSources | undefined, rawText: string): GroundingSourceLike[] {
  if (!Array.isArray(value?.sources)) return [];
  const seen = new Set<string>();

  return value.sources
    .map((source, index) => ({
      title: compactText(String(source.title || `Extracted source ${index + 1}`), 160),
      url: compactText(String(source.url || ""), 500),
      snippet: compactText(String(source.snippet || ""), 500),
    }))
    .filter((source) => {
      if (!source.url || seen.has(source.url)) return false;
      if (!rawText.includes(source.url)) return false;
      seen.add(source.url);
      return true;
    })
    .slice(0, 8);
}

async function enrichGeminiSources<T>(result: T, rawText: string, signal?: AbortSignal): Promise<T> {
  if (hasSources(result) || !hasUsefulSummary(result) || !rawText.trim()) return result;

  try {
    const extraction = await callLlmJson<ExtractedGroundingSources>(
      [
        {
          role: "system",
          content:
            "Extract source titles and URLs from raw web-grounding text. Return valid JSON only. Never invent URLs, domains, titles, or citations.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Extract source URLs that are explicitly present in the raw text.",
            rules: [
              "Return only URLs that appear verbatim in rawText.",
              "If rawText has no URL, return sources=[].",
              "Do not perform web search.",
              "Do not infer or invent missing URLs.",
              "Use nearby title text only if it is present in rawText.",
            ],
            outputSchema: {
              sources: [
                {
                  title: "string",
                  url: "string",
                  snippet: "string",
                },
              ],
            },
            rawText: rawText.slice(0, 6000),
          }),
        },
      ],
      { temperature: 0, maxTokens: 1024, signal, retryInvalidJson: true },
    );
    const sources = normaliseExtractedSources(extraction, rawText);

    if (!sources.length) return result;

    return {
      ...(result as GeminiGroundingLike),
      sources,
      extractionNote: "Source URLs extracted from raw Gemini grounding text without another web search.",
    } as T;
  } catch {
    return result;
  }
}

async function chatCompletion(args: {
  messages: LlmJsonMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}) {
  const config = getAiProviderConfig();
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 45000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 45000);

  args.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;

  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model ?? config.model,
        messages: args.messages,
        temperature: args.temperature ?? 0.2,
        max_tokens: args.maxTokens ?? 2048,
        ...(args.responseFormatJson ? { response_format: { type: "json_object" } } : {}),
        ...(args.tools?.length ? { tools: args.tools } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiProviderError(`FreeLLMAPI request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const providerMessage = await response.text();
    throw new AiProviderError(readableProviderError(response.status, providerMessage, config));
  }

  return (await response.json()) as ChatCompletionResponse;
}

export async function callLlmJson<T>(
  messages: LlmJsonMessage[],
  options: { temperature?: number; signal?: AbortSignal; maxTokens?: number; retryInvalidJson?: boolean } = {},
): Promise<T> {
  const payload = await chatCompletion({
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    responseFormatJson: true,
    signal: options.signal,
  });
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiProviderError("FreeLLMAPI returned an empty response.");
  }

  try {
    return enrichGeminiSources(parseJsonContent<T>(content), content, options.signal);
  } catch (error) {
    const shouldRetry =
      options.retryInvalidJson !== false &&
      error instanceof AiProviderError &&
      error.message.startsWith("AI provider returned invalid JSON");

    if (!shouldRetry) throw error;

    const retryPayload = await chatCompletion({
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "Your previous response was invalid or truncated JSON. Return exactly one complete compact JSON object that matches the requested schema. Do not include Markdown, comments, explanations, or trailing text. Keep all string values short.",
        },
      ],
      temperature: 0,
      maxTokens: Math.max(options.maxTokens ?? 2048, 6144),
      responseFormatJson: true,
      signal: options.signal,
    });
    const retryContent = retryPayload.choices?.[0]?.message?.content;

    if (!retryContent) {
      throw new AiProviderError("FreeLLMAPI returned an empty response while retrying invalid JSON.");
    }

    return parseJsonContent<T>(retryContent);
  }
}

export async function callGeminiGoogleSearchJson<T>(
  messages: LlmJsonMessage[],
  options: { temperature?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const model = readEnv("FREELLMAPI_GEMINI_SEARCH_MODEL") ?? "gemini-2.5-flash";
  const tools: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "google_search",
        description: "Ground the response in live Google Search results when current web information is needed.",
        parameters: {},
      },
    },
  ];
  const payload = await chatCompletion({
    messages,
    model,
    temperature: options.temperature ?? 0.1,
    maxTokens: 1536,
    responseFormatJson: true,
    tools,
    signal: options.signal,
  });
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiProviderError("FreeLLMAPI Gemini Google Search returned an empty response.");
  }

  try {
    return parseJsonContent<T>(content);
  } catch (error) {
    const shouldRetry =
      error instanceof AiProviderError && error.message.startsWith("AI provider returned invalid JSON");

    if (!shouldRetry) throw error;

    const cleanupPayload = await chatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You repair malformed JSON for a web-grounding result. Return only one valid compact JSON object. Do not use Markdown. Do not add facts that are not present in the raw text.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Convert this malformed Google Search grounding response into valid JSON.",
            outputSchema: {
              shouldUseForPlanning: "boolean",
              summary: "string",
              sources: [
                {
                  title: "string",
                  url: "string",
                  snippet: "string",
                },
              ],
            },
            rules: [
              "Return valid JSON only.",
              "Keep summary under 900 characters.",
              "If URLs are missing, return sources as an empty array.",
              "If the raw text contains useful Malaysia career, education, salary, certification, licensing, or job-market context, set shouldUseForPlanning=true.",
            ],
            rawText: content.slice(0, 6000),
          }),
        },
      ],
      model,
      temperature: 0,
      maxTokens: 2048,
      responseFormatJson: true,
      signal: options.signal,
    });
    const cleanupContent = cleanupPayload.choices?.[0]?.message?.content;

    if (!cleanupContent) {
      return enrichGeminiSources(fallbackGeminiGrounding<T>(content), content, options.signal);
    }

    try {
      return enrichGeminiSources(parseJsonContent<T>(cleanupContent), content, options.signal);
    } catch {
      return enrichGeminiSources(fallbackGeminiGrounding<T>(content), content, options.signal);
    }
  }
}
