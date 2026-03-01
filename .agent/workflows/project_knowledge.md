---
description: GrowLouder Notion — Comprehensive Project Knowledge & Coding Conventions
---

# GrowLouder Notion — Project Knowledge

> **Read this at the start of every session** to understand the project's conventions, architecture, and feature set.

---

## 1. Project Overview

**GrowLouder Notion** is a **custom Notion-like workspace** built specifically for a **content production team** (GrowLouder). It is a full-stack Next.js web application.

### Core Purpose
- Organize content production planning using a Notion-style page editor.
- Manage **Scripts** (content scripts for Instagram Reels) with a production pipeline status.
- Assign and track **Reminders** across team members.
- Support **real-time multi-user collaboration** on the same page simultaneously.
- Provide an internal **Chat** feature for direct messaging between team members.

### Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite via Prisma 7 + `better-sqlite3` adapter |
| Auth | NextAuth v4 (credentials + JWT) |
| Rich Text Editor | TipTap 3 (ProseMirror-based) |
| Real-time Collab | Yjs CRDT + Socket.IO |
| Styling | Vanilla CSS Modules |
| ORM Config | `prisma.config.ts` (Prisma 7 style) |

---

## 2. Project Directory Structure

```
Notion/
├── collab-server.js          # Standalone Socket.IO server (port 3001)
├── prisma.config.ts          # Prisma 7 config — reads DATABASE_URL from .env
├── prisma/
│   ├── schema.prisma         # Full DB schema (NO url field — url is in prisma.config.ts)
│   └── dev.db                # SQLite database file
├── .env                      # DATABASE_URL="file:./dev.db" + NEXTAUTH_SECRET
└── src/
    ├── app/
    │   ├── api/              # REST API routes (Next.js route handlers)
    │   │   ├── auth/         # NextAuth routes + /register
    │   │   ├── pages/        # CRUD for pages + /[id]/scripts
    │   │   ├── databases/    # CRUD for inline Notion-style databases
    │   │   ├── favorites/    # Favorite pages
    │   │   ├── reminders/    # Reminder CRUD
    │   │   ├── search/       # Full-text page search
    │   │   ├── chat/         # Direct messages between users
    │   │   ├── users/        # User management (owner-only)
    │   │   └── upload/       # File/image upload
    │   ├── page/[id]/        # Page view with editor (main content page)
    │   ├── workspace/        # Workspace landing/dashboard
    │   ├── chat/             # Chat UI page
    │   ├── reminders/        # Reminders UI page
    │   ├── search/           # Search UI page
    │   ├── settings/         # Settings (profile, users, workspace)
    │   ├── login/            # Login page
    │   └── register/         # Registration page
    ├── components/
    │   ├── Sidebar/          # Left navigation sidebar
    │   ├── Topbar/           # Top bar with page actions (share, favorite)
    │   ├── Editor/           # TipTap block editor + slash commands + toolbar
    │   ├── Database/         # Inline Notion-style database table view
    │   ├── Scripts/          # Script panel for content script management
    │   ├── Collab/           # Real-time collaboration (Yjs + Socket.IO)
    │   └── Theme/            # Theme switching (Light/Dark)
    └── lib/
        ├── auth.ts           # NextAuth configuration
        ├── db.ts             # Prisma singleton (better-sqlite3 adapter)
        ├── types.ts          # Role types, permission helpers, column types
        └── i18n.tsx          # Internationalization
```

---

## 3. Authentication & Authorization

### Auth System
- **NextAuth v4** with `CredentialsProvider` (email + password).
- Passwords hashed with **bcryptjs**.
- **JWT strategy** with 30-day expiry.
- Custom session includes: `id`, `role`, `avatar`.
- Login redirects to `/login` page (`pages.signIn = '/login'`).

### Role-Based Permissions
Roles are stored per-user in the DB and exposed via JWT.

| Role | Level | Capabilities |
|---|---|---|
| `owner` | 100 | Full admin — manage users, workspace, all content |
| `manager` | 80 | Manage workspace and content |
| `content_writer` | 50 | Create/edit pages and scripts |
| `shooter` | 50 | Participate in content pipeline |
| `editor` | 50 | Edit content |
| `posting` | 50 | Posting permissions |

**Key permission helpers** (from `src/lib/types.ts`):
- `canManageUsers(role)` — only `owner`
- `canManageWorkspace(role)` — `owner` or `manager`
- `isAdmin(role)` — `owner` or `manager`
- `hasPermission(role, level)` — numeric comparison

