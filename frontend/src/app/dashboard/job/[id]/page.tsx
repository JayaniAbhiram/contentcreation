'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import UserMenu from '@/components/UserMenu';
import Link from 'next/link';

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [satisfied, setSatisfied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      fetchJob();
    };
    init();

    // Real-time subscription
    const channel = supabase
      .channel(`job_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${id}` }, (payload) => {
        setJob(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Polling Fallback (ensures UI updates if real-time lags)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const activeStatuses = ['extracting', 'scripting', 'processing', 'rendering'];
    if (job?.status && activeStatuses.includes(job.status)) {
      pollInterval = setInterval(() => {
        fetchJob();
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [job?.status]);

  // Dynamic countdown timer for active pipeline stages
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const activeStages: Record<string, number> = {
      'extracting': 15,
      'scripting': 30,
      'processing': 60,
      'rendering': 120
    };

    if (job?.status && activeStages[job.status]) {
      const totalTime = activeStages[job.status];
      // Start with estimate if not already running
      if (timeLeft === null) {
        setTimeLeft(totalTime);
        setProgress(0);
      }
      
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null;
          const nextValue = prev > 1 ? prev - 1 : 1;
          const elapsed = totalTime - nextValue;
          setProgress(Math.min(99, Math.round((elapsed / totalTime) * 100)));
          return nextValue;
        });
      }, 1000);
    } else {
      setTimeLeft(null);
      setProgress(0);
    }

    return () => clearInterval(timer);
  }, [job?.status, timeLeft]);

  const fetchJob = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (data) setJob(data);
    setLoading(false);
  };

  const [settingDuration, setSettingDuration] = useState(false);

  const handleSetDuration = async (seconds: number) => {
    setSettingDuration(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/set-duration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: seconds }),
      });
      await fetchJob();
    } catch (err) {
      console.error(err);
    } finally {
      setSettingDuration(false);
    }
  };

  const startExtraction = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/extract`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      console.error(err);
    }
  };

  const startScripting = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/generate-script`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      console.error(err);
    }
  };

  const startAudioGeneration = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/generate-audio`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      console.error(err);
    }
  };

  const startMediaPlanning = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/generate-media-plan`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      console.error(err);
    }
  };

  const startRendering = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/render`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async () => {
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/approve`, { method: 'POST' });
      const result = await resp.json();
      
      if (result.status === 'success') {
        setSatisfied(true);
        await fetchJob();
      } else {
        alert(`Telegram Error: ${result.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to backend for approval.');
    }
  };

  const [publishing, setPublishing] = useState(false);
  const handlePublishYouTube = async () => {
    setPublishing(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/publish/youtube`, { method: 'POST' });
      const result = await resp.json();
      if (result.status === 'success') {
        alert(`Successfully published! URL: ${result.url}`);
        await fetchJob();
      } else {
        alert(`Publishing failed: ${result.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to backend for publishing.');
    } finally {
      setPublishing(false);
    }
  };

  const handleImprovement = async () => {
    setImproving(true);
    try {
      // 1. Re-generate Media Plan with "improve" flag
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/generate-media-plan?improve=true`, { method: 'POST' });
      // 2. Re-render automatically
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/render`, { method: 'POST' });
      await fetchJob();
    } catch (err) {
      console.error(err);
    } finally {
      setImproving(false);
    }
  };

  if (loading || !user) return <div className="container"><p>Loading job...</p></div>;
  if (!job) return <div className="container"><p>Job not found.</p></div>;

  const extraction = job.metadata?.extraction;
  const script = job.metadata?.script;
  const audio = job.metadata?.audio;
  const mediaPlan = job.metadata?.media_plan;
  const finalVideo = job.metadata?.video;
  const extractionError = job.metadata?.extraction_error?.message || job.error_message;
  const config = job.metadata?.config;

  return (
    <div className="container">
      <nav className="nav" style={{ height: 'auto', padding: '1rem 0' }}>
        <div className="stack-mobile" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>← Dashboard</Link>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>Job Details</h2>
          </div>
          <UserMenu user={user} />
        </div>
      </nav>

      <main style={{ padding: '2rem 0' }}>
        <div className="premium-card" style={{ marginBottom: '2rem' }}>
          <div className="stack-mobile" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', marginBottom: '0.5rem', wordBreak: 'break-all' }}>{job.url}</h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>Created on {new Date(job.created_at).toLocaleString()}</p>
            </div>
            <span style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '100px', 
              fontSize: '0.75rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: job.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 
                          job.status === 'failed' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              color: job.status === 'completed' ? '#16a34a' : 
                     job.status === 'failed' ? '#e11d48' : '#4f46e5'
            }}>
              {job?.status?.toUpperCase()?.replace('_', ' ') || 'UNKNOWN'}
            </span>
          </div>

          {/* Enhanced Pipeline Checklist */}
          <div style={{ marginTop: '2.5rem' }}>
            <h4 style={{ marginBottom: '1.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--secondary)' }}>Pipeline Status</h4>
            
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { key: 'pending_extraction', label: 'Article Extraction', detail: 'Reading content' },
                { key: 'pending_duration', label: 'Duration Selection', detail: '30s, 2m, or 8m' },
                { key: 'pending_script', label: 'AI Scripting', detail: 'Mistral AI generation' },
                { key: 'pending_media', label: 'Production Plan', detail: 'Voice & Stock search' },
                { key: 'processing', label: 'Final Rendering', detail: 'FFmpeg assembly' },
                { key: 'completed', label: 'Publishing', detail: 'YouTube & LinkedIn' }
              ].map((stage, idx, arr) => {
                const stages = arr.map(s => s.key);
                const currentIdx = stages.indexOf(job.status === 'extracting' ? 'pending_extraction' : 
                                                 job.status === 'scripting' ? 'pending_script' :
                                                 (job.status === 'processing' && mediaPlan) ? 'processing' :
                                                 job.status === 'processing' ? 'pending_media' : job.status);
                
                const isCompleted = stages.indexOf(stage.key) < currentIdx || job.status === 'completed';
                const isCurrent = (stage.key === 'pending_extraction' && job.status === 'extracting') ||
                                  (stage.key === 'pending_script' && job.status === 'scripting') ||
                                  (stage.key === 'pending_media' && job.status === 'processing' && !mediaPlan) ||
                                  (stage.key === 'processing' && job.status === 'processing' && mediaPlan) ||
                                  (stage.key === job.status);

                const isActiveAction = ['extracting', 'scripting', 'processing'].includes(job.status);

                return (
                  <div 
                    key={stage.key} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border)',
                      background: isCurrent ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                      opacity: isCompleted || isCurrent ? 1 : 0.4,
                      position: 'relative',
                      borderLeft: isCurrent ? '4px solid var(--primary)' : '1px solid var(--border)',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        {isCompleted ? '✅' : isCurrent ? (isActiveAction ? '⏳' : '🔵') : '⚪️'} {stage.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--secondary)', margin: 0 }}>{stage.detail}</p>
                    
                    {isCurrent && isActiveAction && timeLeft !== null && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>PROGRESS</span>
                          <span>{progress}%</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            background: 'var(--primary)', 
                            width: `${progress}%`,
                            transition: 'width 1s linear'
                          }} />
                        </div>
                        <p style={{ fontSize: '0.6rem', color: 'var(--secondary)', marginTop: '0.4rem', textAlign: 'right' }}>
                          Estimated: ~{timeLeft}s remaining
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            {job.status === 'pending_extraction' || job.status === 'extracting' ? (
              <button 
                onClick={startExtraction} 
                disabled={job.status === 'extracting'}
                className="btn btn-primary"
              >
                {job.status === 'extracting' ? 'Extracting...' : 'Start Extraction'}
              </button>
            ) : null}

            {(['pending_duration', 'pending_script', 'pending_media'].includes(job.status)) && (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Select Video Duration 
                  {config && <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 'normal' }}>(Current: {config.duration_seconds}s)</span>}
                </h3>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {[
                    { label: 'Short (30s)', seconds: 30, description: 'Quick summary' },
                    { label: 'Medium (2m)', seconds: 120, description: 'Detailed overview' },
                    { label: 'Long (8m)', seconds: 480, description: 'Deep dive' },
                  ].map((opt) => {
                    const isSelected = config?.duration_seconds === opt.seconds;
                    return (
                      <button
                        key={opt.seconds}
                        onClick={() => handleSetDuration(opt.seconds)}
                        disabled={settingDuration || job.status === 'scripting'}
                        className="btn"
                        style={{ 
                          padding: '1.5rem 1rem', 
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--background)',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                          height: '100%'
                        }}
                      >
                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{opt.label}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', textAlign: 'center' }}>{opt.description}</span>
                      </button>
                    );
                  })}

                  <div style={{ 
                    padding: '1rem', 
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', fontWeight: '600', textAlign: 'center' }}>CUSTOM SECONDS</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="number" 
                        placeholder="Secs"
                        id="custom-duration-input"
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            if (val > 0) handleSetDuration(val);
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('custom-duration-input') as HTMLInputElement;
                          const val = parseInt(input.value);
                          if (val > 0) handleSetDuration(val);
                        }}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        SET
                      </button>
                    </div>
                  </div>
                </div>

                {config && job.status === 'pending_duration' && (
                  <button 
                    onClick={async () => {
                      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/confirm-config`, { method: 'POST' });
                      await fetchJob();
                    }}
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                  >
                    Confirm & Proceed to Scripting
                  </button>
                )}

                {(['pending_script', 'pending_media', 'scripting'].includes(job.status)) && (
                  <button 
                    onClick={startScripting}
                    disabled={job.status === 'scripting'}
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      marginTop: '1.5rem', 
                      background: script && script.target_duration !== config?.duration_seconds ? '#f59e0b' : 'var(--primary)', 
                      color: 'white' 
                    }}
                  >
                    {job.status === 'scripting' ? 'Generating AI Script...' : (script ? 'Re-generate AI Script' : 'Generate AI Script')}
                  </button>
                )}

                {(['pending_media', 'processing'].includes(job.status)) && (
                  <button 
                    onClick={startAudioGeneration}
                    disabled={job.status === 'processing'}
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      marginTop: '1.5rem', 
                      background: audio && audio.target_duration !== config?.duration_seconds ? '#f59e0b' : '#22c55e', 
                      color: 'white' 
                    }}
                  >
                    {job.status === 'processing' ? 'Generating Voiceover...' : (audio ? 'Re-generate Voiceover' : 'Generate Voiceover')}
                  </button>
                )}

                {(['pending_media', 'processing'].includes(job.status) || mediaPlan) && (
                  <button 
                    onClick={startMediaPlanning}
                    disabled={job.status === 'processing'}
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      marginTop: '1.5rem', 
                      background: mediaPlan ? '#4f46e5' : '#6366f1', 
                      color: 'white' 
                    }}
                  >
                    {job.status === 'processing' ? 'Searching Media Assets...' : (mediaPlan ? 'Re-generate Media Plan' : 'Generate Media Plan')}
                  </button>
                )}

                {(mediaPlan || job.status === 'rendering') && (
                  <button 
                    onClick={startRendering}
                    disabled={job.status === 'rendering'}
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      marginTop: '1.5rem', 
                      background: finalVideo ? '#e11d48' : 'var(--accent)', 
                      color: 'white' 
                    }}
                  >
                    {job.status === 'rendering' ? 'Rendering Video (via FFmpeg)...' : (finalVideo ? 'Re-render Final Video' : 'Render Final Video')}
                  </button>
                )}
                
                {config && script && script.target_duration !== config.duration_seconds && (
                  <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '0.5rem', textAlign: 'center' }}>
                    ⚠ Duration changed. Please re-generate the <strong>Script</strong> first.
                  </p>
                )}

                {config && script && script.target_duration === config.duration_seconds && audio && audio.target_duration !== config.duration_seconds && (
                  <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '0.5rem', textAlign: 'center' }}>
                    ⚠ Script updated. Please re-generate the <strong>Voiceover</strong> to match.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 600px), 1fr))', gap: '2rem' }}>
          <div>
            {finalVideo && (
              <div className="premium-card" style={{ marginBottom: '2rem', border: '1px solid var(--accent)', background: 'rgba(244, 63, 94, 0.02)' }}>
                <h4 style={{ color: 'var(--accent)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Final Video Production</h4>
                <video 
                  key={typeof finalVideo.public_url === 'string' ? finalVideo.public_url : (finalVideo.public_url?.publicUrl || finalVideo.public_url?.publicURL)}
                  src={typeof finalVideo.public_url === 'string' ? finalVideo.public_url : (finalVideo.public_url?.publicUrl || finalVideo.public_url?.publicURL)} 
                  controls 
                  style={{ width: '100%', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} 
                />
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <div className="stack-mobile" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {!satisfied && !(job.metadata?.review_status === 'accepted') ? (
                        <>
                          <button 
                            onClick={handleApprove}
                            className="btn" 
                            style={{ background: '#22c55e', color: 'white' }}
                          >
                            ✓ Approve
                          </button>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button 
                              onClick={async () => {
                                if (confirm('Restart and clear progress?')) {
                                  await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/jobs/${id}/reset`, { method: 'POST' });
                                  await fetchJob();
                                }
                              }}
                              className="btn" 
                              style={{ background: '#64748b', color: 'white', fontSize: '0.75rem' }}
                            >
                              Reset
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: '700' }}>✨ Production Ready</span>
                          </div>
                          
                          <div className="stack-mobile" style={{ width: '100%', gap: '1rem' }}>
                            <Link 
                              href={`/dashboard/job/${id}/social`}
                              className="btn"
                              style={{ background: 'var(--primary)', color: 'white', flex: 2, padding: '1rem' }}
                            >
                              📱 Manage Social Media
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                    <a 
                      href={typeof finalVideo.public_url === 'string' ? finalVideo.public_url : (finalVideo.public_url?.publicUrl || finalVideo.public_url?.publicURL)} 
                      download 
                      className="btn" 
                      style={{ background: 'var(--foreground)', color: 'var(--background)' }}
                    >
                      Download MP4
                    </a>
                  </div>
                </div>
              </div>
            )}

            {mediaPlan && (
              <div className="premium-card" style={{ marginBottom: '2rem', border: '1px solid #6366f1', background: 'rgba(99, 102, 241, 0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h4 style={{ color: '#6366f1', fontSize: '0.75rem', textTransform: 'uppercase' }}>Visual Assets Gallery</h4>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontWeight: '600' }}>
                    {mediaPlan.count} PLACEMENTS
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                  {mediaPlan.plan.map((item: any, idx: number) => (
                    <div 
                      key={idx} 
                      onClick={() => setPreviewMedia(item.media)}
                      style={{ 
                        position: 'relative', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        aspectRatio: '16/9', 
                        background: '#000',
                        cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {item.media.type === 'video' ? (
                        <video 
                          key={item.media.url} 
                          src={item.media.url} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          muted 
                          onMouseOver={e => {
                            const playPromise = e.currentTarget.play();
                            if (playPromise !== undefined) {
                              playPromise.catch(() => { /* Ignore interruption errors */ });
                            }
                          }} 
                          onMouseOut={e => e.currentTarget.pause()} 
                        />
                      ) : (
                        <img src={item.media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.2rem', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.6rem', textAlign: 'center' }}>
                        {item.keyword}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {audio && (
              <div className="premium-card" style={{ marginBottom: '2rem', border: '1px solid #22c55e', background: 'rgba(34, 197, 94, 0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#16a34a', fontSize: '0.75rem', textTransform: 'uppercase' }}>Generated Voiceover</h4>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontWeight: '600' }}>
                    {audio?.mode?.toUpperCase()?.replace('_', ' ') || 'STANDARD'}
                  </span>
                </div>
                <audio 
                  src={typeof audio.public_url === 'string' ? audio.public_url : audio.public_url?.publicUrl} 
                  controls 
                  style={{ width: '100%' }} 
                />
                <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--secondary)' }}>
                  Using {audio.is_personal ? 'Personal Voice Clone' : `AI Voice (${audio.voice})`}
                </p>
                
                {audio.is_personal && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', fontSize: '0.8rem' }}>
                    ℹ️ <strong>Personal Mode Detected:</strong> This audio was generated using your custom voice profile settings.
                  </div>
                )}
              </div>
            )}

            {script && (
              <div className="premium-card" style={{ marginBottom: '2rem', border: '1px solid var(--primary)', background: 'rgba(99, 102, 241, 0.02)' }}>
                <h4 style={{ color: 'var(--primary)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1rem' }}>AI Video Script</h4>
                <div style={{ lineHeight: '1.8', color: 'var(--foreground)', fontSize: '1.1rem', fontStyle: 'italic' }}>
                  "{script.script}"
                </div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--secondary)' }}>
                  <span>Words: {script.word_count}</span>
                  <span>Target: {script.target_duration}s</span>
                </div>
              </div>
            )}

            {extraction && (
              <div className="premium-card">
                <h4 style={{ color: 'var(--secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Extracted Content</h4>
                <h2 style={{ marginBottom: '1rem' }}>{extraction.title}</h2>
                <div style={{ lineHeight: '1.6', color: 'var(--foreground)', whiteSpace: 'pre-wrap', maxHeight: '500px', overflowY: 'auto', paddingRight: '1rem' }}>
                  {extraction.text}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="premium-card" style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: 'var(--secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Job Information</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Status</label>
                  <p style={{ fontWeight: '600' }}>{job?.status?.toUpperCase() || 'LOADING...'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Duration</label>
                  <p style={{ fontWeight: '600' }}>{config ? `${config.duration_seconds} seconds` : 'Not selected'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Created At</label>
                  <p style={{ fontWeight: '600' }}>{new Date(job.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {job.status === 'failed' && (
              <div className="premium-card" style={{ border: '1px solid var(--accent)', background: 'rgba(244, 63, 94, 0.05)' }}>
                <h4 style={{ color: 'var(--accent)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Failure Reason</h4>
                <p style={{ color: 'var(--accent)', fontWeight: '500' }}>{extractionError}</p>
                <button 
                  onClick={startExtraction} 
                  className="btn" 
                  style={{ marginTop: '1.5rem', width: '100%', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                >
                  Retry Extraction
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox Preview Modal */}
      {previewMedia && (
        <div 
          onClick={() => setPreviewMedia(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            {previewMedia.type === 'video' ? (
              <video 
                src={previewMedia.url} 
                controls 
                autoPlay 
                style={{ width: '100%', height: '100%', borderRadius: '12px' }} 
              />
            ) : (
              <img 
                src={previewMedia.url} 
                alt="Preview" 
                style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'contain' }} 
              />
            )}
            <button 
              onClick={() => setPreviewMedia(null)}
              style={{
                position: 'absolute',
                top: '-2rem',
                right: 0,
                color: 'white',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
