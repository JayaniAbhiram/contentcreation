'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function PublishPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [job, setJob] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    privacy_status: 'unlisted',
  });

  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  
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
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/generate-youtube-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          theme: theme || 'informative',
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
        const title = aiMeta?.title || data.metadata?.extraction?.title || 'Untitled Video';
        const description = aiMeta?.description || `Original Article: ${data.url}\n\n${script}\n\n#AI #News #Articlo`;
        
        setFormData({
          title: title,
          description: description,
          privacy_status: 'unlisted',
        });

      }
      setLoading(false);
    }
    fetchJob();
  }, [id]);

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumbnail(true);
    try {
      const fileName = `${id}_custom_thumb_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('job-assets')
        .upload(`thumbnails/${id}/${fileName}`, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('job-assets')
        .getPublicUrl(`thumbnails/${id}/${fileName}`);

      setSelectedThumbnail(publicUrl);
    } catch (err) {
      alert('Upload failed. Please try again.');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const [sendingTelegram, setSendingTelegram] = useState(false);

  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/send-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: `🚀 *YouTube Video Preview*\n\n*Title:* ${formData.title}\n\n*Description:* ${formData.description}`
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
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/publish/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          thumbnail_url: selectedThumbnail
        }),
      });
      const result = await resp.json();
      if (result.status === 'success') {
        alert('🚀 Video Published Successfully!');
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
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>YouTube Review</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Video Preview Section */}
        <div className="premium-card" style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '1rem' }}>Video Preview</h3>
          <video key={videoUrl} src={videoUrl} controls style={{ width: '100%', borderRadius: '12px', background: 'black', maxHeight: '400px' }} />
        </div>

        {/* Editor Form */}
        <div className="premium-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Video Title</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 0, 0, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 0, 0, 0.1)' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', fontSize: '0.85rem', color: '#ff4d4d' }}>✨ AI Description & Social Links</label>
            
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
                    background: selectedPlatforms.includes(p) ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0,0,0,0.05)', 
                    color: selectedPlatforms.includes(p) ? '#FF0000' : 'var(--secondary)',
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '100px',
                    border: selectedPlatforms.includes(p) ? '1px solid #FF0000' : '1px solid transparent',
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
                placeholder="e.g. 'tutorial', 'news style'"
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                style={{ flex: 1 }}
              />
              <button 
                onClick={handleGenerateDescription}
                disabled={generating || publishing}
                className="btn"
                style={{ background: '#FF0000', color: 'white', fontSize: '0.75rem', padding: '0.5rem 1rem' }}
              >
                {generating ? '...' : 'Generate'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Final Description</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              style={{ minHeight: '200px', fontSize: '0.85rem' }}
            />
          </div>

          {/* New Thumbnail Upload Field */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600', fontSize: '0.85rem' }}>Custom Thumbnail (Optional)</label>
            <div className="stack-mobile" style={{ alignItems: 'center' }}>
              <div style={{ 
                width: '160px', 
                aspectRatio: '16/9', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                border: '1px solid var(--border)'
              }}>
                {selectedThumbnail ? (
                  <img src={selectedThumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Custom Thumbnail" />
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--secondary)' }}>No Preview</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleThumbnailUpload}
                  style={{ display: 'none' }}
                  id="thumb-upload"
                />
                <label 
                  htmlFor="thumb-upload"
                  className="btn"
                  style={{ 
                    padding: '0.6rem 1.2rem', 
                    fontSize: '0.75rem', 
                    background: 'var(--accent)', 
                    cursor: 'pointer',
                    borderRadius: '8px',
                    color: 'white'
                  }}
                >
                  {uploadingThumbnail ? 'Uploading...' : '📁 Upload Thumbnail'}
                </label>
                <p style={{ fontSize: '0.65rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                  Recommended: 1280x720 (16:9).
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>Privacy Status</label>
            <select 
              value={formData.privacy_status} 
              onChange={(e) => setFormData({...formData, privacy_status: e.target.value})}
            >
              <option value="public">🌍 Public</option>
              <option value="unlisted">🔗 Unlisted</option>
              <option value="private">🔒 Private</option>
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
              style={{ flex: 2, background: '#FF0000', color: 'white' }}
            >
              {publishing ? 'Publishing...' : '🚀 Finalize & Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
