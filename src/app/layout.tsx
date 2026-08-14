import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ApplicationShell } from "@/components/application-shell";
import "./globals.css";
import "./design-tokens-v2.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Dashboard | Supreme",
    template: "%s | Supreme",
  },
  description: "Seu sistema pessoal de evolução, organização e finanças.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ApplicationShell>{children}</ApplicationShell>
      </body>
    </html>
  );
}
