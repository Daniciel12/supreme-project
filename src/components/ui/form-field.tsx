import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  const messageId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={["ui-form-field", className].filter(Boolean).join(" ")}>
      <label className="ui-form-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p id={messageId} className="ui-form-field__error">{error}</p>
      ) : hint ? (
        <p id={messageId} className="ui-form-field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
