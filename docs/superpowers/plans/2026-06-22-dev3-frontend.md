# DEV 3 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all authenticated pages, layouts, and UI components for the Job Hunt Email Intelligence app — the app shell, dashboard, application detail view, onboarding wizard, and settings page.

**Architecture:** Next.js App Router with an `(app)` route group for authenticated pages. Server Components (async functions) handle initial data fetch and auth redirect. Client Components handle interactivity and Realtime subscriptions. `SupabaseProvider` and `RealtimeProvider` are already scaffolded — compose them in the app shell layout. The dashboard subscribes to Realtime at the component level so it owns its own live state.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui base-nova, Supabase SSR + browser clients, Lucide React, Jest 29 + React Testing Library 16

## Global Constraints

- **File extensions:** `.jsx` only — no TypeScript (matches existing scaffold)
- **Path alias:** `@/*` resolves to project root (jsconfig.json)
- **Auth guard:** every `app/(app)/` page redirects to `/login` when user is null
- **Supabase server:** `const supabase = await createClient()` from `@/lib/supabase/server`
- **Supabase browser:** `useSupabase()` from `@/components/providers/SupabaseProvider`
- **Buttons:** always use `Button` from `@/components/ui/button`
- **Date formatting:** use `relativeTime(date)` from `@/lib/utils/date`
- **CSS utility:** use `cn()` from `@/lib/utils`
- **Icons:** Lucide React only
- **Status ENUM:** `applied | replied | interview | offer | rejected | ghosted | follow_up_due | withdrawn`
- **Draft type ENUM:** `follow_up | interview_confirm | info_response | offer_accept | offer_decline | general_reply`
- **DEV 3 does NOT own:** `app/(auth)/` (login + OAuth callback — Dev 1), all `app/api/` routes (Dev 1 + Dev 2), `middleware.ts` (Dev 1)
- **Before writing any Next.js API or unfamiliar hook:** read `node_modules/next/dist/docs/`

## API Contracts DEV 3 Consumes

Built by Dev 1 & Dev 2. Reference when writing fetch calls:

| Route | Method | Request Body | Response |
|-------|--------|-------------|----------|
| `/api/notifications` | GET | — | `{ notifications: Notification[] }` |
| `/api/notifications` | PATCH | `{ ids: string[] }` | `{ success: true }` |
| `/api/applications/[id]/thread` | GET | — | `{ messages: EmailEvent[] }` |
| `/api/drafts` | POST | `{ applicationId, draftType }` | `{ draft: Draft }` |
| `/api/drafts/[id]` | PATCH | `{ body_edited: string }` | `{ draft: Draft }` |
| `/api/gmail/send` | POST | `{ draftId: string }` | `{ success: true }` |
| `/api/gmail/scan` | POST | `{ mode: 'initial' }` | SSE: `data: {"scanned":N,"total":N,"detected":N}\n\n` then `data: [DONE]\n\n` |
| `/api/auth/revoke` | POST | — | `{ success: true }` |

## Key Data Shapes

```js
// Application
{ id, user_id, gmail_thread_id, company_name, role_title, status, application_date,
  last_activity_at, follow_up_due_at, recipient_email, subject, ai_confidence, notes, is_archived }

// EmailEvent (thread message)
{ id, direction, from_address, subject, snippet, received_at, groq_reply_type }
// direction: 'sent' | 'received'
// groq_reply_type: 'interview_invite' | 'rejection' | 'info_request' | 'offer' | 'acknowledgment' | 'other' | null

// Draft
{ id, application_id, draft_type, subject, body_markdown, body_edited, was_sent, sent_at }

// Notification
{ id, application_id, type, title, body, is_read, created_at }

// UserSettings
{ user_id, follow_up_delay_days, email_digest_enabled, scan_lookback_days, onboarding_completed }
```

---

### Task 1: Test Setup + App Shell Layout

**Files:**
- Create: `jest.config.js`
- Create: `jest.setup.js`
- Modify: `package.json` (add test script + devDependencies)
- Create: `app/(app)/layout.jsx`
- Create: `components/layout/AppShell.jsx`
- Create: `components/layout/Sidebar.jsx`
- Create: `components/layout/TopNav.jsx`
- Create: `components/layout/NotificationBell.jsx` (stub — full impl in Task 5)
- Test: `__tests__/layout/Sidebar.test.jsx`
- Test: `__tests__/layout/AppShell.test.jsx`

**Interfaces:**
- Produces:
  - `AppShell({ userId: string, user: { id: string, email: string }, children: ReactNode })` — `"use client"`, named export from `components/layout/AppShell.jsx`. Fetches initial notifications, holds `notifications` state, passes handlers down to `TopNav`.
  - `Sidebar()` — `"use client"` (needs `usePathname`), named export from `components/layout/Sidebar.jsx`
  - `TopNav({ user, notificationCount: number, notifications: Notification[], onMarkRead: (ids: string[]) => void })` — Server-safe (no hooks), named export from `components/layout/TopNav.jsx`

- [ ] **Step 1: Install testing dependencies**

```bash
npm install --save-dev jest@29 jest-environment-jsdom @testing-library/react@16 @testing-library/jest-dom@6 @testing-library/user-event@14
```

Expected: exits 0, packages appear in `package.json` devDependencies.

- [ ] **Step 2: Configure Jest**

Create `jest.config.js`:
```js
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  setupFilesAfterFramework: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
})
```

Create `jest.setup.js`:
```js
import '@testing-library/jest-dom'
```

Add to `package.json` `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 3: Write failing Sidebar test**

Create `__tests__/layout/Sidebar.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/layout/Sidebar'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

test('renders Dashboard and Settings nav links', () => {
  render(<Sidebar />)
  expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
  expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
})

test('marks current route link as active', () => {
  render(<Sidebar />)
  const dashLink = screen.getByRole('link', { name: /dashboard/i })
  expect(dashLink.className).toMatch(/bg-sidebar-accent/)
})
```

- [ ] **Step 4: Run test, confirm failure**

```bash
npm test -- --testPathPattern=Sidebar
```
Expected: FAIL — "Cannot find module '@/components/layout/Sidebar'"

- [ ] **Step 5: Implement Sidebar**

Create `components/layout/Sidebar.jsx`:
```jsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 flex flex-col border-r border-border bg-sidebar shrink-0">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <Briefcase className="size-5 text-primary" />
        <span className="font-semibold text-sm">Job Hunt Intel</span>
      </div>
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 6: Run test, confirm pass**

