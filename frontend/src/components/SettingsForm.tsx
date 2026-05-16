'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import MediaUpload from './MediaUpload';
import VoiceRecorder from './VoiceRecorder';

export default function SettingsForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'media' | 'telegram' | 'social'>('general');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    intro_text: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    anime_style_enabled: false,
    youtube_connected: false,
    instagram_connected: false,
    linkedin_connected: false,
    instagram_url: '',
    telegram_channel_url: '',
    facebook_page_url: '',
    linkedin_page_url: '',
    youtube_channel_url: '',
    selfie_path: '',
    voice_sample_path: '',
    demo_video_path: '',
  });

  const [previews, setPreviews] = useState({
    selfie: null as string | null,
    voice: null as string | null,
    video: null as string | null,
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
        
        if (data) {
          setFormData({
            intro_text: data.intro_text ?? '',
            telegram_bot_token: data.telegram_bot_token ?? '',
            telegram_chat_id: data.telegram_chat_id ?? '',
            anime_style_enabled: !!data.anime_style_enabled,
            youtube_connected: !!data.youtube_connected,
            instagram_connected: !!data.instagram_access_token,
            linkedin_connected: !!data.linkedin_connected,
            instagram_url: data.instagram_url ?? '',
            telegram_channel_url: data.telegram_channel_url ?? '',
            facebook_page_url: data.facebook_page_url ?? '',
            linkedin_page_url: data.linkedin_page_url ?? '',
            youtube_channel_url: data.youtube_channel_url ?? '',
            selfie_path: data.selfie_path ?? '',
            voice_sample_path: data.voice_sample_path ?? '',
            demo_video_path: data.demo_video_path ?? '',
          });

          // Fetch signed URLs for previews
          if (data.selfie_path) fetchSignedUrl('user-images', data.selfie_path, 'selfie');
          if (data.voice_sample_path) fetchSignedUrl('user-voices', data.voice_sample_path, 'voice');
          if (data.demo_video_path) fetchSignedUrl('user-demo-videos', data.demo_video_path, 'video');
        }
      } catch (err: any) {
        console.error('Error loading settings:', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [userId]);

  const fetchSignedUrl = async (bucket: string, path: string, key: keyof typeof previews) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data) {
      setPreviews(prev => ({ ...prev, [key]: data.signedUrl }));
    }
  };

  const [verifying, setVerifying] = useState(false);

  const verifyTelegram = async () => {
    if (!formData.telegram_bot_token) {
      setMessage({ type: 'error', text: 'Please enter a Bot Token first.' });
      return;
    }

    setVerifying(true);
    setMessage(null);

    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/telegram/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.telegram_bot_token }),
      });

      const result = await resp.json();

      if (result.status === 'success') {
        setFormData({ ...formData, telegram_chat_id: result.chat_id });
        setMessage({ type: 'success', text: `Telegram connected! Chat ID: ${result.chat_id}` });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to connect to backend.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          intro_text: formData.intro_text,
          telegram_bot_token: formData.telegram_bot_token,
          telegram_chat_id: formData.telegram_chat_id,
          anime_style_enabled: formData.anime_style_enabled,
          instagram_url: formData.instagram_url,
          telegram_channel_url: formData.telegram_channel_url,
          facebook_page_url: formData.facebook_page_url,
          linkedin_page_url: formData.linkedin_page_url,
          youtube_channel_url: formData.youtube_channel_url,
          selfie_path: formData.selfie_path,
          voice_sample_path: formData.voice_sample_path,
          demo_video_path: formData.demo_video_path,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading settings...</p>;

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'media', label: 'Media Assets', icon: '🖼️' },
    { id: 'telegram', label: 'Telegram', icon: '📨' },
    { id: 'social', label: 'Social Links', icon: '🔗' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {message && (
        <div style={{ 
          padding: '1rem', 
          borderRadius: '8px', 
          background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          color: message.type === 'success' ? '#16a34a' : 'var(--accent)',
          fontSize: '0.9rem',
          border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'general' && (
          <div className="fade-in">
            <h3 style={{ marginBottom: '1.5rem' }}>General Production Settings</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Default Intro Text</label>
              <textarea
                value={formData.intro_text}
                onChange={(e) => setFormData({ ...formData, intro_text: e.target.value })}
                placeholder="Default text for your video intros..."
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--background)', minHeight: '120px', fontSize: '0.95rem' }}
              />
            </div>

            <div style={{ padding: '1.5rem', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="checkbox"
                id="anime_style"
                checked={formData.anime_style_enabled}
                onChange={(e) => setFormData({ ...formData, anime_style_enabled: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <div>
                <label htmlFor="anime_style" style={{ fontWeight: '600', display: 'block' }}>Anime Style Visuals</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>When enabled, generated media will lean towards anime/illustration aesthetics.</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="fade-in">
            <h3 style={{ marginBottom: '1.5rem' }}>Personal Media Assets</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>These assets are used to clone your identity for AI generation.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <section style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '16px' }}>
                <MediaUpload
                  userId={userId}
                  bucket="user-images"
                  label="Identity Selfie"
                  accept="image/*"
                  currentPath={formData.selfie_path}
                  onUploadSuccess={(path) => {
                    setFormData({ ...formData, selfie_path: path });
                    fetchSignedUrl('user-images', path, 'selfie');
                  }}
                />
                {previews.selfie && <img src={previews.selfie} alt="Selfie" style={{ width: '120px', height: '120px', marginTop: '1rem', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--primary)' }} />}
              </section>

              <section style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '16px' }}>
                <MediaUpload
                  userId={userId}
                  bucket="user-voices"
                  label="Voice Sample (Clone Source)"
                  accept="audio/*"
                  currentPath={formData.voice_sample_path}
                  maxSizeMB={10}
                  onUploadSuccess={(path) => {
                    setFormData({ ...formData, voice_sample_path: path });
                    fetchSignedUrl('user-voices', path, 'voice');
                  }}
                />
                <div style={{ marginTop: '1rem' }}>
                  {previews.voice && <audio src={previews.voice} controls style={{ width: '100%', marginBottom: '1rem' }} />}
                  <VoiceRecorder 
                    userId={userId} 
                    onUploadSuccess={(path) => {
                      setFormData({ ...formData, voice_sample_path: path });
                      fetchSignedUrl('user-voices', path, 'voice');
                    }}
                  />
                </div>
              </section>

              <section style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '16px' }}>
                <MediaUpload
                  userId={userId}
                  bucket="user-demo-videos"
                  label="Reference Demo Video"
                  accept="video/*"
                  currentPath={formData.demo_video_path}
                  maxSizeMB={50}
                  onUploadSuccess={(path) => {
                    setFormData({ ...formData, demo_video_path: path });
                    fetchSignedUrl('user-demo-videos', path, 'video');
                  }}
                />
                {previews.video && <video src={previews.video} controls style={{ width: '100%', marginTop: '1rem', borderRadius: '12px', maxHeight: '240px' }} />}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'telegram' && (
          <div className="fade-in">
            <h3 style={{ marginBottom: '1rem' }}>Telegram Integration</h3>
            <div style={{ padding: '1.25rem', background: 'rgba(0, 136, 204, 0.05)', borderRadius: '12px', marginBottom: '2rem', fontSize: '0.85rem', border: '1px solid rgba(0, 136, 204, 0.2)', color: '#0088cc' }}>
              <p style={{ fontWeight: '700', marginBottom: '0.5rem' }}>How to connect:</p>
              <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                <li>Message <a href="https://t.me/botfather" target="_blank" style={{ color: '#0088cc', fontWeight: '700' }}>@BotFather</a> to create a bot and get a <strong>Token</strong>.</li>
                <li>Start a chat with your new bot on Telegram.</li>
                <li>Paste the token below and click <strong>Verify</strong>.</li>
              </ol>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>Bot Token</label>
                <input
                  type="password"
                  value={formData.telegram_bot_token}
                  onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                  placeholder="123456:ABC-DEF..."
                  style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--background)' }}
                />
              </div>
              <button 
                type="button" 
                onClick={verifyTelegram}
                disabled={verifying}
                className="btn" 
                style={{ padding: '0.85rem 1.5rem', background: '#0088cc', color: 'white', fontWeight: '600', height: 'fit-content' }}
              >
                {verifying ? 'Verifying...' : 'Verify & Link'}
              </button>
            </div>

            {formData.telegram_chat_id && (
              <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#16a34a' }}>Linked Chat ID: <strong>{formData.telegram_chat_id}</strong></span>
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700' }}>CONNECTED ✅</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'social' && (
          <div className="fade-in">
            <h3 style={{ marginBottom: '0.5rem' }}>Social Media Profiles</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>Configure where your content is shared and how it's linked.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              {/* Instagram */}
              <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(219, 39, 119, 0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '32px', height: '32px', background: 'linear-gradient(45deg, #f09433, #dc2743, #ad38d7)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.607.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.366-.333 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.332-3.608-1.308-.975-.975-1.245-2.242-1.308-3.607-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.607-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.058-1.69-.072-4.949-.072zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Instagram</span>
                </div>
                <input
                  type="text"
                  value={formData.instagram_url}
                  onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                  placeholder="Profile URL"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem', marginBottom: '0.75rem' }}
                />
                <button 
                  type="button"
                  onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/instagram/url?user_id=${userId}`}
                  style={{ width: '100%', padding: '0.5rem', background: formData.instagram_connected ? 'rgba(219, 39, 119, 0.1)' : '#db2777', color: formData.instagram_connected ? '#db2777' : 'white', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  {formData.instagram_connected ? '✓ API Connected' : 'Connect API for Auto-Publish'}
                </button>
              </div>

              {/* LinkedIn */}
              <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(10, 102, 194, 0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '32px', height: '32px', background: '#0A66C2', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>LinkedIn</span>
                </div>
                <input
                  type="text"
                  value={formData.linkedin_page_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_page_url: e.target.value })}
                  placeholder="Page/Profile URL"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem' }}
                />
              </div>

              {/* YouTube */}
              <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(255, 0, 0, 0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '32px', height: '32px', background: '#FF0000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>YouTube</span>
                </div>
                <input
                  type="text"
                  value={formData.youtube_channel_url}
                  onChange={(e) => setFormData({ ...formData, youtube_channel_url: e.target.value })}
                  placeholder="Channel URL"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem', marginBottom: '0.75rem' }}
                />
                <button 
                  type="button"
                  onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/youtube/login?user_id=${userId}`}
                  style={{ width: '100%', padding: '0.5rem', background: formData.youtube_connected ? 'rgba(34, 197, 94, 0.1)' : '#FF0000', color: formData.youtube_connected ? '#16a34a' : 'white', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  {formData.youtube_connected ? '✓ API Connected' : 'Connect Google for Publishing'}
                </button>
              </div>

              {/* Facebook */}
              <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(8, 102, 255, 0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ width: '32px', height: '32px', background: '#0866FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Facebook</span>
                </div>
                <input
                  type="text"
                  value={formData.facebook_page_url}
                  onChange={(e) => setFormData({ ...formData, facebook_page_url: e.target.value })}
                  placeholder="Page URL"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '1.25rem', 
              fontSize: '1rem', 
              fontWeight: '700',
              boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.3)' 
            }}
          >
            {saving ? 'Saving Configuration...' : 'Save All Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
