import type { ReactNode } from "react";

type FieldShellProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function FieldShell({ label, hint, children }: FieldShellProps) {
  return (
    <div className="block">
      <span className="text-sm font-medium text-white/78">{label}</span>
      {children}
      {hint ? <span className="mt-2 block text-xs text-white/40">{hint}</span> : null}
    </div>
  );
}