---

## 4. Database Schema (Prisma + SQLite)

### CRITICAL: Prisma 7 Config
- The `datasource db` block in `schema.prisma` does **NOT** have a `url` field.
- The `url` is specified in `prisma.config.ts` via `process.env["DATABASE_URL"]`.
- `.env` must contain: `DATABASE_URL="file:./dev.db"`
- Run `npx prisma db push` (not `migrate`) to sync schema.

### Models

| Model | Purpose |
|---|---|
| `User` | Team member with role, avatar, email, passwordHash |
| `Session` / `Account` | NextAuth session management |
| `Workspace` | Single shared workspace (multi-workspace not implemented yet) |
| `WorkspaceMember` | User ↔ Workspace join table with role |
| `Page` | A document/page (supports self-referencing hierarchy via `parentId`) |
| `Script` | Content script attached to a Page (`pageId`) |
| `Favorite` | User ↔ Page bookmark |
| `Database` | Inline Notion-style database (attached to a Page) |
| `DatabaseRow` | Row in a Database (stores properties as JSON) |
| `Reminder` | Task/reminder assigned to a user with deadline and status |
| `ChatMessage` | Direct message between sender and receiver |
| `Comment` | Comment on a Page |
| `ActivityLog` | Audit log of actions on pages |

### Page Hierarchy
- Pages support **infinite nesting** via `parentId` self-relation.
- Root pages have `parentId = null`.
- Sidebar fetches root pages first, then lazy-loads children on expand.

---

## 5. Feature Modules

### 5.1 Block Editor (TipTap)
**File:** `src/components/Editor/BlockEditor.tsx`

A full Notion-like rich text editor powered by TipTap 3 (ProseMirror).

**Supported block types (via `/` Slash Commands):**
- Paragraph, Heading 1/2/3
- Bullet List, Ordered List, Task List (checkboxes)
- Blockquote / Callout
- Code Block (syntax-highlighted via `lowlight`)
- Horizontal Divider
- Inline Database (triggers `onCreateDatabase` callback)
- Script Panel (triggers `onCreateScriptPanel` callback)

**Features:**
- Floating `BubbleMenu` toolbar appears on text selection (bold, italic, underline, links, alignment).
- Slash command menu (`SlashCommandMenu`) floats at cursor position when `/` is typed.
- Debounced auto-save (500ms) on content change via `onChange` callback.
- Content stored as **TipTap JSON** (stringified) in the `Page.content` DB field.

### 5.2 Real-Time Collaboration (Yjs + Socket.IO)
**Files:** `src/components/Collab/CollabProvider.tsx`, `collab-server.js`

**Architecture:**
- **`collab-server.js`**: A standalone Node.js WebSocket server on **port 3001**. Must be run separately: `npm run collab` (i.e., `node collab-server.js`).
- **`CollabProvider`**: React context that wraps each page. Connects to port 3001 via Socket.IO.

**Protocol:**
1. On page open → client connects to port 3001, emits `join-doc` with `docName: "page-{id}"`, username, and random color.
2. Server sends full `doc-state` (current Yjs document).
3. Any local Yjs update → encoded as base64 → sent via `doc-update` event.
4. Server applies update to its in-memory Yjs doc, broadcasts to all other clients.
5. `CollabIndicator` shows which users are currently on the page.

⚠️ **Note:** Yjs doc state is kept **in memory** on the collab server. If the server restarts, collab state resets (but pages are saved to SQLite via the regular API).

### 5.3 Scripts Feature (Content Pipeline)
**File:** `src/components/Scripts/ScriptPanel.tsx`

**Domain purpose:** Manage Instagram Reel scripts for a content production team.

**Script fields:**
- `scriptNumber` — auto-incremented per page
- `title` — name of the script
- `reelLink` — Instagram Reel URL (once posted)
- `content` — raw text content of the script
- `status` — workflow stage
- `assigneeId` — team member assigned

**Script Status Workflow:**
```
draft → shoot_pending → shoot_done → editing → approved → posted
```

**UI:** A panel below the page content that shows a list of scripts with status badges. Clicking a script expands an inline editor.

**API:** `GET/POST /api/pages/[id]/scripts`, `PATCH/DELETE /api/pages/[id]/scripts/[scriptId]`

