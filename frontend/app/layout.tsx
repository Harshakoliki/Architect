import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Architect — Understand the product behind your code",
  description: "Product knowledge is scattered across code and people. Architect makes supported connections visual, so you can follow a feature, inspect its source, and explain it together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
