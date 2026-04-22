"use client";

import Image from "next/image";
import type { PlanAttachment } from "@/lib/plans";

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(attachment: PlanAttachment) {
  return attachment.mimeType.startsWith("image/");
}

type PlanAttachmentsPanelProps = {
  planId: string;
  attachments: PlanAttachment[];
  editable?: boolean;
  isBusy?: boolean;
  onUpload?: (planId: string, file: File) => Promise<void>;
  onDelete?: (planId: string, attachmentId: string) => Promise<void>;
};

export function PlanAttachmentsPanel({
  planId,
  attachments,
  editable = false,
  isBusy = false,
  onUpload,
  onDelete,
}: PlanAttachmentsPanelProps) {
  return (
    <div className="space-y-3 rounded-[1.2rem] border border-white/8 bg-[#07101f]/72 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/34">
            Вкладення
          </p>
          <p className="mt-1 text-sm text-white/46">
            Картинки, файли та короткий preview того, що ти додав до нотатки.
          </p>
        </div>

        {editable && onUpload ? (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white/86 transition hover:bg-white/12">
            <span>{isBusy ? "Завантажую..." : "Додати файл"}</span>
            <input
              type="file"
              disabled={isBusy}
              className="hidden"
              accept="image/*,.txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.scss,.html,.svg,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                void onUpload(planId, file).finally(() => {
                  event.currentTarget.value = "";
                });
              }}
            />
          </label>
        ) : null}
      </div>

      {attachments.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {attachments.map((attachment) => (
            <article
              key={attachment.id}
              className="overflow-hidden rounded-[1.2rem] border border-white/8 bg-black/10"
            >
              {isImageAttachment(attachment) ? (
                <a
                  href={`/api/cabinet/notes/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <Image
                    src={`/api/cabinet/notes/attachments/${attachment.id}`}
                    alt={attachment.fileName}
                    width={960}
                    height={520}
                    className="h-52 w-full object-cover"
                  />
                </a>
              ) : null}

              <div className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white/88">
                      {attachment.fileName}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/34">
                      {attachment.mimeType || "application/octet-stream"} ·{" "}
                      {formatFileSize(attachment.sizeBytes)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/api/cabinet/notes/attachments/${attachment.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/58 transition hover:border-white/16 hover:text-white/88"
                    >
                      Відкрити
                    </a>

                    {editable && onDelete ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          void onDelete(planId, attachment.id);
                        }}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/52 transition hover:border-red-300/24 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Видалити
                      </button>
                    ) : null}
                  </div>
                </div>

                {attachment.textPreview ? (
                  <pre className="max-h-56 overflow-auto rounded-[1rem] border border-white/8 bg-[#091327] px-4 py-3 text-xs leading-6 text-white/64">
                    {attachment.textPreview}
                  </pre>
                ) : !isImageAttachment(attachment) ? (
                  <div className="rounded-[1rem] border border-white/8 bg-[#091327] px-4 py-3 text-sm leading-6 text-white/40">
                    Для цього типу файлу показуємо коротку картку і даємо відкрити оригінал окремо.
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[1.1rem] border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm leading-7 text-white/36">
          Тут поки немає вкладень. Можеш додати картинку, текстовий файл або невеликий документ до цієї нотатки.
        </div>
      )}
    </div>
  );
}
