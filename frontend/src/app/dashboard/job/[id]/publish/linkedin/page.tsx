'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LinkedInPublishPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [job, setJob] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    visibility: 'PUBLIC',
  });

  const [theme, setTheme] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['telegram', 'instagram', 'linkedin', 'facebook', 'youtube']);
  const [generating, setGenerating] = useState(false);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleGenerateDescription = async () => {
    setGenerating(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/generate-linkedin-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          theme: theme || 'professional',
          enabled_platforms: selectedPlatforms
        }),
      });
      const result = await resp.json();
      if (result.status === 'success') {
        setFormData({ ...formData, description: result.description });
      } else {
        alert(`Generation failed: ${result.message}`);
      }
    } catch (err) {
      alert('Connection error.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    async function fetchJob() {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        setJob(data);
        const script = data.metadata?.script?.script || '';
        const aiMeta = data.metadata?.script?.youtube_meta;
        const title = aiMeta?.title || data.metadata?.extraction?.title || 'Untitled Update';
        const description = aiMeta?.description || `🚀 New Update! 🚀\n\nOriginal Article: ${data.url}\n\n${script}\n\n✨ Check this out! ✨\n\n#AI #News #LinkedIn #Professional #Innovation`;
        
        setFormData({
          title: title,
          description: description,
          visibility: 'PUBLIC',
        });
      }
      setLoading(false);
    }
    fetchJob();
  }, [id]);

  const [sendingTelegram, setSendingTelegram] = useState(false);

  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/send-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: `🚀 *LinkedIn Post Preview*\n\n*Title:* ${formData.title}\n\n*Description:* ${formData.description}`
        }),
      });
      const result = await resp.json();
      if (result.status === 'success') {
        alert('📤 Video and details sent to Telegram!');
      } else {
        alert(`Failed: ${result.message}`);
      }
    } catch (err) {
      alert('Connection error.');
    } finally {
      setSendingTelegram(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/publish/linkedin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await resp.json();
      if (result.status === 'success') {
        alert('🚀 Video Posted to LinkedIn Successfully!');
        router.push(`/dashboard/job/${id}`);
      } else {
        alert(`Failed: ${result.message}`);
      }
    } catch (err) {
      alert('Connection error.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading production data...</div>;
  if (!job) return <div className="p-8 text-center">Job not found.</div>;

  const videoUrl = typeof job.metadata?.video?.public_url === 'string' 
    ? job.metadata.video.public_url 
    : (job.metadata?.video?.public_url?.publicUrl || job.metadata?.video?.public_url?.publicURL);

  return (
    <div className="container" style={{ maxWidth: '900px', padding: '2rem 1rem' }}>
      <div className="stack-mobile" style={{ marginBottom: '2rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/dashboard/job/${id}`} style={{ textDecoration: 'none', color: 'var(--secondary)', fontSize: '0.9rem' }}>← Back</Link>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>LinkedIn Review</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Video Preview Section */}
        <div className="premium-card" style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#0A66C2', marginBottom: '1rem' }}>Video Preview</h3>
          <video key={videoUrl} src={videoUrl} controls style={{ width: '100%', borderRadius: '12px', background: 'black', maxHeight: '400px' }} />
        </div>

        {/* Editor Form */}
        <div className="premium-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Post Title</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div style={{ marginBottom: '1.5rem', background: 'rgba(10, 102, 194, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(10, 102, 194, 0.1)' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: '#70b5f9' }}>✨ AI Description & Social Links</label>
            
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Include these links in description:</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['telegram', 'instagram', 'linkedin', 'facebook', 'youtube'].map(p => (
                  <label key={p} style={{ 
                    fontSize: '0.7rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.25rem', 
                    cursor: 'pointer', 
                    background: selectedPlatforms.includes(p) ? 'rgba(10, 102, 194, 0.2)' : 'rgba(0,0,0,0.05)', 
                    color: selectedPlatforms.includes(p) ? '#0A66C2' : 'var(--secondary)',
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '100px',
                    border: selectedPlatforms.includes(p) ? '1px solid #0A66C2' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={selectedPlatforms.includes(p)} 
                      onChange={() => togglePlatform(p)} 
                      style={{ display: 'none' }}
                    />
                    {p === 'telegram' && '📢'}
                    {p === 'instagram' && '📸'}
                    {p === 'linkedin' && '💼'}
                    {p === 'facebook' && '👥'}
                    {p === 'youtube' && '🎥'}
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="e.g. 'story', 'conversation'"
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
              />
              <button 
                onClick={handleGenerateDescription}
                disabled={generating || publishing}
                className="btn"
                style={{ background: '#0A66C2', color: 'white', fontSize: '0.75rem' }}
              >
                {generating ? '...' : 'Gen'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Post Body</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              style={{ minHeight: '200px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Visibility</label>
            <select 
              value={formData.visibility} 
              onChange={(e) => setFormData({...formData, visibility: e.target.value})}
            >
              <option value="PUBLIC">🌍 Public</option>
              <option value="CONNECTIONS">👥 Connections</option>
            </select>
          </div>

          <div className="stack-mobile">
            <button 
              onClick={handleSendTelegram}
              disabled={sendingTelegram || publishing}
              className="btn"
              style={{ flex: 1, background: '#0088cc', color: 'white' }}
            >
              {sendingTelegram ? 'Sending...' : '📤 Telegram'}
            </button>
            <button 
              onClick={handlePublish}
              disabled={publishing || sendingTelegram}
              className="btn"
              style={{ flex: 2, background: '#0A66C2', color: 'white' }}
            >
              {publishing ? 'Posting...' : '🚀 Finalize & Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
