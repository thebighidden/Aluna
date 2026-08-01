'use client';

/* eslint-disable @next/next/no-img-element */
import {
  Bell,
  BookOpen,
  Boxes,
  ChevronDown,
  Clock3,
  Download,
  FolderKanban,
  History,
  Image as ImageIcon,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiErrorMessage, authFetch, currentUser, logout, StudioUser } from '../lib/auth-client';

type StudioSection =
  'create' | 'campaigns' | 'library' | 'presets' | 'history' | 'team' | 'settings';

type ScenePreset = { id: string; name: string };
type CategoryPreset = { id: string; label: string; scenes: ScenePreset[] };
type GenerationStatus = 'queued' | 'analyzing' | 'generating' | 'done' | 'failed';

type Generation = {
  id: string;
  status: GenerationStatus;
  provider: string;
  model?: string;
  category: string;
  sceneId: string;
  brief: string | null;
  outputKeys: string[];
  resultUrls: string[];
  costUsd: number;
  durationMs: number;
  error: string | null;
  errorCode?: string | null;
  providerUsageUnits?: number;
  providerUsageUnit?: string;
  createdAt: string;
};

type RuntimeConfiguration = {
  provider: 'cloudflare' | 'openai';
  providerLabel: string;
  model: string;
  quality: string;
  imageSize: string;
  configured: boolean;
  missingConfiguration: string[];
  usageUnit: 'neurons' | 'tokens';
  dailyFreeUnits: number | null;
  estimatedUnitsPerImage: number | null;
};

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: StudioUser['role'];
  isActive: boolean;
  createdAt: string;
  permissions: string[];
  _count: { generations: number };
};

