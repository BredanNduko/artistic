DesignForge — architecture summary
===================================

A browser-based graphic design platform. A design is DATA, not a picture: the whole
document is a serialisable JSON tree, and every surface — canvas, thumbnail, export,
AI — is a consumer of that one tree. That single decision is what makes the AI layer
possible later without rewriting the editor.

STACK
-----
React 19 - TypeScript 6 - Vite 8 - Tailwind CSS v4 - shadcn/ui (Radix primitives)
Konva 10 + react-konva 19 - Zustand 5 - React Router 7

LAYERS (dependencies point downward only)
-----------------------------------------
  pages/            route-level composition
  components/       editor chrome, panels, dialogs, UI primitives
  hooks/            cross-cutting behaviour (shortcuts, autosave, thumbnails, theme)
  stores/           Zustand state; editorStore owns the document + history
  services/         the ONLY place that talks to the outside world
  engine/           framework-free domain core (no React import anywhere)
  data/             templates, formats, fonts, categories, locally generated art

THE ENGINE — engine/
--------------------
  types.ts        DesignDocument / DesignElement discriminated unions
  factories.ts    createText / createShape / createImage / createLine / createDocument
  geometry.ts     bounds, hit-testing, alignment, rotation-aware helpers
  ops.ts          immutable element operations (add, move, resize, rotate, group,
                  reorder, z-order) — every op returns a new document
  history.ts      command-based undo/redo with coalescing for drag gestures
  migrations.ts   schema versioning so old documents keep opening
  validation.ts   document invariants, colour + text bounds
  analysis.ts     derived insight: contrast ratios, safe areas, content bounds
  renderer/       describe.ts  document -> renderer-agnostic node descriptors
                  pureKonva.ts descriptor -> Konva tree (used by export)
                  describe.ts is also what thumbnails and previews consume

  The renderer adapter split is deliberate: the document describes WHAT to draw, the
  adapter decides HOW. Swapping Konva for Canvas2D/SVG/WebGL is one new adapter.

STATE — stores/
---------------
  editorStore   document, selection, history, clipboard, viewport
  projectStore  saved designs (delegates persistence to projectService)
  assetStore    uploaded + generated media
  userStore     session, preferences, active brand kit
  uiStore       theme, panels, dialogs, toasts

SERVICES — services/ (each exposes an interface + a local implementation)
------------------------------------------------------------------------
  authService      local single-user session (no passwords handled here)
  templateService  browse / instantiate templates
  projectService   list / save / duplicate / rename / remove designs
  assetService     upload, read as data URL, natural dimensions
  brandKitService  colours, fonts, logos, social handles
  exportService    PNG / JPG / PDF through the shared renderer
  aiService        the AI boundary (see below)
  httpClient       fetch wrapper + API base config

AI READINESS — services/aiService.ts
------------------------------------
  An interface, not a feature. `AIService` declares generateDesign, modifyDesign,
  resizeDesign, rewriteCopy, generateImage, status. `localAIService` implements it
  today with a deterministic, offline engine (prompt -> palette -> composed
  document); `remoteAIService` is the HTTP-backed implementation of the same
  contract, and `aiService` is the single switch that selects one. Adding a real
  model means implementing the interface — zero component changes.

  Because the document is structured data, an AI never has to "see" a pixel: it can
  add an element, restyle a layer, reflow a layout, or hand back a whole document,
  and the editor treats the result exactly like a human edit (including undo).

TEMPLATES — data/templates.ts
-----------------------------
  12 original designs across 12 categories (church, events, business, birthday,
  wedding, conference, social media, announcements, education, marketing, real
  estate, technology). Each is a real DesignDocument, not an image, so every layer
  of every template is editable. All artwork is generated locally in
  data/generated-art.ts and embedded as data URLs — nothing is hot-linked, so
  exports never taint and the library works fully offline.

  Layout strategies demonstrated: centered, leftStack, editorial, split, banner.

RUNNING IT
----------
  npm install
  npm run dev        -> http://localhost:5173
  npm run build      -> production bundle in dist/
  npm run preview
