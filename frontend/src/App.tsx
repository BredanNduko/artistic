import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/common/AppShell';
import { Toaster } from '@/components/common/Toaster';
import LandingPage from '@/pages/LandingPage';
import TemplatesPage from '@/pages/TemplatesPage';
import NewDesignPage from '@/pages/NewDesignPage';
import MyDesignsPage from '@/pages/MyDesignsPage';
import AssetsPage from '@/pages/AssetsPage';
import BrandKitPage from '@/pages/BrandKitPage';
import AiStudioPage from '@/pages/AiStudioPage';
import SettingsPage from '@/pages/SettingsPage';
import EditorPage from '@/pages/EditorPage';
import { useTheme as useAppTheme } from '@/hooks/useTheme';

export default function App() {
  useAppTheme();

  return (
    <Routes>
      {/* The editor is full-bleed: it renders its own chrome. */}
      <Route path="/editor/:id" element={<EditorPage />} />
      <Route path="/editor" element={<Navigate to="/editor/new" replace />} />

      {/* Everything else lives inside the app shell. */}
      <Route element={<AppShell />}>
        <Route index element={<LandingPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/new" element={<NewDesignPage />} />
        <Route path="/designs" element={<MyDesignsPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/brand" element={<BrandKitPage />} />
        <Route path="/ai" element={<AiStudioPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/* ------------------------------------------------------------------ */

function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="font-mono text-4xl font-semibold text-ink-muted">404</span>
      <h1 className="text-lg font-medium text-ink">That page does not exist</h1>
      <p className="text-sm text-ink-soft">
        The link may be out of date, or the design you were looking for has been deleted.
      </p>
      <a
        href="/"
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition-opacity hover:opacity-90"
      >
        Back to the home page
      </a>
    </div>
  );
}
