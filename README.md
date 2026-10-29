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
- Object library: seating, staging and AV, catering, safety, security, workforce, wayfinding and branding, decor.
- Move, rotate, align, distribute, duplicate, lock, undo/redo, snap, measure, box select.
- Tables & guests: tags, CSV import/export (`name,company,group,email,dietary,table`), drag guests onto tables, auto-seat, check-in.
- Aisle clearance checks (default 1.2 m, editable in Venue).
- Exports: A3 PDF with iNBest title block, PNG, seating CSV, project JSON.
- Share links (view-only or editable copy) encoded in the URL. View-only links leave out the guest list unless you choose to show names; emails and dietary notes are never included. Opening an editable copy adds it as a new event.
- Multiple events saved in the browser (IndexedDB, including uploaded basemaps): switch, create, duplicate and delete from the menu next to the event name. The top bar shows "Not saved" if the browser blocks storage.

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
  store/usePlanStore.ts     Zustand store, undo/redo, events, autosave
  components/               TopBar, EventsMenu, Library, FloorCanvas, ElementShape, RightPanel,
                            Inspector, TablesPanel, LayersPanel, VenuePanel, ShareDialog
```

## Shortcuts
Del delete · Ctrl+D duplicate · Ctrl+Z / Ctrl+Shift+Z undo/redo · arrows nudge 0.1 m (Shift 1 m) · R rotate 15° · M measure · V select · F fit · Shift+drag box select · Alt+drag pan · Esc cancel

## Phase 2
Real-time collaboration (Supabase Realtime or Liveblocks), vendor roles, comments, revision history, geo-referenced aerial basemaps. See `PROMPT.md`.
