import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google"; // Remove Geist fonts
import { Manrope } from 'next/font/google'; // Import Manrope
import "./globals.css";

// Configure Manrope font
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope', // Define CSS variable
});

export const metadata: Metadata = {
  title: "Lagani - Nepal Finance App", // Updated Title
  description: "Track NEPSE investments, paper trade, view market data, and get news.", // Updated Description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply Manrope font variable to body */}
      <body className={`${manrope.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