### 5.4 Inline Databases (Notion-Style)
**Files:** `src/components/Database/InlineDatabaseBlock.tsx`, `src/components/Database/DatabaseTableView.tsx`

- Each Page can have **multiple inline databases**.
- Databases have a **schema** (column definitions stored as JSON) and **rows** (properties stored as JSON).
- Supports column types: `text`, `number`, `select`, `multi_select`, `date`, `checkbox`, `url`, `email`, `phone`, `person`, `file`, `status`, `rich_text`.
- View types supported by schema: `table`, `kanban`, `calendar`, `gallery` (table is primary).

### 5.5 Sidebar
**File:** `src/components/Sidebar/Sidebar.tsx`

- Shows **Favorites** section (pinned pages) and **Pages** section (tree navigation).
- Supports **lazy-loading** of child pages on expand.
- Quick nav links: Search, Settings, Reminders, Chat.
- Footer shows: user name, role label, sign-out button.
- Collapsible (collapses fully).

### 5.6 Reminders
**File:** `src/app/reminders/page.tsx`

- Team reminders/tasks with `endDate`, `status`, assignee, and creator.
- Statuses: `pending`, `in_progress`, `completed`, `overdue`.
- Supports **re-assignment chain** (`parentId`) for tracking who delegated to whom.
- `reminderSent` and `halfTimeSent` flags for notification tracking.

### 5.7 Chat
**File:** `src/app/chat/page.tsx`

- Internal direct messaging between team members.
- Supports text messages and media (image/video/file) via `mediaUrl` and `mediaType`.
- Read/unread tracking (`isRead` field).

### 5.8 Search
- Full-text search across all pages in the workspace.
- **API:** `GET /api/search?q=...`

### 5.9 Settings
**File:** `src/app/settings/page.tsx`

- Profile settings (name, avatar, password change).
- User management (owner-only: invite/deactivate users, change roles).
- Workspace settings.

---

## 6. API Routes Reference

| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/pages` | List workspace pages / create page |
| GET/PATCH/DELETE | `/api/pages/[id]` | Get/update/delete a page |
| GET/POST | `/api/pages/[id]/scripts` | List/create scripts for a page |
| PATCH/DELETE | `/api/pages/[id]/scripts/[scriptId]` | Update/delete a script |
| GET/POST | `/api/databases` | List/create databases |
| GET/PATCH/DELETE | `/api/databases/[id]` | Get/update/delete a database |
| GET/POST | `/api/favorites` | List favorites / add favorite |
| DELETE | `/api/favorites/[id]` | Remove favorite |
| GET/POST | `/api/reminders` | List/create reminders |
| PATCH/DELETE | `/api/reminders/[id]` | Update/delete reminder |
| GET/POST | `/api/chat` | List messages / send message |
| GET | `/api/search` | Search pages by title/content |
| GET/PATCH | `/api/users` | List users (admin) / update profile |
| POST | `/api/upload` | File/image upload |
| POST | `/api/auth/register` | Register new user |

---

## 7. Running the Project

### Required Environment (`.env`)
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### Start Commands
```bash
# 1. Install dependencies (use legacy-peer-deps due to React 19 conflicts)
npm install --legacy-peer-deps

# 2. Generate Prisma client
npx prisma generate

# 3. Push schema to database
npx prisma db push

# 4. Start Next.js dev server (port 3000)
npm run dev

