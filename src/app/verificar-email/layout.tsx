import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verificar e-mail",
  description: "Confirme o e-mail associado à sua conta Supreme.",
};

export default function EmailVerificationLayout({
  children,
}: LayoutProps<"/verificar-email">) {
  return children;
}
