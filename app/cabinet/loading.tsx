function SkeletonBlock({
  className,
}: {
  className: string;
}) {
  return (
    <div
      className={[
        "animate-pulse rounded-[1.4rem] border border-white/8 bg-white/[0.04]",
        className,
      ].join(" ")}
    />
  );
}

export default function CabinetLoading() {
  return (
    <div className="grid gap-4">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-md">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="mt-4 h-10 w-80 max-w-full" />
        <SkeletonBlock className="mt-5 h-4 w-full max-w-3xl" />
        <SkeletonBlock className="mt-3 h-4 w-[82%] max-w-2xl" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="mt-4 h-9 w-56 max-w-full" />
          <SkeletonBlock className="mt-5 h-4 w-full" />
          <SkeletonBlock className="mt-3 h-4 w-[88%]" />
          <SkeletonBlock className="mt-6 h-28 w-full" />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-4 h-9 w-48 max-w-full" />
          <SkeletonBlock className="mt-6 h-12 w-full" />
          <SkeletonBlock className="mt-3 h-12 w-full" />
          <SkeletonBlock className="mt-5 h-11 w-36" />
        </section>
      </div>
    </div>
  );
}
