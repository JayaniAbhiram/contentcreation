'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AuthTestPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <p>Checking session...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '4rem 0' }}>
      <nav className="nav">
        <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Auth Test</h2>
        <Link href="/">← Back Home</Link>
      </nav>

      <div className="premium-card">
        <h3>Current Session State</h3>
        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
          {session ? (
            <pre style={{ overflow: 'auto' }}>{JSON.stringify(session.user, null, 2)}</pre>
          ) : (
            <p style={{ color: 'var(--accent)' }}>No active session found. Please log in (UI coming soon).</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <p style={{ color: 'var(--secondary)' }}>
          Tip: You can manually create a user in the Supabase Dashboard > Authentication > Users to test this.
        </p>
      </div>
    </div>
  );
}
