import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Livros",
  description: "Acompanhe sua biblioteca e o progresso das leituras.",
};

export default function LivrosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
