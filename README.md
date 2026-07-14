# SyncDoc Collab ⚡

A premium, full-stack collaborative document creation, editing, and sharing application. Built with **Next.js (App Router)**, **Vanilla CSS Modules**, and **Supabase** (with automatic LocalStorage-backed fallback for instant preview).

---

## 🚀 Key Features

1. **Document Creation & Auto-Saving**
   - Create, rename, edit, and delete documents.
   - Smooth **Auto-saving indicator** (Saving / Saved) with debounced operations.
   - Designed to avoid cursor resetting during editing.
2. **Rich Text Formatting Toolbar**
   - Supports **Bold**, *Italic*, <u>Underline</u>.
   - Vary text sizes with **H1**, **H2**, and paragraph headings.
   - Organize content using bulleted and numbered lists.
3. **Smart File Upload & Import**
   - Import content from `.txt`, `.md`, or `.docx` files by dragging and dropping them anywhere on the dashboard, or using the file picker.
   - Text/Markdown files are parsed client-side using standard APIs.
   - Word Documents (`.docx`) are parsed via a Next.js Server API using the `mammoth` engine.
4. **Simple Access Control & Sharing**
   - Track ownership and grant access to other profiles by entering their emails.
   - Assign permission levels: **Can Edit** or **View Only**.
   - Enforces read-only contentEditable screens for viewers.
5. **Seeded Profile Switcher**
   - A dropdown in the header allows you to switch between pre-seeded accounts:
     - **Alice Smith** (`alice@example.com`)
     - **Bob Jones** (`bob@example.com`)
     - **Charlie Brown** (`charlie@example.com`)
   - You can also type a custom email to dynamically provision and sign in as a new profile.

---

## 🛠️ Setup & Running

### Prerequisites
- Node.js (v18+)
- npm

### 1. Installation
Clone/navigate to the project directory and install dependencies:
```bash
npm install
```

### 2. Configure Environment Variables (Optional)
Copy the template environment file to `.env.local`:
```bash
cp .env.local.example .env.local
```
Fill in your Supabase details. If they are left empty or omitted, **the application automatically runs in Local Demo Mode (using LocalStorage)**. This guarantees the application works immediately for reviewers out of the box.

### 3. Database Migration (If using Supabase)
If you connected a live Supabase instance, run the query inside `schema.sql` in your **Supabase Dashboard SQL Editor**. This will:
- Create the `profiles`, `documents`, and `shares` tables.
- Provision Row Level Security (RLS) policies.
- Seed the 3 mock accounts.

### 4. Running the Dev Server
Launch the local server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Running Automated Tests
We use Vitest to run unit and integration tests checking the document lifecycle, sharing permission guards, and account switcher updates:
```bash
npm test
```

---

## 📐 Architecture Note & Prioritizations

* **Frictionless Mock Fallback**: Setting up a third-party service like Supabase can be tedious for reviewers. To solve this, we built a transparent database client wrapper (`src/lib/db.ts`) that checks if keys are provided. If missing, it redirects all CRUD and permission operations to `localStorage` in the browser, maintaining a 100% functional experience.
* **Server-side Word Parsing**: To avoid client-side bundling issues, missing node modules (`fs`, `path`) errors, or code bloat on the frontend, mammoth parses `.docx` files on the server using Next.js Route Handlers.
* **Typing Polish & Cursor Retention**: Standard React state triggers full page reconciliations which reset cursor selections in `contentEditable` divs. To keep edits seamless, we initialize the page once from React state and bind changes to DOM events, debouncing mutations directly to database hooks.
