"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className: string;
} & Omit<ComponentProps<"button">, "type" | "children" | "className">;

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      {...props}
      className={[
        className,
        isDisabled ? "cursor-wait opacity-70" : "",
      ].join(" ")}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
