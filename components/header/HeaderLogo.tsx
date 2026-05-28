export function HeaderLogo() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-white/6 shadow-[0_0_24px_rgba(117,143,255,0.12)] backdrop-blur-md">
        <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.85)]" />
      </span>

      <div className="flex flex-col">
        <span className="text-[0.68rem] uppercase tracking-[0.42em] text-white/50">
          Private Finance
        </span>
        <span className="text-lg font-medium tracking-[0.28em] text-white/92">
          TRAINIX
        </span>
      </div>
    </div>
  );
}
