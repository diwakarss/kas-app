import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KAS App - Your Business, Your App',
  description: 'Describe your business and get a working app in minutes. AI-powered app generation for solo service providers.',
  keywords: ['app builder', 'business app', 'no-code', 'AI app generator'],
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
