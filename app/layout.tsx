import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// PLACEHOLDER TYPEFACE. The Figma PDFs export their text as Type3 outlines with
// no font metadata, so the real family could not be recovered from /public/figma.
// Swap the import here and both --font-sb-heading / --font-sb-body follow.
const heading = Inter({
  variable: "--font-sb-heading",
  subsets: ["latin"],
  display: "swap",
});

const body = Inter({
  variable: "--font-sb-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Studio Bizar",
    template: "%s · Studio Bizar",
  },
  description: "Designed for life, inspired by the world.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-surface="light"
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
