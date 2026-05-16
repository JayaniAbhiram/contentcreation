'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface VoiceRecorderProps {
  userId: string;
  onUploadSuccess: (path: string) => void;
}

export default function VoiceRecorder({ userId, onUploadSuccess }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/wav' });
        setAudioURL(URL.createObjectURL(blob));
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const uploadRecording = async () => {
    if (chunks.current.length === 0) return;
    setUploading(true);

    try {
      const blob = new Blob(chunks.current, { type: 'audio/wav' });
      const fileName = `recorded_${Date.now()}.wav`;
      const filePath = `${userId}/${fileName}`;

      const { error } = await supabase.storage
        .from('user-voices')
        .upload(filePath, blob);

      if (error) throw error;
      onUploadSuccess(filePath);
      alert('Voice recording uploaded and saved!');
    } catch (err: any) {
      console.error('Upload error:', err.message);
      alert('Failed to upload recording.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px dashed var(--primary)' }}>
      <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--primary)' }}>Record Your Voice</h4>
      
      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', fontStyle: 'italic' }}>
        "The quick brown fox jumps over the lazy dog. In this AI-driven world, voice technology is transforming how we interact with information. I am recording this sample to train my personal AI avatar."
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {!isRecording ? (
          <button 
            type="button" 
            onClick={startRecording}
            className="btn"
            style={{ background: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
          >
            🔴 Start Recording
          </button>
        ) : (
          <button 
            type="button" 
            onClick={stopRecording}
            className="btn"
            style={{ background: 'var(--foreground)', color: 'var(--background)', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
          >
            ⏹ Stop Recording
          </button>
        )}

        {audioURL && !isRecording && (
          <>
            <audio src={audioURL} controls style={{ height: '32px' }} />
            <button 
              type="button" 
              onClick={uploadRecording}
              disabled={uploading}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              {uploading ? 'Uploading...' : 'Use This Recording'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
