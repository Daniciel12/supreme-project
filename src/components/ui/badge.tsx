import type { HTMLAttributes, ReactNode } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  children: ReactNode;
}

export function Badge({
  tone = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const classes = ["ui-badge", `ui-badge--${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
