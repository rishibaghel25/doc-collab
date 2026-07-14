# Submission Details - SyncDoc Collab ⚡

This file lists exactly what is included in the submission package and how to access the live deployment.

---

## 🔗 Live Deployment URL

- **Live URL**: [http://13.127.86.221:3000](http://13.127.86.221:3000)
- **Deployment Path**: Deployed on a Debian VM under PM2 process manager (port 3000), talking to a live Supabase PostgreSQL instance.

---

## 📂 Included Deliverables

1. **Source Code**: Full React Next.js application inside `doc-collab/`.
2. **Setup Instructions**: [README.md](file:///home/x/Projects/doc-collab/README.md) containing commands to install, test, and run locally.
3. **Architecture Note**: [architecture_notes.md](file:///home/x/Projects/doc-collab/architecture_notes.md) detailing stack choices, trade-offs, and file parsers.
4. **AI Native Note**: [ai_workflow_notes.md](file:///home/x/Projects/doc-collab/ai_workflow_notes.md) detailing AI usage, verification, and rejected outputs.
5. **Database Migration Script**: [schema.sql](file:///home/x/Projects/doc-collab/schema.sql) containing SQL queries to configure the Supabase tables.
6. **Walkthrough Video**: Loom Walkthrough Link: `[Walkthrough Video Loom Link]`

---

## 👥 Reviewer / Test Credentials
To protect database privacy, **hardcoded profiles and switchers have been completely removed from public view**.

- When you open the dashboard page, you will see a **Get Started** card.
- Enter any email (e.g., `alice@example.com` or `bob@example.com`) and name to register and log in instantly.
- **To test sharing**:
  1. Register/Login as `rishi@example.com`.
  2. Create a document, click **Share**, and add `collaborator@example.com` as an Editor or Viewer.
  3. In a separate browser tab, register/login as `collaborator@example.com` to see the shared document appear in the **"Shared With Me"** dashboard list.
- **To test Link Sharing**:
  1. Open a document you own, click **Share**, and toggle **Link Sharing** on.
  2. Copy the link and open it in an **Incognito / private browser window** (logged out).
  3. You will be able to view the document anonymously as a **Guest Viewer**. No login card or account lists will be visible.

---

## 🛠️ Feature Matrix

| Feature | Status | Description |
| :--- | :--- | :--- |
| **Document CRUD** | Done | Create, rename, view, auto-save, and delete documents. |
| **Rich-Text formatting** | Done | Bold, Italic, Underline, Headings (H1/H2), Bulleted/Numbered lists. |
| **File Import** | Done | Drag-and-drop or select `.docx`, `.pdf`, `.txt`, and `.md` files. |
| **Collaborator Sharing** | Done | Share via email address with role-based access (**Can Edit** vs **View Only**). |
| **Link Sharing** | Done | Toggle public link access for anonymous guest viewing. |
| **Document Version History** | Done | **[Stretch Goal]** Click **History** to view timelines of saved snapshots, preview past contents, and restore versions. |
| **Export to MD & PDF** | Done | **[Stretch Goal]** Download clean Markdown text files or export to print-ready PDF sheets. |
| **Automated Tests** | Done | 5 Vitest tests covering CRUD, permissions, and sharing models. |

---

## ⏳ Next Steps (With 2-4 More Hours)
If given additional time, we would build:
1. **Real-time collaboration indicators**: Use WebSockets or Supabase Realtime presence channels to show active cursor locations.
2. **Commenting and suggestions**: Allow users to highlight text and leave comments.
