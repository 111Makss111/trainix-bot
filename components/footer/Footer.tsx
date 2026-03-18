import { HeaderLogo } from "@/components/header/HeaderLogo";

const footerActions = ["Orbit", "Signals", "Nebula"];

export function Footer() {
  return (
    <footer className="relative z-10 px-5 pb-5 pt-4 sm:px-7 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-5 py-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <HeaderLogo />

        <div className="flex flex-wrap gap-3">
          {footerActions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/70 transition hover:bg-white/10 hover:text-white/92"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
