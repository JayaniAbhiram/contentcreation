'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function UserMenu({ user }: { user: any }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const menuItemStyle: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    padding: '0.75rem',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    borderRadius: '8px',
    color: 'var(--foreground)'
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'inherit',
          fontWeight: '500'
        }}
      >
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          background: 'var(--primary)', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem'
        }}>
          {user.email?.[0].toUpperCase()}
        </div>
        <span style={{ fontSize: '0.9rem' }}>{user.email}</span>
      </button>

      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          right: 0, 
          marginTop: '0.5rem',
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow)',
          padding: '0.5rem',
          zIndex: 100,
          minWidth: '150px'
        }}>
          <button 
            onClick={() => { setIsOpen(false); router.push('/dashboard'); }}
            style={menuItemStyle}
          >
            Dashboard
          </button>
          <button 
            onClick={() => { setIsOpen(false); router.push('/dashboard/history'); }}
            style={menuItemStyle}
          >
            Job History
          </button>
          <button 
            onClick={() => { setIsOpen(false); router.push('/dashboard/settings'); }}
            style={menuItemStyle}
          >
            Settings
          </button>
          <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
          <button 
            onClick={handleLogout}
            style={{ ...menuItemStyle, color: 'var(--accent)', fontWeight: '600' }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
