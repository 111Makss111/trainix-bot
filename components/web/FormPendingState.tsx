"use client";

import { useFormStatus } from "react-dom";

type FormPendingStateProps = {
  label: string;
};

export function FormPendingState({ label }: FormPendingStateProps) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-white/50">
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.9)]" />
      <span>{label}</span>
    </div>
  );
}
