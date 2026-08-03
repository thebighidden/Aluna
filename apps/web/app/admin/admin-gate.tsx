'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { currentUser } from '../lib/auth-client';

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    currentUser()
      .then((user) => {
        if (!active) return;
        if (user.role === 'SUPER_ADMIN') setAuthorized(true);
        else router.replace('/studio');
      })
      .catch(() => router.replace('/admin/login'));
    return () => {
      active = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <main className="studio-loading">
        <span className="studio-wordmark">Aluna°</span>
        <LoaderCircle aria-hidden="true" />
        <p>Checking dashboard access</p>
      </main>
    );
  }

  return children;
}
