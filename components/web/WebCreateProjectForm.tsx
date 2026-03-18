import { createWebProjectAction } from "@/app/cabinet/web/actions";

export function WebCreateProjectForm() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
        Create
      </p>
      <h2 className="mt-3 text-2xl font-medium text-white">
        Додати новий проєкт
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-white/56">
        Для кожного сайту або додатку буде окремий Telegram-бот, окремі
        AI-налаштування і власний сценарій постів.
      </p>

      <form action={createWebProjectAction} className="mt-5 grid gap-3">
        <input
          name="name"
          type="text"
          placeholder="Назва проєкту"
          className="rounded-[1.3rem] border border-white/10 bg-[#091122] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
        />
        <textarea
          name="description"
          rows={3}
          placeholder="Коротко: про що цей сайт, яка тематика і стиль..."
          className="resize-none rounded-[1.3rem] border border-white/10 bg-[#091122] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/26 focus:border-white/18"
        />
        <button
          type="submit"
          className="w-fit rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/12"
        >
          Створити проєкт
        </button>
      </form>
    </section>
  );
}
