import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if Supabase keys are configured and not placeholders
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseUrl.trim() !== ''
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// Interfaces
export interface Profile {
  id: string;
  email: string;
  name: string;
  password_hash?: string;
  created_at?: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  is_public?: boolean;
  created_at: string;
  updated_at: string;
  owner?: Profile;
}

export interface Share {
  id: string;
  document_id: string;
  user_id: string;
  role: 'VIEW' | 'EDIT';
  created_at?: string;
  user?: Profile;
  document?: Document;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
  title: string;
  created_by: string;
  created_at: string;
  creator?: Profile;
}

// Seed Data for Mock Mode (Empty by default for privacy)
const SEED_PROFILES: Profile[] = [];
const SEED_DOCUMENTS: Document[] = [];
const SEED_SHARES: Share[] = [];

// RFC 4122 v4 UUID — works on HTTP and HTTPS, no native crypto.randomUUID needed
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  // Polyfill using Math.random (good enough for client-side IDs)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to initialize LocalStorage if empty
function initMockStorage() {
  if (typeof window === 'undefined') return;
  
  if (!localStorage.getItem('doc_collab_profiles')) {
    localStorage.setItem('doc_collab_profiles', JSON.stringify(SEED_PROFILES));
  }
  if (!localStorage.getItem('doc_collab_documents')) {
    localStorage.setItem('doc_collab_documents', JSON.stringify(SEED_DOCUMENTS));
  }
  if (!localStorage.getItem('doc_collab_shares')) {
    localStorage.setItem('doc_collab_shares', JSON.stringify(SEED_SHARES));
  }
}

// -------------------------------------------------------------
// Database Operations (Transparently switching Supabase / Mock)
// -------------------------------------------------------------

export async function getProfiles(): Promise<Profile[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Supabase getProfiles error:', error);
      throw error;
    }
    return data || [];
  } else {
    initMockStorage();
    const profilesJson = localStorage.getItem('doc_collab_profiles');
    return profilesJson ? JSON.parse(profilesJson) : [];
  }
}

