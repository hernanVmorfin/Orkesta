# iNBest Floorplan

To-scale floor plan, seating and operations manager for events. Built with Vite, React, TypeScript and Tailwind (iNBest design system).

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## What's in the prototype
- Starts from a blank 30 × 20 m plan (`src/data/blankPlan.ts`) or a template (Gala dinner, Conference, Cocktail reception, Wedding, Expo) from "New event…"; upload a venue drawing or aerial image as a calibrated basemap.
- Satellite view (Venue tab): search an address or paste `lat, lng`, then drag and rotate the satellite to line it up with the venue. Imagery stays sharp as you zoom, shows in view-only links, and is included (with attribution) in PNG and PDF exports.
- Object library: seating, staging and AV, catering, power, lines and areas, safety, security, workforce, wayfinding and branding, decor, plus packs for gala and wedding, conference and expo, concert and club, and back of house. "Custom object" saves your own item (name, size, colour, round or rectangular, layer) to the library.
- Lines and areas: pick a barrier, fence, wall, queue line, route or area from "Lines & areas", then click to add points, right-click to remove the last one, and double-click or Enter to finish. Length and area show live while drawing and in the Inspector; drag a point to edit, or drag a midpoint to add one. Each line or area gets its own calculator: barrier sections, posts or cones, walking or driving time, standing capacity by density, camping pitches, parking spaces. Style controls set fill, stroke, opacity, dashes and arrows.
- Move, rotate, align, distribute, duplicate, lock, hide, undo/redo, snap, measure, box select. Right-click for a menu (copy, paste, layer order, lock, hide, group, repeat, delete). Repeat makes rows × columns copies; "Seating block" lays out theatre or classroom rows with aisles as one folder.
- Layers panel: folders inside each layer, with show and lock per folder and per object.
- Levels (menu next to the event name): floors or rooms with their own footprint, basemap and objects, one guest list across all of them. Switch, add, rename, reorder, duplicate or delete levels.
- Cell references (Venue tab): A1, B2… cells of any size on the plan and in exports; the Inspector shows the cell of the selected object.
- Comments: press C or use the comment tool, click the plan to pin a comment, reply, resolve. The Comments button shows or hides them.
- Ops tab:
  - Evacuation: people (seats plus standing, or a crowd size you enter) against exit flow (exit width × flow rate), assuming the widest exit is blocked, plus objects too close to an exit.
  - Arrivals: queue, wait and queue length per 15 minutes from the registration desks and checkpoints you placed. Until you enter arrivals, the expected crowd is spread over 75 minutes.
  - Power: kW supplied (generators, mains) against kW drawn, per zone.
  - Load-in schedule: a timeline per vendor from each object's load-in and load-out, with clashes (different vendors in the same zone at once) highlighted.
  - Inventory: counts by type, barrier sections, cones and posts, lengths and areas.
- Version history (events menu): a snapshot every 30 minutes of editing (last 30 kept) and named versions; restoring saves the current plan first.
- Tables & guests: tags, CSV import/export (`name,company,group,email,dietary,table,tag`), drag guests onto tables, check-in.
- Auto-seat (Auto button): keeps groups and companies together, seats tagged guests (VIP, Sponsor…) only at tables with the same tag (overflowing to General tables), and splits groups too big for one table across neighbouring tables. Choose "fill tables in order" or "spread evenly", and optionally re-seat everyone (asks first, undoable). Guests already seated by hand stay put otherwise.
- Aisle clearance checks (default 1.2 m, editable in Venue).
- Exports: A3 PDF with iNBest title block, a legend of every object type and a second page with the inventory and the Ops figures; PNG; seating CSV; inventory CSV; project JSON. "Vendor / layer export…" filters any of these to one vendor or a set of layers. Exports show the level you're viewing.
- Share links (view-only or editable copy) encoded in the URL. View-only links leave out the guest list unless you choose to show names; emails and dietary notes are never included. Opening an editable copy adds it as a new event. Links can be protected with a password: the plan is encrypted in the browser (AES-GCM, key from PBKDF2) and only opens with the password.
- Phones (under 768 px wide) get a read-only mobile companion with five tabs. Map: the plan (and satellite) with pinch-to-zoom, drag to pan, tap a table to see who sits there, and a guest/table search that centers the map. Tables: fill bars and a tag filter. Guests: search, filters (unseated, checked in) and a check-in button (on your own phone or as event staff; view-only links show status only). Team: messages and people (see Teams below). Details: event summary, aisle-check status, tag counts, PDF download, a view-only share link without guest details, and switching between your events. "Show on map" works from any table or guest.
- Tablets and small laptops (768 to 1279 px): the library and right panel become slide-over drawers (Objects and Panel buttons), view toggles fold into a View menu, and the plan gets the full width. On touch screens buttons grow to 40 px, delete actions are always visible, and pinch-to-zoom works in the editor. Seat guests on touch with the table picker in the guest list or the Inspector.
- Multiple events saved in the browser (IndexedDB, including uploaded basemaps): switch, create, duplicate and delete from the menu next to the event name. The top bar shows "Not saved" if the browser blocks storage.
- Teams (Team tab, desktop and phone): share an event, invite people by email or link, and give each person a role for that event. Admins edit the plan and manage people; staff see the plan and guest details (no emails), check guests in and read messages. Admins message all staff or a group, mark messages urgent (a banner on staff screens) and pin a place on the map, and see who has read each message. See ROADMAP.md section 11.
- Test mode: no server is connected yet. A test backend keeps the team, invites and messages in this browser and applies the same rules a server must. Each browser tab signs in separately, so open an invite link in a second tab to try the app as that person and watch messages arrive live. Switch test accounts from the account menu.

