import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={["ui-page-header", className].filter(Boolean).join(" ")}>
      <div>
        {eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="ui-page-header__title">{title}</h1>
        {description && <p className="ui-page-header__description">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}
