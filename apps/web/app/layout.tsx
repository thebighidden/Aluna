import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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
