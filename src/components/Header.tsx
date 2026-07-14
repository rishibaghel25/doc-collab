'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Cloud, AlertCircle, Sparkles } from 'lucide-react';
import styles from './Header.module.css';

export default function Header() {
  const { currentUser, signOut, isDemoMode } = useAuth();

  // Extract initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      {/* Fallback mode Banner */}
      {isDemoMode && (
        <div className="banner banner-warning">
          <AlertCircle size={16} />
          <span>
            <strong>Local Demo Mode:</strong> Using LocalStorage for storage. Add Supabase keys to <code>.env.local</code> to enable a live cloud database.
          </span>
        </div>
      )}

      <header className={styles.header}>
        <div className={`app-container ${styles.headerContainer}`}>
          {/* Logo */}
          <div className={styles.logoArea} onClick={() => window.location.href = '/'}>
            <Sparkles className={styles.logoIcon} size={22} color="#6366f1" />
            <span className={`gradient-text ${styles.logoText}`}>SyncDoc</span>
            <span className={styles.logoSubtext}>Collab</span>
          </div>

          {/* Right Action Area */}
          <div className={styles.actions}>
            {/* Profile Info & Logout */}
            {currentUser ? (
              <div className={styles.profileWrapper}>
                <div className={styles.avatar}>
                  {getInitials(currentUser.name)}
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{currentUser.name}</div>
                  <div className={styles.email}>{currentUser.email}</div>
                </div>

                <button
                  className={styles.logoutBtn}
                  onClick={signOut}
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className={styles.anonymousBadge}>
                <Cloud size={14} style={{ marginRight: '6px' }} />
                <span>Guest Viewer</span>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
