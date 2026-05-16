'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function JobInput({ userId, onJobCreated }: { userId: string, onJobCreated: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateUrl(url)) {
      setError('Please enter a valid URL (including http/https)');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('jobs')
        .insert({
          user_id: userId,
          url: url,
          status: 'pending_extraction',
        });

      if (error) throw error;
      
      setUrl('');
      onJobCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-card">
      <h3>Transform Article</h3>
      <p style={{ color: 'var(--secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Paste the URL of an article to start generating your video.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="stack-mobile" style={{ gap: '1rem' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://news.example.com/article-url"
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ padding: '0.75rem 2rem' }}
          >
            {loading ? 'Creating...' : 'Create Video'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--accent)', fontSize: '0.8rem', marginTop: '0.8rem', fontWeight: '500' }}>{error}</p>}
      </form>
    </div>
  );
}
