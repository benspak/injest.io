import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Injest.io - A personal search engine for your files',
  description: 'Capture, search, and organize your knowledge with AI-powered search',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} overflow-x-hidden`} suppressHydrationWarning>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-F6DZ44M10R"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-F6DZ44M10R');
          `}
        </Script>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
