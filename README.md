# iNBest Floorplan

To-scale floor plan, seating and operations manager for events. Built with Vite, React, TypeScript and Tailwind (iNBest design system).

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## What's in the prototype
- Starts from a blank 30 × 20 m plan (`src/data/blankPlan.ts`); upload a venue drawing or aerial image as a calibrated basemap.
- Satellite view (Venue tab): search an address or paste `lat, lng`, then drag and rotate the satellite to line it up with the venue. Imagery stays sharp as you zoom, shows in view-only links, and is included (with attribution) in PNG and PDF exports.
- Object library: seating, staging and AV, catering, safety, security, workforce, wayfinding and branding, decor.
- Move, rotate, align, distribute, duplicate, lock, undo/redo, snap, measure, box select.
- Tables & guests: tags, CSV import/export (`name,company,group,email,dietary,table,tag`), drag guests onto tables, check-in.
- Auto-seat (Auto button): keeps groups and companies together, seats tagged guests (VIP, Sponsor…) only at tables with the same tag (overflowing to General tables), and splits groups too big for one table across neighbouring tables. Choose "fill tables in order" or "spread evenly", and optionally re-seat everyone (asks first, undoable). Guests already seated by hand stay put otherwise.
- Aisle clearance checks (default 1.2 m, editable in Venue).
- Exports: A3 PDF with iNBest title block, PNG, seating CSV, project JSON.
- Share links (view-only or editable copy) encoded in the URL. View-only links leave out the guest list unless you choose to show names; emails and dietary notes are never included. Opening an editable copy adds it as a new event.
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
  lib/catalog.ts            object library + layers
  lib/geometry.ts           snap, clearance checks
  lib/exportPlan.ts         PDF / PNG export (loaded on demand)
  lib/share.ts, csv.ts      share links, guest CSV
  lib/db.ts                 IndexedDB event storage
  lib/canvas.ts             live SVG ref, fit request
  lib/geo.ts                satellite tiles, geo anchor math, place search
  lib/seating.ts            auto-seat algorithm
  lib/useMediaQuery.ts      phone breakpoint (MOBILE_QUERY)
  lib/backend/              Backend interface (types.ts) and the in-browser test backend (mock.ts)
  components/mobile/        MobileApp (shell, tabs), MobileMap, MobileTables, MobileGuests, MobileDetails, Sheets (bottom sheets, check-in)
  components/team/          TeamPanel, PeopleSection, MessagesSection, AccountMenu, UrgentBanner
  store/usePlanStore.ts     Zustand store, undo/redo, events, autosave
  store/team.ts             sign-in, roles, sharing and sync, invites, check-in, messages
  components/               TopBar, EventsMenu, Library, FloorCanvas, ElementShape, RightPanel,
                            Inspector, TablesPanel, LayersPanel, VenuePanel, SatelliteSection, ShareDialog
```

## Shortcuts
Del delete · Ctrl+D duplicate · Ctrl+Z / Ctrl+Shift+Z undo/redo · arrows nudge 0.1 m (Shift 1 m) · R rotate 15° · M measure · V select · F fit · Shift+drag box select · Alt+drag pan · Esc cancel

## Satellite imagery and place search
Defaults need no keys: Esri World Imagery tiles and OpenStreetMap Nominatim search. Both are fine for a prototype. For production, use a keyed imagery provider (Esri Location Platform, MapTiler, Mapbox or Google Map Tiles) and a geocoder you're licensed for:
```bash
VITE_SATELLITE_TILES="https://example.com/tiles/{z}/{x}/{y}.jpg?key=..."
VITE_SATELLITE_ATTRIBUTION="Imagery © Your provider"
```
Nominatim allows about 1 search per second and no search-as-you-type; the app only searches on submit.

## Phase 2
Connect a real server for teams across devices (ROADMAP.md section 11), then live co-editing, vendor roles, comments and revision history. See `PROMPT.md`.
