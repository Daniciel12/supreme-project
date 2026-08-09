import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ className = "", hasError = false, ...props }: InputProps) {
  const classes = ["ui-input", hasError ? "ui-input--error" : "", className]
    .filter(Boolean)
    .join(" ");

  return <input className={classes} aria-invalid={hasError || undefined} {...props} />;
}
