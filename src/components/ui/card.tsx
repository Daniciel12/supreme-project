import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "article" | "div";
  elevated?: boolean;
  children: ReactNode;
}

export function Card({
  as: Component = "section",
  elevated = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const classes = ["ui-card", elevated ? "ui-card--elevated" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
