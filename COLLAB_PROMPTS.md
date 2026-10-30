# Server and real-time collaboration: setup checklist and build prompts

Do the server setup first. Then paste the prompts into Claude Code from the repo root, **one at a time**, in order, and test each step before starting the next.

---

## What's already built (no server needed)

- **Teams:** per-event Admin/Staff roles, invites by link, staff groups, messages (urgent banner, map pins, read receipts), check-in.
  - The screens use one interface, `Backend` in `src/lib/backend/types.ts`.
  - A test backend (`src/lib/backend/mock.ts`) runs it inside one browser and applies the same rules a server must.
  - ROADMAP.md section 11, "Connecting a real server", lists what the server has to enforce.
- **Comments:** pins, replies and resolve. They're stored in the plan, so team sync carries them.
- **Version history:** automatic and named, in this browser.
- **Password-protected links:** encrypted in the browser.

What's left needs the server:
- teams across devices;
- live co-editing with cursors;
- email invites and push notifications;
- links that always show the latest version.

---

## Part A: server setup (you do this)

The plan is to self-host on your AWS server (Ubuntu 24.04, public IP `3.210.198.50`) with Docker:

| Service | Role |
|---|---|
| **Caddy** | web server with automatic HTTPS |
| **PostgreSQL 16** | the database |
| **Small Node API** | logins, roles, events, messages |
| **Hocuspocus (Yjs)** | live editing |

1. **Permanent IP.** In EC2, open **Elastic IPs**. If `3.210.198.50` isn't listed, allocate one and associate it with the instance. Use the new address from then on.
2. **SSH in and install Docker** (commands from our earlier chat). Note:
   - whether `docker run --rm hello-world` prints "Hello from Docker!";
   - what `uname -m` prints (`aarch64` or `x86_64`).
3. **Security group:**
   - 22 open only to your IP;
   - 80 and 443 open to everyone;
   - nothing else. Postgres and the sync port stay private.
4. **Domain (needed before real users).**
   - Buy one (Route 53, Namecheap or Cloudflare), then add an A record, e.g. `plan.yourdomain.com` → the Elastic IP.
   - Without a domain, there's no HTTPS: logins travel unencrypted, and the Azure-hosted site (which is HTTPS) can't call an HTTP server.
5. **Email (for invites and login links).**
   - Verify the domain in Amazon SES.
   - Request production access early; new accounts start in sandbox mode.
6. **Backups.** Turn on daily EBS snapshots (Data Lifecycle Manager).
7. **Secrets stay on the server.**
   - The database password, session secret and SES keys go in a `.env` file on the server, and `.env.local` on your Mac for local testing (git ignores `*.local`).
   - **Never paste secret keys or the `.pem` file into a chat**, and never commit them.

### Decisions to make before Prompt 1
- **Where the web app lives.** Pick one:
  - **Keep Azure Static Web Apps** for the site (every push to `main` deploys it) and run only the API and sync on EC2 at e.g. `api.yourdomain.com`.
  - **Serve everything from EC2** and turn off the Azure workflow (`.github/workflows/deploy-azure.yml`). One place, one address, no cross-site setup.
- **Sign-in:** email and password, email magic link, or both.
- **Events made before the server:** an "Upload to team" step per local event (already how sharing works), or start fresh.

---

## Part B: build prompts

### Prompt 1: the server behind the existing Backend interface

