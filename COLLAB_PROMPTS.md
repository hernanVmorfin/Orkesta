# Real-time collaboration: setup checklist and build prompts

Do the account setup first, then paste the prompts into Claude Code from the repo root, **one at a time**, in order. Test each step before starting the next.

---

## Part A: account setup (you do this)

### 1. Supabase (logins, saved events, file storage)
1. Sign up at supabase.com and create a project. Pick the region closest to your users, and save the database password somewhere safe.
2. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
3. Go to **Authentication → Providers** and leave **Email** on (magic link). If you want Google login, turn on **Google** too. That needs a Google OAuth client ID and secret from Google Cloud Console.
4. Go to **Authentication → URL Configuration** and add `http://localhost:5173` now. Add your live web address once you have it.

### 2. Liveblocks (live sync and cursors)
1. Sign up at liveblocks.io and create a project.
2. Go to **API keys** and copy the **public key** (`pk_...`) and the **secret key** (`sk_...`).

### 3. Vercel (puts the app online)
1. Sign up at vercel.com with GitHub.
2. Wait until the branch is pushed, then import the `Orkesta` repo.
3. Go to **Settings → Environment Variables** and add the same variables as the `.env` file below. Leave out `SUPABASE_SERVICE_ROLE_KEY` unless a prompt asks for it.

### 4. Local `.env` file
Create this file yourself in the repo root and fill it in. It's already ignored by git through `*.local`, so name it `.env.local`. **Never paste the secret keys into a chat.**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_...
LIVEBLOCKS_SECRET_KEY=sk_...
```

### 5. Decisions to make before Prompt 1
- **Login methods:** email magic link, Google, or both.
- **Event access:** invite-only, or anyone with a link who has a login.
- **Roles:** owner / editor / viewer (recommended), or owner / editor only.
- **Existing local events:** an "Upload to cloud" button, or start fresh.

---

## Part B: build prompts

### Prompt 1: logins and cloud-saved events

```
Read README.md, PROMPT.md and ROADMAP.md (Phase 4) first. Keep the existing code style.

Goal: add accounts and save events in Supabase so they follow the user across devices.
Real-time sync comes in a later step; don't add it yet.

Setup: env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in .env.local.
Use @supabase/supabase-js. Login methods: [EMAIL MAGIC LINK / GOOGLE / BOTH].

Build:
1. src/lib/supabase.ts client. A sign-in screen in the iNBest style (logo, email field,
   Google button if enabled). Session persists across reloads. "Log out" in a profile menu.
2. SQL migration in supabase/migrations/ (I will run it in the Supabase SQL editor):
   - events (id uuid pk, owner_id uuid -> auth.users, name, venue, date, plan jsonb,
     updated_at timestamptz, created_at)
   - event_members (event_id, user_id, role text check in ('owner','editor','viewer'), pk both)
   - Row Level Security on both: members can read; owner/editor can update; only owner
     can delete or manage members. A trigger adds the creator as owner.
3. Storage bucket "basemaps" (private, members-only policies). Uploaded venue drawings go
   there instead of data URLs inside the plan; the plan keeps the storage path.
4. Replace IndexedDB as the source of truth when signed in: the events menu lists events from
   Supabase; autosave writes plan jsonb (debounced, keep the "Saving / Not saved" indicator).
   Keep IndexedDB as an offline cache.
5. Local events: [ADD AN "UPLOAD TO CLOUD" ACTION PER LOCAL EVENT / IGNORE THEM].
6. View-only share links keep working as today.

Done when: I can sign in on two browsers with the same account and see the same events,
edits from one appear in the other after a reload, and RLS blocks a second account that
isn't a member. Run npm run build and lint, test in the browser, and tell me the exact SQL
I must run and any Supabase dashboard settings to change.
```

### Prompt 2: live sync and cursors

```
Read README.md and the Supabase work from the previous step first.

Goal: real-time collaboration inside an event, like Google Sheets / draw.io: everyone in the
same event sees moves, edits, new objects and guest seating instantly, plus live cursors.

Setup: use Liveblocks (@liveblocks/client, @liveblocks/react, @liveblocks/zustand or
Liveblocks Storage directly). Env: VITE_LIVEBLOCKS_PUBLIC_KEY, LIVEBLOCKS_SECRET_KEY.

Build:
1. One Liveblocks room per event id. Use secret-key auth through a small serverless
   endpoint (Vercel function in /api/liveblocks-auth) that checks the Supabase session and
   event_members role; viewers get read-only room access.
2. Store the plan in Liveblocks Storage as LiveObject/LiveList (elements and guests keyed by
   id) so two people editing different objects never overwrite each other. Map the existing
   Zustand actions (addElement, updateElement, updateMany, delete, assignGuest, geo, layers…)
   onto Storage mutations. Drags send live position updates, throttled.
3. Undo/redo per user using Liveblocks history, replacing the local past/future stacks.
4. Presence: each user's cursor on the canvas (in plan meters, so it lands correctly at any
   zoom), their name and a colour; outline the objects each user has selected; avatars of
   who's online in the top bar.
5. Persist Storage back to the Supabase events.plan column (debounced, from one client or a
   webhook) so the cloud copy and exports stay current.
6. Show a "Reconnecting…" state when offline and resync after.

Done when: two browser windows signed in as different members of the same event see each
other's cursors and every edit within about a second, simultaneous edits to different
objects both survive, undo only undoes my own changes, and a viewer can't edit. Build, lint,
and test with two windows.
```

### Prompt 3: invites and roles

```
Goal: invite people to an event and control what they can do.

Build:
1. Share dialog: "Invite people" by email with a role (editor / viewer). Existing users are
   added to event_members; new emails get a pending invite row and an email via Supabase
   (magic link that lands them in the event after sign-up).
2. Members list in the Share dialog: change role, remove member (owner only), leave event.
3. Enforce roles everywhere: viewers get the existing view-only UI (no library, no edits) but
   still see live changes and cursors. Server side, RLS and the Liveblocks auth endpoint must
   enforce the same rules; never rely on the UI alone.
4. Keep the existing view-only public link as an option the owner can turn on or off.

Done when: an invited editor can edit, an invited viewer can only watch, a removed member
loses access immediately, and RLS rejects direct API writes from a viewer.
```

### Prompt 4: comments and version history

```
Goal: comments pinned to the plan and restorable history.

Build:
1. Comments: press C or use a toolbar button to drop a pin on the plan; threads with replies,
   @mentions of event members, resolve/unresolve, an unread count, and show/hide comments.
   Use Liveblocks Comments (or a Supabase table with realtime) so they appear live.
2. Version history: save a named snapshot automatically every 30 minutes of activity and
   manually ("Save version"). A History panel lists versions with author and time;
   preview a version read-only; restore creates a new version (never destroys history).

Done when: comments sync live between two users, mentions notify, and restoring an old
version works for everyone in the room at once.
```

---

## Tips
- Start each prompt in a fresh Claude Code session from the repo root, on a new branch.
- If a step fails, paste the error, not your keys.
- After Prompt 2, test with a second person on a different network before moving on.