export async function getDocuments(userId: string): Promise<{ owned: Document[]; shared: Document[] }> {
  if (isSupabaseConfigured && supabase) {
    // Fetch owned documents
    const { data: owned, error: ownedError } = await supabase
      .from('documents')
      .select('*, owner:profiles!documents_owner_id_fkey(*)')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });
    
    if (ownedError) {
      console.error('Supabase getDocuments (owned) error:', ownedError);
      throw ownedError;
    }

    // Fetch shared documents
    const { data: sharedRelations, error: sharedError } = await supabase
      .from('shares')
      .select('role, document:documents(*, owner:profiles!documents_owner_id_fkey(*))')
      .eq('user_id', userId);
    
    if (sharedError) {
      console.error('Supabase getDocuments (shared) error:', sharedError);
      throw sharedError;
    }

    const sharedDocs: Document[] = (sharedRelations || [])
      .map((r: any) => r.document)
      .filter((d: any) => d !== null);

    return {
      owned: owned || [],
      shared: sharedDocs,
    };
  } else {
    initMockStorage();
    const docsJson = localStorage.getItem('doc_collab_documents') || '[]';
    const sharesJson = localStorage.getItem('doc_collab_shares') || '[]';
    const profilesJson = localStorage.getItem('doc_collab_profiles') || '[]';
    
    const docs: Document[] = JSON.parse(docsJson);
    const shares: Share[] = JSON.parse(sharesJson);
    const profiles: Profile[] = JSON.parse(profilesJson);

    const findOwner = (ownerId: string) => profiles.find(p => p.id === ownerId);

    const owned = docs
      .filter(d => d.owner_id === userId)
      .map(d => ({ ...d, owner: findOwner(d.owner_id) }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const sharedDocIds = shares.filter(s => s.user_id === userId).map(s => s.document_id);
    const shared = docs
      .filter(d => sharedDocIds.includes(d.id))
      .map(d => ({ ...d, owner: findOwner(d.owner_id) }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return { owned, shared };
  }
}

export async function getDocument(docId: string, userId: string): Promise<{ document: Document; role: 'OWNER' | 'EDIT' | 'VIEW' } | null> {
  if (isSupabaseConfigured && supabase) {
    // Get document detail
    const { data: doc, error } = await supabase
      .from('documents')
      .select('*, owner:profiles!documents_owner_id_fkey(*)')
      .eq('id', docId)
      .single();
    
    if (error || !doc) return null;

    if (doc.owner_id === userId) {
      return { document: doc, role: 'OWNER' };
    }

    // Check sharing permissions
    const { data: share, error: shareError } = await supabase
      .from('shares')
      .select('role')
      .eq('document_id', docId)
      .eq('user_id', userId)
      .single();
    
    if (share && !shareError) {
      return { document: doc, role: share.role as 'EDIT' | 'VIEW' };
    }

    // Fallback check for link sharing public documents
    if (doc.is_public) {
      return { document: doc, role: 'VIEW' };
    }

    return null; // Access denied
  } else {
    initMockStorage();
    const docs: Document[] = JSON.parse(localStorage.getItem('doc_collab_documents') || '[]');
    const shares: Share[] = JSON.parse(localStorage.getItem('doc_collab_shares') || '[]');
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');

    const doc = docs.find(d => d.id === docId);
    if (!doc) return null;

    doc.owner = profiles.find(p => p.id === doc.owner_id);

    if (doc.owner_id === userId) {
      return { document: doc, role: 'OWNER' };
    }

    const share = shares.find(s => s.document_id === docId && s.user_id === userId);
    if (share) {
      return { document: doc, role: share.role };
    }

    if (doc.is_public) {
      return { document: doc, role: 'VIEW' };
    }

    return null; // Access denied
  }
}

export async function createDocument(title: string, content: string, ownerId: string): Promise<Document> {
  const newId = generateUUID();
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    // Let Supabase generate the UUID server-side via DEFAULT gen_random_uuid()
    const { data, error } = await supabase
      .from('documents')
      .insert({
        title,
        content,
        owner_id: ownerId,
        is_public: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase createDocument error:', error);
      throw error;
    }
    return data;
  } else {
    initMockStorage();
    const docs: Document[] = JSON.parse(localStorage.getItem('doc_collab_documents') || '[]');
    const newDoc: Document = {
      id: newId,
      title,
      content,
      owner_id: ownerId,
      is_public: false,
      created_at: now,
      updated_at: now,
    };
    docs.push(newDoc);
    localStorage.setItem('doc_collab_documents', JSON.stringify(docs));
    return newDoc;
  }
}

export async function updateDocument(docId: string, title: string, content: string, userId: string): Promise<Document> {
  // First verify write access
  const access = await getDocument(docId, userId);
  if (!access || (access.role !== 'OWNER' && access.role !== 'EDIT')) {
    throw new Error('Unauthorized: You do not have edit permission for this document.');
  }

  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        title,
        content,
        updated_at: now,
      })
      .eq('id', docId)
      .select()
      .single();

    if (error) {
      console.error('Supabase updateDocument error:', error);
      throw error;
    }
    return data;
  } else {
    initMockStorage();
    const docs: Document[] = JSON.parse(localStorage.getItem('doc_collab_documents') || '[]');
    const docIdx = docs.findIndex(d => d.id === docId);
    if (docIdx === -1) throw new Error('Document not found');

    const updatedDoc: Document = {
      ...docs[docIdx],
      title,
      content,
      updated_at: now,
    };
    docs[docIdx] = updatedDoc;
    localStorage.setItem('doc_collab_documents', JSON.stringify(docs));
    return updatedDoc;
  }
}

export async function deleteDocument(docId: string, userId: string): Promise<void> {
  const access = await getDocument(docId, userId);
  if (!access || access.role !== 'OWNER') {
    throw new Error('Unauthorized: Only the document owner can delete this document.');
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (error) {
      console.error('Supabase deleteDocument error:', error);
      throw error;
    }
  } else {
    initMockStorage();
    // Delete document
    const docs: Document[] = JSON.parse(localStorage.getItem('doc_collab_documents') || '[]');
    const filteredDocs = docs.filter(d => d.id !== docId);
    localStorage.setItem('doc_collab_documents', JSON.stringify(filteredDocs));

    // Cascade delete shares
    const shares: Share[] = JSON.parse(localStorage.getItem('doc_collab_shares') || '[]');
    const filteredShares = shares.filter(s => s.document_id !== docId);
    localStorage.setItem('doc_collab_shares', JSON.stringify(filteredShares));
  }
}

