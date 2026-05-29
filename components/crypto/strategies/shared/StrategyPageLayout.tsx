import { CabinetTopbar } from "@/components/cabinet";

type StrategyMetric = {
  label: string;
  value: string;
  detail: string;
};

type StrategyBlock = {
  eyebrow: string;
  title: string;
  items: string[];
};

type StrategyPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  focus: string;
  metrics: StrategyMetric[];
  blocks: StrategyBlock[];
};

export function StrategyPageLayout({
  eyebrow,
  title,
  description,
  status,
  focus,
  metrics,
  blocks,
}: StrategyPageLayoutProps) {
  return (
    <>
      <CabinetTopbar eyebrow={eyebrow} title={title} description={description} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 backdrop-blur-md">
          <p className="text-[0.72rem] uppercase tracking-[0.3em] text-white/38">
            Strategy Status
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1.5 text-sm text-emerald-100">
              {status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/64">
              Shadow mode first
            </span>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/62">
            {focus}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-5"
            >
              <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/36">
                {metric.label}
              </p>
              <p className="mt-3 text-xl font-medium text-white">
                {metric.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/48">
                {metric.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {blocks.map((block) => (
          <section
            key={block.title}
            className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 backdrop-blur-md"
          >
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-white/36">
              {block.eyebrow}
            </p>
            <h2 className="mt-3 text-xl font-medium text-white">
              {block.title}
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-white/58">
              {block.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/44" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
