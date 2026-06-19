"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DetailsPanel } from "@/components/agentic/DetailsPanel";
import { PathwayFlowchart } from "@/components/agentic/PathwayFlowchart";
import type { SavedPathwayPlan } from "@/lib/history/types";

const SESSION_KEY = "nextchapter.sessionId.v1";
const LEGACY_SESSION_KEY = "pathwise.sessionId.v1";

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

function savedDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return date.toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
}

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<SavedPathwayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    async function loadItem() {
      try {
        const sessionId = getOrCreateSessionId();
        const response = await fetch(`/api/history/${params.id}?sessionId=${encodeURIComponent(sessionId)}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load this saved pathway.");
        }

        setItem(payload.item);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load this saved pathway.");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) loadItem();
  }, [params.id]);

  return (
    <main className="min-h-screen px-5 py-8 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Saved pathway</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-trust sm:text-5xl">History details</h1>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-trust/15 bg-white/75 px-5 py-3 text-sm font-bold text-trust hover:border-jade/60 hover:text-jade"
          >
            <ArrowLeft size={16} />
            History
          </Link>
        </div>

        {loading ? (
          <div className="glass-panel mt-8 rounded-[30px] p-6 text-sm font-semibold text-slate-600">Loading saved plan...</div>
        ) : error ? (
          <div className="glass-panel mt-8 rounded-[30px] p-6 text-sm leading-6 text-red-700">{error}</div>
        ) : item ? (
          <div className="mt-8 space-y-6">
            <div className="glass-panel rounded-[34px] p-5 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Original input</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-trust">
                    {item.pathways[0]?.title ?? "Saved pathway"}
                  </h2>
                </div>
                <p className="rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-slate-500">
                  {savedDateLabel(item.createdAt)}
                </p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-trust/10 bg-white/65 p-5">
                  <h3 className="text-sm font-bold text-trust">Current condition</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.currentCondition}</p>
                </div>
                <div className="rounded-[24px] border border-trust/10 bg-white/65 p-5">
                  <h3 className="text-sm font-bold text-trust">Dream life</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.dreamLife}</p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] bg-[#003366]/95 p-5 text-white">
                <h3 className="text-sm font-bold">CollectInfo summary</h3>
                <p className="mt-3 text-sm leading-6 text-white/75">{item.collectInfoSummary.planningSummary}</p>
              </div>
            </div>

            {item.answeredQuestions.length ? (
              <div className="glass-panel rounded-[30px] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Answered follow-up questions</p>
                <div className="mt-4 grid gap-3">
                  {item.answeredQuestions.map((answer, index) => (
                    <div key={`${answer.questionId}-${index}`} className="rounded-[22px] border border-trust/10 bg-white/70 p-4">
                      <p className="text-sm font-bold text-trust">{answer.question}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{answer.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-jade/20 bg-white/70 p-5 text-sm leading-6 text-slate-700">
              {item.responsibleAiNotice}
            </div>

            {item.pathways.map((pathway, index) => (
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
