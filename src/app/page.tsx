'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDocuments, createDocument, deleteDocument, Document } from '@/lib/db';
import { Plus, FileUp, Folder, Users, FileText, Trash2, LogIn, Loader2 } from 'lucide-react';
import styles from './page.module.css';

export default function Dashboard() {
  const { currentUser, loading, handleSignIn, handleSignUp } = useAuth();
  const router = useRouter();
  const [ownedDocs, setOwnedDocs] = useState<Document[]>([]);
  const [sharedDocs, setSharedDocs] = useState<Document[]>([]);
  const [fetchingDocs, setFetchingDocs] = useState(true);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail.includes('@') || authEmail.length < 5) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (authMode === 'register') {
      if (!authName.trim()) {
        setAuthError('Please enter your full name.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }
    }

    setAuthLoading(true);
    try {
      if (authMode === 'signin') {
        await handleSignIn(authEmail, authPassword);
      } else {
        await handleSignUp(authEmail, authName, authPassword);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };


  const fetchDocs = async () => {
    if (!currentUser) return;
    setFetchingDocs(true);
    try {
      const { owned, shared } = await getDocuments(currentUser.id);
      setOwnedDocs(owned);
      setSharedDocs(shared);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setFetchingDocs(false);
    }
  };

  // Re-fetch when user changes
  useEffect(() => {
    if (currentUser) {
      fetchDocs();
    }
  }, [currentUser]);

  // Listen for storage events (e.g. mock db sync between tabs or pages)
  useEffect(() => {
    const handleStorageChange = () => {
      fetchDocs();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

  const handleCreateNewDoc = async () => {
    if (!currentUser) return;
    try {
      const newDoc = await createDocument('Untitled Document', '<p>Start typing here...</p>', currentUser.id);
      router.push(`/document/${newDoc.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create document.');
    }
  };

  const handleDeleteDoc = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation(); // prevent card navigation
    if (!currentUser) return;
    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return;

    try {
      await deleteDocument(docId, currentUser.id);
      await fetchDocs();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document.');
    }
  };

  // Handle file import parsing
  const importFile = async (file: File) => {
    if (!currentUser) return;
    setImporting(true);
    setErrorMessage('');

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const title = file.name.replace(/\.[^/.]+$/, ''); // remove extension

    try {
      let content = '';

      if (fileExtension === 'txt' || fileExtension === 'md') {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

        // Convert simple carriage returns to HTML tags
        content = text
          .split('\n')
          .map(line => line.trim() === '' ? '<p><br></p>' : `<p>${line}</p>`)
          .join('');
      } else if (fileExtension === 'docx') {
        // Send to Next.js API route to parse docx using mammoth
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/import-docx', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to parse Word document.');
        }

        const data = await res.json();
        content = data.html;
      } else if (fileExtension === 'pdf') {
        // Send to Next.js API route to parse PDF using pdf-parse
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/import-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to parse PDF document.');
        }

        const data = await res.json();
        content = data.html;
      } else {
        throw new Error('Unsupported file format. Please upload a .txt, .md, .docx, or .pdf file.');
      }

      // Create new document with parsed content
      const doc = await createDocument(title || 'Imported Document', content, currentUser.id);
      router.push(`/document/${doc.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import file.');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      importFile(file);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading user session...</p>
      </div>
    );
  }

  if (!currentUser) {
    const inputStyle: React.CSSProperties = {
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      color: 'var(--text-primary)',
      padding: '10px 14px',
      fontSize: '14px',
      borderRadius: 'var(--radius-md)',
      outline: 'none',
      transition: 'border-color var(--transition-fast)',
      width: '100%',
    };
    const labelStyle: React.CSSProperties = {
      fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    };

    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--primary-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogIn color="var(--primary)" size={22} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px', textAlign: 'center' }}>
            Welcome to <span className="gradient-text">SyncDoc</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px', textAlign: 'center' }}>
            Collaborative document editing, built for teams.
          </p>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '24px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(''); }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all var(--transition-fast)',
                background: authMode === 'signin' ? 'var(--bg-tertiary)' : 'transparent',
                color: authMode === 'signin' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all var(--transition-fast)',
                background: authMode === 'register' ? 'var(--bg-tertiary)' : 'transparent',
                color: authMode === 'register' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Name — only on register */}
            {authMode === 'register' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Full Name</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g., Alice Smith"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="e.g., alice@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder={authMode === 'register' ? 'At least 6 characters' : 'Your password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, padding: '2px 4px'
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Confirm Password — only on register */}
            {authMode === 'register' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Error message */}
            {authError && (
              <div style={{
                color: 'var(--danger)', fontSize: '13px', lineHeight: '1.4',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-sm)', padding: '8px 12px',
              }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={authLoading}
              style={{ marginTop: '4px', width: '100%', justifyContent: 'center' }}
            >
              {authLoading ? (
                <><Loader2 size={16} style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} /> Please wait...</>
              ) : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${styles.dashboard}`}>
      {/* Welcome Hero Area */}
      <div className={styles.welcomeSection}>
        <div className={styles.welcomeText}>
          <h1>
            Welcome back, <span className="gradient-text">{currentUser.name}</span>
          </h1>
          <p>Create a new document, import a draft, or collaborate with others.</p>
        </div>

        <div className={styles.quickActions}>
          {/* Create Document Button */}
          <button className="btn btn-primary" onClick={handleCreateNewDoc}>
            <Plus size={16} /> New Document
          </button>

          {/* Import File Button */}
          <div className={`btn btn-secondary ${styles.importZone}`}>
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <FileUp size={16} />
                <span>Import File</span>
              </>
            )}
            <input
              type="file"
              className={styles.importInput}
              accept=".txt,.md,.docx,.pdf"
              disabled={importing}
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="banner banner-warning" style={{ borderRadius: 'var(--radius-md)', padding: '12px' }}>
          {errorMessage}
        </div>
      )}

      {/* Main Sections Grid */}
      <div
        className={`${styles.sectionsGrid} ${dragOver ? styles.dropZoneActive : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Owned Documents */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Folder size={18} style={{ marginRight: '8px', color: 'var(--primary)' }} />
              My Documents
            </h2>
            <span className={styles.sectionCount}>{ownedDocs.length}</span>
          </div>

          <div className={styles.docList}>
            {fetchingDocs ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading documents...</p>
            ) : ownedDocs.length === 0 ? (
              <div className={styles.emptyState}>
                <FileText size={32} className={styles.emptyIcon} />
                <p>You haven't created any documents yet.</p>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '12px', fontSize: '12px' }}
                  onClick={handleCreateNewDoc}
                >
                  Create your first document
                </button>
              </div>
            ) : (
              ownedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={styles.docItem}
                  onClick={() => router.push(`/document/${doc.id}`)}
                >
                  <div className={styles.docMainInfo}>
                    <div className={styles.docTitle}>{doc.title}</div>
                    <div className={styles.docMeta}>
                      <span>Edited {formatDate(doc.updated_at)}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={(e) => handleDeleteDoc(e, doc.id)}
                    title="Delete document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shared Documents */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <Users size={18} style={{ marginRight: '8px', color: 'var(--accent)' }} />
              Shared With Me
            </h2>
            <span className={styles.sectionCount}>{sharedDocs.length}</span>
          </div>

          <div className={styles.docList}>
            {fetchingDocs ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading shared documents...</p>
            ) : sharedDocs.length === 0 ? (
              <div className={styles.emptyState}>
                <Users size={32} className={styles.emptyIcon} />
                <p>No documents have been shared with you yet.</p>
              </div>
            ) : (
              sharedDocs.map((doc) => {
                return (
                  <div
                    key={doc.id}
                    className={styles.docItem}
                    onClick={() => router.push(`/document/${doc.id}`)}
                  >
                    <div className={styles.docMainInfo}>
                      <div className={styles.docTitle}>{doc.title}</div>
                      <div className={styles.docMeta}>
                        <span>By {doc.owner?.name || 'Collaborator'}</span>
                        <span className={styles.dotSeparator} />
                        <span>Updated {formatDate(doc.updated_at)}</span>
                      </div>
                    </div>
                    <span className={`${styles.roleBadge} ${styles.roleEdit}`}>
                      Shared
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {dragOver && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(99, 102, 241, 0.15)',
            border: '3px dashed var(--primary)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div className="glass-panel" style={{ padding: '24px 40px', fontSize: '1.25rem', fontWeight: 600 }}>
            Drop to import as a new document
          </div>
        </div>
      )}
    </div>
  );
}