export async function getShares(docId: string, userId: string): Promise<Share[]> {
  const access = await getDocument(docId, userId);
  if (!access) {
    throw new Error('Unauthorized: You do not have access to view shares.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('shares')
      .select('*, user:profiles!shares_user_id_fkey(*)')
      .eq('document_id', docId);

    if (error) {
      console.error('Supabase getShares error:', error);
      throw error;
    }
    return data || [];
  } else {
    initMockStorage();
    const shares: Share[] = JSON.parse(localStorage.getItem('doc_collab_shares') || '[]');
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    
    return shares
      .filter(s => s.document_id === docId)
      .map(s => ({
        ...s,
        user: profiles.find(p => p.id === s.user_id),
      }));
  }
}

export async function shareDocument(docId: string, email: string, role: 'VIEW' | 'EDIT', ownerId: string): Promise<Share> {
  const access = await getDocument(docId, ownerId);
  if (!access || access.role !== 'OWNER') {
    throw new Error('Unauthorized: Only the document owner can share it.');
  }

  let targetUser: Profile | null = null;

  // Resolve user by email
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !data) {
      throw new Error(`User with email "${email}" not found. Please ask them to log in once first.`);
    }
    targetUser = data;
  } else {
    initMockStorage();
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    const found = profiles.find(p => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) {
      throw new Error(`User with email "${email}" not found. Seeded emails are: alice@example.com, bob@example.com, charlie@example.com`);
    }
    targetUser = found;
  }

  if (!targetUser) {
    throw new Error('User not found.');
  }

  if (targetUser.id === ownerId) {
    throw new Error('You cannot share a document with yourself.');
  }

  const newId = generateUUID();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('shares')
      .upsert({
        document_id: docId,
        user_id: targetUser.id,
        role,
      }, { onConflict: 'document_id,user_id' })
      .select('*, user:profiles!shares_user_id_fkey(*)')
      .single();

    if (error) {
      console.error('Supabase shareDocument error:', error);
      throw error;
    }
    return data;
  } else {
    initMockStorage();
    const shares: Share[] = JSON.parse(localStorage.getItem('doc_collab_shares') || '[]');
    
    // Remove existing share if any (upsert simulation)
    const filteredShares = shares.filter(s => !(s.document_id === docId && s.user_id === targetUser!.id));
    
    const newShare: Share = {
      id: newId,
      document_id: docId,
      user_id: targetUser.id,
      role,
      user: targetUser,
    };
    
    filteredShares.push(newShare);
    localStorage.setItem('doc_collab_shares', JSON.stringify(filteredShares));
    return newShare;
  }
}

export async function unshareDocument(shareId: string, ownerId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    // Fetch share to check owner permissions
    const { data: share, error: fetchError } = await supabase
      .from('shares')
      .select('document_id, user_id, document:documents(owner_id)')
      .eq('id', shareId)
      .single();
    
    if (fetchError || !share) {
      throw new Error('Share relation not found.');
    }

    const docOwnerId = (share.document as any)?.owner_id;

    // Only owner or the shared user themselves can delete/revoke the share
    if (docOwnerId !== ownerId && share.user_id !== ownerId) {
      throw new Error('Unauthorized: You cannot modify this share relationship.');
    }

    const { error } = await supabase
      .from('shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      console.error('Supabase unshareDocument error:', error);
      throw error;
    }
  } else {
    initMockStorage();
    const shares: Share[] = JSON.parse(localStorage.getItem('doc_collab_shares') || '[]');
    const docs: Document[] = JSON.parse(localStorage.getItem('doc_collab_documents') || '[]');
    
    const shareIdx = shares.findIndex(s => s.id === shareId);
    if (shareIdx === -1) throw new Error('Share relation not found');

    const share = shares[shareIdx];
    const doc = docs.find(d => d.id === share.document_id);
    const docOwnerId = doc?.owner_id;

    if (docOwnerId !== ownerId && share.user_id !== ownerId) {
      throw new Error('Unauthorized: You cannot modify this share relationship.');
    }

    shares.splice(shareIdx, 1);
    localStorage.setItem('doc_collab_shares', JSON.stringify(shares));
  }
}

// ─── Pure-JS SHA-256 (works on HTTP and HTTPS, no native crypto needed) ──────
// Based on the FIPS 180-4 specification.
function sha256(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = str.length * 8;

  // Initial hash values (first 32 bits of fractional parts of sqrt of first 8 primes)
  let hash = sha256.h = sha256.h || [];
  // Round constants (first 32 bits of fractional parts of cbrt of first 64 primes)
  const k = sha256.k = sha256.k || [];
  let primeCounter = k.length;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter < 8 ? primeCounter : 0] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  str += '\x80'; // Append bit '1' to message
  while (str.length % 64 - 56) str += '\x00'; // Pad with zeros
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    if (j >> 8) return ''; // Non-ASCII character: bail
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }
    hash = hash.map((val, i) => (val + oldHash[i]) | 0);
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}
// Memoised state for sha256
sha256.h = [] as number[];
sha256.k = [] as number[];

async function hashPassword(password: string): Promise<string> {
  // Prefer native crypto.subtle when available (HTTPS / localhost)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // fall through to pure-JS implementation
    }
  }
  // Fallback: pure-JS SHA-256 (works on plain HTTP)
  return sha256(password);
}

