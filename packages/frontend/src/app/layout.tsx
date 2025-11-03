import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brain - AI Data Platform',
  description: 'Connect, analyze, and visualize your business data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
