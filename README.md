# Orkesta

By iNBest. To-scale floor plan, seating and operations manager for events. Built with Vite, React, TypeScript and Tailwind (iNBest design system).

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm test         # unit tests (also run before every deploy)
```

## What's in the prototype
- Home hub (`/`), modelled on OnePlan's dashboard:
  - **Continue:** the event you last worked on.
  - **Start:** New event, From a venue drawing, or Open a project file. Templates (Gala dinner, Conference, Cocktail reception, Wedding, Expo) show as cards with thumbnails.
  - **Your events:** cards or a list with a thumbnail drawn from each plan, venue, date ("in 22 days"), last edited, role and seats. Search, filters (All, Upcoming, Past, Shared, Archived) and sorting (last edited, event date, name).
  - **Each event's ⋯ menu:** Open, Rename, Duplicate, Share link, Version history, Archive, and Delete, which asks you to type the event's name. "Select" archives or deletes several at once.
  - **Shared with you:** team events not on this device yet.
- **New event:** name, date, venue (address suggestions with a Google key; the picked place centres the satellite view) and size, then start blank, from a template, or from the venue's PDF or image.
- Each event has its own address (`/events/<id>`), so Back returns to the hub. In the editor, the logo ("All events") goes back to the hub, and the menu next to the event name switches between recent events.
- Venue drawings (Venue tab): upload a PDF or an image as the basemap. For a PDF with several pages, pick the floor plan page. If the sheet states a scale (1:100), enter it to size the drawing exactly; otherwise calibrate it against a known dimension with the measure tool. "Fit footprint to drawing" sets the venue's size to the drawing's.
- Satellite view (Venue tab): search an address or paste `lat, lng`, then drag and rotate the satellite to line it up with the venue. Imagery stays sharp as you zoom, shows in view-only links, and is included (with attribution) in PNG and PDF exports.
- Object library: seating, staging and AV, catering, power, lines and areas, safety, security, workforce, wayfinding and branding, decor, plus packs for gala and wedding, conference and expo, concert and club, and back of house. "Custom object" saves your own item (name, size, colour, round or rectangular, layer and an optional icon) to the library.
- Lines and areas: pick a barrier, fence, wall, queue line, route or area from "Lines & areas", then click to add points, right-click to remove the last one, and double-click or Enter to finish. Length and area show live while drawing and in the Inspector; drag a point to edit, or drag a midpoint to add one. Each line or area gets its own calculator: barrier sections and posts or cones (plus any spares you add), walking or driving time, standing capacity by density, camping pitches, parking spaces. Style controls set fill, stroke, opacity, dashes and arrows.
- Move, rotate, align, distribute, duplicate, lock, hide, undo/redo, snap, measure, box select. Right-click for a menu (copy, paste, layer order, lock, hide, group, repeat, delete). Repeat makes rows × columns copies; "Seating block" lays out theatre or classroom rows with aisles as one folder.
- Layers panel: folders inside each layer, with show and lock per folder and per object.
- Levels (menu next to the event name): floors or rooms with their own footprint, basemap and objects, one guest list across all of them. Switch, add, rename, reorder, duplicate or delete levels.
- Cell references (Venue tab): A1, B2… cells of any size on the plan and in exports; the Inspector shows the cell of the selected object.
- Comments: press C or use the comment tool, click the plan to pin a comment, reply, resolve. The Comments button shows or hides them.
- Ops tab:
  - Evacuation: people (seats plus standing, or a crowd size you enter) against exit flow (exit width × flow rate), assuming the widest exit is blocked, plus objects too close to an exit.
  - Arrivals: queue, wait and queue length per 15 minutes from the registration desks and checkpoints you placed. Until you enter arrivals, the expected crowd is spread over 75 minutes. Draw queue lines (stanchions) where people will wait, and it warns when the longest queue won't fit along them.
  - Power: kW supplied (generators, mains) against kW drawn, per zone.
  - Load-in schedule: a timeline per vendor from each object's load-in and load-out, with clashes (different vendors in the same zone at once) highlighted.
  - Inventory: counts by type, barrier sections, cones and posts, lengths and areas.
- Version history (events menu): a snapshot every 30 minutes of editing (last 30 kept) and named versions; restoring saves the current plan first.
- Tables & guests: tags, CSV import/export (`name,company,group,email,dietary,table,tag`), drag guests onto tables, check-in.
- Auto-seat (Auto button): keeps groups and companies together, seats tagged guests (VIP, Sponsor…) only at tables with the same tag (overflowing to General tables), and splits groups too big for one table across neighbouring tables. Choose "fill tables in order" or "spread evenly", and optionally re-seat everyone (asks first, undoable). Guests already seated by hand stay put otherwise.
- Aisle clearance checks (default 1.2 m, editable in Venue).
- Exports: A3 PDF with iNBest title block, a legend of every object type and a second page with the inventory and the Ops figures; PNG; seating CSV; inventory CSV; project JSON. "Vendor / layer export…" filters any of these to one vendor or a set of layers. Exports show the level you're viewing.
- Share links (view-only or editable copy) encoded in the URL. View-only links leave out the guest list unless you choose to show names; emails and dietary notes are never included. Opening an editable copy adds it as a new event. Links can be protected with a password: the plan is encrypted in the browser (AES-GCM, key from PBKDF2) and only opens with the password.
- Phones (under 768 px wide) open on a simple hub (Continue, Upcoming, your events, Shared with you), then a read-only mobile companion with six tabs; the back arrow returns to the hub. Map: the plan (and satellite) with pinch-to-zoom, drag to pan, tap a table to see who sits there, and a guest/table search that centers the map. Tables: fill bars and a tag filter. Guests: search, filters (unseated, checked in) and a check-in button (on your own phone or as event staff; view-only links show status only). Ops: the evacuation, arrivals, power, load-in and inventory figures, read-only, plus the comments list; tapping an exit, object or comment shows it on the map. Comment pins show on the map too (toggle with the comment button). Team: messages and people (see Teams below). Details: event summary, aisle-check status, tag counts, PDF download, a view-only share link without guest details, and switching between your events. "Show on map" works from any table or guest.
- Tablets and small laptops (768 to 1279 px): the library and right panel become slide-over drawers (Objects and Panel buttons), view toggles fold into a View menu, and the plan gets the full width. On touch screens buttons grow to 40 px, delete actions are always visible, and pinch-to-zoom works in the editor. Seat guests on touch with the table picker in the guest list or the Inspector.
- Events are saved in the browser (IndexedDB, including uploaded basemaps), each with a small summary (counts and thumbnail) so the hub never loads whole plans. The top bar shows "Not saved" if the browser blocks storage.
- Teams (Team tab, desktop and phone): share an event, invite people by email or link, and give each person a role for that event. Admins edit the plan and manage people; staff see the plan and guest details (no emails), check guests in and read messages. Admins message all staff or a group, mark messages urgent (a banner on staff screens) and pin a place on the map, and see who has read each message. See ROADMAP.md section 11.
- Works offline and installs like an app: once opened, the whole app is cached on the device, so plans, drawings, exports and PDF import keep working without a connection (satellite imagery and place search need one). Install it from the browser ("Add to Home Screen" on phones, the install icon in Chrome or Edge). When a new version is published, a banner offers to reload; nothing reloads mid-edit.
- Profile (account menu → "Your profile…"): your name, job title, company, phone and an avatar (a photo, cropped and shrunk to a few KB, or initials on a colour you pick). It's how you appear on comments, messages and the People list.
  - **Phone privacy:** like your email, your phone is shown only to admins of events you're on.
  - **First sign-in:** a one-time welcome step asks you to set it up. That includes people who join from an invite, whose name is otherwise guessed from their email.
  - **"Later":** skips it on that device.
- Test mode: no server is connected yet. A test backend keeps the team, invites and messages in this browser and applies the same rules a server must. Each browser tab signs in separately, so open an invite link in a second tab to try the app as that person and watch messages arrive live. Switch test accounts from the account menu.

Confirm safety marker positions (extinguishers, exits, first aid) with the venue and local civil protection.

## Structure
```
src/
  types.ts                  data model (meters, degrees)
  data/blankPlan.ts         default empty plan
  data/templates.ts         starter layouts for "New event…"
  test/fixtures.ts          helpers for the unit tests (*.test.ts next to the code they test)
  lib/route.ts              addresses: / (hub) and /events/<id>
  lib/thumb.ts              plan thumbnails for event cards (numbers only)
  lib/hubList.ts            hub filters, search, sorting and event dates
  components/hub/           Hub (home), PlanThumb, template thumbnails
  lib/catalog.ts            object library, layers, packs, custom objects
  lib/geometry.ts           snap, clearance checks
  lib/shapes.ts             drawn lines and areas: length, area, hit-testing, markers
  lib/calcs.ts              calculators for lines, areas, exits and entrances
  lib/ops.ts                evacuation, arrivals, power, schedule, inventory
  lib/levels.ts             levels and per-level visibility
  lib/layouts.ts            theatre and classroom seating blocks
  lib/gridref.ts            A1-style cell references
  lib/pdfImport.ts          PDF venue drawings to basemaps (pdf.js, loaded on demand)
  lib/pwa.ts                offline service worker and the update banner
  lib/exportPlan.ts         PDF / PNG export (loaded on demand)
  lib/share.ts, csv.ts      share links (plain and password-protected), guest CSV
  lib/inventoryCsv.ts       inventory CSV
  lib/db.ts                 IndexedDB event storage and version history
  lib/canvas.ts             live SVG ref, fit request
  lib/geo.ts                satellite tiles, geo anchor math, place search
  lib/seating.ts            auto-seat algorithm
  lib/useMediaQuery.ts      phone breakpoint (MOBILE_QUERY)
  lib/backend/              Backend interface (types.ts) and the in-browser test backend (mock.ts)
  components/mobile/        MobileHub (phone home), MobileApp (shell, tabs), MobileMap, MobileTables, MobileGuests, MobileDetails, Sheets (bottom sheets, check-in)
  components/team/          TeamPanel, PeopleSection, MessagesSection, AccountMenu, ProfileDialog, Avatar, UrgentBanner
  lib/profile.ts            profile fields and the rules both the app and the backend apply
  store/usePlanStore.ts     Zustand store, undo/redo, events, autosave
  store/team.ts             sign-in, roles, sharing and sync, invites, check-in, messages
  components/dialogs/       New event, Repeat, Seating block, Custom object, Load-in schedule, Vendor / layer export, Version history
  components/               TopBar, EventsMenu, LevelMenu, Library, FloorCanvas, ElementShape, ContextMenu, Comments,
                            RightPanel, Inspector, TablesPanel, LayersPanel, VenuePanel, OpsPanel, SatelliteSection,
                            ShareDialog, PasswordGate