```bash
npm test -- --testPathPattern=Sidebar
```
Expected: PASS

- [ ] **Step 7: Write failing AppShell test**

Create `__tests__/layout/AppShell.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { AppShell } from '@/components/layout/AppShell'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
jest.mock('@/components/providers/RealtimeProvider', () => ({
  RealtimeProvider: ({ children }) => <>{children}</>,
}))
jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ notifications: [] }),
})

const mockUser = { id: 'user-1', email: 'test@example.com' }

test('renders sidebar, topnav and children', () => {
  render(
    <AppShell userId="user-1" user={mockUser}>
      <div>Page content</div>
    </AppShell>
  )
  expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  expect(screen.getByText('Page content')).toBeInTheDocument()
  expect(screen.getByText('test@example.com')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run test, confirm failure**

```bash
npm test -- --testPathPattern=AppShell
```
Expected: FAIL — module not found

- [ ] **Step 9: Implement AppShell, TopNav, and NotificationBell stub**

Create `components/layout/AppShell.jsx`:
```jsx
"use client";
import { useState, useEffect } from "react";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppShell({ userId, user, children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(({ notifications: n }) => setNotifications(n ?? []))
      .catch(() => {});
  }, []);

  function handleNotification(notification) {
    setNotifications((prev) => [notification, ...prev]);
  }

  function handleMarkRead(ids) {
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <RealtimeProvider userId={userId} onNotification={handleNotification}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopNav
            user={user}
            notificationCount={unreadCount}
            notifications={notifications}
            onMarkRead={handleMarkRead}
          />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
```

Create `components/layout/TopNav.jsx`:
```jsx
import { NotificationBell } from "./NotificationBell";

export function TopNav({ user, notificationCount, notifications, onMarkRead }) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0 bg-background">
      <div />
      <div className="flex items-center gap-4">
        <NotificationBell
          count={notificationCount}
          notifications={notifications}
          onMarkRead={onMarkRead}
        />
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </div>
    </header>
  );
}
```

Create `components/layout/NotificationBell.jsx` (stub — full impl in Task 5):
```jsx
"use client";
export function NotificationBell({ count, notifications, onMarkRead }) {
  return <div data-testid="notification-bell" />;
}
```

- [ ] **Step 10: Create the app layout**

Create `app/(app)/layout.jsx`:
```jsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <SupabaseProvider>
      <AppShell userId={user.id} user={user}>
        {children}
      </AppShell>
    </SupabaseProvider>
  );
}
```

- [ ] **Step 11: Run AppShell test, confirm pass**

```bash
npm test -- --testPathPattern=AppShell
```
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add jest.config.js jest.setup.js package.json "app/(app)/layout.jsx" components/layout/ "__tests__/layout/"
git commit -m "feat: test setup, app shell layout, sidebar, topnav"
```

---

### Task 2: StatusBadge + StatsCards

**Files:**
- Create: `components/dashboard/StatusBadge.jsx`
- Create: `components/dashboard/StatsCards.jsx`
- Test: `__tests__/dashboard/StatusBadge.test.jsx`
- Test: `__tests__/dashboard/StatsCards.test.jsx`

**Interfaces:**
- Produces:
  - `StatusBadge({ status: string })` — named export from `components/dashboard/StatusBadge.jsx`
  - `STATUS_MAP` — named export, object mapping each status string → `{ label: string, className: string }`
  - `StatsCards({ applications: Application[] })` — named export from `components/dashboard/StatsCards.jsx`

- [ ] **Step 1: Write failing StatusBadge tests**

Create `__tests__/dashboard/StatusBadge.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/dashboard/StatusBadge'

test.each([
  ['applied',       'Applied'],
  ['replied',       'Replied'],
  ['interview',     'Interview'],
  ['offer',         'Offer'],
  ['rejected',      'Rejected'],
  ['ghosted',       'Ghosted'],
  ['follow_up_due', 'Follow Up Due'],
  ['withdrawn',     'Withdrawn'],
])('renders correct label for status "%s"', (status, expectedLabel) => {
  render(<StatusBadge status={status} />)
  expect(screen.getByText(expectedLabel)).toBeInTheDocument()
})

test('renders unknown status as-is', () => {
  render(<StatusBadge status="unknown_xyz" />)
  expect(screen.getByText('unknown_xyz')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=StatusBadge
```
Expected: FAIL

- [ ] **Step 3: Implement StatusBadge**

Create `components/dashboard/StatusBadge.jsx`:
```jsx
import { cn } from "@/lib/utils";

export const STATUS_MAP = {
  applied:       { label: "Applied",       className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  replied:       { label: "Replied",       className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  interview:     { label: "Interview",     className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  offer:         { label: "Offer",         className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rejected:      { label: "Rejected",      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  ghosted:       { label: "Ghosted",       className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  follow_up_due: { label: "Follow Up Due", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  withdrawn:     { label: "Withdrawn",     className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
};

export function StatusBadge({ status }) {
  const { label, className } = STATUS_MAP[status] ?? { label: status, className: "" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=StatusBadge
```
Expected: PASS

- [ ] **Step 5: Write failing StatsCards tests**

Create `__tests__/dashboard/StatsCards.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { StatsCards } from '@/components/dashboard/StatsCards'

const makeApps = (statusCounts) =>
  Object.entries(statusCounts).flatMap(([status, count]) =>
    Array.from({ length: count }, (_, i) => ({ id: `${status}-${i}`, status }))
  )

test('shows correct counts for each tracked status', () => {
  const applications = makeApps({ applied: 5, interview: 2, offer: 1, rejected: 3 })
  render(<StatsCards applications={applications} />)
  // These texts appear in the count cells
  expect(screen.getByText('5')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('shows zero for all when applications is empty', () => {
  render(<StatsCards applications={[]} />)
  expect(screen.getAllByText('0')).toHaveLength(4)
})
```

- [ ] **Step 6: Run test, confirm failure**

```bash
npm test -- --testPathPattern=StatsCards
```
Expected: FAIL

- [ ] **Step 7: Implement StatsCards**

