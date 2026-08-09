import type { ReactNode } from "react";

interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className = "" }: StateProps) {
  return (
    <div className={["ui-state", "ui-state--empty", className].filter(Boolean).join(" ")}>
      <div className="ui-state__icon" aria-hidden="true">○</div>
      <p className="ui-state__title">{title}</p>
      {description && <p className="ui-state__description">{description}</p>}
      {action && <div className="ui-state__action">{action}</div>}
    </div>
  );
}

export function LoadingState({
  title = "Carregando...",
  description,
  className = "",
}: Partial<StateProps>) {
  return (
    <div
      className={["ui-state", "ui-state--loading", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <span className="ui-state__spinner" aria-hidden="true" />
      <div>
        <p className="ui-state__title">{title}</p>
        {description && <p className="ui-state__description">{description}</p>}
      </div>
    </div>
  );
}

export function ErrorState({ title, description, action, className = "" }: StateProps) {
  return (
    <div
      className={["ui-state", "ui-state--error", className].filter(Boolean).join(" ")}
      role="alert"
    >
      <div className="ui-state__icon" aria-hidden="true">!</div>
      <div>
        <p className="ui-state__title">{title}</p>
        {description && <p className="ui-state__description">{description}</p>}
        {action && <div className="ui-state__action">{action}</div>}
      </div>
    </div>
  );
}
