export function Hero() {
  return (
    <section className="relative z-10 flex flex-1 items-center px-5 pb-10 pt-6 sm:px-7 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[0.7rem] uppercase tracking-[0.35em] text-white/62 backdrop-blur-md">
            Private Crypto Cabinet
          </span>

          <h1 className="mt-6 max-w-xl text-4xl font-medium leading-[1.02] text-white sm:text-5xl lg:text-7xl">
            Trainix Crypto
            <span className="block text-white/70">починається з чистого ядра.</span>
          </h1>

          <p className="mt-6 max-w-xl text-sm leading-7 text-white/62 sm:text-base">
            Приватний кабінет для майбутнього портфеля, інвестиційних рішень,
            watchlist і фінансової безпеки без старих модулів та зайвих
            залежностей.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-white/46">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Portfolio
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Watchlist
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Security
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
