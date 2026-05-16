'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        router.push('/dashboard');
        return;
      }

      setIsAdmin(true);
      fetchData(user.id);
    }
    checkAdmin();
  }, []);

  const fetchData = async (adminId: string) => {
    setLoading(true);
    try {
      const [statsResp, jobsResp] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/stats?admin_id=${adminId}`),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/jobs?admin_id=${adminId}`)
      ]);
      
      setStats(await statsResp.json());
      setJobs(await jobsResp.json());
    } catch (err) {
      console.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job and all associated assets? This cannot be undone.')) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/jobs/${jobId}?admin_id=${user?.id}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Admin Panel...</div>;
  if (!isAdmin) return null;

  const filteredJobs = jobs.filter(j => filter === 'all' ? true : j.status === filter);

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>System Admin</h1>
          <p style={{ color: 'var(--secondary)', marginTop: '0.5rem' }}>Monitoring & Infrastructure Management</p>
        </div>
        <Link href="/dashboard" className="btn" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>Return to App</Link>
      </div>

      {/* Stats Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="premium-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Total Jobs</h4>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats?.total_jobs || 0}</div>
        </div>
        <div className="premium-card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '4px solid #f43f5e' }}>
          <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '0.5rem' }}>System Failures</h4>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f43f5e' }}>{stats?.failed_jobs || 0}</div>
        </div>
        <div className="premium-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Videos Rendered</h4>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats?.storage_files?.video || 0}</div>
        </div>
        <div className="premium-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Storage Items</h4>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>
            {Object.values(stats?.storage_files || {}).reduce((a: any, b: any) => a + b, 0)}
          </div>
        </div>
      </div>

      {/* Monitoring Table */}
      <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Global Job Monitor</h3>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px', background: 'var(--background)', color: 'white', border: '1px solid var(--border)' }}
          >
            <option value="all">All Statuses</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="telegram_approved">Approved</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--secondary)' }}>
                <th style={{ padding: '1rem 1.5rem' }}>User</th>
                <th style={{ padding: '1rem 1.5rem' }}>Job ID</th>
                <th style={{ padding: '1rem 1.5rem' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem' }}>Created At</th>
                <th style={{ padding: '1rem 1.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontWeight: '600' }}>{job.profiles?.email}</div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>{job.id.slice(0, 8)}...</code>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem', 
                      borderRadius: '100px', 
                      fontSize: '0.7rem', 
                      fontWeight: '600',
                      background: job.status === 'completed' || job.status === 'telegram_approved' ? 'rgba(34, 197, 94, 0.1)' : job.status === 'failed' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                      color: job.status === 'completed' || job.status === 'telegram_approved' ? '#22c55e' : job.status === 'failed' ? '#f43f5e' : '#6366f1'
                    }}>
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--secondary)', fontSize: '0.8rem' }}>
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link href={`/dashboard/job/${job.id}`} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>View</Link>
                      <button 
                        onClick={() => handleDeleteJob(job.id)}
                        className="btn" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredJobs.length === 0 && (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--secondary)' }}>No jobs found in this category.</div>
          )}
        </div>
      </div>

      {/* Failure Logs Section */}
      <div style={{ marginTop: '3rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Critical System Failures</h3>
        <div className="grid" style={{ gap: '1rem' }}>
          {jobs.filter(j => j.status === 'failed').slice(0, 5).map(job => (
            <div key={job.id} className="premium-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f43f5e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Job: {job.id.slice(0, 8)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>{new Date(job.created_at).toLocaleString()}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.1)' }}>
                {job.error_message || 'Unknown technical failure during processing.'}
              </p>
            </div>
          ))}
          {jobs.filter(j => j.status === 'failed').length === 0 && (
            <p style={{ color: 'var(--secondary)' }}>No system failures detected recently. High five! 🙌</p>
          )}
        </div>
      </div>
    </div>
  );
}
