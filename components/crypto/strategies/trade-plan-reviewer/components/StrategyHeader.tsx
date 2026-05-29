export function StrategyHeader() {
  return (
    <header className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-md">
      <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/42">
        Strategy 03
      </p>
      <h1 className="mt-3 text-3xl font-medium text-white">
        Trade Plan Reviewer
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">
        Це перша версія моєї стратегії: вона не дає сигнал купити чи продати,
        а перевіряє, чи є в угоди нормальний план, ризик, стоп, ціль і
        зрозуміла причина входу.
      </p>
    </header>
  );
}
