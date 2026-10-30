# Roadmap: making Orkesta better, using the OnePlan research

Written 2026-10-29. It compares this repo (commit `b36a8e0`) with a teardown of OnePlan's venue-event features. That teardown used their public sample plans, their shipped web app code, and a signed-in walkthrough of the free plan.

Effort sizes: **S** is under a day, **M** is 1–3 days, **L** is a week or more.

---

## 1. Where Orkesta stands today

`npm run build` passes with zero TypeScript errors. `oxlint` reports 3 warnings. The main JS chunk is 724 KB.

What already works end to end:

| Area | Orkesta today |
|---|---|
| Canvas | SVG in meters, zoom/pan, 1 m / 5 m grid, 0.25 m snap, scale bar, cursor coordinates, fit to venue |
| Basemap | Upload an image, set opacity, offset and real width, **calibrate from a measured known distance** |
| Library | About 45 true-size objects in 8 groups (seating, staging/AV, catering, safety, security, workforce, wayfinding, decor/structure) |
| Editing | Select, multi-select, box select, move, rotate (15°), numeric inspector, duplicate, align/distribute, nudge, lock, undo/redo (100 steps), 10 fixed layers with show/lock |
| Seating | Auto-numbered tables, table tags, guest list, CSV import/export (EN/ES headers), drag a guest onto a table, capacity limits, check-in, auto-seat that keeps groups together |
| Safety | Live aisle-clearance check with red dashed lines and a conflict counter |
| Export | A3 300 dpi PDF with title block and tag legend, 6000 px PNG, seating CSV, project JSON |
| Share | Plan encoded in the URL as a snapshot (view-only or editable copy) |
| Storage | localStorage autosave of **one** plan |

### Where Orkesta already beats OnePlan (protect these)

1. **Seating and guests.** OnePlan has nothing: no tables-as-seats, no guest list, no check-in. This is Orkesta's lead for galas, weddings and conferences.
2. **Aisle-clearance check.** OnePlan has no layout safety checks at all.
3. **PDF with title block and legend.** OnePlan only exports a PNG; on free it's 72 DPI and watermarked. Their legend is a separate beta website you feed a CSV into.
4. **Basemap calibration** by measuring a known length. OnePlan just scales its overlay by hand.
5. **Works without an account**, it's local-first, and CSV headers accept Spanish.

---

## 2. Gap analysis vs OnePlan (venue-event features only)

