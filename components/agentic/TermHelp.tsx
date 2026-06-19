export function TermHelp({ label, description }: { label: string; description: string }) {
  return (
    <span
      aria-label={`${label}: ${description}`}
      className="group relative ml-1 inline-flex align-middle"
      role="img"
      tabIndex={0}
    >
      <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] font-black leading-none opacity-70">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-trust/10 bg-white px-3 py-2 text-xs font-medium normal-case leading-5 tracking-normal text-slate-700 opacity-0 shadow-xl shadow-trust/10 transition group-focus:opacity-100 group-hover:opacity-100">
        {description}
      </span>
    </span>
  );
}
