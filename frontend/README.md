# DesignForge

A browser-based, AI-ready graphic design platform. Built as a poster-focused MVP on
top of a general visual-design engine: a design is structured JSON data, so the
canvas, thumbnails, exports and the AI layer are all consumers of the same document.

## Stack

React 19 - TypeScript - Vite - Tailwind CSS v4 - shadcn/ui - Konva / react-konva -
Zustand - React Router

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle -> dist/
npm run preview
```

## What works today

| Capability | Status |
|---|---|
| Template browsing (12 designs, 12 categories) | working |
| Drag / resize / rotate elements | working |
| Click-to-select with transform handles | working |
| Layer panel, z-order, group/ungroup | working |
| Text editing (typeface, size, weight, colour, align, line height, spacing) | working |
| Image upload (embedded as data URL, offline-safe) | working |
| Undo / redo with gesture coalescing | working |
| Autosave + "My designs" (localStorage) | working |
| PNG / JPG / PDF export | working |
| Brand kit (colours, fonts, logos, handles) | working |
| AI Studio (prompt -> design, copy rewrite, smart resize) | local deterministic engine |
| Connected remote AI provider | interface ready, not connected |

## Architecture in one paragraph

`engine/` is framework-free domain code — types, factories, geometry, immutable
operations, command-based history, migrations, validation and analysis. A renderer
adapter turns the document into renderer-agnostic node descriptors, and a second
adapter turns those descriptors into a Konva tree; the same path renders the live
canvas and the exported file, so what you see is what you get. `stores/` holds
Zustand state, `services/` is the only layer that touches the outside world (auth,
templates, projects, assets, brand kits, export, AI) and each service is an
interface with a swappable implementation.

Full write-up: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
Verification evidence: [`docs/VERIFICATION.md`](docs/VERIFICATION.md)
Screenshots: [`screenshots/`](screenshots)

## AI readiness

`services/aiService.ts` defines the `AIService` contract (generate, modify, resize,
rewrite copy, generate image). It ships with a deterministic offline implementation
and a remote HTTP implementation behind the same interface, selected by one export.
Because documents are structured data, an AI can manipulate layers directly rather
than generating pixels — and its output flows through the normal command history,
so it is undoable like any human edit.
