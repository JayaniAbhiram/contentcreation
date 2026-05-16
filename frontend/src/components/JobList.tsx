'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function JobList({ userId, refreshKey }: { userId: string, refreshKey: number }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) setJobs(data);
      setLoading(false);
    };

    fetchJobs();

    // Subscribe to changes for real-time updates
    const channel = supabase
      .channel('jobs_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'jobs',
        filter: `user_id=eq.${userId}` 
      }, () => {
        fetchJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshKey]);

  if (loading) return <p>Loading jobs...</p>;

  return (
    <div className="premium-card">
      <h3 style={{ marginBottom: '1.5rem' }}>Recent Jobs</h3>
      
      {jobs.length === 0 ? (
        <p style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>No jobs found. Start by creating one above!</p>
      ) : (
        <div>
          {/* Mobile View: Cards */}
          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '1rem', display: 'flex', flexDirection: 'column' }}>
            <style jsx>{`
              .job-row { display: none; }
              .job-card-mobile { display: block; border: 1px solid var(--border); padding: 1rem; border-radius: 12px; }
              @media (min-width: 641px) {
                .job-row { display: table-row; }
                .job-card-mobile { display: none; }
                .job-table { display: table !important; }
              }
              .job-table { display: none; width: 100%; border-collapse: collapse; }
            `}</style>

            {jobs.map((job) => (
              <div key={job.id} className="job-card-mobile">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <Link href={`/dashboard/job/${job.id}`} style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                    {job.url}
                  </Link>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '6px', 
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    background: job.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 
                                job.status === 'failed' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    color: job.status === 'completed' ? '#16a34a' : 
                           job.status === 'failed' ? '#e11d48' : '#4f46e5'
                  }}>
                    {job.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}

            {/* Desktop View: Table */}
            <table className="job-table">
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 0', fontSize: '0.8rem', color: 'var(--secondary)' }}>ARTICLE URL</th>
                  <th style={{ padding: '0.75rem 0', fontSize: '0.8rem', color: 'var(--secondary)' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 0', fontSize: '0.8rem', color: 'var(--secondary)', textAlign: 'right' }}>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="job-row" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 0', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/dashboard/job/${job.id}`} style={{ color: 'var(--primary)', fontWeight: '600' }}>
                        {job.url}
                      </Link>
                    </td>
                    <td style={{ padding: '1rem 0' }}>
                      <span style={{ 
                        padding: '0.25rem 0.6rem', 
                        borderRadius: '100px', 
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        background: job.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 
                                    job.status === 'failed' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: job.status === 'completed' ? '#16a34a' : 
                               job.status === 'failed' ? '#e11d48' : '#4f46e5'
                      }}>
                        {job.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0', color: 'var(--secondary)', textAlign: 'right', fontSize: '0.8rem' }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
