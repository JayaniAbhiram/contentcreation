'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import SettingsForm from '@/components/SettingsForm';
import Link from 'next/link';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        router.push('/login');
      }
    };
    getUser();
  }, [router]);

  if (!user) return null;

  return (
    <div className="container" style={{ padding: '0 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <nav className="nav" style={{ height: 'auto', padding: '1.5rem 0' }}>
        <div className="stack-mobile" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>← Dashboard</Link>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>Settings</h2>
          </div>
          <UserMenu user={user} />
        </div>
      </nav>

      <main style={{ padding: '2rem 0' }}>
        <header style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', marginBottom: '0.5rem' }}>Your Configuration</h1>
          <p style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>Manage your video preferences and third-party integrations.</p>
        </header>

        <div className="premium-card">
          <SettingsForm userId={user.id} />
        </div>
      </main>
    </div>
  );
}