# 5. Start collaboration server (port 3001) — OPTIONAL, needed for real-time collab
npm run collab
```

| Service | Port | Command |
|---|---|---|
| Next.js App | 3000 | `npm run dev` |
| Collab WebSocket | 3001 | `npm run collab` |

---

## 8. Coding Conventions

### Component Style
- All components use **vanilla CSS Modules** (`.module.css`) or plain `.css` files imported directly.
- CSS variables for theming: `var(--text-primary)`, `var(--bg-hover)`, `var(--accent-blue)`, etc.
- Icons from **lucide-react**.

### Data Fetching
- All data fetching via `fetch('/api/...')` from client components.
- API routes use `getServerSession(authOptions)` for server-side auth checks.
- Debounced saves: title save = 500ms, script content = 400ms.

### State Management
- No global state manager (no Redux/Zustand). Uses React `useState`/`useContext`.
- `CollabContext` is the only shared context.

### Dynamic Imports
- Heavy components (`BlockEditor`, `InlineDatabaseBlock`, `ScriptPanel`, `CollabProvider`) are loaded with `next/dynamic` + `ssr: false` to avoid SSR issues.

### Prisma 7 Pattern
- **NEVER add `url` to `datasource db` in `schema.prisma`** — it's set in `prisma.config.ts`.
- Always use `npx prisma db push` (not `migrate dev`) for schema changes in development.
- Re-run `npx prisma generate` after schema changes to update the client.

---

## 9. Key Business-Domain Notes

- This tool is built for **GrowLouder's content team** (not a general-purpose Notion clone).
- The **Scripts** feature is the most domain-specific: it tracks Instagram Reel content from script → shoot → edit → post.
- The **Reminder** system is for assigning tasks between team members (owner/manager delegates to content_writer/shooter/editor/posting).
- Collaboration is **per-page**: each `/page/[id]` URL creates its own Yjs document room.
- The app is **single-workspace** by design — all users share one workspace in the DB.

---

## 10. Phase 4 — Chat, DMs, Notifications, Cooldowns

### Architecture
- **Group Chat** (`/api/chat/group`): All workspace members can post to a common room, powered by Socket.IO rooms.
- **Direct Messages** (`/api/chat/dm/[userId]`): 1-to-1 DMs between users.
- **Chat UI** (`src/components/Chat/ChatSidebarPanel.tsx`): Slide-in panel supporting collapsed, expanded, and full-screen states.

### Key Components
| Component | Location | Purpose |
|---|---|---|
| `ChatSidebarPanel` | `src/components/Chat/` | Container — manages collapsed/expanded/fullscreen state |
| `GroupChatPanel` | `src/components/Chat/` | Group chat room UI |
| `DMPanel` | `src/components/Chat/` | 1-to-1 DM thread UI |
| `MessageBubble` | `src/components/Chat/` | Single message with reply preview, media, @mention highlights |
| `MentionAutocomplete` | `src/components/Chat/` | @mention dropdown triggered by `@` key in input |
| `CooldownModal` | `src/components/Chat/` | Shown when user hits rate-limit |
| `NotificationBell` | `src/components/Notifications/` | Topbar bell with unread count badge and dropdown |

### Socket.IO Events (collab-server.js)
| Event | Direction | Description |
|---|---|---|
| `group-message` | client → server → room | Broadcast group chat message |
| `dm-message` | client → server → user | Send DM to a specific user |
| `notification` | server → client | Push an in-app notification |
| `typing` | client → server → room | Show typing indicator |
| `block-lock` / `block-unlock` | client → server → room | Per-block editing lock for collab |

### @Mention Pattern
- User types `@` in chat input → `MentionAutocomplete` opens with filtered user list.
- Selected user's name is embedded in text and their `userId` is stored in `ChatMessage.mentions` (comma-separated string).
- Server reads the mentions and emits `notification` events to those users.

### Cooldown System
- `UserCooldown` model stores last message timestamp per user.
- API enforces a configurable cooldown window (default 30 seconds).
- On violation, `CooldownModal` shows remaining time.

---

## 11. Phase 5 — Task Assignment, TopBar Chips, Deadline Notifications

### Extended Reminder Model
The `Reminder` model was significantly upgraded:
```prisma
model Reminder {
  description    String?
  assignerId     String?
  reviewStatus   String?   // "pending_review" | "approved" | "changes_requested"
  notif1Sent     Boolean  @default(false)  // 24h before deadline
  notif2Sent     Boolean  @default(false)  // 6h before
  notif3Sent     Boolean  @default(false)  // 1h before
}
```

### Task Flow
1. Any user can **assign a task** to another user via the Reminders page.
2. Assignee sees a **colored chip** in the TaskBar (in the Topbar).
3. Assignee opens `TaskDetailModal` to view the task description, due date, and take action.
4. Assignee can click **Mark Complete** → task goes to `pending_review` for assigner.
5. Assigner reviews and can **Approve** or **Request Changes**.
6. On approval, task status becomes `completed`.

### Urgency Color Coding (TaskBar)
| Urgency | Condition | Color |
|---|---|---|
| Overdue | Past deadline | Red (`#ef4444`) |
| Critical | < 6 hours | Orange (`#f97316`) |
| Warning | < 24 hours | Yellow (`#eab308`) |
| Normal | > 24 hours | Blue (`#3b82f6`) |

