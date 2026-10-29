# Optimized build prompt: iNBest Floorplan

Copy everything below the line into Claude Code (or any coding agent) from the repo root.

---

## Role
You are a senior front-end engineer building a production-grade, browser-only event floor-plan and seating manager for **iNBest** (inbest.cloud). It must feel like OnePlan (app.oneplan.io): a large to-scale canvas in the middle, an object library on the left, contextual panels on the right, and export/share in the top bar.

## Context
- General-purpose tool for any event and venue. The app starts from a blank plan (default 30 × 20 m venue, no elements, no basemap); the user sets the venue footprint and uploads a drawing.
- All coordinates are element **centers in meters** from the venue's top-left corner.

## Stack (fixed)
Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 (`@tailwindcss/vite`). State: Zustand. Icons: lucide-react. PDF: jsPDF. CSV: PapaParse. Share links: lz-string. No backend in Phase 1.

## Brand (iNBest design system, use tokens only)
- Colors: bg `#f3f6fa`, bg-2 `#e7ecf3`, ink `#0a1729`, ink-2 `#1c2638`, muted `#5b6576`, accent `#1ea7e8`, accent-deep `#075e99`, accent-on-dark `#64c7f5`, on-ink `#eaf1fa`. Radius 12 px, 8 px spacing grid.
- Type: Geist for everything (`public/brand/Geist-VariableFont_wght.ttf`), Geist Mono for eyebrows, labels and numbers, Instrument Serif italic for at most one emphasis word per title.
- Logo is always the image `public/brand/logo-inbest.png` (inverted to white on navy). Never typeset the logo.
- No em dashes in UI copy.

## Data model
- `PlanElement { id, kind, label, x, y, w, h, rotation, layer, locked?, seats?, number?, tag?, color?, notes? }` (meters, degrees).
- `Guest { id, name, company?, group?, email?, dietary?, tableId?, checkedIn? }`.
- `Plan { id, name, venue, date, widthM, heightM, minAisleM, elements, guests, tags, basemap?, layers, updatedAt }`.
- Layers: structure, staging, seating, service, safety, security, workforce, wayfinding, decor, notes. Each has visible + locked.

## Features (Phase 1, must work end to end)
1. **To-scale canvas**: SVG in meter units, wheel zoom around cursor, drag to pan, 1 m / 5 m grid, snap 0.25 m, scale bar, live cursor coordinates, fit-to-venue.
2. **Basemap**: none by default; upload any blueprint or aerial image; set opacity, offset and real width; **calibrate** by measuring a known distance and entering its real length.
3. **Object library** (drag-and-drop or click-to-place, searchable), all true to size: round tables 8/10, banquet, imperial, cocktail, chair, stage, podium, LED screen, speaker, photo wall, FOH, camera, bars, waiter stations, buffet, registration; safety (emergency exit, extinguisher, first aid, AED, assembly point, accessible route); security (checkpoint, CCTV, barriers, fences); **workforce** (security guard, steward, volunteer, event manager, AV tech, host); wayfinding and branding (signs, flow arrows, sponsor banners, totems); decor and structure (plants, tents, zones, walls, text notes).
4. **Editing**: select, Shift multi-select, Shift+drag box select, drag move with snap, rotate handle (15 degree steps), numeric inspector (x, y, w, h, rotation, seats, number, tag, notes, lock), duplicate, delete, align row/column, distribute, arrow-key nudge, undo/redo (100 steps), keyboard shortcuts.
5. **Seating manager**: table grid with fill bars, table tags (General, VIP, Sponsor, Speaker, Press, Staff) colored on the plan, guest list with search and filters, add guest, **CSV import/export** (name, company, group, email, dietary, table), drag a guest onto a table on the plan or in the grid, capacity enforcement, check-in toggle, auto-seat that keeps groups together.
6. **Safety checks**: aisle clearance (chair-back to chair-back, table radius + 0.75 m) against a configurable minimum (default 1.2 m), drawn as red dashed lines with the gap in meters, plus a conflict counter.
7. **Export**: A3 landscape 300 dpi PDF with an iNBest navy title block (event, venue, date, tables/seats, guests seated, scale 1:N, revision, tag legend), optional grid and aisle overlay; 6000 px PNG; seating CSV; project JSON.
8. **Share**: link that encodes the plan (view-only or editable copy). View-only mode hides the library and disables editing but keeps pan, zoom, layers and export. View-only links never carry guest emails or dietary notes (guest names only when the sender opts in); an opened editable copy becomes a new event.
9. **Persistence**: multiple events autosaved to IndexedDB (plans and basemaps), with a visible "Not saved" state on failure; open project JSON as a new event; create, duplicate and delete events.

## Phase 2 (design for it, do not build yet)
- Supabase (Postgres + Auth + Realtime) or Liveblocks/Yjs for real-time multi-user rooms, presence cursors, comments pinned to the plan, role-based links (owner, editor, vendor viewer), revision history.
- Aerial basemaps from map tiles with geo-referenced meters. (Built: satellite tiles under the plan with a lat/lng anchor and rotation; see ROADMAP.md section 8.)
- Per-vendor filtered exports (e.g. only catering layer), QR check-in, seat-level assignment, printable place cards.

## Acceptance criteria
- `npm run build` passes with zero TypeScript errors.
- On first load an empty plan renders with the venue outline and grid, and tables placed from the library get numbered automatically.
- A guest dragged onto a table appears in its inspector and its `n/10` counter; an 11th guest is refused.
- Exported PDF opens, shows the whole venue to scale with the title block.
- A view-only share link opens the same layout without the library or edit controls.

## Deliverables
Scaffolded repo with `src/{types.ts, lib/, data/, store/, components/}`, a README with run instructions, and no placeholder TODOs in shipped features.
