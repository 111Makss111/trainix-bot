"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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

function getAttachmentUrl(attachmentId: string) {
  return `/api/cabinet/notes/attachments/${attachmentId}`;
}

function getFileExtension(fileName: string) {
  const match = fileName.match(/\.([^.]+)$/);

  return match?.[1]?.toUpperCase() ?? "FILE";
}

function isImageAttachment(attachment: PlanAttachment) {
  return attachment.mimeType.startsWith("image/");
}

function isPdfAttachment(attachment: PlanAttachment) {
  return attachment.mimeType === "application/pdf";
}

function isTextLikeAttachment(attachment: PlanAttachment) {
  return Boolean(attachment.textPreview);
}

function getAttachmentKindLabel(attachment: PlanAttachment) {
  if (isImageAttachment(attachment)) {
    return "Зображення";
  }

  if (isPdfAttachment(attachment)) {
    return "PDF документ";
  }

  if (isTextLikeAttachment(attachment)) {
    return "Текстовий preview";
  }

  return "Файл";
}

function getPreviewSnippet(textPreview: string | null) {
  if (!textPreview) {
    return [];
  }

  return textPreview
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 6);
}

type PlanAttachmentsPanelProps = {
  planId: string;
  attachments: PlanAttachment[];
  editable?: boolean;
  isBusy?: boolean;
  onUpload?: (planId: string, file: File) => Promise<void>;
  onDelete?: (planId: string, attachmentId: string) => Promise<void>;
};

type AttachmentPreviewCardProps = {
  attachment: PlanAttachment;
  editable: boolean;
  isBusy: boolean;
  onDelete?: (planId: string, attachmentId: string) => Promise<void>;
  onPreviewImage: (attachment: PlanAttachment) => void;
  planId: string;
};

function AttachmentPreviewCard({
  attachment,
  editable,
  isBusy,
  onDelete,
  onPreviewImage,
  planId,
}: AttachmentPreviewCardProps) {
  const attachmentUrl = getAttachmentUrl(attachment.id);
  const previewLines = useMemo(
    () => getPreviewSnippet(attachment.textPreview),
    [attachment.textPreview],
  );

  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(9,19,39,0.96),rgba(6,12,24,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all text-sm font-medium text-white/88">
              {attachment.fileName}
            </p>
            <p className="mt-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/34">
              {getAttachmentKindLabel(attachment)} ·{" "}
              {attachment.mimeType || "application/octet-stream"} ·{" "}
              {formatFileSize(attachment.sizeBytes)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={attachmentUrl}
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
      </div>

      <div className="space-y-4 p-4">
        {isImageAttachment(attachment) ? (
          <button
            type="button"
            onClick={() => {
              onPreviewImage(attachment);
            }}
            className="group block w-full text-left"
          >
            <div className="relative flex h-[18rem] w-full items-center justify-center overflow-hidden rounded-[1.15rem] border border-white/8 bg-[#0b1325]">
              <Image
                src={attachmentUrl}
                alt={attachment.fileName}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-contain p-3 transition duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,16,31,0.04),rgba(7,16,31,0.56))] opacity-0 transition group-hover:opacity-100" />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/14 bg-black/35 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.2em] text-white/82 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                Розгорнути
              </div>
            </div>
          </button>
        ) : isPdfAttachment(attachment) ? (
          <div className="overflow-hidden rounded-[1.15rem] border border-white/8 bg-[#0b1325]">
            <iframe
              src={`${attachmentUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title={attachment.fileName}
              className="h-[18rem] w-full border-0"
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.15rem] border border-white/8 bg-[#0b1325]">
            <div className="flex items-center gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/[0.04] text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/70">
                {getFileExtension(attachment.fileName)}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white/82">Попередній перегляд</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/34">
                  {getAttachmentKindLabel(attachment)}
                </p>
              </div>
            </div>

            {previewLines.length ? (
              <div className="px-4 py-4">
                <pre className="max-h-[12.5rem] overflow-auto whitespace-pre-wrap break-words rounded-[1rem] border border-white/8 bg-[#091327] px-4 py-3 text-xs leading-6 text-white/64">
                  {previewLines.join("\n")}
                </pre>
              </div>
            ) : (
              <div className="px-4 py-4 text-sm leading-7 text-white/42">
                Для цього типу файлу показуємо коротку картку. Відкрий оригінал, якщо потрібно побачити повний вміст.
              </div>
            )}
          </div>
        )}

        {!isImageAttachment(attachment) && attachment.textPreview ? (
          <div className="rounded-[1rem] border border-dashed border-white/8 bg-black/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/34">
            Preview згенеровано автоматично, щоб ти відразу розумів контекст файлу.
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function PlanAttachmentsPanel({
  planId,
  attachments,
  editable = false,
  isBusy = false,
  onUpload,
  onDelete,
}: PlanAttachmentsPanelProps) {
  const [previewImage, setPreviewImage] = useState<PlanAttachment | null>(null);

  useEffect(() => {
    if (!previewImage) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

  return (
    <>
      <div className="space-y-3 rounded-[1.2rem] border border-white/8 bg-[#07101f]/72 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/34">
              Вкладення
            </p>
            <p className="mt-1 text-sm text-white/46">
              Картинки відкриваються в повний перегляд, а файли дають короткий контекст ще до відкриття.
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
          <div className="space-y-4">
            {attachments.map((attachment) => (
              <AttachmentPreviewCard
                key={attachment.id}
                planId={planId}
                attachment={attachment}
                editable={editable}
                isBusy={isBusy}
                onDelete={onDelete}
                onPreviewImage={setPreviewImage}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.1rem] border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm leading-7 text-white/36">
            Тут поки немає вкладень. Можеш додати картинку, текстовий файл або невеликий документ до цієї нотатки.
          </div>
        )}
      </div>

      {previewImage ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(4,8,18,0.92)] p-6 backdrop-blur-md"
          onClick={() => {
            setPreviewImage(null);
          }}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/82 transition hover:bg-white/12"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewImage(null);
            }}
          >
            Закрити
          </button>

          <div
            className="relative h-[86vh] w-[min(92vw,1500px)]"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Image
              src={getAttachmentUrl(previewImage.id)}
              alt={previewImage.fileName}
              fill
              unoptimized
              sizes="92vw"
              className="object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
