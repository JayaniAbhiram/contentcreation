'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import Link from 'next/link';

export default function HistoryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setJobs(data);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading || !user) return <div className="container"><p>Loading history...</p></div>;

  return (
    <div className="container">
      <nav className="nav">
        <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Job History</h2>
        <UserMenu user={user} />
      </nav>

      <main style={{ padding: '2rem 0' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>All Jobs</h1>
          <p style={{ color: 'var(--secondary)' }}>View and track the status of all your video generation requests.</p>
        </div>

        <div className="premium-card">
          {jobs.length === 0 ? (
            <p style={{ color: 'var(--secondary)', textAlign: 'center', padding: '2rem' }}>
              You haven't created any jobs yet. <Link href="/dashboard" style={{ color: 'var(--primary)' }}>Start one here!</Link>
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '1rem' }}>Article URL</th>
                    <th style={{ padding: '1rem' }}>Duration</th>
                    <th style={{ padding: '1rem' }}>Pipeline Stage</th>
                    <th style={{ padding: '1rem' }}>YouTube</th>
                    <th style={{ padding: '1rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <Link href={`/dashboard/job/${job.id}`} style={{ fontWeight: '500', color: 'var(--primary)' }}>
                          {job.url}
                        </Link>
                      </td>
                      <td style={{ padding: '1.25rem 1rem', fontSize: '0.9rem', color: 'var(--secondary)' }}>
                        {job.metadata?.config?.duration_seconds 
                          ? (job.metadata.config.duration_seconds >= 60 
                            ? `${job.metadata.config.duration_seconds / 60}m` 
                            : `${job.metadata.config.duration_seconds}s`) 
                          : '-'}
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        <span style={{ 
                          padding: '0.4rem 0.8rem', 
                          borderRadius: '8px', 
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: job.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 
                                      job.status === 'failed' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                          color: job.status === 'completed' ? '#16a34a' : 
                                 job.status === 'failed' ? '#e11d48' : '#4f46e5'
                        }}>
                          {job.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 1rem' }}>
                        {job.metadata?.youtube ? (
                          <a 
                            href={job.metadata.youtube.url} 
                            target="_blank" 
                            style={{ color: '#FF0000', fontSize: '0.8rem', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            Live
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: '1.25rem 1rem', fontSize: '0.85rem', color: 'var(--secondary)' }}>
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
