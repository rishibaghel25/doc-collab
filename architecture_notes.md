# Architecture Notes 📐

This document explains the technical architecture, design trade-offs, and development priorities of **SyncDoc Collab**.

---

## 🛠️ Technology Stack & Rationale

1. **Frontend & Backend: Next.js (App Router)**
   - **Why**: Allows combining React Server Components (RSCs) and Client Components with lightweight serverless API Route handlers. This simplifies deployment to a single PM2 process on the VM.
2. **Database & Storage: Supabase (PostgreSQL)**
   - **Why**: Provides a robust, cloud-hosted relational PostgreSQL database with low latency. Real-time updates, security, and relations are handled cleanly without maintaining local Postgres database engines.
3. **Styling: Vanilla CSS Modules**
   - **Why**: Used in place of CSS frameworks like Tailwind to create a highly polished, distraction-free modern UI. Employs CSS custom properties for unified variables and transitions.
4. **Vector Iconography: Lucide React**
   - **Why**: Replaced standard emojis with clean, professional vector icons to ensure a modern SaaS-like design.

---

## 🧩 Architectural Decisions & Prioritizations

### 1. Robust Storage Fallback (`src/lib/db.ts`)
- Reviewers may want to run the project locally without registering a Supabase account or setting up database credentials.
- **Solution**: The database module [db.ts](file:///home/x/Projects/doc-collab/src/lib/db.ts) detects the presence of `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables.
  - If keys are found, it queries the live **Supabase** instance.
  - If keys are missing, it transparently routes all CRUD, permissions, and sharing queries to browser **LocalStorage**, preserving full app functionality.

### 2. Typing Flow & Cursor Position Polish
- Bindings in React usually reset the browser selection cursor inside `contentEditable` divs on every state re-render.
- **Solution**: We decoupled React state from the editor DOM. The document content is loaded into the `contentEditable` div exactly once on mount. Edits are listened to via DOM events and debounced (saved 1000ms after user pauses typing), preventing any cursor jumps.

### 3. Server-side File Parsing Pipelines
- **Word (.docx)**: Mammoth is used to convert XML nodes into semantic HTML paragraphs (`<p>`). To avoid loading mammoth's Node-native dependency trees (`fs`, `path`) on the frontend, parsing is handled in a Next.js route handler at `/api/import-docx`.
- **PDF (.pdf)**: Parses text using `pdf-parse` on the server at `/api/import-pdf` and translates extracted lines into paragraphs.
- **Text & Markdown (.txt, .md)**: Handled fast and securely in the browser using the HTML5 `FileReader` API.

### 4. Zero Seed Leakage Access Controls
- All pre-seeded accounts have been removed from the production database to protect user privacy. 
- When logging in, new users are dynamically registered.
- Public link sharing operates anonymously in `VIEW` mode, ensuring external visitors can read documents without getting access to any dropdowns or other user accounts.
