"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
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

function planTitle(item: SavedPathwayPlan) {
  return item.pathways[0]?.title ?? item.collectInfoSummary.dreamLifeSummary ?? "Saved pathway";
}

export default function HistoryPage() {
  const [items, setItems] = useState<SavedPathwayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const sessionId = getOrCreateSessionId();
        const response = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load history.");
        }

        setItems(payload.items ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load history.");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <main className="min-h-screen px-5 py-8 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Supabase history</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-trust sm:text-5xl">Saved pathways</h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-trust/15 bg-white/75 px-5 py-3 text-sm font-bold text-trust hover:border-jade/60 hover:text-jade"
          >
            <ArrowLeft size={16} />
            Planner
          </Link>
        </div>

        <div className="mt-8 grid gap-4">
          {loading ? (
            <div className="glass-panel rounded-[30px] p-6 text-sm font-semibold text-slate-600">Loading history...</div>
          ) : error ? (
            <div className="glass-panel rounded-[30px] p-6 text-sm leading-6 text-red-700">{error}</div>
          ) : items.length ? (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/history/${item.id}`}
                className="glass-panel rounded-[30px] p-5 shadow-sm hover:-translate-y-0.5 hover:border-jade/60 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-jade/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-jade">
                      <History size={13} />
                      {item.pathways.length} pathway{item.pathways.length === 1 ? "" : "s"}
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-trust">{planTitle(item)}</h2>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {item.collectInfoSummary.planningSummary}
                    </p>
                  </div>
                  <p className="shrink-0 rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-slate-500">
                    {savedDateLabel(item.createdAt)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="glass-panel rounded-[30px] p-6 text-sm leading-6 text-slate-600">
              No saved pathways yet. Generate a pathway from the planner and it will appear here once Supabase saves it.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
