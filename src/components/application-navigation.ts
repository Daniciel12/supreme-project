export const applicationNavigation = [
  { href: "/", label: "Início", shortLabel: "IN" },
  { href: "/habitos", label: "Hábitos", shortLabel: "HA" },
  { href: "/financas", label: "Finanças", shortLabel: "FI" },
  { href: "/metas", label: "Metas", shortLabel: "ME" },
  { href: "/livros", label: "Livros", shortLabel: "LI" },
  { href: "/treinos", label: "Treinos", shortLabel: "TR" },
  { href: "/visao", label: "Visão", shortLabel: "VI" },
] as const;

export function isActivePath(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
