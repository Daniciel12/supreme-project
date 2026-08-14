import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Metas",
  description: "Transforme objetivos em próximos passos acompanháveis.",
};

export default function MetasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
