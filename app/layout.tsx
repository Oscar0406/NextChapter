import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "NextChapter | Malaysia Agentic Pathway Planner",
  description:
    "Plan your next chapter with Malaysia-relevant agentic AI pathways and transparent MYR calculations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
