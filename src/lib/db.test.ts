import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// 1. Mock the browser environment (window and localStorage)
const localStorageStore: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => localStorageStore[key] || null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    for (const key in localStorageStore) {
      delete localStorageStore[key];
    }
  },
};

beforeAll(() => {
  global.window = {} as any;
  global.localStorage = mockLocalStorage as any;
});

// Import database methods to test
import {
  getProfiles,
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  unshareDocument,
  getShares,
  updateDocumentPublicStatus
} from './db';

describe('Document Collaboration DB & Permissions Layer', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    const TEST_PROFILES = [
      { id: 'd3b07384-d113-4ef5-a50d-6d58bab2433e', email: 'alice@example.com', name: 'Alice Smith' },
      { id: '5f891b92-628b-498c-8f96-3398c8bf102f', email: 'bob@example.com', name: 'Bob Jones' },
      { id: '7c9e66ab-9cc3-4876-b6b8-204123512e02', email: 'charlie@example.com', name: 'Charlie Brown' },
    ];
    mockLocalStorage.setItem('doc_collab_profiles', JSON.stringify(TEST_PROFILES));
    mockLocalStorage.setItem('doc_collab_documents', JSON.stringify([]));
    mockLocalStorage.setItem('doc_collab_shares', JSON.stringify([]));
  });

  it('should list pre-seeded user profiles', async () => {
    const profiles = await getProfiles();
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.map(p => p.email)).toContain('alice@example.com');
    expect(profiles.map(p => p.email)).toContain('bob@example.com');
  });

  it('should support document creation and retrieval', async () => {
    const profiles = await getProfiles();
    const alice = profiles.find(p => p.email.startsWith('alice'))!;

    // Create a new document for Alice
    const doc = await createDocument('Test Doc Title', '<h1>Hello World</h1>', alice.id);
    expect(doc.title).toBe('Test Doc Title');
    expect(doc.owner_id).toBe(alice.id);

    // Retrieve documents list for Alice
    const { owned } = await getDocuments(alice.id);
    expect(owned.some(d => d.id === doc.id)).toBe(true);

    // Retrieve specific document
    const result = await getDocument(doc.id, alice.id);
    expect(result).not.toBeNull();
    expect(result!.document.title).toBe('Test Doc Title');
    expect(result!.role).toBe('OWNER');
  });

  it('should allow owners and editors to update document, but deny viewers', async () => {
    const profiles = await getProfiles();
    const alice = profiles.find(p => p.email.startsWith('alice'))!;
    const bob = profiles.find(p => p.email.startsWith('bob'))!;
    const charlie = profiles.find(p => p.email.startsWith('charlie'))!;

    // Alice creates document
    const doc = await createDocument('Alice Doc', 'Draft', alice.id);

    // Share with Bob (EDIT role)
    await shareDocument(doc.id, bob.email, 'EDIT', alice.id);

    // Share with Charlie (VIEW role)
    await shareDocument(doc.id, charlie.email, 'VIEW', alice.id);

    // Alice (Owner) updates title and content
    const updatedByAlice = await updateDocument(doc.id, 'Alice Doc (Updated)', 'New content by Alice', alice.id);
    expect(updatedByAlice.title).toBe('Alice Doc (Updated)');

    // Bob (Editor) updates title and content
    const updatedByBob = await updateDocument(doc.id, 'Bob Title Update', 'Content by Bob', bob.id);
    expect(updatedByBob.title).toBe('Bob Title Update');

    // Charlie (Viewer) tries to update title and content - should throw Error
    await expect(
      updateDocument(doc.id, 'Charlie Attempt', 'Content by Charlie', charlie.id)
    ).rejects.toThrow(/Unauthorized/);
  });

  it('should enforce document sharing and access control lists', async () => {
    const profiles = await getProfiles();
    const alice = profiles.find(p => p.email.startsWith('alice'))!;
    const bob = profiles.find(p => p.email.startsWith('bob'))!;

    // Alice creates document
    const doc = await createDocument('Secret Doc', 'Secret Content', alice.id);

    // Bob shouldn't have access yet
    const docForBobBefore = await getDocument(doc.id, bob.id);
    expect(docForBobBefore).toBeNull();

    // Share with Bob
    const share = await shareDocument(doc.id, bob.email, 'VIEW', alice.id);
    expect(share.user_id).toBe(bob.id);
    expect(share.role).toBe('VIEW');

    // Bob should now have access as VIEWER
    const docForBobAfter = await getDocument(doc.id, bob.id);
    expect(docForBobAfter).not.toBeNull();
    expect(docForBobAfter!.role).toBe('VIEW');

    // Revoke Bob's access
    await unshareDocument(share.id, alice.id);

    // Bob should no longer have access
    const docForBobFinal = await getDocument(doc.id, bob.id);
    expect(docForBobFinal).toBeNull();
  });

  it('should support link sharing and allow anyone to view public documents', async () => {
    const profiles = await getProfiles();
    const alice = profiles.find(p => p.email.startsWith('alice'))!;
    const bob = profiles.find(p => p.email.startsWith('bob'))!;

    // Alice creates document
    const doc = await createDocument('Link Share Doc', 'Content for public', alice.id);

    // Bob shouldn't have access yet
    const access1 = await getDocument(doc.id, bob.id);
    expect(access1).toBeNull();

    // Alice enables public link sharing
    await updateDocumentPublicStatus(doc.id, true, alice.id);

    // Bob should now have VIEW access to the document
    const access2 = await getDocument(doc.id, bob.id);
    expect(access2).not.toBeNull();
    expect(access2!.role).toBe('VIEW');

    // Alice disables public link sharing
    await updateDocumentPublicStatus(doc.id, false, alice.id);

    // Bob should lose access
    const access3 = await getDocument(doc.id, bob.id);
    expect(access3).toBeNull();
  });
});
