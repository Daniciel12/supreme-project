import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Treinos",
  description: "Planeje sessões e acompanhe sua evolução física.",
};

export default function TreinosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
