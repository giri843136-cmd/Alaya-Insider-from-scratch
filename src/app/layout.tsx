import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import CookieConsent from '@/components/public/CookieConsent';
import { getOneLinkSrcs } from '@/lib/onelink-server';

const GA_ID = process.env.NEXT_PUBLIC_ANALYTICS_ID;

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
  // Amazon OneLink — rewrites Amazon product anchors for visitors in the 9
  // secondary markets to their local store (with the -20 tag). Read per
  // request (not module scope) so an admin save applies immediately.
  const ONELINK_SRCS = getOneLinkSrcs();
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        {/* Inter font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        {/* Google Analytics — only loads when NEXT_PUBLIC_ANALYTICS_ID is set */}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:true});`}
            </Script>
          </>
        )}
        {/* Amazon OneLink — validated external script(s) injected once */}
        {ONELINK_SRCS.map(src => (
          <Script key={src} src={src} strategy="afterInteractive" />
        ))}
        <CookieConsent />
      </body>
    </html>
  );
}
