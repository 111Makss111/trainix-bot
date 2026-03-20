"use client";

import { useState } from "react";

type CopyTextButtonProps = {
  text: string;
  idleLabel?: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyTextButton({
  text,
  idleLabel = "Скопіювати",
  copiedLabel = "Скопійовано",
  className = "",
}: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        "rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/68 transition hover:bg-white/[0.08]",
        className,
      ].join(" ")}
    >
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}