```

## Shortcuts
Del delete · Ctrl+C / Ctrl+X / Ctrl+V copy, cut, paste · Ctrl+D duplicate · Ctrl+A select all · Ctrl+G group, Ctrl+Shift+G ungroup · Ctrl+Shift+L lock · Ctrl+Shift+H hide · Ctrl+Z / Ctrl+Shift+Z undo/redo · arrows nudge 0.1 m (Shift 1 m) · R rotate 15° · ] / [ bring to front / send to back (Shift: one step) · M measure · V select · C comment · F fit · Shift+drag box select · Alt+drag pan · right-click menu · Esc cancel. While drawing: Enter finish, Backspace remove the last point. On a Mac, Cmd works in place of Ctrl.

## Satellite imagery and place search
Defaults need no keys: Esri World Imagery tiles and OpenStreetMap Nominatim search. Both are fine for a prototype but not licensed for a commercial product. For production, sign up with a keyed provider (MapTiler, Mapbox, Esri Location Platform or Google Map Tiles) and set these in `.env.local` and in the deploy's environment:
```bash
VITE_SATELLITE_TILES="https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=YOUR_KEY"
VITE_SATELLITE_ATTRIBUTION="© MapTiler © Maxar"
# the provider's deepest tile level (Esri stops at 19); higher gives sharper close-ups
VITE_SATELLITE_MAX_ZOOM=20
VITE_GEOCODER_URL="https://api.maptiler.com/geocoding/{q}.json?key=YOUR_KEY&limit=5"
VITE_GEOCODER_NAME="MapTiler"
```
`{q}` is replaced by the search text. The geocoder can return a Nominatim-style list (Nominatim, LocationIQ) or GeoJSON features (MapTiler, Mapbox, Geoapify). Check each provider's current URLs and zoom levels in its docs. Map keys end up in the browser, which is normal for these services: restrict each key to your site's domain in the provider's dashboard.
Nominatim allows about 1 search per second and no search-as-you-type; the app only searches on submit.

### Google address search
Set `VITE_GOOGLE_MAPS_API_KEY` in `.env.local` to search with Google Places. The New event dialog then shows address suggestions as you type, and the Venue tab's search uses Google too. In Google Cloud the key needs **Places API (New)** enabled, and its website restrictions must list every origin the app runs on (for example `http://localhost:5173/*` and `http://localhost:4173/*` for dev and preview, plus the deployed domain). If Google refuses a request, suggestions turn off and search falls back to the geocoder above.

## Phase 2
Connect a real server for teams across devices (ROADMAP.md section 11), then live co-editing, links that always show the latest version, vendor roles, email invites and push notifications. Comments, version history and password links already work in the browser; with a server they become shared and synced. See `COLLAB_PROMPTS.md` and `PROMPT.md`.
