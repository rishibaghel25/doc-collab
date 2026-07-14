# AI-Native Workflow Notes 🤖

This document outlines how AI was utilized during the planning, implementation, and verification phases of **SyncDoc Collab**.

---

## 🛠️ AI Tools Utilized

- **Gemini 3.5 Flash**: Used as the core pair-programming assistant for code generation, architectural analysis, refactoring, and command-line execution.

---

## ⚡ Acceleration Points

AI materially accelerated development in the following areas:
1. **Database Schema Design**: Bootstrapped the initial Prisma and PostgreSQL table structures (`profiles`, `documents`, `shares`) with optimal relationship mappings.
2. **Integration Test Suite**: Generated the boilerplate structure for the Vitest test cases, including mock environments for the browser's `localStorage` and `window` objects.
3. **Vanilla CSS Design tokens**: Structured the global variables, gradients, and custom scrollbar styles inside `globals.css` quickly.

---

## 🚫 AI Output Changed or Rejected

Several AI-generated code paths were altered or rejected to maintain engineering standards and meet production requirements:
1. **Removal of Mock User Seeds**: Initial proposals recommended hardcoding seeded accounts (Alice, Bob, Charlie) in production. This was rejected because anyone opening a shared link could hijack these accounts via the header switcher. They were removed from the database and the UI dropdown was disabled.
2. **React Hydration / contentEditable Race Condition**: The initial generated React code populated the `contentEditable` element inside the database fetch callback. Because the component was still returning the loading state, the DOM element was null on mount, resulting in blank documents on reload. This was refactored to watch the `fetching` state and inject HTML exactly when the DOM mounts.
3. **pdf-parse ESM Compilation**: The AI initially generated default imports for `pdf-parse` (`import pdf from 'pdf-parse'`), which failed Next.js ESM compilation. It was updated to import named classes (`import { PDFParse } from 'pdf-parse'`) and cast private methods to `any` to satisfy the TypeScript compiler.

---

## 🧪 Verification & Reliability

To ensure correctness and reliability under pressure:
- **Automated Verification**: Configured Vitest to run 5 integration tests covering CRUD, permission roles (Viewer vs Editor), and public Link sharing.
- **Build Checks**: Ran `npm run build` locally and on the remote VM to verify compilation and static-page generation.
- **Production VM Deployment**: Installed the project on a Debian VM, ran it persistently under PM2 on port 3000, and verified localhost routing.
