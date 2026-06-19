"use client";

import { useState } from "react";
import { ChevronRight, CircleDollarSign, Sparkles, TimerReset } from "lucide-react";
import { TermHelp } from "@/components/agentic/TermHelp";
import type { PathwayExecutionStep, PathwayFlowchartResult } from "@/lib/agentic/types";

function formatRM(value: number) {
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}

function stepDetail(pathway: PathwayFlowchartResult, index: number): PathwayExecutionStep {
  const flowStep = pathway.flowSteps[index] ?? `Step ${index + 1}`;
  const detail = pathway.executionSteps?.[index];

  if (detail) {
    return {
      timeframe: detail.timeframe || `Step ${index + 1}`,
      milestone: flowStep,
      specificActions: detail.specificActions?.length ? detail.specificActions : [flowStep],
      proofOfProgress: detail.proofOfProgress?.length
        ? detail.proofOfProgress
        : ["You can clearly show that this milestone is completed."],
      riskOrSacrifice: detail.riskOrSacrifice || "No extra risk detail was saved for this step.",
    };
  }

  return {
    timeframe: `Step ${index + 1}`,
    milestone: flowStep,
    specificActions: [
      "Treat this roadmap card as the next concrete milestone.",
      "Break it into weekly tasks based on your available time, budget, and location.",
    ],
    proofOfProgress: ["You have evidence that this milestone is completed, such as a result, portfolio item, offer, certificate, or application record."],
    riskOrSacrifice: "This older saved pathway does not include detailed step guidance, so use the milestone as the main direction.",
  };
}

export function PathwayFlowchart({
  pathway,
  index,
  detailsVisible,
  onShowDetails,
  children,
}: {
  pathway: PathwayFlowchartResult;
  index: number;
  detailsVisible: boolean;
  onShowDetails: () => void;
  children?: React.ReactNode;
}) {
  const model = pathway.details.financialModel;
  const feasibilityScore = pathway.feasibilityScore ?? pathway.probability;
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const selectedStep = selectedStepIndex === null ? null : stepDetail(pathway, selectedStepIndex);

  return (
    <article className="glass-panel relative overflow-visible rounded-[34px] p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Pathway {index + 1}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-trust sm:text-3xl">{pathway.title}</h2>
        </div>
        <div className="rounded-[24px] bg-trust px-5 py-4 text-white shadow-xl shadow-trust/15">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
            Estimated feasibility
            <TermHelp
              label="Estimated feasibility"
              description="A planning score from the calculation model. It is not a guaranteed real-world probability."
            />
          </p>
          <p className="mt-1 text-3xl font-semibold">{feasibilityScore}%</p>
          <p className="mt-1 max-w-44 text-[11px] leading-4 text-white/60">Planning score, not a guaranteed probability.</p>
        </div>
      </div>

      <div className="mt-7 overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-3">
          {pathway.flowSteps.map((step, stepIndex) => (
            <div key={`${pathway.id}-${step}`} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedStepIndex(stepIndex)}
                className={`w-56 rounded-[24px] border p-4 text-left shadow-sm transition hover:border-jade/50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-jade/40 ${
                  selectedStepIndex === stepIndex ? "border-jade/70 bg-white shadow-jade/10" : "border-trust/10 bg-white/70"
                }`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-jade/15 text-xs font-bold text-jade">
                  {stepIndex + 1}
                </span>
                <p className="mt-3 text-sm font-semibold leading-6 text-trust">{step}</p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-jade">Click for details</p>
              </button>
              {stepIndex < pathway.flowSteps.length - 1 ? <ChevronRight className="shrink-0 text-jade" size={22} /> : null}
            </div>
          ))}
        </div>
      </div>

      {selectedStep && selectedStepIndex !== null ? (
        <div className="mt-4 rounded-[28px] border border-jade/20 bg-white/90 p-5 text-trust shadow-xl shadow-trust/10 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-jade">Step {selectedStepIndex + 1} details</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{selectedStep.timeframe}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{selectedStep.milestone}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStepIndex(null)}
              className="rounded-full border border-trust/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-trust hover:border-jade/50 hover:text-jade"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <section className="rounded-[20px] bg-jade/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-jade">How to achieve this step</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {selectedStep.specificActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-[20px] bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Proof of progress</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {selectedStep.proofOfProgress.map((proof) => (
                  <li key={proof}>{proof}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-[20px] bg-amber/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Risk / sacrifice</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{selectedStep.riskOrSacrifice}</p>
            </section>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-trust/10 bg-white/65 p-4">
          <CircleDollarSign className="text-jade" size={18} />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Projected salary
            <TermHelp
              label="Projected salary"
              description="Estimated monthly salary at the pathway timeline, using Malaysia salary ranges and city adjustment."
            />
          </p>
          <p className="mt-1 text-lg font-semibold text-trust">
            {formatRM(model.projectedMonthlySalaryAtTimelineRM)} / month
          </p>
        </div>
        <div className="rounded-[22px] border border-trust/10 bg-white/65 p-4">
          <Sparkles className="text-jade" size={18} />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Expected NPV
            <TermHelp
              label="Expected NPV"
              description="The 15-year net present value multiplied by the estimated feasibility score. It is a planning estimate, not guaranteed money."
            />
          </p>
          <p className="mt-1 text-lg font-semibold text-trust">{formatRM(model.expectedNpvRM)}</p>
        </div>
        <div className="rounded-[22px] border border-trust/10 bg-white/65 p-4">
          <TimerReset className="text-jade" size={18} />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Break-even
            <TermHelp
              label="Break-even"
              description="The first projected year where cumulative discounted net value reaches RM0 or above."
            />
          </p>
          <p className="mt-4 text-lg font-semibold text-trust">
            {model.breakEvenYear ? `Year ${model.breakEvenYear}` : "Not within 15 years"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] bg-amber/20 p-5">
          <h3 className="text-sm font-bold text-trust">Sacrifice / condition</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {pathway.sacrificeConditions.slice(0, 3).map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-[24px] bg-white/70 p-5">
          <h3 className="text-sm font-bold text-trust">Expectation mismatch</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {pathway.expectationMismatches.length ? (
              pathway.expectationMismatches.slice(0, 3).map((mismatch) => <li key={mismatch}>{mismatch}</li>)
            ) : (
              <li>No major mismatch detected from current assumptions.</li>
            )}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={onShowDetails}
        className="mt-6 rounded-full border border-trust/15 bg-white/75 px-5 py-3 text-sm font-bold text-trust hover:border-jade/60 hover:text-jade"
      >
        Show details
      </button>

      {detailsVisible ? <div className="mt-6">{children}</div> : null}
    </article>
  );
}
