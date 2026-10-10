import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Architect — See your codebase clearly",
  description: "An evidence-first visual workspace for understanding software.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
