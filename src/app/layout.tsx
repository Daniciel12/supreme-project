import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "New Diana",
  description: "Painel pessoal de hábitos, check-ins e treinos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <nav className="navbar">
          <div className="navbar-inner">
            <span className="nav-brand">
              New <span>Diana</span>
            </span>
            <div className="nav-links">
              <Link href="/" className="nav-link">
                Painel
              </Link>
              <Link href="/treinos" className="nav-link">
                Treinos
              </Link>
              <Link href="/financas" className="nav-link">
                Finanças
              </Link>
              <Link href="/metas" className="nav-link">
                Ordem no Caos
              </Link>
              <Link href="/visao" className="nav-link">
                Visão
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