Create `components/dashboard/StatsCards.jsx`:
```jsx
const STAT_DEFINITIONS = [
  { key: "applied",   label: "Applied",   color: "text-blue-600" },
  { key: "interview", label: "Interview", color: "text-violet-600" },
  { key: "offer",     label: "Offer",     color: "text-green-600" },
  { key: "rejected",  label: "Rejected",  color: "text-red-600" },
];

export function StatsCards({ applications }) {
  const counts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {STAT_DEFINITIONS.map(({ key, label, color }) => (
        <div key={key} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold ${color}`}>{counts[key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run test, confirm pass**

```bash
npm test -- --testPathPattern=StatsCards
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/StatusBadge.jsx components/dashboard/StatsCards.jsx "__tests__/dashboard/StatusBadge.test.jsx" "__tests__/dashboard/StatsCards.test.jsx"
git commit -m "feat: StatusBadge and StatsCards components"
```

---

### Task 3: FilterBar + ApplicationsTable

**Files:**
- Create: `components/dashboard/FilterBar.jsx`
- Create: `components/dashboard/ApplicationsTable.jsx`
- Test: `__tests__/dashboard/FilterBar.test.jsx`
- Test: `__tests__/dashboard/ApplicationsTable.test.jsx`

**Interfaces:**
- Consumes: `StatusBadge` from `@/components/dashboard/StatusBadge`, `StatsCards` from `@/components/dashboard/StatsCards`, `relativeTime` from `@/lib/utils/date`, `useSupabase` from `@/components/providers/SupabaseProvider`, `useRouter` from `next/navigation`
- Produces:
  - `FilterBar({ statusFilter: string, searchQuery: string, onStatusChange: (v: string) => void, onSearchChange: (v: string) => void })` — named export
  - `ApplicationsTable({ initialApplications: Application[], userId: string })` — `"use client"`, named export. Owns Realtime subscription for the applications table.

- [ ] **Step 1: Write failing FilterBar tests**

Create `__tests__/dashboard/FilterBar.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '@/components/dashboard/FilterBar'

test('calls onSearchChange as user types', async () => {
  const user = userEvent.setup()
  const onSearchChange = jest.fn()
  render(
    <FilterBar statusFilter="" searchQuery="" onStatusChange={jest.fn()} onSearchChange={onSearchChange} />
  )
  await user.type(screen.getByPlaceholderText(/search/i), 'Google')
  expect(onSearchChange).toHaveBeenLastCalledWith('Google')
})

test('calls onStatusChange when status option is selected', async () => {
  const user = userEvent.setup()
  const onStatusChange = jest.fn()
  render(
    <FilterBar statusFilter="" searchQuery="" onStatusChange={onStatusChange} onSearchChange={jest.fn()} />
  )
  await user.selectOptions(screen.getByRole('combobox'), 'applied')
  expect(onStatusChange).toHaveBeenCalledWith('applied')
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=FilterBar
```
Expected: FAIL

- [ ] **Step 3: Implement FilterBar**

Create `components/dashboard/FilterBar.jsx`:
```jsx
"use client";
import { Search } from "lucide-react";

const STATUSES = [
  { value: "",              label: "All Statuses" },
  { value: "applied",       label: "Applied" },
  { value: "replied",       label: "Replied" },
  { value: "interview",     label: "Interview" },
  { value: "offer",         label: "Offer" },
  { value: "rejected",      label: "Rejected" },
  { value: "ghosted",       label: "Ghosted" },
  { value: "follow_up_due", label: "Follow Up Due" },
  { value: "withdrawn",     label: "Withdrawn" },
];

export function FilterBar({ statusFilter, searchQuery, onStatusChange, onSearchChange }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search company or role..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {STATUSES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=FilterBar
```
Expected: PASS

- [ ] **Step 5: Write failing ApplicationsTable tests**

Create `__tests__/dashboard/ApplicationsTable.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApplicationsTable } from '@/components/dashboard/ApplicationsTable'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    channel: () => ({ on: function() { return this }, subscribe: () => ({}) }),
    removeChannel: jest.fn(),
  }),
}))

const apps = [
  { id: '1', company_name: 'Acme',   role_title: 'Engineer', status: 'applied',    application_date: '2026-06-01', last_activity_at: '2026-06-15' },
  { id: '2', company_name: 'Globex', role_title: 'Designer', status: 'interview',  application_date: '2026-06-05', last_activity_at: '2026-06-20' },
]

test('renders all application rows', () => {
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  expect(screen.getByText('Acme')).toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})

test('navigates to detail page on row click', async () => {
  const user = userEvent.setup()
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  await user.click(screen.getByText('Acme'))
  expect(mockPush).toHaveBeenCalledWith('/applications/1')
})

test('filters rows by status', async () => {
  const user = userEvent.setup()
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  await user.selectOptions(screen.getByRole('combobox'), 'interview')
  expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})

test('filters rows by search query', async () => {
  const user = userEvent.setup()
  render(<ApplicationsTable initialApplications={apps} userId="user-1" />)
  await user.type(screen.getByPlaceholderText(/search/i), 'Globex')
  expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  expect(screen.getByText('Globex')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test, confirm failure**

```bash
npm test -- --testPathPattern=ApplicationsTable
```
Expected: FAIL

- [ ] **Step 7: Implement ApplicationsTable**

Create `components/dashboard/ApplicationsTable.jsx`:
```jsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { relativeTime } from "@/lib/utils/date";
import { StatusBadge } from "./StatusBadge";
import { FilterBar } from "./FilterBar";
import { StatsCards } from "./StatsCards";

export function ApplicationsTable({ initialApplications, userId }) {
  const [applications, setApplications] = useState(initialApplications);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

  useEffect(() => {
    const channel = supabase
      .channel("apps-table")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setApplications((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setApplications((prev) =>
              prev.map((a) => (a.id === payload.new.id ? payload.new : a))
            );
          } else if (payload.eventType === "DELETE") {
            setApplications((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [supabase, userId]);

  const filtered = applications.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesCompany = a.company_name?.toLowerCase().includes(q);
      const matchesRole = a.role_title?.toLowerCase().includes(q);
      if (!matchesCompany && !matchesRole) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <StatsCards applications={applications} />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <FilterBar
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            onStatusChange={setStatusFilter}
            onSearchChange={setSearchQuery}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No applications found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => router.push(`/applications/${app.id}`)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{app.company_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{app.role_title ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.application_date ? relativeTime(app.application_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.last_activity_at ? relativeTime(app.last_activity_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test, confirm pass**

```bash
npm test -- --testPathPattern=ApplicationsTable
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/FilterBar.jsx components/dashboard/ApplicationsTable.jsx "__tests__/dashboard/"
git commit -m "feat: FilterBar and ApplicationsTable with realtime updates"
```

---

### Task 4: Dashboard Page

**Files:**
- Create: `app/(app)/dashboard/page.jsx`
- Test: `__tests__/dashboard/DashboardPage.test.jsx`

**Interfaces:**
- Consumes: `ApplicationsTable` (named, `@/components/dashboard/ApplicationsTable`), `createClient` from `@/lib/supabase/server`
- Note: This is an async Server Component. Test by mocking `createClient`.

- [ ] **Step 1: Write failing dashboard page test**

Create `__tests__/dashboard/DashboardPage.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(app)/dashboard/page'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'me@test.com' } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    channel: () => ({ on: function() { return this }, subscribe: () => ({}) }),
    removeChannel: jest.fn(),
  }),
}))

test('renders Applications heading', async () => {
  render(await DashboardPage())
  expect(screen.getByRole('heading', { name: /applications/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=DashboardPage
```
Expected: FAIL

- [ ] **Step 3: Implement dashboard page**

Create `app/(app)/dashboard/page.jsx`:
```jsx
import { createClient } from "@/lib/supabase/server";
import { ApplicationsTable } from "@/components/dashboard/ApplicationsTable";

export const metadata = { title: "Dashboard — Job Hunt Intel" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      <ApplicationsTable
        initialApplications={applications ?? []}
        userId={user.id}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=DashboardPage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/dashboard/page.jsx" "__tests__/dashboard/DashboardPage.test.jsx"
git commit -m "feat: dashboard page with SSR applications fetch"
```

---

### Task 5: NotificationBell (full implementation)

**Files:**
- Modify: `components/layout/NotificationBell.jsx` (replace stub)
- Test: `__tests__/layout/NotificationBell.test.jsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `Bell` icon from `lucide-react`, `cn` from `@/lib/utils`
- Produces: `NotificationBell({ count: number, notifications: Notification[], onMarkRead: (ids: string[]) => void })` — `"use client"`, named export

- [ ] **Step 1: Write failing NotificationBell tests**

Create `__tests__/layout/NotificationBell.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from '@/components/layout/NotificationBell'

global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({}) })

const notifications = [
  { id: '1', title: 'Reply from Acme',  body: 'They want an interview', is_read: false },
  { id: '2', title: 'Follow-up due',    body: 'Ping Globex',            is_read: true },
]

test('shows numeric badge when count > 0', () => {
  render(<NotificationBell count={3} notifications={[]} onMarkRead={jest.fn()} />)
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('hides badge when count is 0', () => {
  render(<NotificationBell count={0} notifications={[]} onMarkRead={jest.fn()} />)
  expect(screen.queryByText('0')).not.toBeInTheDocument()
})

test('shows 9+ when count exceeds 9', () => {
  render(<NotificationBell count={15} notifications={[]} onMarkRead={jest.fn()} />)
  expect(screen.getByText('9+')).toBeInTheDocument()
})

test('opens dropdown on button click', async () => {
  const user = userEvent.setup()
  render(<NotificationBell count={1} notifications={notifications} onMarkRead={jest.fn()} />)
  expect(screen.queryByText('Reply from Acme')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /notifications/i }))
  expect(screen.getByText('Reply from Acme')).toBeInTheDocument()
})

test('calls onMarkRead with unread ids when opened', async () => {
  const user = userEvent.setup()
  const onMarkRead = jest.fn()
  render(<NotificationBell count={1} notifications={notifications} onMarkRead={onMarkRead} />)
  await user.click(screen.getByRole('button', { name: /notifications/i }))
  expect(onMarkRead).toHaveBeenCalledWith(['1'])
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=NotificationBell
```
Expected: FAIL (stub has no button or dropdown)

- [ ] **Step 3: Implement NotificationBell**

Replace `components/layout/NotificationBell.jsx`:
```jsx
"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell({ count, notifications, onMarkRead }) {
  const [open, setOpen] = useState(false);

  async function handleToggle() {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: unreadIds }),
        });
        onMarkRead(unreadIds);
      }
    }
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Notifications">
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-popover shadow-lg">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          <div className="max-h-72 overflow-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border last:border-0",
                    !n.is_read && "bg-muted/40"
                  )}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=NotificationBell
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/layout/NotificationBell.jsx "__tests__/layout/NotificationBell.test.jsx"
git commit -m "feat: NotificationBell with dropdown and mark-read"
```

---

### Task 6: Application Detail — Page + ApplicationMeta + ThreadViewer

**Files:**
- Create: `app/(app)/applications/[id]/page.jsx`
- Create: `components/application/ApplicationMeta.jsx`
- Create: `components/application/ThreadViewer.jsx`
- Create: `components/application/DraftPanel.jsx` (stub — full impl in Task 7)
- Create: `components/application/DraftEditor.jsx` (stub — full impl in Task 7)
- Test: `__tests__/application/ApplicationMeta.test.jsx`
- Test: `__tests__/application/ThreadViewer.test.jsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `StatusBadge`, `relativeTime`
- Produces:
  - `ApplicationMeta({ application: Application })` — named export from `components/application/ApplicationMeta.jsx`
  - `ThreadViewer({ messages: EmailEvent[] })` — named export from `components/application/ThreadViewer.jsx`
  - `DraftPanel({ applicationId: string, initialDrafts: Draft[] })` — stub `"use client"`, named export
  - `DraftEditor({ draft: Draft, onUpdate: (body: string) => void, onSend: () => void, sending: boolean })` — stub `"use client"`, named export

- [ ] **Step 1: Write failing ApplicationMeta tests**

Create `__tests__/application/ApplicationMeta.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { ApplicationMeta } from '@/components/application/ApplicationMeta'

const application = {
  id: '1',
  company_name: 'Acme Corp',
  role_title: 'Senior Engineer',
  status: 'interview',
  application_date: '2026-06-01',
  last_activity_at: '2026-06-18',
  follow_up_due_at: null,
  recipient_email: 'hr@acme.com',
  subject: 'Application for Senior Engineer',
  ai_confidence: 0.92,
  notes: null,
}

test('renders company name and role title', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
})

test('renders status badge', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('Interview')).toBeInTheDocument()
})

test('renders recipient email', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('hr@acme.com')).toBeInTheDocument()
})

test('renders AI confidence as percentage', () => {
  render(<ApplicationMeta application={application} />)
  expect(screen.getByText('92%')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=ApplicationMeta
```
Expected: FAIL

- [ ] **Step 3: Implement ApplicationMeta**

Create `components/application/ApplicationMeta.jsx`:
```jsx
import { relativeTime } from "@/lib/utils/date";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

function MetaRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function ApplicationMeta({ application }) {
  const {
    company_name, role_title, status, application_date, last_activity_at,
    follow_up_due_at, recipient_email, subject, ai_confidence,
  } = application;

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{company_name ?? "Unknown Company"}</h2>
          <p className="text-muted-foreground">{role_title ?? "Unknown Role"}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetaRow label="Recipient" value={recipient_email} />
        <MetaRow label="Subject" value={subject} />
        <MetaRow label="Applied" value={application_date ? relativeTime(application_date) : null} />
        <MetaRow label="Last Activity" value={last_activity_at ? relativeTime(last_activity_at) : null} />
        {follow_up_due_at && (
          <MetaRow label="Follow-up Due" value={relativeTime(follow_up_due_at)} />
        )}
        {ai_confidence != null && (
          <MetaRow label="AI Confidence" value={`${Math.round(ai_confidence * 100)}%`} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=ApplicationMeta
```
Expected: PASS

- [ ] **Step 5: Write failing ThreadViewer tests**

Create `__tests__/application/ThreadViewer.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { ThreadViewer } from '@/components/application/ThreadViewer'

const messages = [
  { id: 'm1', direction: 'sent',     from_address: 'me@gmail.com',  subject: 'Application for Engineer', snippet: 'I am applying...',     received_at: '2026-06-01T10:00:00Z', groq_reply_type: null },
  { id: 'm2', direction: 'received', from_address: 'hr@acme.com',   subject: 'Re: Application',          snippet: 'Thanks for applying!',  received_at: '2026-06-05T14:00:00Z', groq_reply_type: 'interview_invite' },
]

test('renders sender address for each message', () => {
  render(<ThreadViewer messages={messages} />)
  expect(screen.getByText('me@gmail.com')).toBeInTheDocument()
  expect(screen.getByText('hr@acme.com')).toBeInTheDocument()
})

test('renders snippet text for each message', () => {
  render(<ThreadViewer messages={messages} />)
  expect(screen.getByText('I am applying...')).toBeInTheDocument()
  expect(screen.getByText('Thanks for applying!')).toBeInTheDocument()
})

test('renders groq_reply_type label when present', () => {
  render(<ThreadViewer messages={messages} />)
  expect(screen.getByText('Interview Invite')).toBeInTheDocument()
})

test('renders empty state when no messages', () => {
  render(<ThreadViewer messages={[]} />)
  expect(screen.getByText(/no messages/i)).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test, confirm failure**

```bash
npm test -- --testPathPattern=ThreadViewer
```
Expected: FAIL

- [ ] **Step 7: Implement ThreadViewer**

Create `components/application/ThreadViewer.jsx`:
```jsx
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

const REPLY_TYPE_LABELS = {
  interview_invite: "Interview Invite",
  rejection:        "Rejection",
  info_request:     "Info Request",
  offer:            "Offer",
  acknowledgment:   "Acknowledgment",
  other:            "Other",
};

export function ThreadViewer({ messages }) {
  if (!messages?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No messages in thread.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "rounded-xl border border-border bg-card p-4",
            msg.direction === "sent" && "border-l-4 border-l-blue-400"
          )}
        >
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-sm font-medium">{msg.from_address}</span>
            <div className="flex items-center gap-2">
              {msg.groq_reply_type && (
                <span className="text-xs rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 font-medium dark:bg-violet-900/30 dark:text-violet-300">
                  {REPLY_TYPE_LABELS[msg.groq_reply_type] ?? msg.groq_reply_type}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {msg.received_at ? relativeTime(msg.received_at) : ""}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-1">{msg.subject}</p>
          <p className="text-sm">{msg.snippet}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run test, confirm pass**

```bash
npm test -- --testPathPattern=ThreadViewer
```
Expected: PASS

- [ ] **Step 9: Create stub DraftPanel and DraftEditor**

Create `components/application/DraftPanel.jsx`:
```jsx
"use client";
export function DraftPanel({ applicationId, initialDrafts }) {
  return <div data-testid="draft-panel" />;
}
```

Create `components/application/DraftEditor.jsx`:
```jsx
"use client";
export function DraftEditor({ draft, onUpdate, onSend, sending }) {
  return <div data-testid="draft-editor" />;
}
```

- [ ] **Step 10: Create application detail page**

Create `app/(app)/applications/[id]/page.jsx`:
```jsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationMeta } from "@/components/application/ApplicationMeta";
import { ThreadViewer } from "@/components/application/ThreadViewer";
import { DraftPanel } from "@/components/application/DraftPanel";

export default async function ApplicationDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!application) notFound();

  // Fetch thread from Dev 2's API route — non-fatal if not yet built
  let messages = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/applications/${id}/thread`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      messages = data.messages ?? [];
    }
  } catch {
    // Thread fetch failure is non-fatal
  }

  const { data: drafts } = await supabase
    .from("ai_drafts")
    .select("*")
    .eq("application_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <ApplicationMeta application={application} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Email Thread</h2>
          <ThreadViewer messages={messages} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">AI Drafts</h2>
          <DraftPanel applicationId={id} initialDrafts={drafts ?? []} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Run all application tests**

```bash
npm test -- --testPathPattern=application
```
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add "app/(app)/applications/" components/application/ "__tests__/application/"
git commit -m "feat: application detail page, ApplicationMeta, ThreadViewer"
```

---

### Task 7: DraftPanel + DraftEditor

**Files:**
- Modify: `components/application/DraftPanel.jsx` (replace stub)
- Modify: `components/application/DraftEditor.jsx` (replace stub)
- Test: `__tests__/application/DraftPanel.test.jsx`
- Test: `__tests__/application/DraftEditor.test.jsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `Loader2`, `SendHorizonal`, `CheckCircle2` from `lucide-react`
- Produces:
  - `DraftPanel({ applicationId: string, initialDrafts: Draft[] })` — `"use client"`, named export. Calls `POST /api/drafts`, `PATCH /api/drafts/[id]`, `POST /api/gmail/send`.
  - `DraftEditor({ draft: Draft, onUpdate: (body: string) => void, onSend: () => void, sending: boolean })` — `"use client"`, named export.

- [ ] **Step 1: Write failing DraftPanel tests**

Create `__tests__/application/DraftPanel.test.jsx`:
```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftPanel } from '@/components/application/DraftPanel'

global.fetch = jest.fn()

const draft = {
  id: 'd1', draft_type: 'follow_up', subject: 'Following up',
  body_markdown: 'Hi, just checking in...', body_edited: null, was_sent: false,
}

beforeEach(() => jest.clearAllMocks())

test('shows draft type select and Generate button', () => {
  render(<DraftPanel applicationId="app-1" initialDrafts={[]} />)
  expect(screen.getByRole('combobox')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
})

test('calls POST /api/drafts on Generate click', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ draft }) })
  render(<DraftPanel applicationId="app-1" initialDrafts={[]} />)
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/drafts',
    expect.objectContaining({ method: 'POST' })
  ))
})

test('displays subject after draft is generated', async () => {
  const user = userEvent.setup()
  global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ draft }) })
  render(<DraftPanel applicationId="app-1" initialDrafts={[]} />)
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await waitFor(() => expect(screen.getByText('Following up')).toBeInTheDocument())
})

test('renders existing drafts on mount', () => {
  render(<DraftPanel applicationId="app-1" initialDrafts={[draft]} />)
  expect(screen.getByText('Following up')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=DraftPanel
```
Expected: FAIL (stub renders nothing)

- [ ] **Step 3: Implement DraftPanel**

Replace `components/application/DraftPanel.jsx`:
```jsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DraftEditor } from "./DraftEditor";

const DRAFT_TYPES = [
  { value: "follow_up",         label: "Follow Up" },
  { value: "interview_confirm", label: "Confirm Interview" },
  { value: "info_response",     label: "Answer Info Request" },
  { value: "offer_accept",      label: "Accept Offer" },
  { value: "offer_decline",     label: "Decline Offer" },
  { value: "general_reply",     label: "General Reply" },
];

export function DraftPanel({ applicationId, initialDrafts }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selectedType, setSelectedType] = useState("follow_up");
  const [generating, setGenerating] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState(initialDrafts[0]?.id ?? null);
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, draftType: selectedType }),
      });
      if (!res.ok) return;
      const { draft } = await res.json();
      setDrafts((prev) => [draft, ...prev]);
      setActiveDraftId(draft.id);
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdate(draftId, body) {
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body_edited: body }),
    });
    if (res.ok) {
      const { draft } = await res.json();
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? draft : d)));
    }
  }

  async function handleSend(draftId) {
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      if (res.ok) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, was_sent: true } : d))
        );
      }
    } finally {
      setSending(false);
    }
  }

  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DRAFT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <Button onClick={handleGenerate} disabled={generating} size="sm">
          {generating ? <Loader2 className="size-3.5 animate-spin" /> : "Generate"}
        </Button>
      </div>

      {drafts.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {drafts.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActiveDraftId(d.id)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                d.id === activeDraftId
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              Draft {i + 1}
            </button>
          ))}
        </div>
      )}

      {activeDraft ? (
        <DraftEditor
          draft={activeDraft}
          onUpdate={(body) => handleUpdate(activeDraft.id, body)}
          onSend={() => handleSend(activeDraft.id)}
          sending={sending}
        />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
          No draft yet. Choose a type and click Generate.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=DraftPanel
```
Expected: PASS

- [ ] **Step 5: Write failing DraftEditor tests**

Create `__tests__/application/DraftEditor.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftEditor } from '@/components/application/DraftEditor'

const draft = {
  id: 'd1', draft_type: 'follow_up', subject: 'Following up',
  body_markdown: 'Hi, just checking in...', body_edited: null, was_sent: false,
}

test('renders subject and body text', () => {
  render(<DraftEditor draft={draft} onUpdate={jest.fn()} onSend={jest.fn()} sending={false} />)
  expect(screen.getByText('Following up')).toBeInTheDocument()
  expect(screen.getByDisplayValue('Hi, just checking in...')).toBeInTheDocument()
})

test('calls onUpdate when textarea changes', async () => {
  const user = userEvent.setup()
  const onUpdate = jest.fn()
  render(<DraftEditor draft={draft} onUpdate={onUpdate} onSend={jest.fn()} sending={false} />)
  const textarea = screen.getByDisplayValue('Hi, just checking in...')
  await user.clear(textarea)
  await user.type(textarea, 'New body')
  expect(onUpdate).toHaveBeenLastCalledWith('New body')
})

test('calls onSend on Send Email button click', async () => {
  const user = userEvent.setup()
  const onSend = jest.fn()
  render(<DraftEditor draft={draft} onUpdate={jest.fn()} onSend={onSend} sending={false} />)
  await user.click(screen.getByRole('button', { name: /send email/i }))
  expect(onSend).toHaveBeenCalled()
})

test('shows Sent state and hides send button when was_sent is true', () => {
  render(<DraftEditor draft={{ ...draft, was_sent: true }} onUpdate={jest.fn()} onSend={jest.fn()} sending={false} />)
  expect(screen.getByText(/sent/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /send email/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 6: Run test, confirm failure**

```bash
npm test -- --testPathPattern=DraftEditor
```
Expected: FAIL (stub renders nothing)

- [ ] **Step 7: Implement DraftEditor**

Replace `components/application/DraftEditor.jsx`:
```jsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizonal, CheckCircle2 } from "lucide-react";

export function DraftEditor({ draft, onUpdate, onSend, sending }) {
  const [body, setBody] = useState(draft.body_edited ?? draft.body_markdown ?? "");

  function handleChange(e) {
    setBody(e.target.value);
    onUpdate(e.target.value);
  }

  if (draft.was_sent) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-green-600" />
        <span>Sent</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <p className="text-sm font-medium">{draft.subject}</p>
      <textarea
        value={body}
        onChange={handleChange}
        rows={8}
        className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button onClick={onSend} disabled={sending} className="self-end">
        {sending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <>
            <SendHorizonal className="size-3.5" />
            Send Email
          </>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 8: Run test, confirm pass**

```bash
npm test -- --testPathPattern=DraftEditor
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/application/DraftPanel.jsx components/application/DraftEditor.jsx "__tests__/application/DraftPanel.test.jsx" "__tests__/application/DraftEditor.test.jsx"
git commit -m "feat: DraftPanel and DraftEditor with generate, edit, send"
```

---

### Task 8: Onboarding Wizard

**Files:**
- Create: `app/(app)/onboarding/page.jsx`
- Create: `components/onboarding/OnboardingWizard.jsx`
- Create: `components/onboarding/StepConnectGmail.jsx`
- Create: `components/onboarding/StepScanProgress.jsx`
- Create: `components/onboarding/StepDone.jsx`
- Test: `__tests__/onboarding/OnboardingWizard.test.jsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `Button` from `@/components/ui/button`
- Produces:
  - `OnboardingWizard({ hasGmail: boolean })` — `"use client"`, named export
  - `StepConnectGmail({ onNext: () => void })` — `"use client"`, named export. Shows "Connect Gmail" link to `/login` and "Already connected" skip button.
  - `StepScanProgress({ onNext: (detected: number) => void })` — `"use client"`, named export. POSTs to `/api/gmail/scan`, reads SSE stream, shows animated progress bar.
  - `StepDone({ detected: number })` — named export (no hooks). Shows count + link to `/dashboard`.

SSE parsing: split response text by `\n`, filter lines starting with `data: `, strip the prefix, parse JSON. Stream ends with `data: [DONE]`.

- [ ] **Step 1: Write failing OnboardingWizard tests**

Create `__tests__/onboarding/OnboardingWizard.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

jest.mock('@/components/onboarding/StepScanProgress', () => ({
  StepScanProgress: ({ onNext }) => (
    <div>
      <p>Scan step</p>
      <button onClick={() => onNext(5)}>Complete scan</button>
    </div>
  ),
}))

test('starts on step 1 (connect gmail) when hasGmail is false', () => {
  render(<OnboardingWizard hasGmail={false} />)
  expect(screen.getByText(/connect gmail/i)).toBeInTheDocument()
})

test('starts on step 2 (scan) when hasGmail is true', () => {
  render(<OnboardingWizard hasGmail={true} />)
  expect(screen.getByText(/scan step/i)).toBeInTheDocument()
})

test('advances from step 1 to step 2 on "Already connected" click', async () => {
  const user = userEvent.setup()
  render(<OnboardingWizard hasGmail={false} />)
  await user.click(screen.getByRole('button', { name: /already connected/i }))
  expect(screen.getByText(/scan step/i)).toBeInTheDocument()
})

test('advances from step 2 to step 3 when scan completes', async () => {
  const user = userEvent.setup()
  render(<OnboardingWizard hasGmail={true} />)
  await user.click(screen.getByRole('button', { name: /complete scan/i }))
  expect(screen.getByText(/5 applications/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=OnboardingWizard
```
Expected: FAIL

- [ ] **Step 3: Implement step components**

Create `components/onboarding/StepConnectGmail.jsx`:
```jsx
"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export function StepConnectGmail({ onNext }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Mail className="size-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Connect your Gmail</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">
          We need read access to scan your sent mail for job applications and watch for replies.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button asChild>
          <Link href="/login">Connect Gmail</Link>
        </Button>
        <Button variant="ghost" onClick={onNext}>
          Already connected — continue
        </Button>
      </div>
    </div>
  );
}
```

Create `components/onboarding/StepScanProgress.jsx`:
```jsx
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function StepScanProgress({ onNext }) {
  const [progress, setProgress] = useState({ scanned: 0, total: 0, detected: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let aborted = false;

    async function runScan() {
      try {
        const res = await fetch("/api/gmail/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "initial" }),
        });
        if (!res.ok) { setError("Scan failed. Please try again."); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!aborted) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") { setDone(true); return; }
            try { setProgress(JSON.parse(payload)); } catch {}
          }
        }
        setDone(true);
      } catch {
        if (!aborted) setError("Scan failed. Please try again.");
      }
    }

    runScan();
    return () => { aborted = true; };
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h2 className="text-xl font-bold">Scanning your Gmail</h2>
        <p className="text-muted-foreground mt-1">
          Looking through your sent mail for job applications...
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {done
              ? `Scan complete — found ${progress.detected} application${progress.detected !== 1 ? "s" : ""}`
              : progress.total > 0
              ? `Scanned ${progress.scanned} of ${progress.total} emails`
              : "Starting scan..."}
          </p>
        </div>
      )}

      {done ? (
        <Button onClick={() => onNext(progress.detected)}>Continue</Button>
      ) : !error && (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
```

Create `components/onboarding/StepDone.jsx`:
```jsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function StepDone({ detected }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <CheckCircle2 className="size-16 text-green-600" />
      <div>
        <h2 className="text-xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground mt-1">
          Found <strong>{detected}</strong> job application{detected !== 1 ? "s" : ""} in your Gmail.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
```

Create `components/onboarding/OnboardingWizard.jsx`:
```jsx
"use client";
import { useState } from "react";
import { StepConnectGmail } from "./StepConnectGmail";
import { StepScanProgress } from "./StepScanProgress";
import { StepDone } from "./StepDone";

const STEP_LABELS = ["Connect Gmail", "Scan Mail", "Done"];

export function OnboardingWizard({ hasGmail }) {
  const [step, setStep] = useState(hasGmail ? 1 : 0);
  const [detected, setDetected] = useState(0);

  function handleScanComplete(count) {
    setDetected(count);
    setStep(2);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px w-8 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-8">
        {step === 0 && <StepConnectGmail onNext={() => setStep(1)} />}
        {step === 1 && <StepScanProgress onNext={handleScanComplete} />}
        {step === 2 && <StepDone detected={detected} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npm test -- --testPathPattern=OnboardingWizard
```
Expected: PASS

- [ ] **Step 5: Create onboarding page**

Create `app/(app)/onboarding/page.jsx`:
```jsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Setup — Job Hunt Intel" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .single();

  if (settings?.onboarding_completed) redirect("/dashboard");

  const { data: tokens } = await supabase
    .from("user_tokens")
    .select("google_refresh_token")
    .eq("user_id", user.id)
    .single();

  const hasGmail = !!tokens?.google_refresh_token;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Welcome to Job Hunt Intel</h1>
        <p className="text-muted-foreground mt-1">Let's get your applications set up.</p>
      </div>
      <OnboardingWizard hasGmail={hasGmail} />
    </div>
  );
}
```

- [ ] **Step 6: Run all onboarding tests**

```bash
npm test -- --testPathPattern=onboarding
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/onboarding/" components/onboarding/ "__tests__/onboarding/"
git commit -m "feat: onboarding wizard with Gmail connect, SSE scan progress, done step"
```

---

### Task 9: Settings Page

**Files:**
- Create: `app/(app)/settings/page.jsx`
- Create: `components/settings/SettingsForm.jsx`
- Test: `__tests__/settings/SettingsPage.test.jsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `useSupabase` from `@/components/providers/SupabaseProvider`, `useRouter` from `next/navigation`, `Button`
- Produces:
  - `SettingsForm({ userId: string, settings: UserSettings })` — `"use client"`, named export. Updates `user_settings` table directly via `useSupabase()` (RLS allows users to update their own row). Calls `POST /api/auth/revoke` then redirects to `/login` on disconnect.

- [ ] **Step 1: Write failing settings tests**

Create `__tests__/settings/SettingsPage.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/(app)/settings/page'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'me@test.com' } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { follow_up_delay_days: 7, email_digest_enabled: false, scan_lookback_days: 90 },
          }),
        }),
      }),
    }),
  }),
}))
jest.mock('@/components/providers/SupabaseProvider', () => ({
  useSupabase: () => ({
    from: () => ({ update: () => ({ eq: jest.fn().mockResolvedValue({ error: null }) }) }),
  }),
}))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
global.fetch = jest.fn().mockResolvedValue({ ok: true })

test('renders Settings heading', async () => {
  render(await SettingsPage())
  expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
})

test('renders follow-up delay input with default value', async () => {
  render(await SettingsPage())
  expect(screen.getByLabelText(/follow.up delay/i)).toHaveValue(7)
})

test('renders Disconnect Gmail button', async () => {
  render(await SettingsPage())
  expect(screen.getByRole('button', { name: /disconnect gmail/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npm test -- --testPathPattern=SettingsPage
```
Expected: FAIL

- [ ] **Step 3: Implement SettingsForm**

Create `components/settings/SettingsForm.jsx`:
```jsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export function SettingsForm({ userId, settings }) {
  const [followUpDays, setFollowUpDays] = useState(settings.follow_up_delay_days);
  const [digestEnabled, setDigestEnabled] = useState(settings.email_digest_enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = useSupabase();

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("user_settings")
      .update({ follow_up_delay_days: Number(followUpDays), email_digest_enabled: digestEnabled })
      .eq("user_id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Gmail? You'll need to reconnect to keep using the app.")) return;
    await fetch("/api/auth/revoke", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold">Preferences</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="follow-up-days" className="text-sm font-medium">
            Follow-up delay (days)
          </label>
          <input
            id="follow-up-days"
            type="number"
            min={1}
            max={60}
            value={followUpDays}
            onChange={(e) => setFollowUpDays(Number(e.target.value))}
            className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Applications with no reply after this many days are flagged for follow-up.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="email-digest"
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            className="size-4 rounded border-border"
          />
          <label htmlFor="email-digest" className="text-sm font-medium">
            Send daily email digest
          </label>
        </div>

        <Button type="submit" disabled={saving} className="self-start">
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>

      <div className="rounded-xl border border-destructive/30 bg-card p-5 flex flex-col gap-3">
        <h2 className="text-base font-semibold">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Disconnecting Gmail stops all scanning and webhooks. Your existing application data is preserved.
        </p>
        <Button variant="destructive" onClick={handleDisconnect} className="self-start">
          Disconnect Gmail
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement settings page**

Create `app/(app)/settings/page.jsx`:
```jsx
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings — Job Hunt Intel" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("follow_up_delay_days, email_digest_enabled, scan_lookback_days")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="p-6 flex flex-col gap-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm
        userId={user.id}
        settings={settings ?? { follow_up_delay_days: 7, email_digest_enabled: false, scan_lookback_days: 90 }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run test, confirm pass**

```bash
npm test -- --testPathPattern=SettingsPage
```
Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/settings/" components/settings/ "__tests__/settings/"
git commit -m "feat: settings page with preferences and Gmail disconnect"
```

---

## Self-Review Checklist

- [ ] `app/(app)/layout.jsx` — auth guard + SupabaseProvider + AppShell ✅
- [ ] `app/(app)/dashboard/page.jsx` — SSR fetch + ApplicationsTable ✅
- [ ] `app/(app)/applications/[id]/page.jsx` — SSR fetch + ApplicationMeta + ThreadViewer + DraftPanel ✅
- [ ] `app/(app)/onboarding/page.jsx` — redirects if `onboarding_completed`, renders OnboardingWizard ✅
- [ ] `app/(app)/settings/page.jsx` — SSR fetch settings + SettingsForm ✅
- [ ] `components/layout/` — Sidebar (active link), TopNav, NotificationBell (dropdown + mark-read), AppShell ✅
- [ ] `components/dashboard/` — StatusBadge (all 8 statuses), StatsCards (4 stats), FilterBar, ApplicationsTable (Realtime) ✅
- [ ] `components/application/` — ApplicationMeta, ThreadViewer (groq_reply_type labels), DraftPanel, DraftEditor ✅
- [ ] `components/onboarding/` — OnboardingWizard, StepConnectGmail, StepScanProgress (SSE), StepDone ✅
- [ ] `components/settings/SettingsForm` — Supabase direct update, Gmail disconnect ✅
- [ ] Realtime subscription on `applications` table in ApplicationsTable ✅
- [ ] SSE scan stream consumer in StepScanProgress ✅
- [ ] All 8 status ENUM values labeled in StatusBadge ✅
- [ ] All 6 draft type ENUM values selectable in DraftPanel ✅
- [ ] `app/(auth)/` (login + callback) — NOT DEV 3 scope, owned by Dev 1 ✅
- [ ] `middleware.ts` — NOT DEV 3 scope, owned by Dev 1 ✅
- [ ] All `app/api/` routes — NOT DEV 3 scope, owned by Dev 1 + Dev 2 ✅
