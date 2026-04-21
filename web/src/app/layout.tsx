import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "StochastoGreen — Climate Portfolio Risk",
  description: "Portfolio climate risk platform for stochastic simulation, scenario stress, and structured decision support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <AppProviders>
          <div className="ambient">
            <div className="glow-tr" />
            <div className="glow-bl" />
          </div>
          <div className="grid-bg" />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
