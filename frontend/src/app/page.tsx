'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import UserMenu from '@/components/UserMenu';

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  return (
    <div className="container">
      <nav className="nav">
        <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Articlo.</h2>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/signup" className="btn btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      <main style={{ padding: '4rem 0' }}>
        <header style={{ textAlign: 'center', marginBottom: '6rem' }}>
          <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', lineHeight: '1.1' }}>
            Turn Any Article Into a <span style={{ color: 'var(--primary)' }}>Viral Video</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--secondary)', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            The all-in-one platform to transform text content into engaging video formats for social media.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href={user ? "/dashboard" : "/signup"} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
              Create Your First Video
            </Link>
            <Link href="#features" className="btn" style={{ border: '1px solid var(--border)' }}>
              How it works
            </Link>
          </div>
        </header>

        <section id="features">
          <h3 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '3rem' }}>Future Features</h3>
          <div className="grid">
            <div className="premium-card">
              <h4>URL to Script</h4>
              <p style={{ color: 'var(--secondary)', marginTop: '0.5rem' }}>
                Automatically extract key points and generate a high-retention video script.
              </p>
              <Link href="/features/script" style={{ display: 'block', marginTop: '1rem', fontSize: '0.9rem' }}>Learn more →</Link>
            </div>
            <div className="premium-card">
              <h4>AI Voiceover</h4>
              <p style={{ color: 'var(--secondary)', marginTop: '0.5rem' }}>
                Choose from hundreds of natural-sounding AI voices in multiple languages.
              </p>
              <Link href="/features/voice" style={{ display: 'block', marginTop: '1rem', fontSize: '0.9rem' }}>Learn more →</Link>
            </div>
            <div className="premium-card">
              <h4>Auto-Visuals</h4>
              <p style={{ color: 'var(--secondary)', marginTop: '0.5rem' }}>
                Match your script with relevant stock footage and dynamic transitions.
              </p>
              <Link href="/features/visuals" style={{ display: 'block', marginTop: '1rem', fontSize: '0.9rem' }}>Learn more →</Link>
            </div>
          </div>
        </section>

        <footer style={{ marginTop: '8rem', padding: '4rem 0', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--secondary)' }}>
            &copy; 2026 Articlo. Built with Next.js, FastAPI, and Supabase.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <a href="/api/health" target="_blank" style={{ fontSize: '0.8rem' }}>Backend Health</a>
            <Link href="/health" style={{ fontSize: '0.8rem' }}>Frontend Health</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