| OnePlan feature | Orkesta today | Verdict |
|---|---|---|
| Lines drawn point by point (barriers, fences, routes) with live length | Fixed 2 m / 3 m segments only | **Build (foundation)** |
| Areas drawn point by point, with area and perimeter labels | Rectangles only | **Build (foundation)** |
| Calculators: crowd capacity by density, barrier/fence segment counts, cone counts, route travel time, camping, parking | Seats only | **Build**, adapted to indoor venues |
| Per-object vendor details (vendor, zone, in/out date/time, power kW) | A single "Notes for vendors" field | **Build, then go further**: OnePlan stores these but never shows a schedule or totals |
| Levels (floors/rooms per event) | One plan | **Build** |
| Many events plus a dashboard | One plan; "New blank plan" overwrites it | **Build** (local first) |
| Styling (fill/stroke colour, opacity, dashed/dotted, arrow patterns) | `color` field exists but isn't editable | **Build** |
| Z-order, copy/paste, right-click menu | Layer order only, duplicate only | **Build** |
| Repeat object in a grid (rows × columns with gaps) | Duplicate only | **Build** (great for theatre rows and booths) |
| Grid with cell references (A1, B2…) on screen and in exports | Unlabelled 1 m grid | **Build** (cheap, useful on show day) |
| Object inventory export (CSV of every object with coordinates) | Guests CSV only | **Build** as a bill of materials |
| Exit (egress) and arrival (queue) calculators | Not present (OnePlan's are separate sites) | **Build inside the plan**, linked to placed exits and entrances |
| Live share links, password links, comments, roles | Snapshot in the URL | **Build in the backend phase** (already in PROMPT.md Phase 2) |
| Real map basemap (satellite, geo-referenced), GeoJSON, ArcGIS | Not present | **Defer** unless iNBest does outdoor events |
| About 285 objects plus paid packs | About 45 objects | **Grow in packs per event type** |
| Metric/imperial toggle | Metric only | Low priority |

**Don't copy:** their 25-object cap, export watermarks, calculators on separate websites, or the separate legend tool.

---

## 3. Fix first (Phase 0: hardening, about 2–3 days)

These are real problems in the current code. Fix them before adding features.

**Status (2026-10-29):** 0.1, 0.2, 0.3, 0.5 and 0.6 are done on branch `docs/roadmap-from-oneplan-research` and tested in the browser. 0.4: the product is named **Orkesta** (decided 2026-10-30). Browser storage keys keep their old `inbest-floorplan` names so saved events still open.

| # | Problem | Where | Fix | Size |
|---|---|---|---|---|
| 0.1 | **View-only share links contain the whole guest list**, including emails and dietary needs. Anyone a vendor forwards the link to can read them. | `src/lib/share.ts` (`shareUrl` serialises `plan.guests`) | Leave guests out of view-only links by default. Add a "include guest names (no emails)" option for check-in staff. | S |
| 0.2 | **Autosave silently fails** once an uploaded basemap is stored. The image is saved as a data URL in localStorage (~5 MB cap), and the error is swallowed in `catch {}`. | `usePlanStore.ts` autosave, `VenuePanel.tsx` `onImage` | Move plans and image blobs to IndexedDB (e.g. `idb-keyval`). Show "Not saved" in the top bar when a write fails. | M |
| 0.3 | **Only one plan exists.** "New blank plan" or opening a JSON file replaces it. | `usePlanStore.ts` (`STORAGE_KEY`), `VenuePanel.tsx` | Add a local events list: create, duplicate, rename, delete, sorted by last updated. That's the start of a dashboard. | M |
| 0.4 | Name mismatch: repo "Orkesta", package and UI "iNBest Floorplan". | `package.json`, `TopBar.tsx`, `README.md` | Pick one product name. | S |
| 0.5 | 724 KB main bundle: jsPDF and html2canvas load on startup. | `TopBar.tsx` → `exportPlan.ts` | Load the export code only when an export runs (`await import('../lib/exportPlan')`). | S |
| 0.6 | Single-key shortcuts (`r`, `m`, `v`, `f`) fire with Cmd/Ctrl held, so Cmd+R also rotates. There are also 3 lint warnings. | `App.tsx` | Ignore those keys when `mod` is held. Fix the lint warnings. | S |

---

## 4. Phase 1: geometry foundation (the base for OnePlan's best features, about 1–1.5 weeks)

Everything valuable in OnePlan's venue tools (calculators, routes, fence counts, area capacities) depends on objects drawn as real lines and areas. Orkesta's model is only a centre point plus width × height, so build this first.

**Status (2026-10-30): done on `feature/venue-tools`, tested in the browser.**
- Built as planned, with a few differences:
  - Drawing starts from the "Lines & areas" library group, not an L shortcut.
  - Points are stored relative to the object's centre, so move, rotate and duplicate work unchanged.
  - Calculators are keyed by `calc` instead of `blocks`.
- Old box barriers, fences and walls stay hidden in the library so existing plans still open.

### Data model

Extend `src/types.ts`:

```ts
export type Geometry = 'box' | 'polyline' | 'polygon'

export interface PlanElement {
  // ...existing fields
  geometry?: Geometry              // default 'box' (all current objects)
  points?: Pt[]                    // polyline/polygon vertices in meters
  style?: {
    fill?: string; fillOpacity?: number
    stroke?: string; strokeOpacity?: number
    strokeStyle?: 'solid' | 'dashed' | 'dotted'
    pattern?: 'none' | 'arrows' | 'chevrons'   // route / flow lines
  }
  z?: number                       // order within a layer
}

export interface CatalogItem {
  // ...existing fields
  geometry?: Geometry
  segmentM?: number                // barrier/fence section length
  blocks?: BlockId[]               // calculators this object gets (Phase 2)
}
```

### Features

1. **Draw tool for lines and areas** (L). Copy the interaction OnePlan users already know:
   - click adds a point, right-click removes the last one, double-click finishes, Esc cancels;
   - a live length label while drawing; an area needs at least 3 points, a line at least 2;
   - draggable point handles to edit afterwards.

   Where: a new drawing mode in `FloorCanvas.tsx`; `ElementShape.tsx` renders `<polyline>` and `<polygon>`; maths goes in `geometry.ts`. **M–L**
2. **Live measurements** in the Inspector and on the canvas: length for lines; area and perimeter for areas. Hovering a segment shows its length. **S**
3. **Convert the library**: Barrier, Fence and Wall become lines with `segmentM`; Zone and Tent become areas (keep a rectangle quick-shape too). Add **Flow route** (line with arrows) and **Crowd/standing area**. **S**
4. **Style controls** in the Inspector: fill and stroke colour, opacity, dashed/dotted, arrows. **S**
5. **Z-order, copy/paste, and a right-click menu**: copy, paste, bring to front/back, lock, hide, delete. **S**
6. **Repeat/array**: rows × columns with X and Y gaps (limit 20 × 20), plus a **theatre/classroom block** preset: rows of chairs with an aisle every N seats. **M**

Done when: you can draw a 120 m barrier line and see its length and segment count, draw a standing area and see its m², and lay out a 10 × 12 chair block in one action.

---

## 5. Phase 2: calculators and logistics (the venue-event value, about 1.5–2 weeks)

**Status (2026-10-30): done on `feature/venue-tools`, tested in the browser.**
- The figures live in a new **Ops** tab (Evacuation, Arrivals, Power, Load-in schedule, Inventory) and on a second PDF page.
- Differences from the plan:
  - Barrier sections round up (`ceil`), so the line is fully covered.
  - Posts and cones are `floor(length ÷ spacing) + 1`.
  - Until arrivals are entered, the expected crowd is spread over 75 minutes.
- Added later (`feature/orkesta-polish`):
  - a **Spares** field on barrier, fence, queue-line and cone calculators; spares count in the inventory;
  - a **"Queue won't fit"** warning: the longest queue (about 4 people per meter) is compared with the queue lines (stanchions) drawn on the plan.

### 5.1 Calculator framework

Add `blocks?: Record<BlockId, unknown>` to `PlanElement`. Each block has a typed schema (inputs, defaults, read-only outputs), rendered as a section in the Inspector. Outputs recompute from the geometry, so moving a point updates the numbers. **M**

### 5.2 Calculators to ship

These are the formulas OnePlan uses, confirmed in their app, adapted for indoor venues:

| Calculator | Applies to | Inputs (defaults) | Output |
|---|---|---|---|
| **Crowd/standing capacity** | Areas | Density in m² per person: 2 / 1 / 0.5 / 0.33 / 0.25 / 0.2 (OnePlan's options). Default 0.5 for a cocktail reception | `floor(area ÷ m²_per_person)` |
| **Segment count** | Barrier, fence and pipe-and-drape lines | Section length (crowd barrier 2.2 m, mesh fence 3.5 m, high fence 3 m, front-of-stage 1 m) | `floor(length ÷ segment)` (OnePlan rounds down). Add a "+1 spare" toggle |
| **Cone/stanchion count** | Lines | Spacing 1 m, base 0.27 m | `floor(length ÷ (spacing + base))` |
| **Walking time** | Flow route lines | Speed 5 km/h | `length ÷ speed` in minutes |
| **Power** | Generators, distro, any object | kW supplied or drawn | Totals per zone (see 5.4) |

### 5.3 Life safety, built into the plan (Orkesta's chance to clearly beat OnePlan)

OnePlan's arrival and exit calculators are standalone websites that know nothing about the plan. Orkesta can connect them to the objects you've actually placed.

- **Egress (exit capacity).**
  - Give every *Emergency exit* object a clear width and a "stairs" flag.
  - Exit capacity per minute = sum of exit widths × flow rate. Flow rates: 82 people/m/min on level routes, 66 on stairs, 40 conservative.
  - Compare that against occupancy (seats + standing capacity) to get clearance time, with a "largest exit blocked" scenario.
  - Show it in a new **Safety** panel and in the PDF title block. **M**
- **Arrival queues.**
  - Give registration desks and security checkpoints a throughput (people per 15 min each).
  - Enter expected arrivals per 15 minutes, then calculate queue, wait time and queue length:
    - `queue = max(0, previous + arrivals − capacity)`
    - `wait = queue ÷ capacity × 15`
    - `length (m) = ceil(queue ÷ 4)`
  - Draw a warning when the queue length won't fit the space in front of the desk. **M**
- Keep the existing aisle check, and add **exit approach clearance**: no object within X m in front of an exit. **S**

### 5.4 Vendor logistics (OnePlan stores this data but never uses it)

1. **Object setup** on every element: vendor name, vendor zone, load-in date/time, load-out date/time, power draw (kW). Same fields as OnePlan; check that in ≤ out. **S**
2. **Load-in schedule view**: a timeline or Gantt grouped by vendor, built from those in/out times, with clashes highlighted (two vendors in the same zone at the same time). OnePlan has nothing like this. **M**
3. **Power budget**: kW drawn vs supplied per zone or level, with a warning when over. **S**
4. **Bill of materials export** (CSV and a PDF page): counts per object type, segment and cone totals, grouped by vendor and layer, plus each object's coordinates. That covers OnePlan's object CSV and goes further. **S–M**
5. **Per-vendor exports**: filter by vendor or layer, then PDF/PNG ("only catering"). This is already in PROMPT.md Phase 2 and is cheap once vendor details exist. **S**
6. **Fuller legend in the PDF**: every object type used, not just table tags. OnePlan needs a separate beta site for this. **S**

---

## 6. Phase 3: venue structure and library (about 1–1.5 weeks)

**Status (2026-10-30): done on `feature/venue-tools`.**
- Built:
  - levels;
  - folders with show and lock;
  - cell references;
  - four library packs;
  - custom objects: name, size, colour, round or rectangular, layer;
  - five templates (Gala, Conference, Cocktail, Wedding, Expo). Each opens with clear aisles, unblocked exits and realistic Ops figures.
- Custom objects got an icon picker later (`feature/orkesta-polish`).

1. **Levels/rooms per event** (Ballroom, Foyer, Terrace, Floor 2): each has its own footprint, basemap and elements, with one guest list across all of them. Includes a level switcher and duplicate level. Data model: `Plan.levels: Level[]` and `PlanElement.levelId`. **M–L**
2. **Folders/groups** inside layers (e.g. "Sponsor booths"), with show/lock per group and per object in the list. **M**
3. **Grid cell references**: A–Z by 1–N labels at a chosen cell size (e.g. 5 m), on screen and in exports, so you can say "AED at C4" on the radio. **S**
4. **Library growth in packs** matched to iNBest's event types:
   - **Gala/Wedding:** dance floor, DJ booth, lounge set, cake table, head table, sweetheart table, coat check, photo booth, step-and-repeat.
   - **Conference/Expo:** theatre/classroom/cabaret presets, booths (3 × 3, 3 × 6), pipe and drape, breakout room, interpreter booth, charging station.
   - **Concert/Club:** front-of-stage barrier, mixing desk, VIP riser, bars, toilets block, merch.
   - **Back of house:** power distro, generator, catering pantry, dumpsters, loading dock, green room.
   - **Custom object:** set the name, size, colour and icon, and save it to the library. **M**
5. **Templates/sample plans** (like OnePlan's "Inspiration Hub"): 3–5 starter layouts that open as editable copies. **S**

---

## 7. Phase 4: collaboration backend (already in PROMPT.md Phase 2)

**Status (2026-10-30):** three items here work without a server and are built on `feature/venue-tools`:
- **comments:** pins, replies and resolve; they travel with the plan, so team sync carries them;
- **version history and restore:** stored in this browser;
- **password-protected links:** encrypted in the browser with AES-GCM.

Everything else in this section still needs the server:
- live links that always show the latest version;
- turning links off;
- vendor viewer roles;
- @mentions;
- presence and cursors;
- live co-editing.

Recommended stack: Supabase (Postgres, Auth, Storage for basemaps, Realtime).

- **Live links:** a share link always shows the latest revision. View-only links can be turned off and can have a **password** (OnePlan charges for this).
- **Roles:** owner, editor, vendor viewer (sees only their layers). Per-event access for team members.
- **Comments pinned to the plan:** replies, @mentions, resolve. OnePlan reserves comments for Team at $60 per user per month with a 3-seat minimum.
- **Real-time presence and cursors.** OnePlan only checks for changes every so often (polling); live presence would be a visible upgrade.
- **Revision history** and restore.
- **From PROMPT.md:** QR check-in, seat-level assignment, printable place cards.

---

## 8. Phase 5: outdoor/geo (only if iNBest plans outdoor sites)

OnePlan's core is a satellite map with geo-referenced objects. It's costly to build: MapLibre plus a satellite tile source, an anchor point and rotation for the plan, and GeoJSON import/export. **L**

A cheaper option is "Place aerial image by address": fetch a static satellite image for a location, then use the existing calibration. That covers most outdoor needs.

**Status (2026-10-29): a satellite view is built, without MapLibre.**
- **How it works:** live Esri World Imagery tiles are drawn inside the existing meter-based SVG canvas, under the plan, choosing the tile zoom from the current px/m. A `GeoAnchor` (lat/lng of the plan origin, plus rotation) pins the plan to the world.
- **Placing it:** search an address (Nominatim) or paste `lat, lng`. You can drag the satellite to align it, rotate it around the venue centre, set its opacity, or turn it off. A north arrow and the imagery credit show on the canvas.
- **Everywhere else:** it shows in view-only links, and exports re-fetch tiles for the whole venue at export resolution, with the credit stamped on.

Since then (`feature/orkesta-polish`): the imagery provider, its deepest zoom level and the place-search provider are settings (`VITE_SATELLITE_TILES`, `VITE_SATELLITE_MAX_ZOOM`, `VITE_GEOCODER_URL`; see README). What's left there is signing up with a licensed provider and setting its key.

Still open:
- an account with a licensed imagery and place-search provider (MapTiler, Mapbox, Esri or Google);
- GeoJSON import/export;
- lat/lng readout per object.

---

## 9. Suggested order (next 5 pull requests)

**Status (2026-10-30):** items 1–5 are done, and so are levels and library packs. Also done since (`feature/orkesta-polish`):
- PDF venue drawings, with page choice and drawing scale (1:100);
- unit tests (`npm test`) for the plan maths, auto-seat, share links and templates, run before every deploy;
- the app works offline and installs on phones and desktops;
- Ops figures and comments on phones (section 10, M5);
- the product name, Orkesta.

The backend is next: ROADMAP section 11, "Connecting a real server", and COLLAB_PROMPTS.md. QR check-in comes from iNBest's existing system and will be integrated later.

1. **Hardening:** 0.1 privacy, 0.2 IndexedDB, 0.3 multiple events, 0.5 code-split, 0.6 shortcuts.
2. **Drawn lines and areas, measurements, styling**: Phase 1, items 1–4.
3. **Context menu, z-order, repeat and theatre blocks**: Phase 1, items 5–6.
4. **Calculator framework, crowd/segment/route calculators, object setup, bill of materials**: Phase 2, sections 5.1, 5.2, 5.4.1 and 5.4.4.
5. **Safety panel (egress and arrival queues) plus the fuller PDF legend**: sections 5.3 and 5.4.6.

After that: levels, then library packs, then the backend.

### Positioning

OnePlan is outdoor site planning with paywalls: Free allows 25 objects; Pro is $66/month for 10 events; Team is $60 per user per month (3-seat minimum). Orkesta can be **the indoor venue planner that also handles seating and life safety**, with calculators tied to the plan. Every point in section 9 strengthens that position. None of it means chasing OnePlan's map.

---

## 10. Mobile companion (phones)

**Audit (2026-10-29), before this work:**
- **Phones (375 px):** the plan canvas was 0 px wide, because the library (256 px) and right panel (360 px) filled the screen. The page scrolled sideways to about 919 px, and Share and Export were cut off.
- **View-only links on a phone:** the plan was a 15 px sliver.
- **Tablets (768 px):** the plan got 152 px.
- **Touch:** zoom was mouse-wheel only. Library and guest drag-and-drop used mouse drag events, which don't work on touch. Delete buttons only appeared on hover.
- **Sizing:** 11 controls were 28 px tall, and only one responsive class was used in the whole app.

**Approach:** the phone is a review and on-site companion, not an editor. Below 768 px, a separate layout reuses the same store, and the desktop editor stays as it is. View-only links opened on a phone get this layout automatically. The only planned edit on a phone is guest check-in.

| Phase | Scope | Status |
|---|---|---|
| M1 | Mobile shell with bottom tabs (Map, Tables, Guests, Details). Map: read-only plan and satellite, pinch-to-zoom (also on desktop touch screens), drag to pan, tap a table or object for a details sheet, guest/table search that centers the map, zoom/fit/satellite buttons (44 px). | **Done** on `feature/mobile-companion` |
| M2 | Tables tab (fill bars, tag filter) and Guests tab (search, filters, check-in toggle), with "show on map" from either | **Done** |
| M3 | Details tab (event summary, aisle-check status, PDF download, share link), event switcher on your own phone | **Done** |
| M5 | Ops figures (evacuation, arrivals, power, load-in, inventory) and comments on phones, read-only, with "show on map" | **Done** on `feature/orkesta-polish`: a sixth tab, Ops, plus comment pins and a toggle on the map. |
| M4 | Tablets: collapsible library and panels, a share dialog that fits, visible delete actions, tap-to-seat instead of drag-and-drop, 44 px targets in the editor | **Done**. Below 1280 px the library and panel are drawers and view toggles fold into a menu. Touch screens get 40 px controls and always-visible delete buttons. Tap-to-seat already existed: the table picker in each guest row and in the Inspector. |

**Still to test on real devices:** iOS Safari and Android Chrome. Pinch and the safe areas were only checked in an emulated 375 × 812 viewport, with synthetic touch events. This needs the app hosted over HTTPS.

---

## 11. Build queue before the first deploy (added 2026-10-29)

The first deploy waits until the mobile companion (section 10, done) and both items below are built.

**Status (2026-10-29): Q1 and Q2 are built and tested in test mode.** No server is connected yet. You asked to skip the Azure work for now, so a test backend (`src/lib/backend/mock.ts`) stores the team, invites and messages in the browser and applies the same rules a server must. Connecting a real server is what's left before these features work across devices (see "Connecting a real server" below).

### Q1. Users page, per event (built)

- **Sharing:** "Share with my team" in the Team tab makes you the event's admin. Copies, imports and links always start unshared.
- **Invites:**
  - by email (works once, for that person) or as a link anyone can use; both expire after 7 days;
  - pending invites can be copied again or cancelled;
  - nothing is emailed yet: the admin copies the link and sends it.
- **Roles, per event:**
  - **Admin:** edits the plan, manages people and groups, and sends messages.
  - **Staff:** sees the plan and guest details (dietary notes, not emails), checks guests in and reads messages. Everything else is read-only.
  - A person can be Admin on one event, Staff on another, and nothing on a third.
- **Changes:** change roles or remove people; it applies right away. An event always keeps at least one admin.
- **Where:**
  - a **Team** tab (Messages | People) in the desktop right panel and in the phone tab bar;
  - an account menu (top bar on desktop, Details tab on phones);
  - the events menu also lists events shared with you that aren't on this device yet.
- **Data model (for the server):**
  - `event_members (event_id, user_id, role, joined_at)`
  - `event_invites (event_id, email | null, role, token, expires_at)`
  - `event_checkins (event_id, guest_id)`: kept apart from the plan, so an admin's save never undoes a staff check-in.
- **Decided (2026-10-29):**
  - **Sign-in:** email and password, planned on Azure (Microsoft Entra External ID); deferred.
  - **Staff see guest details,** including dietary needs. Emails stay admin-only.

### Q2. Staff messaging (built)

- **Broadcasts:** admins send to all staff or to a staff group, and manage the groups in the People view.
- **Options:** normal or **urgent** priority, and an optional **pinned map location** (the selected object) that opens the plan there.
- **Staff:**
  - read-only Messages in the Team tab, with an unread badge;
  - a red banner for unread urgent messages (phones also vibrate where supported);
  - no replies.
- **Admins:** compose on desktop or phone, and see read receipts per message ("Read by 3 of 5", with names and times).
- **Delivery:** live in the app.
  - The test backend delivers instantly between open tabs of the same browser.
  - A real server can push updates (Web PubSub/SignalR), or the app can poll.
  - **Web push for urgent messages comes later.** On iPhone it needs the web app added to the home screen (iOS 16.4+).
- **Data model (for the server):**
  - `messages (event_id, sender_id, audience: all | group, group_id, priority, body, pin, created_at)`
  - `message_reads (message_id, user_id, read_at)`
  - `staff_groups (event_id, name)` and `staff_group_members (group_id, user_id)`
- **Decided (2026-10-29):**
  - Messages are **kept indefinitely**.
  - **Only admins send;** staff can't reply.
  - **The event's admins decide group membership.**

### How syncing works

- An admin's edits go to the server about a second after they're made; the top bar shows "Saved for the team".
- Everyone else's copy follows the server's.
- If two admins save at the same moment, the second save is refused instead of overwriting. That person's version is kept as a separate event named "… (your version)".
- Each device keeps its copy in IndexedDB, so a shared event still opens offline (read-only for staff).

### Connecting a real server (not built yet)

The screens talk to one interface, `Backend` in `src/lib/backend/types.ts`. A real server implementation replaces the test backend in `src/lib/backend/index.ts`, and nothing else changes. The server must:

- sign people in with email and password, and identify them on every request;
- enforce the roles itself, because the browser can't be trusted to:
  - only admins change the plan, people, groups and messages;
  - staff get guests without emails;
  - staff only see messages sent to everyone or to their groups;
- refuse a plan save whose `baseUpdatedAt` isn't the current version (HTTP 409);
- keep check-ins separate from the plan;
- answer a small status call (role, plan version, check-ins) that the app can poll cheaply;
- accept large plans: uploaded floor plan images can make them several MB.

On Azure (your original plan, now deferred) that means:

- a Microsoft Entra External ID tenant for sign-in;
- a small API in front of the database (Azure Functions or App Service; the EC2 server could also host it);
- Web PubSub/SignalR, or polling, for live updates.

**Next:** connect a server (needed for teams across devices), deploy, then real-device testing (section 10) on the hosted HTTPS build. The app can also be deployed before a server exists, but team features then only work within one browser.
