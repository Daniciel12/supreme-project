import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hábitos",
  description: "Acompanhe seus hábitos e o ritmo dos últimos dias.",
};

export default function HabitosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
