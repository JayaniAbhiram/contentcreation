'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function JobSocialPage() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJob() {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) setJob(data);
      setLoading(false);
    }
    fetchJob();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading platform status...</div>;
  if (!job) return <div className="p-8 text-center">Job not found.</div>;

  const youtubeData = job.metadata?.youtube;
  const linkedinData = job.metadata?.linkedin;
  const ytStatus = youtubeData?.status === 'success' ? 'published' : 'not_published';
  const liStatus = linkedinData?.status === 'success' ? 'published' : 'not_published';

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      <nav className="nav" style={{ height: 'auto', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/dashboard/job/${id}`} style={{ textDecoration: 'none', color: 'var(--secondary)', fontSize: '0.9rem' }}>← Back to Job</Link>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Social Media Manager</h1>
        </div>
      </nav>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Ready to Publish?</h2>
        <p style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>Choose a platform to share your generated video.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* YouTube Card */}
        <div className="premium-card" style={{ border: '1px solid #FF0000', background: 'rgba(255, 0, 0, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem' }}>🎥</div>
            <span style={{ 
              fontSize: '0.7rem', 
              padding: '0.25rem 0.6rem', 
              borderRadius: '100px', 
              background: ytStatus === 'published' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 0, 0, 0.1)',
              color: ytStatus === 'published' ? '#16a34a' : '#FF0000',
              fontWeight: '700'
            }}>
              {ytStatus.toUpperCase()}
            </span>
          </div>
          <h3 style={{ marginBottom: '0.5rem' }}>YouTube</h3>
          <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Publish your video as a Short or regular video. Manage thumbnails and privacy.
          </p>
          {youtubeData?.url && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 0, 0, 0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', display: 'block', marginBottom: '0.25rem' }}>Live URL:</span>
              <a href={youtubeData.url} target="_blank" rel="noopener noreferrer" style={{ color: '#FF0000', fontSize: '0.85rem', wordBreak: 'break-all', fontWeight: '600' }}>
                {youtubeData.url}
              </a>
            </div>
          )}
          <Link href={`/dashboard/job/${id}/publish`} className="btn" style={{ background: '#FF0000', color: 'white', width: '100%', textAlign: 'center', display: 'block' }}>
            {ytStatus === 'published' ? 'Re-publish on YouTube' : 'Publish to YouTube'}
          </Link>
        </div>

        {/* LinkedIn Card */}
        <div className="premium-card" style={{ border: '1px solid #0A66C2', background: 'rgba(10, 102, 194, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem' }}>💼</div>
            <span style={{ 
              fontSize: '0.7rem', 
              padding: '0.25rem 0.6rem', 
              borderRadius: '100px', 
              background: liStatus === 'published' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(10, 102, 194, 0.1)',
              color: liStatus === 'published' ? '#16a34a' : '#0A66C2',
              fontWeight: '700'
            }}>
              {liStatus.toUpperCase()}
            </span>
          </div>
          <h3 style={{ marginBottom: '0.5rem' }}>LinkedIn</h3>
          <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Share as a professional update. Use AI to generate an engaging, emoji-rich description.
          </p>
          {linkedinData?.url && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(10, 102, 194, 0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', display: 'block', marginBottom: '0.25rem' }}>Post URL:</span>
              <a href={linkedinData.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0A66C2', fontSize: '0.85rem', wordBreak: 'break-all', fontWeight: '600' }}>
                {linkedinData.url}
              </a>
            </div>
          )}
          <Link href={`/dashboard/job/${id}/publish/linkedin`} className="btn" style={{ background: '#0A66C2', color: 'white', width: '100%', textAlign: 'center', display: 'block' }}>
            {liStatus === 'published' ? 'Re-publish on LinkedIn' : 'Publish to LinkedIn'}
          </Link>
        </div>
      </div>
    </div>
  );
}
