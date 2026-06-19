import type { PathwayFlowchartResult } from "@/lib/agentic/types";
import { TermHelp } from "@/components/agentic/TermHelp";

function formatRM(value: number) {
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}

export function DetailsPanel({ pathway }: { pathway: PathwayFlowchartResult }) {
  const model = pathway.details.financialModel;
  const firstFiveYears = model.yearlyProjection.slice(0, 5);
  const executionSteps = pathway.executionSteps ?? [];

  return (
    <section className="rounded-[28px] border border-trust/10 bg-[#001f3d]/95 p-5 text-white sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">AI reasoning</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
            {pathway.details.reasoning.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <div className="mt-6 rounded-[22px] bg-white/8 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">MYR summary</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-white/45">
                  NPV
                  <TermHelp
                    label="NPV"
                    description="Net present value: the projected 15-year cash value converted into today's RM using a discount rate."
                  />
                </dt>
                <dd className="mt-1 font-semibold">{formatRM(model.npvRM)}</dd>
              </div>
              <div>
                <dt className="text-white/45">
                  Expected NPV
                  <TermHelp
                    label="Expected NPV"
                    description="NPV multiplied by the estimated feasibility score. It is useful for comparing pathways, not guaranteed income."
                  />
                </dt>
                <dd className="mt-1 font-semibold">{formatRM(model.expectedNpvRM)}</dd>
              </div>
              <div>
                <dt className="text-white/45">
                  Education cost
                  <TermHelp
                    label="Education cost"
                    description="Estimated tuition or training cost for the selected route, shown in RM."
                  />
                </dt>
                <dd className="mt-1 font-semibold">{formatRM(model.totalEducationCostRM)}</dd>
              </div>
              <div>
                <dt className="text-white/45">
                  Living cost
                  <TermHelp
                    label="Living cost"
                    description="Estimated monthly living budget for the selected Malaysian city or location."
                  />
                </dt>
                <dd className="mt-1 font-semibold">{formatRM(model.monthlyLivingCostRM)} / month</dd>
              </div>
              <div>
                <dt className="text-white/45">
                  Purchasing power
                  <TermHelp
                    label="Purchasing power"
                    description="Projected monthly salary divided by estimated monthly living cost."
                  />
                </dt>
                <dd className="mt-1 font-semibold">{model.purchasingPowerRatio}x</dd>
              </div>
            </dl>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Prediction graph</p>
          <div className="mt-4 flex h-48 items-end gap-3 rounded-[24px] bg-white/8 p-4">
            {firstFiveYears.map((year) => {
              const height = Math.max(14, Math.min(100, (Math.max(0, year.netCashFlowRM) / 90000) * 100));
              return (
                <div key={year.year} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div
                    className="rounded-t-xl bg-gradient-to-t from-jade to-white/80"
                    style={{ height: `${height}%` }}
                    title={`${formatRM(year.netCashFlowRM)} net cash flow`}
                  />
                  <span className="text-center text-[11px] font-bold text-white/50">Y{year.year}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/10 text-white/55">
                <tr>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3">Salary</th>
                  <th className="px-3 py-3">
                    Net cash
                    <TermHelp
                      label="Net cash"
                      description="Salary minus estimated living cost and education cost for that year."
                    />
                  </th>
                  <th className="px-3 py-3">
                    Cum. NPV
                    <TermHelp
                      label="Cum. NPV"
                      description="Cumulative net present value up to that year."
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {firstFiveYears.map((year) => (
                  <tr key={year.year} className="border-t border-white/10">
                    <td className="px-3 py-3 font-bold">Y{year.year}</td>
                    <td className="px-3 py-3">{formatRM(year.annualSalaryRM)}</td>
                    <td className="px-3 py-3">{formatRM(year.netCashFlowRM)}</td>
                    <td className="px-3 py-3">{formatRM(year.cumulativeNpvRM)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {executionSteps.length ? (
        <div className="mt-6 rounded-[24px] bg-white/8 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Execution guide</p>
          <div className="mt-4 grid gap-3">
            {executionSteps.map((step, index) => (
              <article key={`${step.timeframe}-${step.milestone}`} className="rounded-[20px] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                  Step {index + 1} - {step.timeframe}
                </p>
                <h3 className="mt-2 text-sm font-bold text-white">{step.milestone}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-jade">Actions</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-white/65">
                      {step.specificActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-jade">Proof of progress</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-white/65">
                      {step.proofOfProgress.map((proof) => (
                        <li key={proof}>{proof}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-jade">Risk / sacrifice</p>
                    <p className="mt-2 text-xs leading-5 text-white/65">{step.riskOrSacrifice}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-jade">Calculation traces</p>
        {model.calculationTraces.map((trace) => (
          <details key={trace.id} className="rounded-[20px] bg-white/8 p-4" open={trace.id === "estimated_feasibility"}>
            <summary className="cursor-pointer text-sm font-bold">{trace.label}</summary>
            <p className="mt-3 font-mono text-xs leading-6 text-jade">{trace.formula}</p>
            <ul className="mt-3 space-y-1 text-xs leading-5 text-white/65">
              {trace.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold text-white">{trace.result}</p>
          </details>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] bg-white/8 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Assumptions</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-white/65">
            {pathway.details.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-[20px] bg-white/8 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Data sources</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-white/65">
            {pathway.details.dataSources.map((source) => (
              <li key={source.id}>
                {source.id}: {source.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
