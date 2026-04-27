import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "問い合わせ対応自動化システム",
  description:
    "アクリル製品製造会社向けの問い合わせメール対応自動化システム（デモ）。AIが返信草案を生成し、担当者が編集してワンクリックで送信できる。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-stone-900">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
