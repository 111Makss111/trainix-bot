export function Hero() {
  return (
    <section className="relative z-10 flex flex-1 items-center px-5 pb-10 pt-6 sm:px-7 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl">
        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[0.7rem] uppercase tracking-[0.35em] text-white/62 backdrop-blur-md">
            Cosmic Silence
          </span>

          <h1 className="mt-6 max-w-xl text-4xl font-medium leading-[1.02] text-white sm:text-5xl lg:text-7xl">
            Тиша між зорями теж
            <span className="block text-white/70">має свій рух.</span>
          </h1>

          <p className="mt-6 max-w-xl text-sm leading-7 text-white/62 sm:text-base">
            Холодне сяйво, далекі орбіти й мить, коли темрява виглядає живою.
            Це простір, у який хочеться зайти ще раз тільки заради атмосфери.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.28em] text-white/46">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Orbit
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Nebula
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Night Pulse
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
