import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finanças",
  description: "Organize contas, receitas, despesas e valores pendentes.",
};

export default function FinancasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
