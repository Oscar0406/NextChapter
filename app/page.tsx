"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, History, LoaderCircle, Sparkles } from "lucide-react";
import { AgentThinking } from "@/components/agentic/AgentThinking";
import { DetailsPanel } from "@/components/agentic/DetailsPanel";
import { FollowUpModal } from "@/components/agentic/FollowUpModal";
import { PathwayFlowchart } from "@/components/agentic/PathwayFlowchart";
import type {
  FollowUpQuestion,
  FollowUpState,
  GeneratePathwayResponse,
  PathwayGenerationRun,
  PathwayGenerationStepResponse,
  StartPathwayResponse,
} from "@/lib/agentic/types";
import type { SavePathwayHistoryRequest } from "@/lib/history/types";

type Phase = "idle" | "thinking" | "question" | "answering" | "output" | "invalid";

const SESSION_KEY = "nextchapter.sessionId.v1";
const LEGACY_SESSION_KEY = "pathwise.sessionId.v1";
const GENERATION_RUN_KEY = "nextchapter.generationRun.v1";
const LEGACY_GENERATION_RUN_KEY = "pathwise.generationRun.v1";
const MAX_CLIENT_STAGE_RETRIES = 3;

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const legacy = window.localStorage.getItem(LEGACY_SESSION_KEY);
  if (legacy) {
    window.localStorage.setItem(SESSION_KEY, legacy);
    return legacy;
  }

  const next = createSessionId();
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

function readSavedGenerationRun() {
  try {
    const raw = window.localStorage.getItem(GENERATION_RUN_KEY) ?? window.localStorage.getItem(LEGACY_GENERATION_RUN_KEY);
    if (!raw) return null;

    const run = JSON.parse(raw) as Partial<PathwayGenerationRun>;
    if (!run.id || !run.stage || !run.state || run.stage === "complete") return null;
    window.localStorage.setItem(GENERATION_RUN_KEY, raw);
    window.localStorage.removeItem(LEGACY_GENERATION_RUN_KEY);
    return run as PathwayGenerationRun;
  } catch {
    window.localStorage.removeItem(GENERATION_RUN_KEY);
    window.localStorage.removeItem(LEGACY_GENERATION_RUN_KEY);
    return null;
  }
}

function saveGenerationRun(run: PathwayGenerationRun) {
  window.localStorage.setItem(GENERATION_RUN_KEY, JSON.stringify(run));
}

function clearGenerationRun() {
  window.localStorage.removeItem(GENERATION_RUN_KEY);
  window.localStorage.removeItem(LEGACY_GENERATION_RUN_KEY);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readApiResponse(response: Response): Promise<StartPathwayResponse> {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Pathway generation failed.");
  }

  return payload as StartPathwayResponse;
}

async function readGenerationStepResponse(response: Response): Promise<PathwayGenerationStepResponse> {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Pathway generation step failed.");
  }

  return payload as PathwayGenerationStepResponse;
}

function savedDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return `Saved ${date.toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}`;
}

