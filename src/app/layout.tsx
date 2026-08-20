import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alaya Insider — Better Products. Better Choices.",
  description: "Curated products, honest comparisons, and practical recommendations to help you buy with confidence.",
  openGraph: {
    title: "Alaya Insider",
    description: "Curated products, honest comparisons, and practical recommendations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