// ─── Sign In (existing user, password required) ───────────────────────────────
export async function signIn(email: string, password: string): Promise<Profile> {
  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  if (isSupabaseConfigured && supabase) {
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      throw new Error('No account found with that email. Please register first.');
    }

    const user = rows[0];
    // If password_hash column doesn't exist yet (migration not run), fall through
    if (user.password_hash && user.password_hash !== passwordHash) {
      throw new Error('Incorrect password. Please try again.');
    }
    return user as Profile;
  } else {
    initMockStorage();
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    const user = profiles.find(p => p.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('No account found with that email. Please register first.');
    }
    if (user.password_hash && user.password_hash !== passwordHash) {
      throw new Error('Incorrect password. Please try again.');
    }
    return user;
  }
}

// ─── Sign Up (new user registration with password) ───────────────────────────
export async function signUp(email: string, name: string, password: string): Promise<Profile> {
  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  if (isSupabaseConfigured && supabase) {
    // Check for existing account
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail);

    if (existing && existing.length > 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase signUp error:', error);
      throw error;
    }
    return data as Profile;
  } else {
    initMockStorage();
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    if (profiles.find(p => p.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    const newProfile: Profile = {
      id: generateUUID(),
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      password_hash: passwordHash,
    };
    profiles.push(newProfile);
    localStorage.setItem('doc_collab_profiles', JSON.stringify(profiles));
    return newProfile;
  }
}

// ─── Legacy: kept for internal use (public link anon login, etc.) ─────────────
export async function loginOrRegister(email: string, name: string): Promise<Profile> {
  const cleanEmail = email.trim().toLowerCase();
  if (isSupabaseConfigured && supabase) {
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail);
    
    if (existing && existing.length > 0) {
      return existing[0];
    }
    
    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert({
        email: cleanEmail,
        name: name || email.split('@')[0],
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Supabase loginOrRegister error:', insertError);
      throw insertError;
    }
    return data;
  } else {
    initMockStorage();
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    const existing = profiles.find(p => p.email.toLowerCase() === cleanEmail);
    if (existing) return existing;

    const newProfile: Profile = {
      id: generateUUID(),
      email: cleanEmail,
      name: name || email.split('@')[0],
    };
    profiles.push(newProfile);
    localStorage.setItem('doc_collab_profiles', JSON.stringify(profiles));
    return newProfile;
  }
}

export async function updateDocumentPublicStatus(docId: string, isPublic: boolean, userId: string): Promise<Document> {
  const access = await getDocument(docId, userId);
  if (!access || access.role !== 'OWNER') {
    throw new Error('Unauthorized: Only the document owner can change link sharing settings.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('documents')
      .update({ is_public: isPublic })
      .eq('id', docId)
      .select()
      .single();

    if (error) {
      console.error('Supabase updateDocumentPublicStatus error:', error);
      throw error;
    }
    return data;
  } else {
    initMockStorage();
    const docs: Document[] = JSON.parse(localStorage.getItem('doc_collab_documents') || '[]');
    const idx = docs.findIndex(d => d.id === docId);
    if (idx !== -1) {
      docs[idx].is_public = isPublic;
      localStorage.setItem('doc_collab_documents', JSON.stringify(docs));
      return docs[idx];
    }
    throw new Error('Document not found');
  }
}

export async function createDocumentVersion(docId: string, title: string, content: string, userId: string): Promise<DocumentVersion> {
  const access = await getDocument(docId, userId);
  if (!access || access.role === 'VIEW') {
    throw new Error('Unauthorized: Only editors and owners can save document versions.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('document_versions')
      .insert({
        document_id: docId,
        title,
        content,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase createDocumentVersion error:', error);
      throw error;
    }
    return data;
  } else {
    initMockStorage();
    const versions: DocumentVersion[] = JSON.parse(localStorage.getItem('doc_collab_versions') || '[]');
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    const creator = profiles.find(p => p.id === userId);

    const newVersion: DocumentVersion = {
      id: generateUUID(),
      document_id: docId,
      title,
      content,
      created_by: userId,
      created_at: new Date().toISOString(),
      creator: creator
    };

    versions.push(newVersion);
    localStorage.setItem('doc_collab_versions', JSON.stringify(versions));
    return newVersion;
  }
}

export async function getDocumentVersions(docId: string, userId: string): Promise<DocumentVersion[]> {
  const access = await getDocument(docId, userId);
  if (!access) {
    throw new Error('Unauthorized access.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*, creator:profiles(*)')
      .eq('document_id', docId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getDocumentVersions error:', error);
      throw error;
    }
    return data || [];
  } else {
    initMockStorage();
    const versions: DocumentVersion[] = JSON.parse(localStorage.getItem('doc_collab_versions') || '[]');
    const docVersions = versions.filter(v => v.document_id === docId);
    
    docVersions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const profiles: Profile[] = JSON.parse(localStorage.getItem('doc_collab_profiles') || '[]');
    docVersions.forEach(v => {
      v.creator = profiles.find(p => p.id === v.created_by);
    });
    
    return docVersions;
  }
}
