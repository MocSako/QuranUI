import type { Metadata, Viewport } from "next";
import { Amiri_Quran, Gentium_Book_Plus, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-ui" });
const amiriQuran = Amiri_Quran({ subsets: ["arabic"], weight: "400", variable: "--font-mushaf" });
const gentium = Gentium_Book_Plus({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-latin" });

export const metadata: Metadata = {
  title: "Rehal",
  description: "A Quran that rests on a wooden rehal and turns like paper.",
};

export const viewport: Viewport = {
  themeColor: "#0e0d0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${amiriQuran.variable} ${gentium.variable}`}>
      <body>{children}</body>
    </html>
  );
}