```
Read README.md, ROADMAP.md (section 11, "Connecting a real server") and
src/lib/backend/types.ts first. Keep the existing code style.

Goal: a real server that implements the Backend interface, so teams, invites, check-in and
messages work across devices. The screens must not change; only src/lib/backend/index.ts
picks the server backend when VITE_API_URL is set, and the test backend otherwise.

Build, in a new server/ folder with a docker-compose.yml:
1. Caddy (HTTPS for [DOMAIN], or plain HTTP on the IP until there is one), PostgreSQL 16,
   and a Node + TypeScript API. Migrations in server/migrations/.
2. Sign-in: [EMAIL AND PASSWORD / MAGIC LINK / BOTH], http-only session cookies, rate limits on
   sign-in. Passwords hashed with argon2 or bcrypt.
3. Every Backend method as an endpoint. The server enforces the roles itself:
   - only admins change the plan, people, groups and messages;
   - staff get guests without emails;
   - staff only see messages to everyone or their groups;
   - a plan save whose baseUpdatedAt isn't current returns 409;
   - check-ins are stored apart from the plan;
   - a cheap status endpoint (role, plan version, check-ins) for polling;
   - plan bodies up to 20 MB.
4. subscribe(): server-sent events or WebSocket, falling back to polling the status endpoint.
5. src/lib/backend/server.ts implementing Backend against the API.
6. A deploy script (build, copy, docker compose up -d) and a short server/README.md.

Done when: an admin on one computer and staff on a phone see the same event, staff check-ins
show up for the admin, messages arrive on both, a staff account can't change the plan or read
emails even by calling the API directly, and two admins saving at once gives the existing
"(your version)" copy. Run npm run build and lint, and test with two browsers.
```

### Prompt 2: live co-editing and cursors

```
Read README.md and the server from the previous step first.

Goal: real-time collaboration inside an event, like Google Sheets / draw.io: admins editing
the same event see each other's moves, new objects, guest seating and comments instantly,
with live cursors. Replaces "admin edits, everyone else follows" and the 409 copy.

Build:
1. A Hocuspocus (Yjs) service in the docker-compose, behind Caddy on /sync over WSS. Its
   onAuthenticate checks the API session and the event role; staff connect read-only.
2. The plan as a Y.Doc: elements, guests, groups, levels and comments as Y.Maps keyed by id,
   so two people editing different objects never overwrite each other. Map the existing
   Zustand actions (addElement, updateElement, updateMany, deleteSelected, assignGuest,
   drawing, levels, comments, …) onto Y.Doc changes; throttle live drag updates.
3. Per-user undo/redo with Y.UndoManager, replacing the shared past/future stacks for
   shared events.
4. Presence: each user's cursor in plan meters (lands right at any zoom), name and colour;
   outline what each user has selected; avatars of who's online in the top bar.
5. Persistence: Hocuspocus stores the document in Postgres and keeps the API's plan copy
   current, so exports, staff views and the status endpoint stay right.
6. "Reconnecting…" while offline; edits made offline merge when back.

Done when: two admins in different browsers see each other's cursors and every edit within
about a second, simultaneous edits to different objects both survive, undo only undoes my
own changes, and staff can watch but not edit. Build, lint, and test with two windows.
```

### Prompt 3: email invites and push notifications

```
Goal: invites and urgent messages reach people without copying links by hand.

Build:
1. Invites by email through Amazon SES (keys in the server's .env): the existing invite
   flow sends the link; resend and revoke from the Team tab. Plain, iNBest-styled email.
2. Web push for urgent messages (VAPID keys on the server): staff opt in on their phone,
   urgent messages notify even with the app closed, tapping opens the message.
3. A per-person setting to turn emails or notifications off.

Done when: an invited person gets the email and lands in the event after signing in, and
an urgent message shows a notification on a phone with the app closed.
```

### Prompt 4: shared comments, history and live links

```
Goal: move the browser-only features onto the server.

Build:
1. Comments: they already sync inside the Y.Doc; add @mentions of event members, an unread
   count, and an email or push notification for mentions.
2. Version history on the server: automatic snapshots every 30 minutes of activity plus
   named versions, with author; restore creates a new version and updates everyone at once.
   Keep the local history for events that aren't shared.
3. Live share links: a view-only link that always shows the latest version, can be turned
   off, and can have a password checked by the server. Keep today's snapshot links
   (including the encrypted ones) as an option.

Done when: a mention notifies the person, a restore updates everyone in the event, and
turning a live link off stops it working immediately.
```

---

## Tips
- Start each prompt in a fresh Claude Code session from the repo root, on a new branch.
- If a step fails, paste the error, not your keys.
- After Prompt 2, test with a second person on a different network before moving on.
- Pushing `main` deploys to Azure. Merge server work to `main` only when you want it live.
- Keep `npm test` passing: the deploy runs it and stops on a failure. Add tests for the server's role rules too.
- The app is cached for offline use by a service worker. After a deploy, open users see a "new version" banner; test that a server change and an older cached app still work together for a few minutes.
