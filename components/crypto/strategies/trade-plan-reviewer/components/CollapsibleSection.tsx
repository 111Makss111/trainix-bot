"use client";

import { useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  badge?: string;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-md">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="font-medium text-white">{title}</span>
        <span className="flex items-center gap-3 text-sm text-white/48">
          {badge ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              {badge}
            </span>
          ) : null}
          <span className="text-lg leading-none">{isOpen ? "-" : "+"}</span>
        </span>
      </button>

      {isOpen ? <div className="border-t border-white/10 p-5">{children}</div> : null}
    </section>
  );
}
