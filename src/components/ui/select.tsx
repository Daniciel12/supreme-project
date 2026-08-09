import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ className = "", hasError = false, ...props }: SelectProps) {
  const classes = ["ui-select", hasError ? "ui-select--error" : "", className]
    .filter(Boolean)
    .join(" ");

  return <select className={classes} aria-invalid={hasError || undefined} {...props} />;
}
