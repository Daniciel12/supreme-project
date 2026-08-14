import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visão",
  description: "Reúna referências visuais para o futuro que você quer construir.",
};

export default function VisaoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
