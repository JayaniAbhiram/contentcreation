'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MediaUploadProps {
  userId: string;
  bucket: string;
  label: string;
  accept: string;
  currentPath: string;
  onUploadSuccess: (path: string) => void;
  maxSizeMB?: number;
}

export default function MediaUpload({ 
  userId, 
  bucket, 
  label, 
  accept, 
  currentPath, 
  onUploadSuccess,
  maxSizeMB = 5
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);
      setUploading(true);

      const file = e.target.files?.[0];
      if (!file) return;

      // Validate size
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxSizeMB}MB`);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
      const filePath = `users/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      onUploadSuccess(filePath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: '12px', background: 'rgba(0,0,0,0.02)' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>{label}</label>
      
      {currentPath && (
        <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--primary)' }}>
          ✓ Current file: {currentPath.split('/').pop()}
        </div>
      )}

      <input
        type="file"
        accept={accept}
        onChange={handleUpload}
        disabled={uploading}
        style={{ fontSize: '0.8rem' }}
      />

      {uploading && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Uploading...</p>}
      {error && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--accent)' }}>{error}</p>}
    </div>
  );
}
