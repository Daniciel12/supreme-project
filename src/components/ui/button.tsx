import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md";
  isLoading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingLabel = "Aguarde...",
  className = "",
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? loadingLabel : children}
    </button>
  );
}