### Key Components
| Component | Location | Purpose |
|---|---|---|
| `TaskBar` | `src/components/Topbar/TaskBar.tsx` | Horizontal scrolling chip row below Topbar |
| `TaskDetailModal` | `src/components/Topbar/TaskDetailModal.tsx` | Task details, actions, review UI |
| `TopbarContainer` | styled via `TopbarContainer.module.css` | Sticky wrapper for Topbar + TaskBar |

### Cron Job — Deadline Notifications
- Runs every **5 minutes** inside `collab-server.js` using `node-cron`.
- Queries all `pending`/`in_progress` tasks with upcoming deadlines.
- Emits Socket.IO `notification` events at: 24h, 6h, and 1h before deadline.
- Uses `notif1Sent`, `notif2Sent`, `notif3Sent` flags to prevent duplicate notifications.

---

## 12. Phase 6 — Polish, Calendar, Search, and Final Integration

### Global Search Modal (Ctrl+K)
- **Component:** `src/components/Sidebar/SearchModal.tsx`
- Keyboard shortcut `Ctrl+K` (or `Cmd+K`) triggers an overlay command palette.
- Searches pages in real time as user types.
- Styled like a Spotlight / VS Code command palette experience.
- Listener added in `Sidebar.tsx` via `useEffect`.

### Slash Commands in Script Editor (Ctrl+/)
- **File:** `src/components/Scripts/TipTapScriptEditor.tsx`
- The `SlashCommandMenu` from `BlockEditor` is also mounted in the Script TipTap editor.
- `Ctrl+/` keyboard shortcut triggers the slash command menu programmatically.
- Commands: Heading 1/2/3, Bullet List, Ordered List, Blockquote, etc.

### Loading Skeletons
- **Component:** `src/components/Skeleton/PageLoadingSkeleton.tsx`
- Replaces bare `<div>Loading...</div>` in `workspace/page.tsx` and `page/[id]/page.tsx`.
- Shows a full sidebar + topbar + animated pulsing content skeleton during initial data fetch.

### Client Calendar Enhancements
- **Column Visibility Toggle** (manager/owner only):
  - A `⚙ Columns` button appears in the calendar header for managers/owners.
  - Clicking opens a dropdown menu with checkboxes for each column.
  - Visibility preferences are saved to `Client.settings` JSON field via `PATCH /api/clients/[clientId]`.
  - Loaded on next page visit from the saved `settings.columnVisibility` object.
- **Social Media Column:**
  - A disabled `Instagram` button renders in each row's "Socials" cell.
  - Hovering shows a tooltip: "Coming in v2".

### Reusable UI Components (`src/components/UI/`)
| Component | Props | Purpose |
|---|---|---|
| `ConfirmModal` | title, message, onConfirm, onCancel, isDestructive? | Generic confirmation /delete dialog |
| `StatusBadge` | status, label, color, bg | Styled inline status chip |
| `AvatarPill` | name, avatar?, size? (sm/md/lg) | User avatar + name pill |

### Environment Setup (`.env.example`)
- Created `.env.example` in project root documenting all required environment variables.
- Includes step-by-step instructions for activating Google Docs / Drive API credentials.
- Key new variables:
  - `GOOGLE_CLIENT_EMAIL` — Service account email
  - `GOOGLE_PRIVATE_KEY` — Service account RSA key
  - `NEXT_PUBLIC_COLLAB_SERVER_URL` — URL for collab server

---

## 13. Component Import Quick Reference

```typescript
// Reusable UI
import ConfirmModal from '@/components/UI/ConfirmModal';
import StatusBadge from '@/components/UI/StatusBadge';
import AvatarPill from '@/components/UI/AvatarPill';
import PageLoadingSkeleton from '@/components/Skeleton/PageLoadingSkeleton';

// Task / Topbar
import TaskBar from '@/components/Topbar/TaskBar';
import TaskDetailModal from '@/components/Topbar/TaskDetailModal';

// Calendar
import ClientCalendarView from '@/components/Calendar/ClientCalendarView';
import PopupPreview from '@/components/Calendar/PopupPreview';

// Chat
import ChatSidebarPanel from '@/components/Chat/ChatSidebarPanel';
import NotificationBell from '@/components/Notifications/NotificationBell';

// Scripts
import TipTapScriptEditor from '@/components/Scripts/TipTapScriptEditor';
import ScriptPageView from '@/components/Scripts/ScriptPageView';

// Search
import SearchModal from '@/components/Sidebar/SearchModal';
```
