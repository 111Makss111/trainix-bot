type WebStatusCardProps = {
  eyebrow: string;
  title: string;
  status: string;
  statusTone?: "neutral" | "active";
  items: Array<{
    label: string;
    value: string;
  }>;
  note: string;
};

export function WebStatusCard({
  eyebrow,
  title,
  status,
  statusTone = "neutral",
  items,
  note,
}: WebStatusCardProps) {
  const badgeClass =
    statusTone === "active"
      ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-100"
      : "border-white/10 bg-white/[0.04] text-white/60";

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            {eyebrow}
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">{title}</h3>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${badgeClass}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-white/8 bg-[#091122]/72 px-4 py-3"
          >
            <span className="text-sm text-white/46">{item.label}</span>
            <span className="text-sm font-medium text-white/84">{item.value}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm leading-7 text-white/56">{note}</p>
    </section>
  );
}
