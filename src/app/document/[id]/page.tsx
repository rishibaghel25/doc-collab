'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getDocument,
  updateDocument,
  getShares,
  shareDocument,
  unshareDocument,
  updateDocumentPublicStatus,
  createDocumentVersion,
  getDocumentVersions,
  Document,
  Share,
  DocumentVersion,
  isSupabaseConfigured
} from '@/lib/db';
import { 
  ChevronLeft, Save, Share2, Eye, Edit3, Lock, Bold, Italic, 
  Underline, Heading1, Heading2, List, ListOrdered, X, Copy, Check, Download, History 
} from 'lucide-react';
import styles from './page.module.css';

export default function DocumentEditor() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, loading } = useAuth();
  const id = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [role, setRole] = useState<'OWNER' | 'EDIT' | 'VIEW' | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [fetching, setFetching] = useState(true);

  // Saving states
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const hasInitializedContent = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Sharing states
  const [shares, setShares] = useState<Share[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [shareError, setShareError] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');

  // Link Sharing states
  const [isCopied, setIsCopied] = useState(false);

  // Export states & actions
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Version History states
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

  const loadVersions = async () => {
    if (!currentUser || !id) return;
    try {
      const history = await getDocumentVersions(id, currentUser.id);
      setVersions(history);
    } catch (err) {
      console.error('Failed to load version history:', err);
    }
  };

  const handleTogglePublic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !document) return;
    const checked = e.target.checked;
    try {
      const updated = await updateDocumentPublicStatus(id, checked, currentUser.id);
      setDocument(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update link sharing settings.');
    }
  };

  const handleCopyLink = () => {
    const url = window.location.origin + '/document/' + id;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy using clipboard API:', err);
          fallbackCopyText(url);
        });
    } else {
      fallbackCopyText(url);
    }
  };

  const fallbackCopyText = (text: string) => {
    const textArea = window.document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    window.document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = window.document.execCommand('copy');
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        alert('Failed to copy link. Please copy it manually from the box.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy link. Please copy it manually from the box.');
    }
    
    window.document.body.removeChild(textArea);
  };

  // Load document detail
  const loadDoc = async () => {
    if (!id) return;
    try {
      const data = await getDocument(id, currentUser?.id || 'anonymous-user');
      if (!data) {
        setRole(null);
        setDocument(null);
        return;
      }

      setDocument(data.document);
      setRole(data.role);
      setDocTitle(data.document.title);
      setDocContent(data.document.content);

      // Populate collaborators list if owner and logged in
      if (data.role === 'OWNER' && currentUser) {
        const shareData = await getShares(id, currentUser.id);
        setShares(shareData);
      }

      // Populate versions history if logged in
      if (currentUser) {
        const history = await getDocumentVersions(id, currentUser.id);
        setVersions(history);
      }
    } catch (err) {
      console.error('Error loading document:', err);
    } finally {
      setFetching(false);
    }
  };

  // Run on mount or user switch
  useEffect(() => {
    hasInitializedContent.current = false;
    // We can load public documents even if currentUser is null!
    loadDoc();
  }, [currentUser, id]);

  // Populate contentEditable once the editor DOM is mounted and fetching is done
  useEffect(() => {
    if (!fetching && document && editorRef.current && !hasInitializedContent.current) {
      editorRef.current.innerHTML = document.content || '';
      hasInitializedContent.current = true;
    }
  }, [fetching, document]);

  // Debounced auto-save content & title
  useEffect(() => {
    if (!document || role === 'VIEW' || !currentUser) return;
    
    // Check if anything actually changed from current document state
    if (docTitle === document.title && docContent === document.content) {
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const updated = await updateDocument(id, docTitle, docContent, currentUser.id);
        setDocument(updated);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [docTitle, docContent]);

  // Handle title input change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocTitle(e.target.value);
  };

  // Handle editor sheet text change
  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    setDocContent(e.currentTarget.innerHTML);
  };

  // Rich Text Formatting Actions
  const handleFormat = (command: string, value: string = '') => {
    if (role === 'VIEW') return;
    
    // Execute editor command
    window.document.execCommand(command, false, value);
    
    // Sync editor html state to state variable
    if (editorRef.current) {
      setDocContent(editorRef.current.innerHTML);
    }
  };

  // Sharing Modal Actions
  const handleAddShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError('');
    setShareSuccess('');

    if (!currentUser) return;

    try {
      await shareDocument(id, shareEmail, shareRole, currentUser.id);
      setShareSuccess(`Document shared with ${shareEmail} successfully.`);
      setShareEmail('');
      
      // Reload collaborators
      const shareData = await getShares(id, currentUser.id);
      setShares(shareData);
    } catch (err: any) {
      setShareError(err.message || 'Failed to share document.');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!currentUser) return;
    try {
      await unshareDocument(shareId, currentUser.id);
      
      // Reload collaborators
      const shareData = await getShares(id, currentUser.id);
      setShares(shareData);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke sharing permission.');
    }
  };

  const handleManualSave = async () => {
    if (role === 'VIEW' || !currentUser) return;
    setSaveStatus('saving');
    try {
      const updated = await updateDocument(id, docTitle, docContent, currentUser.id);
      setDocument(updated);
      
      // Save version history checkpoint!
      await createDocumentVersion(id, docTitle, docContent, currentUser.id);
      await loadVersions();
      
      setSaveStatus('saved');
    } catch (err) {
      console.error('Manual save failed:', err);
      setSaveStatus('error');
    }
  };

  const handlePreviewVersion = (ver: DocumentVersion) => {
    setPreviewVersion(ver);
    if (editorRef.current) {
      editorRef.current.innerHTML = ver.content;
    }
  };

  const handleExitPreview = () => {
    setPreviewVersion(null);
    if (editorRef.current && document) {
      editorRef.current.innerHTML = docContent;
    }
  };

  const handleRestoreVersion = async () => {
    if (!previewVersion || !currentUser) return;
    setSaveStatus('saving');
    try {
      const updated = await updateDocument(id, previewVersion.title, previewVersion.content, currentUser.id);
      setDocument(updated);
      setDocTitle(previewVersion.title);
      setDocContent(previewVersion.content);
      if (editorRef.current) {
        editorRef.current.innerHTML = previewVersion.content;
      }
      
      // Save a new version checkpoint for the restore event!
      await createDocumentVersion(id, `Restored: ${previewVersion.title}`, previewVersion.content, currentUser.id);
      await loadVersions();
      
      setPreviewVersion(null);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to restore version:', err);
      setSaveStatus('error');
    }
  };

  const exportToPDF = () => {
    setShowExportMenu(false);
    setShowVersionPanel(false);  // close sidebar
    setPreviewVersion(null);     // exit preview mode so banner is gone
    // Restore actual content in case we're in preview
    if (editorRef.current) {
      editorRef.current.innerHTML = docContent;
    }
    // Defer print until after React flushes state so the UI has cleaned up
    setTimeout(() => window.print(), 100);
  };

  const exportToMarkdown = () => {
    setShowExportMenu(false);
    if (!editorRef.current) return;
    
    // Always use actual document content, not a version preview
    const contentEl = window.document.createElement('div');
    contentEl.innerHTML = docContent;
    
    // HTML to basic Markdown converter
    let html = contentEl.innerHTML;
    
    // Replace structural elements
    let markdown = html
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<p><br><\/p>/gi, '\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<ul>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
      // inline formatting tags
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<u>(.*?)<\/u>/gi, '_$1_')
      // strip other tags
      .replace(/<[^>]*>/g, '');

    // Decode HTML entities
    const txt = window.document.createElement('textarea');
    txt.innerHTML = markdown;
    markdown = txt.value;

    // Trigger download
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${docTitle || 'document'}.md`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  if (loading || fetching) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading document workspace...</p>
      </div>
    );
  }

  if (!document || !role) {
    return (
      <div className={`app-container`} style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock color="var(--danger)" size={28} />
          </div>
        </div>
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '24px' }}>
          You do not have permission to view this document, or it does not exist.
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.editorPage}>
      {/* Editor Sub-Header Bar */}
      <div className={styles.topBar}>
        <div className={styles.navArea}>
          <button className={styles.backBtn} onClick={() => router.push('/')} title="Back to dashboard">
            <ChevronLeft size={16} style={{ marginRight: '4px' }} /> Dashboard
          </button>
          
          <div className={styles.titleWrapper}>
            <input
              type="text"
              className={styles.titleInput}
              value={docTitle}
              onChange={handleTitleChange}
              disabled={role === 'VIEW'}
              placeholder="Untitled Document"
            />
            {role !== 'VIEW' && currentUser && (
              <div className={styles.saveIndicator}>
                <span className={`${styles.saveDot} ${saveStatus === 'saving' ? styles.saveDotSaving : styles.saveDotSaved}`} />
                <span>
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'saved' && (isSupabaseConfigured ? 'Saved to Supabase' : 'Saved locally')}
                  {saveStatus === 'error' && 'Save failed'}
                </span>
              </div>
            )}
            {!currentUser && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Viewing public link as Guest
              </div>
            )}
          </div>
        </div>

        <div className={styles.actionsArea}>
          {role === 'VIEW' && (
            <div className={styles.viewOnlyBadge}>
              <Eye size={12} style={{ marginRight: '4px' }} /> View Only
            </div>
          )}

          {role === 'EDIT' && (
            <div className={styles.viewOnlyBadge} style={{ color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <Edit3 size={12} style={{ marginRight: '4px' }} /> Editor Access
            </div>
          )}

          {role !== 'VIEW' && currentUser && (
            <button className="btn btn-primary" onClick={handleManualSave} style={{ marginRight: '8px' }}>
              <Save size={14} style={{ marginRight: '4px' }} /> Save
            </button>
          )}

          {currentUser && (
            <button className="btn btn-secondary" onClick={() => setShowVersionPanel(!showVersionPanel)} style={{ marginRight: '8px' }}>
              <History size={14} style={{ marginRight: '4px' }} /> History
            </button>
          )}

          {role === 'OWNER' && currentUser && (
            <button className="btn btn-secondary" onClick={() => setShowShareModal(true)} style={{ marginRight: '8px' }}>
              <Share2 size={14} style={{ marginRight: '4px' }} /> Share
            </button>
          )}

          {/* Export Dropdown */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button className="btn btn-secondary" onClick={() => setShowExportMenu(!showExportMenu)}>
              <Download size={14} style={{ marginRight: '4px' }} /> Export
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '6px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '6px', zIndex: 100, minWidth: '160px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '2px'
              }}>
                <button
                  onClick={exportToMarkdown}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)',
                    cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s',
                    fontFamily: 'var(--font-sans)', fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  As Markdown (.md)
                </button>
                <button
                  onClick={exportToPDF}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)',
                    cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s',
                    fontFamily: 'var(--font-sans)', fontWeight: 500
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  As PDF / Print (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor workspace — horizontal row: editor | sidebar */}
      <div className={styles.workspace}>
        {/* ── Main editor column ── */}
        <div className={styles.editorMain}>
          {/* Version preview banner */}
          {previewVersion && (
            <div className={styles.previewBanner}>
              <span className={styles.previewBannerText}>
                <strong>Viewing:</strong> {previewVersion.title} — saved by {previewVersion.creator?.name || 'User'} on {new Date(previewVersion.created_at).toLocaleString()}
              </span>
              <div className={styles.previewBannerActions}>
                {role !== 'VIEW' && currentUser && (
                  <button className="btn btn-primary" onClick={handleRestoreVersion} style={{ padding: '6px 14px', fontSize: '12px', height: '30px' }}>
                    Restore
                  </button>
                )}
                <button className="btn btn-secondary" onClick={handleExitPreview} style={{ padding: '6px 14px', fontSize: '12px', height: '30px' }}>
                  Exit Preview
                </button>
              </div>
            </div>
          )}

          {/* Paper area: toolbar + sheet, centred */}
          <div className={styles.paperArea}>
            {/* Formatting Toolbar — hidden in view-only or preview mode */}
            {role !== 'VIEW' && !previewVersion && (
              <div className={styles.toolbar}>
                <button className={styles.toolbarBtn} onClick={() => handleFormat('bold')} title="Bold (Ctrl+B)">
                  <Bold size={15} />
                </button>
                <button className={styles.toolbarBtn} onClick={() => handleFormat('italic')} title="Italic (Ctrl+I)">
                  <Italic size={15} />
                </button>
                <button className={styles.toolbarBtn} onClick={() => handleFormat('underline')} title="Underline (Ctrl+U)">
                  <Underline size={15} />
                </button>

                <span className={styles.toolbarSeparator} />

                <button className={styles.toolbarBtn} onClick={() => handleFormat('formatBlock', '<h1>')} title="Heading 1">
                  <Heading1 size={15} />
                </button>
                <button className={styles.toolbarBtn} onClick={() => handleFormat('formatBlock', '<h2>')} title="Heading 2">
                  <Heading2 size={15} />
                </button>
                <button className={styles.toolbarBtn} style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={() => handleFormat('formatBlock', '<p>')} title="Paragraph">
                  P
                </button>

                <span className={styles.toolbarSeparator} />

                <button className={styles.toolbarBtn} onClick={() => handleFormat('insertUnorderedList')} title="Bulleted List">
                  <List size={15} />
                </button>
                <button className={styles.toolbarBtn} onClick={() => handleFormat('insertOrderedList')} title="Numbered List">
                  <ListOrdered size={15} />
                </button>
              </div>
            )}

            {/* Document sheet */}
            <div className={styles.sheet}>
              <div
                ref={editorRef}
                className={styles.editorArea}
                contentEditable={role !== 'VIEW' && !previewVersion}
                onInput={handleEditorInput}
                suppressContentEditableWarning
                data-placeholder="Type your document content here..."
              />
            </div>
          </div>
        </div>

        {/* ── Version History Sidebar ── */}
        {showVersionPanel && currentUser && (
          <div className={styles.versionSidebar}>
            <div className={styles.versionSidebarHeader}>
              <span className={styles.versionSidebarTitle}>
                <History size={14} color="var(--primary)" />
                Version History
              </span>
              <button className={styles.versionSidebarClose} onClick={() => setShowVersionPanel(false)} title="Close">
                <X size={14} />
              </button>
            </div>

            <div className={styles.versionList}>
              {versions.length === 0 ? (
                <p className={styles.versionEmpty}>
                  No saved versions yet.<br />Click <strong>Save</strong> to create a checkpoint.
                </p>
              ) : (
                versions.map((ver) => {
                  const isActive = previewVersion?.id === ver.id;
                  return (
                    <button
                      key={ver.id}
                      className={`${styles.versionItem} ${isActive ? styles.versionItemActive : ''}`}
                      onClick={() => handlePreviewVersion(ver)}
                    >
                      <div className={styles.versionItemTitle}>{ver.title || 'Untitled'}</div>
                      <div className={styles.versionItemMeta}>By {ver.creator?.name || 'User'}</div>
                      <div className={styles.versionItemMeta}>{new Date(ver.created_at).toLocaleString()}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>


      {/* Sharing modal */}
      {showShareModal && currentUser && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Manage Access</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
              Control who can see or edit this document.
            </p>

            {/* Link Sharing Area */}
            <div style={{
              background: 'rgba(11, 15, 25, 0.4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600, display: 'block' }}>🔗 Link Sharing</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Anyone with the link can view the document</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                  <input
                    type="checkbox"
                    checked={!!document.is_public}
                    onChange={handleTogglePublic}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: document.is_public ? 'var(--primary)' : 'var(--bg-tertiary)',
                    transition: '0.3s', borderRadius: '22px', border: '1px solid var(--border)'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '14px', width: '14px', left: document.is_public ? '24px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.3s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>

              {document.is_public && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.origin + '/document/' + id : ''}
                    style={{
                      background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                      padding: '8px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)', flex: 1, outline: 'none'
                    }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleCopyLink} style={{ fontSize: '12px', padding: '0 12px', height: '32px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    {isCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </div>

            {/* List of current shares */}
            <div className={styles.shareList}>
              <div className={styles.shareListItem}>
                <div className={styles.shareUser}>
                  <span className={styles.shareName}>You ({currentUser?.name})</span>
                  <span className={styles.shareEmail}>{currentUser?.email}</span>
                </div>
                <span className={styles.roleBadge} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Owner</span>
              </div>

              {shares.map((share) => (
                <div key={share.id} className={styles.shareListItem}>
                  <div className={styles.shareUser}>
                    <span className={styles.shareName}>{share.user?.name}</span>
                    <span className={styles.shareEmail}>{share.user?.email}</span>
                  </div>
                  <div className={styles.shareRoleArea}>
                    <span className={`${styles.roleBadge} ${share.role === 'EDIT' ? styles.roleEdit : styles.roleView}`}>
                      {share.role === 'EDIT' ? 'Can Edit' : 'Can View'}
                    </span>
                    <button
                      className={styles.shareDeleteBtn}
                      onClick={() => handleRevokeShare(share.id)}
                      title="Revoke access"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new collaborator */}
            <form onSubmit={handleAddShare} className={styles.shareForm}>
              <div className={styles.shareInputGroup}>
                <label>Add Collaborator Email</label>
                <input
                  type="email"
                  className={styles.shareInput}
                  required
                  placeholder="e.g., bob@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className={styles.label} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</label>
                <select
                  className={styles.shareSelect}
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as 'VIEW' | 'EDIT')}
                >
                  <option value="VIEW">View Only</option>
                  <option value="EDIT">Can Edit</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: '38px', padding: '0 16px' }}>
                Share
              </button>
            </form>

            {shareError && <div className={styles.formError} style={{ marginTop: '12px' }}>{shareError}</div>}
            {shareSuccess && <div style={{ color: 'var(--success)', fontSize: '13px', marginTop: '12px' }}>{shareSuccess}</div>}

            <div className={styles.modalButtons} style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={() => setShowShareModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