Confirm safety marker positions (extinguishers, exits, first aid) with the venue and local civil protection.

## Structure
```
src/
  types.ts                  data model (meters, degrees)
  data/blankPlan.ts         default empty plan
  data/templates.ts         starter layouts for "New event…"
  lib/catalog.ts            object library, layers, packs, custom objects
  lib/geometry.ts           snap, clearance checks
  lib/shapes.ts             drawn lines and areas: length, area, hit-testing, markers
  lib/calcs.ts              calculators for lines, areas, exits and entrances
  lib/ops.ts                evacuation, arrivals, power, schedule, inventory
  lib/levels.ts             levels and per-level visibility
  lib/layouts.ts            theatre and classroom seating blocks
  lib/gridref.ts            A1-style cell references
  lib/exportPlan.ts         PDF / PNG export (loaded on demand)
  lib/share.ts, csv.ts      share links (plain and password-protected), guest CSV
  lib/inventoryCsv.ts       inventory CSV
  lib/db.ts                 IndexedDB event storage and version history
  lib/canvas.ts             live SVG ref, fit request
  lib/geo.ts                satellite tiles, geo anchor math, place search
  lib/seating.ts            auto-seat algorithm
  lib/useMediaQuery.ts      phone breakpoint (MOBILE_QUERY)
  lib/backend/              Backend interface (types.ts) and the in-browser test backend (mock.ts)
  components/mobile/        MobileApp (shell, tabs), MobileMap, MobileTables, MobileGuests, MobileDetails, Sheets (bottom sheets, check-in)
  components/team/          TeamPanel, PeopleSection, MessagesSection, AccountMenu, UrgentBanner
  store/usePlanStore.ts     Zustand store, undo/redo, events, autosave
  store/team.ts             sign-in, roles, sharing and sync, invites, check-in, messages
  components/dialogs/       Repeat, Seating block, Templates, Custom object, Load-in schedule, Vendor / layer export, Version history
  components/               TopBar, EventsMenu, LevelMenu, Library, FloorCanvas, ElementShape, ContextMenu, Comments,
                            RightPanel, Inspector, TablesPanel, LayersPanel, VenuePanel, OpsPanel, SatelliteSection,
                            ShareDialog, PasswordGate
```

## Shortcuts
Del delete · Ctrl+C / Ctrl+X / Ctrl+V copy, cut, paste · Ctrl+D duplicate · Ctrl+A select all · Ctrl+G group, Ctrl+Shift+G ungroup · Ctrl+Shift+L lock · Ctrl+Shift+H hide · Ctrl+Z / Ctrl+Shift+Z undo/redo · arrows nudge 0.1 m (Shift 1 m) · R rotate 15° · ] / [ bring to front / send to back (Shift: one step) · M measure · V select · C comment · F fit · Shift+drag box select · Alt+drag pan · right-click menu · Esc cancel. While drawing: Enter finish, Backspace remove the last point. On a Mac, Cmd works in place of Ctrl.

## Satellite imagery and place search
Defaults need no keys: Esri World Imagery tiles and OpenStreetMap Nominatim search. Both are fine for a prototype. For production, use a keyed imagery provider (Esri Location Platform, MapTiler, Mapbox or Google Map Tiles) and a geocoder you're licensed for:
```bash
VITE_SATELLITE_TILES="https://example.com/tiles/{z}/{x}/{y}.jpg?key=..."
VITE_SATELLITE_ATTRIBUTION="Imagery © Your provider"
```
Nominatim allows about 1 search per second and no search-as-you-type; the app only searches on submit.

## Phase 2
Connect a real server for teams across devices (ROADMAP.md section 11), then live co-editing, links that always show the latest version, vendor roles, email invites and push notifications. Comments, version history and password links already work in the browser; with a server they become shared and synced. See `COLLAB_PROMPTS.md` and `PROMPT.md`.