const fallbackPresets: CategoryPreset[] = [
  {
    id: 'clothing',
    label: 'Clothing',
    scenes: [
      { id: 'studio', name: 'Editorial Studio' },
      { id: 'street', name: 'Modern Street' },
      { id: 'detail', name: 'Material Detail' },
    ],
  },
  {
    id: 'cosmetics',
    label: 'Cosmetics',
    scenes: [
      { id: 'vanity', name: 'Luxury Vanity' },
      { id: 'water', name: 'Fresh Water' },
      { id: 'botanical', name: 'Botanical Editorial' },
    ],
  },
  {
    id: 'food',
    label: 'Food',
    scenes: [
      { id: 'table', name: 'Appetizing Table' },
      { id: 'kitchen', name: 'Bright Kitchen' },
      { id: 'graphic', name: 'Bold Color' },
    ],
  },
  {
    id: 'jewelry',
    label: 'Jewelry',
    scenes: [
      { id: 'velvet', name: 'Velvet Gallery' },
      { id: 'marble', name: 'Sunlit Marble' },
      { id: 'evening', name: 'Evening Glow' },
    ],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    scenes: [
      { id: 'loft', name: 'Architectural Loft' },
      { id: 'minimal', name: 'Minimal Studio' },
      { id: 'home', name: 'Lived-in Home' },
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    scenes: [
      { id: 'tech', name: 'Precision Tech' },
      { id: 'desk', name: 'Creative Desk' },
      { id: 'dynamic', name: 'Dynamic Launch' },
    ],
  },
];

const sectionItems: Array<{
  id: StudioSection;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: 'create', label: 'Create', icon: WandSparkles },
  { id: 'campaigns', label: 'Campaigns', icon: FolderKanban },
  { id: 'library', label: 'Asset library', icon: ImageIcon },
  { id: 'presets', label: 'Scene presets', icon: SlidersHorizontal },
  { id: 'history', label: 'Generation history', icon: History },
  { id: 'team', label: 'Team & roles', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const statusCopy: Record<GenerationStatus, string> = {
  queued: 'Queued',
  analyzing: 'Analyzing product',
  generating: 'Generating campaign',
  done: 'Ready',
  failed: 'Failed',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function displayCategory(id: string): string {
  return fallbackPresets.find((item) => item.id === id)?.label ?? id;
}

function displayScene(category: string, sceneId: string): string {
  return (
    fallbackPresets
      .find((item) => item.id === category)
      ?.scenes.find((scene) => scene.id === sceneId)?.name ?? sceneId
  );
}

export default function StudioPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<Record<string, string>>({});
  const [user, setUser] = useState<StudioUser>();
  const [section, setSection] = useState<StudioSection>('create');
  const [mobileNav, setMobileNav] = useState(false);
  const [presets, setPresets] = useState<CategoryPreset[]>(fallbackPresets);
  const [category, setCategory] = useState('clothing');
  const [sceneId, setSceneId] = useState('studio');
  const [variants, setVariants] = useState(4);
  const [brief, setBrief] = useState('');
  const [file, setFile] = useState<File>();
  const [inputPreview, setInputPreview] = useState<string>();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [runtime, setRuntime] = useState<RuntimeConfiguration>();
  const [activeGeneration, setActiveGeneration] = useState<Generation>();
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [booting, setBooting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const selectedCategory = useMemo(
    () => presets.find((item) => item.id === category) ?? presets[0],
    [category, presets],
  );
  const selectedScene = selectedCategory?.scenes.find((item) => item.id === sceneId);

  const hasGenerationPermission = user?.permissions.includes('generation:create') ?? false;
  const canGenerate = hasGenerationPermission && Boolean(runtime?.configured);
  const canManageTeam = user?.permissions.includes('team:manage') ?? false;
  const completedAssets = generations.reduce((total, item) => total + item.outputKeys.length, 0);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const signedInUser = await currentUser();
        if (cancelled) return;
        setUser(signedInUser);
        const [presetResponse, historyResponse, configurationResponse] = await Promise.all([
          authFetch('/generations/presets'),
          authFetch('/generations'),
          authFetch('/generations/configuration'),
        ]);
        if (!presetResponse.ok) throw new Error(await apiErrorMessage(presetResponse));
        if (!historyResponse.ok) throw new Error(await apiErrorMessage(historyResponse));
        if (!configurationResponse.ok)
          throw new Error(await apiErrorMessage(configurationResponse));
        const nextPresets = (await presetResponse.json()) as CategoryPreset[];
        const nextGenerations = (await historyResponse.json()) as Generation[];
        const nextRuntime = (await configurationResponse.json()) as RuntimeConfiguration;
        if (cancelled) return;
        setPresets(nextPresets);
        setGenerations(nextGenerations);
        setRuntime(nextRuntime);
        await hydrateAssets(nextGenerations);
      } catch {
        router.replace('/studio/login');
        return;
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
      Object.values(objectUrls.current).forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = {};
    };
  }, [router]);

  useEffect(() => {
    if (!activeGeneration || ['done', 'failed'].includes(activeGeneration.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await authFetch(`/generations/${activeGeneration.id}`);
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        const next = (await response.json()) as Generation;
        if (cancelled) return;
        setActiveGeneration(next);
        setGenerations((current) => [next, ...current.filter((item) => item.id !== next.id)]);
        await hydrateAssets([next]);
        if (!['done', 'failed'].includes(next.status)) timer = window.setTimeout(poll, 1400);
      } catch (pollError) {
        if (!cancelled)
          setError(pollError instanceof Error ? pollError.message : 'Could not refresh generation');
      }
    };
    timer = window.setTimeout(poll, 800);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGeneration?.id, activeGeneration?.status]);

  useEffect(() => {
    if (section !== 'team' || team.length > 0 || loadingTeam) return;
    setLoadingTeam(true);
    authFetch('/users')
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        setTeam((await response.json()) as TeamMember[]);
      })
      .catch((teamError: unknown) =>
        setError(teamError instanceof Error ? teamError.message : 'Could not load the team'),
      )
      .finally(() => setLoadingTeam(false));
  }, [loadingTeam, section, team.length]);

  async function hydrateAssets(items: Generation[]): Promise<void> {
    const paths = items
      .flatMap((item) => item.resultUrls)
      .filter((path) => !objectUrls.current[path])
      .slice(0, 24);
    await Promise.all(
      paths.map(async (path) => {
        try {
          const response = await authFetch(path);
          if (!response.ok) return;
          const url = URL.createObjectURL(await response.blob());
          objectUrls.current[path] = url;
          setAssetUrls((current) => ({ ...current, [path]: url }));
        } catch {
          // The history remains usable even if a remote asset cannot be hydrated.
        }
      }),
    );
  }

  function acceptFile(nextFile?: File) {
    setError(undefined);
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('Choose a PNG, JPG, or WEBP image.');
      return;
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      setError('The source image must be 15 MB or smaller.');
      return;
    }
    if (inputPreview) URL.revokeObjectURL(inputPreview);
    setFile(nextFile);
    setInputPreview(URL.createObjectURL(nextFile));
    setActiveGeneration(undefined);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    acceptFile(event.dataTransfer.files[0]);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
  }

  function changeCategory(nextCategory: string) {
    const next = presets.find((item) => item.id === nextCategory);
    setCategory(nextCategory);
    if (next?.scenes[0]) setSceneId(next.scenes[0].id);
  }

  async function createGeneration(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Add a clear source image before generating.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const body = new FormData();
    body.append('image', file);
    body.append('category', category);
    body.append('sceneId', sceneId);
    body.append('variants', String(variants));
    if (brief.trim()) body.append('brief', brief.trim());
    try {
      const response = await authFetch('/generations', { method: 'POST', body });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const created = (await response.json()) as {
        id: string;
        status: GenerationStatus;
        provider: string;
        model: string;
      };
      const queued: Generation = {
        id: created.id,
        status: created.status,
        provider: created.provider,
        model: created.model,
        category,
        sceneId,
        brief: brief.trim() || null,
        outputKeys: [],
        resultUrls: [],
        costUsd: 0,
        durationMs: 0,
        error: null,
        createdAt: new Date().toISOString(),
      };
      setActiveGeneration(queued);
      setGenerations((current) => [queued, ...current]);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Could not create the campaign',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadResult(path: string, index: number) {
    const response = await authFetch(path);
    if (!response.ok) {
      setError(await apiErrorMessage(response));
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `aluna-campaign-${String(index + 1).padStart(2, '0')}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function changeRole(member: TeamMember, role: StudioUser['role']) {
    const response = await authFetch(`/users/${member.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      setError(await apiErrorMessage(response));
      return;
    }
    setTeam((current) => current.map((item) => (item.id === member.id ? { ...item, role } : item)));
  }

  async function signOut() {
    await logout();
    router.replace('/studio/login');
  }

  if (booting) {
    return (
      <main className="studio-loading">
        <span className="studio-wordmark">Aluna°</span>
        <LoaderCircle aria-hidden="true" />
        <p>Opening your workspace</p>
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <aside className={`studio-sidebar ${mobileNav ? 'is-open' : ''}`}>
        <div className="studio-sidebar-head">
          <Link className="studio-wordmark" href="/">
            Aluna<span>°</span>
          </Link>
          <button type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)}>
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="studio-workspace-switcher">
          <span>AS</span>
          <div>
            <strong>Aluna Studio</strong>
            <small>Creative workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>

        <nav className="studio-nav" aria-label="Studio navigation">
          <p>Workspace</p>
          {sectionItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={section === item.id ? 'active' : ''}
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileNav(false);
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.id === 'library' && <small>{completedAssets}</small>}
              </button>
            );
          })}
          <p>Manage</p>
          {sectionItems.slice(5).map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={section === item.id ? 'active' : ''}
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileNav(false);
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="studio-sidebar-foot">
          <button type="button" onClick={() => setSection('presets')}>
            <BookOpen size={16} />
            Prompting guide
          </button>
          <button type="button" onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
          <div className="studio-profile">
            <span>
              {user?.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </span>
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.role.toLowerCase()}</small>
            </div>
          </div>
        </div>
      </aside>

      {mobileNav && (
        <button
          className="studio-nav-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}

      <section className="studio-main">
        <header className="studio-topbar">
          <button
            className="studio-mobile-menu"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>
          <div>
            <span>Aluna Studio</span>
            <strong>{sectionItems.find((item) => item.id === section)?.label}</strong>
          </div>
          <div className="studio-top-actions">
            <span className="studio-engine-chip">
              <Sparkles size={13} />
              {runtime?.provider === 'cloudflare' ? 'FLUX.2 Klein' : 'GPT Image 2'}
            </span>
            <button type="button" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <div className="studio-avatar">
              {user?.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </div>
          </div>
        </header>

        {error && (
          <div className="studio-error" role="alert">
            <span>{error}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}>
              <X size={16} />
            </button>
          </div>
        )}

        {runtime && !runtime.configured && (
          <div className="studio-error" role="status">
            <span>
              {runtime.providerLabel} needs {runtime.missingConfiguration.join(' and ')} on the API
              server.
            </span>
          </div>
        )}

        {section === 'create' && (
          <CreateSection
            activeGeneration={activeGeneration}
            assetUrls={assetUrls}
            brief={brief}
            canGenerate={canGenerate}
            engineConfigured={Boolean(runtime?.configured)}
            hasGenerationPermission={hasGenerationPermission}
            category={category}
            file={file}
            fileInput={fileInput}
            inputPreview={inputPreview}
            presets={presets}
            sceneId={sceneId}
            selectedCategory={selectedCategory}
            selectedScene={selectedScene}
            submitting={submitting}
            variants={variants}
            onBriefChange={setBrief}
            onCategoryChange={changeCategory}
            onDownload={downloadResult}
            onDrop={onDrop}
            onFileChange={onFileChange}
            onSceneChange={setSceneId}
            onSubmit={createGeneration}
            onVariantsChange={setVariants}
          />
        )}
        {section === 'campaigns' && (
          <CampaignsSection generations={generations} onCreate={() => setSection('create')} />
        )}
        {section === 'library' && (
          <LibrarySection
            generations={generations}
            assetUrls={assetUrls}
            onDownload={downloadResult}
          />
        )}
        {section === 'presets' && (
          <PresetsSection
            presets={presets}
            onUse={changeCategory}
            goCreate={() => setSection('create')}
          />
        )}
        {section === 'history' && <HistorySection generations={generations} />}
        {section === 'team' && (
          <TeamSection
            canManage={canManageTeam}
            currentUserId={user?.id}
            loading={loadingTeam}
            members={team}
            onRoleChange={changeRole}
          />
        )}
        {section === 'settings' && user && <SettingsSection runtime={runtime} user={user} />}
      </section>
    </main>
  );
}

type CreateSectionProps = {
  activeGeneration?: Generation;
  assetUrls: Record<string, string>;
  brief: string;
  canGenerate: boolean;
  engineConfigured: boolean;
  hasGenerationPermission: boolean;
  category: string;
  file?: File;
  fileInput: { readonly current: HTMLInputElement | null };
  inputPreview?: string;
  presets: CategoryPreset[];
  sceneId: string;
  selectedCategory?: CategoryPreset;
  selectedScene?: ScenePreset;
  submitting: boolean;
  variants: number;
  onBriefChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDownload: (path: string, index: number) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSceneChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onVariantsChange: (value: number) => void;
};

function CreateSection(props: CreateSectionProps) {
  const working =
    props.submitting ||
    (props.activeGeneration && !['done', 'failed'].includes(props.activeGeneration.status));
  const progress = props.activeGeneration
    ? Math.max(
        props.activeGeneration.status === 'queued'
          ? 8
          : props.activeGeneration.status === 'analyzing'
            ? 18
            : (props.activeGeneration.outputKeys.length / props.variants) * 100,
        props.activeGeneration.status === 'done' ? 100 : 0,
      )
    : 0;

  return (
    <div className="studio-content studio-create">
      <div className="studio-page-heading">
        <div>
          <span className="studio-kicker">New generation</span>
          <h1>Build a product campaign.</h1>
          <p>Upload one honest product photo. Aluna builds the campaign around it.</p>
        </div>
        <div className="studio-fidelity-badge">
          <ShieldCheck size={17} />
          <span>
            <strong>Identity preserved</strong>
            <small>Shape, color, logos &amp; labels</small>
          </span>
        </div>
      </div>

      <div className="studio-create-grid">
        <form className="studio-builder" onSubmit={props.onSubmit}>
          <section className="studio-card">
            <div className="studio-card-title">
              <span>01</span>
              <div>
                <h2>Source photo</h2>
                <p>Use a clear, uncropped photo. Max 15 MB.</p>
              </div>
            </div>
            <input
              ref={props.fileInput}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={props.onFileChange}
            />
            <button
              className={`studio-upload ${props.inputPreview ? 'has-image' : ''}`}
              type="button"
              onClick={() => props.fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={props.onDrop}
            >
              {props.inputPreview ? (
                <>
                  <img src={props.inputPreview} alt="Uploaded product" />
                  <span>
                    <Upload size={14} /> Replace photo
                  </span>
                  <small>{props.file?.name}</small>
                </>
              ) : (
                <>
                  <i>
                    <Upload size={21} />
                  </i>
                  <strong>Drop your product image here</strong>
                  <span>or browse from your device</span>
                  <small>PNG, JPG, WEBP · 15 MB max</small>
                </>
              )}
            </button>
          </section>

          <section className="studio-card">
            <div className="studio-card-title">
              <span>02</span>
              <div>
                <h2>Creative direction</h2>
                <p>Choose a product type and campaign setting.</p>
              </div>
            </div>
            <label className="studio-label">Product category</label>
            <div className="studio-category-grid">
              {props.presets.map((item) => (
                <button
                  className={props.category === item.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => props.onCategoryChange(item.id)}
                >
                  <span className={`studio-category-art is-${item.id}`} />
                  {item.label}
                </button>
              ))}
            </div>

            <label className="studio-label">Scene preset</label>
            <div className="studio-scene-list">
              {props.selectedCategory?.scenes.map((scene, index) => (
                <button
                  className={props.sceneId === scene.id ? 'active' : ''}
                  key={scene.id}
                  type="button"
                  onClick={() => props.onSceneChange(scene.id)}
                >
                  <span className={`studio-scene-art scene-${index + 1}`}>
                    <i />
                  </span>
                  <span>
                    <strong>{scene.name}</strong>
                    <small>
                      {index === 0
                        ? 'Clean campaign hero'
                        : index === 1
                          ? 'Editorial lifestyle'
                          : 'Material-led detail'}
                    </small>
                  </span>
                  <i className="studio-radio" />
                </button>
              ))}
            </div>

            <label className="studio-label" htmlFor="campaign-brief">
              Campaign brief <span>Optional</span>
            </label>
            <textarea
              id="campaign-brief"
              maxLength={500}
              placeholder="Example: soft violet background, premium skincare launch, space for copy on the left…"
              value={props.brief}
              onChange={(event) => props.onBriefChange(event.target.value)}
            />
            <small className="studio-char-count">{props.brief.length} / 500</small>

            <div className="studio-variant-row">
              <span>
                <strong>Number of variants</strong>
                <small>Each result explores a distinct composition.</small>
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => props.onVariantsChange(Math.max(1, props.variants - 1))}
                >
                  −
                </button>
                <strong>{props.variants}</strong>
                <button
                  type="button"
                  onClick={() => props.onVariantsChange(Math.min(8, props.variants + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <button
            className="studio-generate"
            type="submit"
            disabled={!props.canGenerate || !!working}
          >
            {working ? <LoaderCircle size={18} /> : <Sparkles size={18} />}
            {working
              ? props.activeGeneration
                ? statusCopy[props.activeGeneration.status]
                : 'Sending to studio'
              : props.canGenerate
                ? `Generate ${props.variants} images`
                : !props.hasGenerationPermission
                  ? 'Your role cannot generate'
                  : !props.engineConfigured
                    ? 'Configure image engine'
                    : 'Generation unavailable'}
          </button>
        </form>

        <section className="studio-output">
          <div className="studio-output-head">
            <div>
              <span>Campaign canvas</span>
              <strong>
                {props.selectedCategory?.label} / {props.selectedScene?.name}
              </strong>
            </div>
            <span className="studio-live">
              <i /> Live workspace
            </span>
          </div>

          {!props.activeGeneration ? (
            <div className="studio-canvas-empty">
              <div className="studio-canvas-orb" />
              {props.inputPreview ? (
                <img src={props.inputPreview} alt="Source product preview" />
              ) : (
                <div className="studio-demo-bottle">
                  <span>ALUNA</span>
                </div>
              )}
              <div className="studio-canvas-caption">
                <span>Source preview</span>
                <p>Your finished campaign images will appear here as each variant completes.</p>
              </div>
            </div>
          ) : (
            <div className="studio-generation-output">
              <div className={`studio-job-status is-${props.activeGeneration.status}`}>
                <span>
                  {props.activeGeneration.status === 'done' ? (
                    <ShieldCheck size={19} />
                  ) : (
                    <LoaderCircle size={19} />
                  )}
                  <span>
                    <strong>{statusCopy[props.activeGeneration.status]}</strong>
                    <small>
                      {props.activeGeneration.status === 'generating'
                        ? `${props.activeGeneration.outputKeys.length} of ${props.variants} variants complete`
                        : props.activeGeneration.status === 'done'
                          ? `${props.activeGeneration.outputKeys.length} campaign assets · $${props.activeGeneration.costUsd.toFixed(3)}`
                          : props.activeGeneration.status === 'failed'
                            ? props.activeGeneration.error
                            : 'Your source is being prepared securely'}
                    </small>
                  </span>
                </span>
                {!['done', 'failed'].includes(props.activeGeneration.status) && (
                  <b>{Math.round(progress)}%</b>
                )}
                <i>
                  <span style={{ width: `${progress}%` }} />
                </i>
              </div>
              <div className="studio-output-grid">
                {Array.from({ length: props.variants }, (_, index) => {
                  const path = props.activeGeneration?.resultUrls[index];
                  const image = path ? props.assetUrls[path] : undefined;
                  return (
                    <article className={image ? 'is-ready' : ''} key={index}>
                      {image ? (
                        <img src={image} alt={`Generated campaign variant ${index + 1}`} />
                      ) : (
                        <div className="studio-output-placeholder">
                          {props.activeGeneration?.status === 'failed' ? (
                            <X size={18} />
                          ) : (
                            <LoaderCircle size={18} />
                          )}
                        </div>
                      )}
                      <footer>
                        <span>Variant {String(index + 1).padStart(2, '0')}</span>
                        {path && (
                          <button
                            type="button"
                            aria-label={`Download variant ${index + 1}`}
                            onClick={() => props.onDownload(path, index)}
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </footer>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CampaignsSection({
  generations,
  onCreate,
}: {
  generations: Generation[];
  onCreate: () => void;
}) {
  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Campaign workspace</span>
          <h1>Your campaigns.</h1>
          <p>Every source, direction, and finished asset in one place.</p>
        </div>
        <button className="studio-primary-action" type="button" onClick={onCreate}>
          <Plus size={17} /> New campaign
        </button>
      </div>
      {generations.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No campaigns yet"
          copy="Your first generated campaign will appear here."
        />
      ) : (
        <div className="studio-campaign-grid">
          {generations.map((item) => (
            <article key={item.id}>
              <div className={`studio-campaign-cover is-${item.category}`}>
                <Boxes size={30} />
                <span>{displayCategory(item.category)}</span>
              </div>
              <div>
                <span className={`studio-status is-${item.status}`}>{statusCopy[item.status]}</span>
                <h3>{displayScene(item.category, item.sceneId)}</h3>
                <p>{item.brief || 'Preset-led campaign direction'}</p>
                <footer>
                  <span>{item.outputKeys.length} assets</span>
                  <span>{formatDate(item.createdAt)}</span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySection({
  generations,
  assetUrls,
  onDownload,
}: {
  generations: Generation[];
  assetUrls: Record<string, string>;
  onDownload: (path: string, index: number) => void;
}) {
  const assets = generations.flatMap((generation) =>
    generation.resultUrls.map((path, index) => ({ generation, path, index })),
  );
  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Asset library</span>
          <h1>Campaign-ready work.</h1>
          <p>Review and download every generated image.</p>
        </div>
      </div>
      {assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Your library is empty"
          copy="Completed images are collected here automatically."
        />
      ) : (
        <div className="studio-library-grid">
          {assets.map(({ generation, path, index }) => (
            <article key={path}>
              {assetUrls[path] ? (
                <img
                  src={assetUrls[path]}
                  alt={`${displayCategory(generation.category)} campaign asset`}
                />
              ) : (
                <div>
                  <LoaderCircle size={22} />
                </div>
              )}
              <footer>
                <span>
                  <strong>{displayCategory(generation.category)}</strong>
                  <small>{displayScene(generation.category, generation.sceneId)}</small>
                </span>
                <button type="button" onClick={() => onDownload(path, index)}>
                  <Download size={15} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function PresetsSection({
  presets,
  onUse,
  goCreate,
}: {
  presets: CategoryPreset[];
  onUse: (id: string) => void;
  goCreate: () => void;
}) {
  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Art direction</span>
          <h1>Scene presets.</h1>
          <p>Eighteen carefully prompted starting points with product fidelity built in.</p>
        </div>
      </div>
      <div className="studio-preset-grid">
        {presets.map((category) => (
          <section key={category.id}>
            <header>
              <span className={`studio-category-art is-${category.id}`} />
              <div>
                <strong>{category.label}</strong>
                <small>3 directions</small>
              </div>
            </header>
            {category.scenes.map((scene, index) => (
              <div key={scene.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{scene.name}</strong>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                onUse(category.id);
                goCreate();
              }}
            >
              Use {category.label.toLowerCase()} preset
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

function HistorySection({ generations }: { generations: Generation[] }) {
  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Audit trail</span>
          <h1>Generation history.</h1>
          <p>Runtime, spend, provider, and status for every job.</p>
        </div>
      </div>
      <div className="studio-table-wrap">
        <table className="studio-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Provider</th>
              <th>Assets</th>
              <th>Duration</th>
              <th>Est. cost</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {generations.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{displayCategory(item.category)}</strong>
                  <small>{displayScene(item.category, item.sceneId)}</small>
                </td>
                <td>
                  <span className={`studio-status is-${item.status}`}>
                    {statusCopy[item.status]}
                  </span>
                </td>
                <td>
                  {item.provider === 'openai'
                    ? 'GPT Image 2'
                    : item.provider === 'cloudflare'
                      ? 'FLUX.2 Klein'
                      : item.provider}
                </td>
                <td>{item.outputKeys.length}</td>
                <td>{item.durationMs ? `${(item.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                <td>${item.costUsd.toFixed(3)}</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {generations.length === 0 && (
          <EmptyState
            icon={Clock3}
            title="No generation history"
            copy="Run a campaign to create the first event."
          />
        )}
      </div>
    </div>
  );
}

function TeamSection({
  members,
  canManage,
  currentUserId,
  loading,
  onRoleChange,
}: {
  members: TeamMember[];
  canManage: boolean;
  currentUserId?: string;
  loading: boolean;
  onRoleChange: (member: TeamMember, role: StudioUser['role']) => void;
}) {
  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Access control</span>
          <h1>Team &amp; roles.</h1>
          <p>Give each collaborator only the workspace access they need.</p>
        </div>
        <button className="studio-primary-action" type="button" disabled>
          <Plus size={17} /> Invite member
        </button>
      </div>
      <div className="studio-role-cards">
        {(['OWNER', 'ADMIN', 'CREATOR', 'VIEWER'] as const).map((role) => (
          <article key={role}>
            <ShieldCheck size={18} />
            <strong>{role[0] + role.slice(1).toLowerCase()}</strong>
            <p>
              {role === 'OWNER'
                ? 'Full workspace and access control'
                : role === 'ADMIN'
                  ? 'Manage work, team, and settings'
                  : role === 'CREATOR'
                    ? 'Create campaigns and manage assets'
                    : 'Review campaigns without editing'}
            </p>
          </article>
        ))}
      </div>
      <div className="studio-table-wrap">
        {loading ? (
          <EmptyState
            icon={LoaderCircle}
            title="Loading team"
            copy="Checking workspace permissions…"
          />
        ) : (
          <table className="studio-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Generations</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <span className="studio-member">
                      <i>
                        {member.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </i>
                      <span>
                        <strong>
                          {member.name}
                          {member.id === currentUserId ? ' (you)' : ''}
                        </strong>
                        <small>{member.email}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      disabled={!canManage || member.id === currentUserId}
                      onChange={(event) =>
                        onRoleChange(member, event.target.value as StudioUser['role'])
                      }
                    >
                      <option>OWNER</option>
                      <option>ADMIN</option>
                      <option>CREATOR</option>
                      <option>VIEWER</option>
                    </select>
                  </td>
                  <td>
                    <span className={`studio-status ${member.isActive ? 'is-done' : 'is-failed'}`}>
                      {member.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td>{member._count.generations}</td>
                  <td>{formatDate(member.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ runtime, user }: { runtime?: RuntimeConfiguration; user: StudioUser }) {
  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Workspace configuration</span>
          <h1>Settings.</h1>
          <p>Manage profile, generation defaults, storage, and security.</p>
        </div>
      </div>
      <div className="studio-settings-grid">
        <section>
          <header>
            <Settings size={18} />
            <div>
              <h2>Profile</h2>
              <p>Your workspace identity.</p>
            </div>
          </header>
          <label>
            Name
            <input value={user.name} readOnly />
          </label>
          <label>
            Email
            <input value={user.email} readOnly />
          </label>
          <button type="button" disabled>
            Save profile
          </button>
        </section>
        <section>
          <header>
            <Sparkles size={18} />
            <div>
              <h2>Image engine</h2>
              <p>Defaults used for new campaigns.</p>
            </div>
          </header>
          <label>
            Model
            <input value={runtime?.model ?? 'Loading configuration'} readOnly />
          </label>
          <label>
            Quality
            <input
              value={runtime ? `${runtime.quality} · ${runtime.imageSize}` : 'Loading'}
              readOnly
            />
          </label>
          <span className={runtime?.configured ? 'studio-config-ok' : 'studio-config-note'}>
            <i />
            {runtime?.configured
              ? `${runtime.providerLabel} configured securely on the server`
              : `Missing ${runtime?.missingConfiguration.join(' and ') || 'provider settings'}`}
          </span>
        </section>
        <section>
          <header>
            <ShieldCheck size={18} />
            <div>
              <h2>Access</h2>
              <p>Your effective role and permissions.</p>
            </div>
          </header>
          <label>
            Role
            <input value={user.role} readOnly />
          </label>
          <div className="studio-permissions">
            {user.permissions.map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
          </div>
        </section>
        <section>
          <header>
            <LayoutGrid size={18} />
            <div>
              <h2>Storage</h2>
              <p>Campaign source and result files.</p>
            </div>
          </header>
          <label>
            Current backend
            <input value="Local disk · R2 ready" readOnly />
          </label>
          <span className="studio-config-note">
            Cloudflare R2 activates automatically when its environment variables are present.
          </span>
        </section>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  copy,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
}) {
  return (
    <div className="studio-empty">
      <Icon size={25} />
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
