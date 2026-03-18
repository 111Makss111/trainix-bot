type CabinetCardProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function CabinetCard({
  eyebrow,
  title,
  description,
}: CabinetCardProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-6 backdrop-blur-md">
      <p className="text-sm uppercase tracking-[0.28em] text-white/38">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-medium text-white">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
        {description}
      </p>
    </section>
  );
}
