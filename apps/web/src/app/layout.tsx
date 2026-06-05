import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/shared/providers/theme-provider';
import { QueryProvider } from '@/shared/providers/query-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'SellerBase', template: '%s · SellerBase' },
  description: 'Аналитика и управление продажами на маркетплейсах',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/branding/favicon.ico', sizes: 'any' },
      { url: '/branding/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/branding/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/branding/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0F17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
