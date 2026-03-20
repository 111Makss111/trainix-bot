type CabinetTopbarProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function CabinetTopbar({
  eyebrow,
  title,
  description,
}: CabinetTopbarProps) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-md">
      <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/42">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-medium text-white">{title}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">
        {description}
      </p>
    </div>
  );
}
//
