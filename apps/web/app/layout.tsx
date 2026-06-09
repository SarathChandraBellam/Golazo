import type { Metadata } from "next";
import { Saira, Saira_Condensed, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const saira = Saira({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const sairaCondensed = Saira_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Golazo — World Cup stats agent",
  description:
    "Ask anything about FIFA World Cup history. Stats, players, simulations — answered from real data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${sairaCondensed.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
