import type { Metadata } from "next";
import {
  Bebas_Neue,
  Inter,
  Lora,
  Playfair_Display,
  Poppins,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-poppins",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: "Carousel Generator — AI Instagram Carousels",
  description:
    "Turn any topic into a polished Instagram carousel: AI-written slides, customizable themes, inline editing, and full-resolution PNG export.",
  openGraph: {
    title: "Carousel Generator",
    description:
      "AI-written Instagram carousels with customizable themes, inline editing, and full-resolution PNG export.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${playfair.variable} ${lora.variable} ${spaceGrotesk.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
