import Link from "next/link";
import type { WebProject } from "@/lib/web-projects";

type WebProjectSwitcherProps = {
  projects: WebProject[];
  activeProjectId?: string;
};

export function WebProjectSwitcher({
  projects,
  activeProjectId,
}: WebProjectSwitcherProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Switcher
          </p>
          <h2 className="mt-3 text-2xl font-medium text-white">
            Твої web-проєкти
          </h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/46">
          {projects.length} total
        </span>
      </div>

      {projects.length ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {projects.map((project) => {
            const active = project.id === activeProjectId;

            return (
              <Link
                key={project.id}
                href={`/cabinet/web?project=${project.id}`}
                className={[
                  "min-w-[13rem] rounded-[1.5rem] border px-4 py-4 transition",
                  active
                    ? "border-white/16 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] text-white shadow-[0_0_28px_rgba(91,119,230,0.16)]"
                    : "border-white/10 bg-[#091122]/72 text-white/66 hover:border-white/14 hover:text-white/92",
                ].join(" ")}
              >
                <p className="text-sm font-medium">{project.name}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-white/38">
                  {project.slug}
                </p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/46">
                  {project.description || "Новий web-проєкт без опису."}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-[#091122]/58 px-5 py-8 text-sm leading-7 text-white/40">
          Ще немає жодного проєкту. Створи перший, і тут з’явиться
          перемикач між сайтами та додатками.
        </div>
      )}
    </section>
  );
}