export default function HomePage() {
  const outputRef = useRef<HTMLElement | null>(null);
  const generationLoopRef = useRef(false);
  const [sessionId, setSessionId] = useState("");
  const [currentCondition, setCurrentCondition] = useState("");
  const [dreamLife, setDreamLife] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [state, setState] = useState<FollowUpState | null>(null);
  const [generationRun, setGenerationRun] = useState<PathwayGenerationRun | null>(null);
  const [question, setQuestion] = useState<FollowUpQuestion | null>(null);
  const [result, setResult] = useState<GeneratePathwayResponse | null>(null);
  const [invalid, setInvalid] = useState<{ message: string; reasons: string[] } | null>(null);
  const [error, setError] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());

    const savedRun = readSavedGenerationRun();
    if (!savedRun) return;

    setCurrentCondition(savedRun.currentCondition);
    setDreamLife(savedRun.dreamLife);
    setState(savedRun.state);
    setQuestion(null);
    setResult(null);
    setInvalid(null);
    setError("");
    setGenerationRun(savedRun);
    setPhase("thinking");
    scrollToOutput();
    void continueGeneration(savedRun);
  }, []);

  function scrollToOutput() {
    window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function saveHistory(
    nextState: FollowUpState,
    nextResult: GeneratePathwayResponse,
    inputOverride?: { currentCondition: string; dreamLife: string },
  ) {
    const activeSessionId = sessionId || getOrCreateSessionId();
    if (!activeSessionId) return;

    const payload: SavePathwayHistoryRequest = {
      sessionId: activeSessionId,
      currentCondition: inputOverride?.currentCondition ?? currentCondition,
      dreamLife: inputOverride?.dreamLife ?? dreamLife,
      collectInfoSummary: nextState.collectInfoSummary,
      answeredQuestions: nextState.answeredQuestions,
      pathways: nextResult.pathways,
      responsibleAiNotice: nextResult.responsibleAiNotice,
    };

    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = await response.json();

      if (!response.ok) {
        throw new Error(saved.error ?? "Could not save history.");
      }

      setSavedAt(saved.item?.createdAt ?? new Date().toISOString());
      setHistoryNotice("");
    } catch (caught) {
      setHistoryNotice(caught instanceof Error ? caught.message : "Could not save this plan to Supabase history.");
    }
  }

  async function continueGeneration(initialRun: PathwayGenerationRun) {
    if (generationLoopRef.current) return;

    generationLoopRef.current = true;
    let activeRun = initialRun;

    try {
      for (let index = 0; index < 16; index += 1) {
        saveGenerationRun(activeRun);

        const response = await fetch("/api/pathway/generation/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run: activeRun }),
        });
        const payload = await readGenerationStepResponse(response);

        if (payload.kind === "result") {
          clearGenerationRun();
          setGenerationRun(null);
          setCurrentCondition(payload.run.currentCondition);
          setDreamLife(payload.run.dreamLife);
          setState(payload.state);
          setQuestion(null);
          setInvalid(null);
          setResult(payload.result);
          setDetailsId(null);
          setPhase("output");
          setSavedAt("");
          scrollToOutput();
          await saveHistory(payload.state, payload.result, {
            currentCondition: payload.run.currentCondition,
            dreamLife: payload.run.dreamLife,
          });
          return;
        }

        activeRun = payload.run;
        setGenerationRun(activeRun);
        saveGenerationRun(activeRun);

        if (activeRun.error && activeRun.retryCount >= MAX_CLIENT_STAGE_RETRIES) {
          setError(
            `Generation paused during ${activeRun.stage.replace(/_/g, " ")}: ${activeRun.error}. Your answers are saved in this browser; refresh the page to resume from this stage.`,
          );
          setPhase("invalid");
          scrollToOutput();
          return;
        }

        await wait(300);
      }

      setError("Generation paused before completion. Your answers are saved in this browser; refresh the page to resume.");
      setPhase("invalid");
      scrollToOutput();
    } catch (caught) {
      const pausedRun: PathwayGenerationRun = {
        ...activeRun,
        retryCount: activeRun.retryCount + 1,
        error: caught instanceof Error ? caught.message : "Pathway generation step failed.",
        updatedAt: new Date().toISOString(),
      };

      setGenerationRun(pausedRun);
      saveGenerationRun(pausedRun);
      setError(
        `Generation paused during ${pausedRun.stage.replace(/_/g, " ")}: ${pausedRun.error}. Your answers are saved in this browser; refresh the page to resume from this stage.`,
      );
      setPhase("invalid");
      scrollToOutput();
    } finally {
      generationLoopRef.current = false;
    }
  }

  function handleGenerationRun(run: PathwayGenerationRun) {
    setState(run.state);
    setQuestion(null);
    setInvalid(null);
    setResult(null);
    setGenerationRun(run);
    saveGenerationRun(run);
    setPhase((previousPhase) => (previousPhase === "answering" ? "answering" : "thinking"));
    scrollToOutput();
    void continueGeneration(run);
  }

  async function handlePlannerResponse(payload: StartPathwayResponse) {
    if (payload.kind === "invalid") {
      clearGenerationRun();
      setGenerationRun(null);
      setInvalid({ message: payload.message, reasons: payload.reasons });
      setQuestion(null);
      setResult(null);
      setPhase("invalid");
      scrollToOutput();
      return;
    }

    if (payload.kind === "question") {
      setState(payload.state);
      setInvalid(null);
      setGenerationRun(null);
      setQuestion(payload.nextQuestion);
      setPhase("question");
      scrollToOutput();
      return;
    }

    if (payload.kind === "generation") {
      handleGenerationRun(payload.run);
      return;
    }

    setState(payload.state);
    setInvalid(null);
    clearGenerationRun();
    setGenerationRun(null);
    setQuestion(null);
    setResult(payload.result);
    setDetailsId(null);
    setPhase("output");
    setSavedAt("");
    scrollToOutput();
    await saveHistory(payload.state, payload.result);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInvalid(null);
    setResult(null);
    setDetailsId(null);
    setHistoryNotice("");
    setSavedAt("");
    clearGenerationRun();
    setGenerationRun(null);
    setPhase("thinking");
    scrollToOutput();

    try {
      const response = await fetch("/api/pathway/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCondition,
          dreamLife,
          locale: "en-MY",
          currency: "MYR",
        }),
      });

      await handlePlannerResponse(await readApiResponse(response));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pathway generation failed.");
      setPhase("invalid");
      scrollToOutput();
    }
  }

  async function submitAnswer(answer: string) {
    if (!state) return;

    setError("");
    setPhase("answering");
    scrollToOutput();

    try {
      const response = await fetch("/api/pathway/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, answer }),
      });

      await handlePlannerResponse(await readApiResponse(response));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not apply follow-up answer.");
      setPhase("question");
    }
  }

  const busy = phase === "thinking" || phase === "answering" || Boolean(generationRun && phase !== "output" && phase !== "invalid");
  const canSubmit = currentCondition.trim().length >= 10 && dreamLife.trim().length >= 10 && !busy;

  return (
    <main className="min-h-screen">
      <Link
        href="/history"
        className="fixed right-5 top-5 z-40 grid size-12 place-items-center rounded-full bg-trust text-white shadow-2xl shadow-trust/20 hover:-translate-y-0.5 hover:bg-[#004780]"
        aria-label="Open history"
      >
        <History size={19} />
      </Link>

      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-6 lg:px-8">
        <div className="w-full">
          <div className="text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-bold text-trust shadow-sm">
              <Sparkles size={14} className="text-jade" />
              NextChapter
            </div>
            <h1 className="mx-auto mt-5 max-w-3xl text-balance text-[clamp(2.6rem,7vw,5.8rem)] font-semibold leading-[0.9] tracking-[-0.075em] text-trust">
              Plan your next chapter.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Tell us your current condition and dream life. The agents will ask only what they need, then generate
              Malaysia-oriented pathways with RM calculations.
            </p>
          </div>

          <form onSubmit={generate} className="glass-panel mx-auto mt-7 max-w-4xl rounded-[34px] p-5 sm:p-6 lg:p-7">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-trust">Current condition</span>
                <textarea
                  value={currentCondition}
                  onChange={(event) => setCurrentCondition(event.target.value)}
                  placeholder="Example: I am a second-year AI student in Selangor, CGPA 3.4, family can support RM500/month..."
                  className="mt-3 min-h-36 w-full resize-y rounded-[24px] border border-trust/10 bg-white/75 p-4 text-sm leading-6 text-trust outline-none placeholder:text-slate-400 focus:border-jade/70 sm:min-h-44"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-trust">Dream life</span>
                <textarea
                  value={dreamLife}
                  onChange={(event) => setDreamLife(event.target.value)}
                  placeholder="Example: I want to earn RM10,000/month within 5 years, work in AI engineering, and keep debt low..."
                  className="mt-3 min-h-36 w-full resize-y rounded-[24px] border border-trust/10 bg-white/75 p-4 text-sm leading-6 text-trust outline-none placeholder:text-slate-400 focus:border-jade/70 sm:min-h-44"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-trust px-6 py-4 text-sm font-bold text-white shadow-xl shadow-trust/15 hover:-translate-y-0.5 hover:bg-[#004780] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  Planning
                </>
              ) : (
                <>
                  Generate Pathway
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      <section ref={outputRef} className="mx-auto min-h-screen max-w-5xl px-5 py-10 lg:px-8">
        {(phase === "thinking" || phase === "answering" || phase === "question") && (
          <AgentThinking
            label={phase === "answering" ? "Updating the plan from your answer" : "Thinking through your pathway"}
          />
        )}

        {phase === "question" && question ? <FollowUpModal question={question} loading={false} onSubmit={submitAnswer} /> : null}

        {phase === "invalid" ? (
          <div className="glass-panel rounded-[34px] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">CollectInfo Agent</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-trust">Input needs revision</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              {error || invalid?.message || "Please add realistic education, career, income, finance, or location details."}
            </p>
            {invalid?.reasons.length ? (
              <ul className="mt-5 space-y-2 text-sm leading-6 text-slate-600">
                {invalid.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {phase === "output" && result && state ? (
          <div className="space-y-6">
            <div className="glass-panel rounded-[34px] p-5 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Your input and AI understanding</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-trust">
                    Pathway generated from this profile
                  </h2>
                </div>
                {savedAt ? (
                  <p className="rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-slate-500">
                    {savedDateLabel(savedAt)}
                  </p>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-trust/10 bg-white/65 p-5">
                  <h3 className="text-sm font-bold text-trust">Current condition</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{currentCondition}</p>
                </div>
                <div className="rounded-[24px] border border-trust/10 bg-white/65 p-5">
                  <h3 className="text-sm font-bold text-trust">Dream life</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{dreamLife}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] bg-[#003366]/95 p-5 text-white">
                <h3 className="text-sm font-bold">What the CollectInfo Agent understood</h3>
                <p className="mt-3 text-sm leading-6 text-white/75">{state.collectInfoSummary.planningSummary}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Current summary</p>
                    <p className="mt-2 text-sm leading-6">{state.collectInfoSummary.currentConditionSummary}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Dream summary</p>
                    <p className="mt-2 text-sm leading-6">{state.collectInfoSummary.dreamLifeSummary}</p>
                  </div>
                </div>
              </div>
            </div>

            {state.answeredQuestions.length ? (
              <div className="glass-panel rounded-[30px] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Answered follow-up questions</p>
                <div className="mt-4 grid gap-3">
                  {state.answeredQuestions.map((item, index) => (
                    <div key={`${item.questionId}-${index}`} className="rounded-[22px] border border-trust/10 bg-white/70 p-4">
                      <p className="text-sm font-bold text-trust">{item.question}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {historyNotice ? (
              <div className="rounded-[28px] border border-amber/40 bg-amber/20 p-5 text-sm leading-6 text-slate-700">
                {historyNotice}
              </div>
            ) : null}

            <div className="rounded-[28px] border border-jade/20 bg-white/70 p-5 text-sm leading-6 text-slate-700">
              {result.responsibleAiNotice}
            </div>

            {result.pathways.map((pathway, index) => (
              <PathwayFlowchart
                key={pathway.id}
                pathway={pathway}
                index={index}
                detailsVisible={detailsId === pathway.id}
                onShowDetails={() => setDetailsId(pathway.id)}
              >
                <DetailsPanel pathway={pathway} />
              </PathwayFlowchart>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
