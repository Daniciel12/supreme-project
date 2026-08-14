import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conta",
  description: "Perfil, identidade e métodos de acesso da sua conta Supreme.",
};

export default function ConfiguracoesLayout({
  children,
}: LayoutProps<"/configuracoes">) {
  return children;
}
