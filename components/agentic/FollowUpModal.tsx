"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { FollowUpQuestion } from "@/lib/agentic/types";

type FollowUpModalProps = {
  question: FollowUpQuestion;
  loading: boolean;
  onSubmit: (answer: string) => void;
};

export function FollowUpModal({ question, loading, onSubmit }: FollowUpModalProps) {
  const [answer, setAnswer] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || loading) return;
    onSubmit(answer.trim());
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#001a33]/35 px-5 backdrop-blur-md">
      <form onSubmit={submit} className="glass-panel w-full max-w-xl rounded-[32px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-jade/15 text-jade">
            <span className="size-2 animate-pulse rounded-full bg-jade" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">CollectInfo Agent</p>
            <p className="mt-1 text-xs text-slate-500">One question at a time</p>
          </div>
        </div>

        <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-trust">{question.question}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{question.reason}</p>

        {question.inputType === "choice" && question.options?.length ? (
          <div className="mt-6 grid gap-2">
            {question.options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-trust/10 bg-white/70 p-4 text-sm font-semibold text-trust hover:border-jade/50"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answer === option}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="accent-[#00A86B]"
                />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <label className="mt-6 block">
            <span className="sr-only">{question.question}</span>
            <div className="flex items-center rounded-[22px] border border-trust/10 bg-white/75 px-4 focus-within:border-jade/70">
              {question.prefix ? <span className="text-sm font-bold text-slate-500">{question.prefix}</span> : null}
              <input
                type={question.inputType === "number" ? "number" : "text"}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={question.placeholder ?? "Type your answer"}
                className="min-h-14 flex-1 bg-transparent px-2 text-sm font-semibold text-trust outline-none placeholder:text-slate-400"
              />
              {question.suffix ? <span className="text-sm font-bold text-slate-500">{question.suffix}</span> : null}
            </div>
          </label>
        )}

        <button
          type="submit"
          disabled={!answer.trim() || loading}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-trust px-5 py-4 text-sm font-bold text-white shadow-xl shadow-trust/15 hover:-translate-y-0.5 hover:bg-[#004780] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Updating plan
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>
    </div>
  );
}
