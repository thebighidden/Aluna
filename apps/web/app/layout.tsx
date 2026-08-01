import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@clr/city/css/light.css';
import '@clr/city/css/regular.css';
import '@clr/city/css/medium.css';
import '@clr/city/css/semibold.css';
import '@clr/city/css/bold.css';
import '@clr/city/css/extra-bold.css';
import '@clr/city/css/black.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import '@fontsource/tajawal/900.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'Aluna — AI Fashion & Product Photo Studio',
  description:
    'Turn simple clothing and product photos into campaign-ready imagery while preserving every detail.',
  openGraph: {
    title: 'Aluna — AI Fashion & Product Photo Studio',
    description: 'Turn one garment photo into an on-model campaign with fidelity built in.',
    images: [
      {
        url: '/og-aluna-fashion.png',
        width: 1680,
        height: 945,
        alt: 'Aluna AI fashion photo studio before-and-after transformation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aluna — AI Fashion & Product Photo Studio',
    description: 'Turn one garment photo into an on-model campaign with fidelity built in.',
    images: ['/og-aluna-fashion.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
