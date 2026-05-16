'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import JobInput from '@/components/JobInput';
import JobList from '@/components/JobList';
import UserMenu from '@/components/UserMenu';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
    <div className="container">
      <nav className="nav" style={{ height: 'auto', padding: '1.5rem 0' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>Articlo Dashboard</h2>
        <UserMenu user={user} />
      </nav>

      <main style={{ padding: '2rem 0' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', marginBottom: '0.5rem' }}>Welcome back, {user.email?.split('@')[0]}!</h1>
          <p style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>Ready to transform your next article into a video?</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <JobInput userId={user.id} onJobCreated={() => setRefreshKey(prev => prev + 1)} />
          
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '2rem', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 1' }}>
              <JobList userId={user.id} refreshKey={refreshKey} />
            </div>

            <div className="premium-card">
              <h4>Quick Settings</h4>
              <p style={{ color: 'var(--secondary)', margin: '1rem 0', fontSize: '0.85rem' }}>
                Manage your Telegram bot and video preferences.
              </p>
              <Link href="/dashboard/settings" className="btn" style={{ width: '100%', border: '1px solid var(--border)', display: 'inline-flex', justifyContent: 'center' }}>
                Go to Settings
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
