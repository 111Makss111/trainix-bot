import type { TelegramMessageLog } from "@/lib/web-projects";

type WebTelegramMessagesProps = {
  messages: TelegramMessageLog[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WebTelegramMessages({ messages }: WebTelegramMessagesProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.32em] text-white/40">
            Inbox
          </p>
          <h3 className="mt-3 text-2xl font-medium text-white">
            Останні вхідні повідомлення
          </h3>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/46">
          {messages.length} recent
        </span>
      </div>

      {messages.length ? (
        <div className="mt-5 grid gap-3">
          {messages.map((message) => (
            <article
              key={message.id}
              className="rounded-[1.5rem] border border-white/8 bg-[#091122]/72 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/88">
                    {message.senderName || "Unknown sender"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/32">
                    {message.updateType}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/32">
                    {formatDate(message.receivedAt)}
                  </p>
                  <p className="mt-1 text-xs text-white/42">
                    chat {message.telegramChatId || "unknown"}
                  </p>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/72">
                {message.text || "Повідомлення без тексту"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-[#091122]/58 px-5 py-8 text-sm leading-7 text-white/40">
          Ще немає жодного вхідного повідомлення. Після активації webhook тут
          з’явиться журнал апдейтів із Telegram.
        </div>
      )}
    </section>
  );
}
