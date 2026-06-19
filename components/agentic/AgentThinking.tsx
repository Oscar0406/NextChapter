export function AgentThinking({ label: _label = "Agent thinking" }: { label?: string }) {
  return (
    <section className="flex min-h-40 items-center justify-center px-5 py-8">
      <div className="glass-panel inline-flex items-center gap-3 rounded-2xl px-5 py-4 shadow-lg">
        <span className="size-2 animate-pulse rounded-full bg-jade" />
        <p className="text-sm font-bold text-trust">Agent thinking</p>
      </div>
    </section>
  );
}
