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
        {/* Inter font — loaded from Google Fonts CDN at runtime */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
