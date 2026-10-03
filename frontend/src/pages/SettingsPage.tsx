/**
 * Settings — appearance, account (local), editor defaults, data and security.
 */

import { useState } from 'react';
import {
  Database,
  Download,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, NumberInput, Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FORMATS } from '@/data/formats';
import { FORMAT_GROUPS } from '@/data/formats';
import { parseDesignJSON, serializeToJSON, validateSerializedDesign } from '@/engine';
import { isBackendConfigured, UPLOAD_LIMITS } from '@/services';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { useEditorStore, useProjectStore, useUIStore, useUserStore } from '@/stores';
import { downloadBlob } from '@/lib/utils';

export default function SettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const snapEnabled = useUIStore((s) => s.snapEnabled);
  const toggleSnap = useUIStore((s) => s.toggleSnap);
  const pushToast = useUIStore((s) => s.pushToast);

  const settings = useUserStore((s) => s.settings);
  const updateSettings = useUserStore((s) => s.updateSettings);
  const user = useUserStore((s) => s.user);
  const signIn = useUserStore((s) => s.signIn);
  const signUp = useUserStore((s) => s.signUp);
  const signOut = useUserStore((s) => s.signOut);

  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.load);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const hasBackend = isBackendConfigured();
  // The backend enforces 8+ characters; check here too so people get instant feedback.
  const credentialsReady = Boolean(email.trim()) && (!hasBackend || password.length >= 8);
  const importInput = useState<HTMLInputElement | null>(null);

  const exportAll = async () => {
    await loadProjects();
    const all = storage.get<unknown[]>(STORAGE_KEYS.projects, []);
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      designs: all,
      brandKits: storage.get(STORAGE_KEYS.brandKits, []),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `designforge-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
    pushToast({
      title: 'Backup downloaded',
      description: `${all.length} design${all.length === 1 ? '' : 's'} and your brand kits.`,
      variant: 'success',
    });
  };

  const clearEverything = () => {
    if (!window.confirm('Delete every design, asset and brand kit stored in this browser?')) return;
    storage.remove(STORAGE_KEYS.projects);
    storage.remove(STORAGE_KEYS.assets);
    storage.remove(STORAGE_KEYS.brandKits);
    storage.remove(STORAGE_KEYS.activeBrandKit);
    void loadProjects();
    pushToast({ title: 'Local data cleared', variant: 'default' });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Appearance, editor defaults and your local data. Nothing here requires an account.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* appearance */}
        <Section icon={Palette} title="Appearance" description="Applies to the whole app.">
          <Field label="Theme">
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ]}
            />
          </Field>
        </Section>

        {/* editor defaults */}
        <Section
          icon={GridStyleIcon}
          title="Editor defaults"
          description="Preferences for how the canvas behaves."
        >
          <Row
            label="Show grid by default"
            hint="Overlay a 50px grid on the canvas."
            control={<Switch checked={gridVisible} onCheckedChange={toggleGrid} aria-label="Show grid by default" />}
          />
          <Row
            label="Snapping"
            hint="Snap to canvas centre, edges and other elements while dragging."
            control={<Switch checked={snapEnabled} onCheckedChange={toggleSnap} aria-label="Snapping" />}
          />
          <Row
            label="Autosave"
            hint="Save the current design automatically after you stop editing."
            control={
              <Switch
                checked={settings.autosave}
                onCheckedChange={(autosave) => updateSettings({ autosave })}
                aria-label="Autosave"
              />
            }
          />
          <Field label="Autosave delay">
            <NumberInput
              value={settings.autosaveDelayMs}
              min={500}
              max={15000}
              step={250}
              suffix="ms"
              onChange={(autosaveDelayMs) => updateSettings({ autosaveDelayMs })}
            />
          </Field>
          <Field label="Default format for new designs">
            <Select
              value={settings.defaultFormat}
              onValueChange={(defaultFormat) => updateSettings({ defaultFormat })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_GROUPS.map((group) => (
                  <div key={group.id}>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {group.label}
                    </div>
                    {FORMATS.filter((f) => f.group === group.id).map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* account */}
        <Section
          icon={UserIcon}
          title="Account"
          description={
            hasBackend
              ? 'Your designs, assets and brand kits are saved to your account.'
              : 'Local mode — this session is stored in your browser only.'
          }
        >
          {user ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
                <span
                  className="grid size-9 place-items-center rounded-full text-sm font-semibold text-white"
                  style={{ background: user.avatarColor }}
                >
                  {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                  <p className="truncate text-[11px] text-ink-muted">{user.email}</p>
                </div>
                <Badge variant="brand">{user.plan}</Badge>
              </div>
              <Button variant="outline" onClick={() => void signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] leading-relaxed text-ink-soft">
                {hasBackend
                  ? 'Sign in to save your work to your account. Passwords need at least 8 characters.'
                  : 'Signing in is optional and creates no server account — it gives the app a name and avatar to display.'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                {hasBackend && (
                  <Field label="Password">
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </Field>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={!credentialsReady || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await signIn(email.trim(), name.trim() || undefined, password || undefined);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Sign in
                </Button>
                <Button
                  variant="outline"
                  disabled={!credentialsReady || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await signUp(email.trim(), name.trim() || undefined, password || undefined);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {hasBackend ? 'Create account' : 'Create local profile'}
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* data */}
        <Section
          icon={Database}
          title="Your data"
          description="Everything lives in this browser's local storage."
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
            <Badge variant="outline">{projects.length} designs</Badge>
            <Badge variant="outline">
              {storage.get<unknown[]>(STORAGE_KEYS.assets, []).length} assets
            </Badge>
            <Badge variant="outline">
              {storage.get<unknown[]>(STORAGE_KEYS.brandKits, []).length} brand kits
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void exportAll()}>
              <Download /> Export a JSON backup
            </Button>
            <Button variant="outline" onClick={() => importInput[0]?.click()}>
              <Upload /> Import a design
            </Button>
            <input
              ref={(node) => importInput[1](node)}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                try {
                  const text = await file.text();
                  const parsed = JSON.parse(text) as unknown;

                  // Full backup
                  if (parsed && typeof parsed === 'object' && 'designs' in parsed) {
                    const designs = (parsed as { designs: unknown[] }).designs;
                    const current = storage.get<unknown[]>(STORAGE_KEYS.projects, []);
                    const ids = new Set(
                      current.map((d) => (d as { id?: string }).id).filter(Boolean) as string[],
                    );
                    const merged = [
                      ...current,
                      ...designs.filter((d) => !ids.has((d as { id?: string }).id ?? '')),
                    ];
                    storage.set(STORAGE_KEYS.projects, merged);
                    await loadProjects();
                    pushToast({
                      title: 'Backup imported',
                      description: `${designs.length} designs merged into your library.`,
                      variant: 'success',
                    });
                    return;
                  }

                  // Single design document
                  const validation = validateSerializedDesign(parsed);
                  if (!validation.ok) throw new Error(validation.error);
                  const doc = parseDesignJSON(text);
                  useEditorStore.getState().loadDocument(doc);
                  const current = storage.get<unknown[]>(STORAGE_KEYS.projects, []);
                  if (!current.some((d) => (d as { id?: string }).id === doc.id)) {
                    storage.set(STORAGE_KEYS.projects, [JSON.parse(serializeToJSON(doc)), ...current]);
                    await loadProjects();
                  }
                  pushToast({
                    title: 'Design imported',
                    description: `${doc.name} — open it from My designs.`,
                    variant: 'success',
                  });
                } catch (error) {
                  pushToast({
                    title: 'Import failed',
                    description: error instanceof Error ? error.message : 'Invalid file',
                    variant: 'error',
                  });
                }
              }}
            />
            <Button variant="outline" onClick={clearEverything}>
              <Trash2 /> Clear local data
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Design documents carry a <code className="font-mono text-[10px]">version</code> field, so
            files exported today will still open after the schema evolves — the migration registry
            upgrades them on load.
          </p>
        </Section>

        {/* security */}
        <Section
          icon={ShieldCheck}
          title="Security"
          description="How this app handles your content and secrets."
        >
          <ul className="flex flex-col gap-2 text-[11px] leading-relaxed text-ink-soft">
            {[
              `Uploads are validated by MIME type and capped at ${UPLOAD_LIMITS.label} per file before anything is read into memory.`,
              'Uploaded SVG is stripped of scripts, event handlers, javascript: URLs and foreignObject elements.',
              'User text is stored as data and drawn to a canvas — it is never injected as HTML, so there is no XSS surface.',
              'Imported design JSON is validated (version, canvas, elements) and depth-checked before it reaches the engine.',
              'No AI provider key is ever present in frontend code. AI calls are routed Frontend → your backend → provider, and the client-side AIService interface never touches a secret.',
              isBackendConfigured()
                ? 'A backend is configured for this build.'
                : 'No backend is configured, so every service runs its local implementation.',
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-soft">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function GridStyleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M2 8h12M8 2v12" />
    </svg>
  );
}
