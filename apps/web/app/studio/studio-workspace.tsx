'use client';

/* eslint-disable @next/next/no-img-element */
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Boxes,
  ChevronDown,
  Clock3,
  Download,
  FolderKanban,
  Globe,
  History,
  Image as ImageIcon,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  Palette,
  Plus,
  Settings,
  Share2,
  Shuffle,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiErrorMessage, authFetch, currentUser, logout, StudioUser } from '../lib/auth-client';
import { ConfirmDialog } from '../components/confirm-dialog';

type StudioSection =
  | 'create'
  | 'brand'
  | 'campaigns'
  | 'gallery'
  | 'library'
  | 'presets'
  | 'history'
  | 'settings';

type ScenePreset = { id: string; name: string };
type CampaignOptionChoice = { id: string; label: string; description: string };
type CampaignOptionDefinition = {
  id: string;
  label: string;
  description: string;
  defaultValue: string;
  choices: CampaignOptionChoice[];
};
type CampaignOptionGroup = {
  id: string;
  label: string;
  description: string;
  options: CampaignOptionDefinition[];
};
type CategoryPreset = {
  id: string;
  label: string;
  scenes: ScenePreset[];
  optionGroups?: CampaignOptionGroup[];
};
type GenerationStatus = 'queued' | 'analyzing' | 'generating' | 'done' | 'failed';

type Generation = {
  id: string;
  status: GenerationStatus;
  provider: string;
  model?: string;
  category: string;
  sceneId: string;
  brief: string | null;
  productType?: string | null;
  creativeOptions?: Record<string, string> | null;
  contextWarnings?: string[];
  outputKeys: string[];
  resultUrls: string[];
  costUsd: number;
  durationMs: number;
  error: string | null;
  errorCode?: string | null;
  providerUsageUnits?: number;
  providerUsageUnit?: string;
  campaignId?: string | null;
  sharedAt?: string | null;
  createdAt: string;
};

type Campaign = {
  id: string;
  name: string;
  productType: string | null;
  category: string;
  sceneId: string;
  brief: string | null;
  creativeOptions: Record<string, string> | null;
  runs: number;
  assets: number;
  createdAt: string;
  updatedAt: string;
};

type CampaignRun = {
  id: string;
  status: GenerationStatus;
  category: string;
  sceneId: string;
  brief: string | null;
  productType: string | null;
  requestedVariants: number;
  outputKeys: string[];
  resultUrls: string[];
  sharedAt: string | null;
  costUsd: number;
  error: string | null;
  createdAt: string;
};

type CampaignDetail = Campaign & { generations: CampaignRun[] };

type GalleryItem = {
  id: string;
  category: string;
  sceneId: string;
  productType: string | null;
  brief: string | null;
  creativeOptions: Record<string, string> | null;
  author: string;
  mine: boolean;
  assetUrls: string[];
  sharedAt: string;
};

type ReusableSettings = {
  category: string;
  sceneId: string;
  productType?: string | null;
  brief?: string | null;
  creativeOptions?: Record<string, string> | null;
};

const reuseSettingsKey = 'aluna-reuse-settings';

const clothingOptionDefaults: Record<string, string> = {
  presentation: 'on-model',
  modelGender: 'varied',
  modelAge: '25-34',
  modelHeritage: 'global-mix',
  bodyBuild: 'varied',
  hairDirection: 'varied',
  expression: 'confident',
  castingDiversity: 'unique-each',
  pose: 'varied',
  framing: 'three-quarter',
  campaignMood: 'scene-led',
  composition: 'vary',
  camera: 'vary',
  lighting: 'scene-led',
  palette: 'scene-led',
  variationStrength: 'balanced',
};

const sharedOptionDefaults: Record<string, string> = {
  campaignMood: 'scene-led',
  composition: 'vary',
  camera: 'vary',
  lighting: 'scene-led',
  palette: 'scene-led',
  variationStrength: 'balanced',
};

function defaultsForCategory(category?: CategoryPreset): Record<string, string> {
  if (!category?.optionGroups?.length) {
    return { ...(category?.id === 'clothing' ? clothingOptionDefaults : sharedOptionDefaults) };
  }
  return Object.fromEntries(
    category.optionGroups.flatMap((group) =>
      group.options.map((definition) => [definition.id, definition.defaultValue]),
    ),
  );
}

type RuntimeConfiguration = {
  provider: 'cloudflare' | 'gemini' | 'openai';
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
    id: 'wellness',
    label: 'Health & Wellness',
    scenes: [
      { id: 'performance', name: 'Performance Studio' },
      { id: 'science', name: 'Sports Science' },
      { id: 'recovery', name: 'Active Recovery' },
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
  { id: 'brand', label: 'Brand Profile', icon: Palette },
  { id: 'campaigns', label: 'Campaigns', icon: FolderKanban },
  { id: 'gallery', label: 'Gallery', icon: Globe },
  { id: 'library', label: 'Asset library', icon: ImageIcon },
  { id: 'presets', label: 'Scene presets', icon: SlidersHorizontal },
  { id: 'history', label: 'Generation history', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const workspaceSectionCount = 7;

const statusCopy: Record<GenerationStatus, string> = {
  queued: 'Queued',
  analyzing: 'Analyzing product',
  generating: 'Generating campaign',
  done: 'Ready',
  failed: 'Failed',
};

function generationFailureMessage(generation: Generation): string {
  if (
    generation.errorCode === 'content_policy' ||
    /3030|output has been flagged|prompt \/ input image combination/i.test(generation.error ?? '')
  ) {
    return 'Cloudflare could not approve this image and direction, even after one safer retry. Try a different source photo, or use Ghost mannequin or Styled flat lay for branded garments.';
  }
  return generation.error ?? 'The image provider could not complete this campaign.';
}

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

interface ProductSceneConcept {
  id: string;
  name: string;
  rationale: string;
  environment: string;
  lighting: string;
  camera: string;
  props: string;
  mood: string;
}

interface ProductAnalysis {
  id: string;
  category: string;
  productType: string;
  productClass: string;
  summary: string;
  confidence: number;
  costUsd: number;
  model: string;
  attributes: {
    materials: string[];
    dominantColors: string[];
    finish: string;
    shapeAndScale: string;
    visibleText: string[];
    handlingNotes: string[];
    forbiddenEnvironments: string[];
  };
  scenes: ProductSceneConcept[];
}

function isAiScene(sceneId: string): boolean {
  return sceneId.startsWith('ai:');
}

function displayScene(category: string, sceneId: string): string {
  // AI scene ids are slugs of the name the vision model wrote, so they read well once expanded.
  if (isAiScene(sceneId)) {
    return sceneId
      .slice(3)
      .split('-')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return (
    fallbackPresets
      .find((item) => item.id === category)
      ?.scenes.find((scene) => scene.id === sceneId)?.name ?? sceneId
  );
}

function sectionHref(id: StudioSection): string {
  return id === 'create' ? '/studio' : `/studio/${id}`;
}

type StudioContextValue = {
  user?: StudioUser;
  presets: CategoryPreset[];
  generations: Generation[];
  runtime?: RuntimeConfiguration;
  assetUrls: Record<string, string>;
  createProps: CreateSectionProps;
  changeCategory: (category: string) => void;
  downloadResult: (path: string, index: number) => void;
};

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error('useStudio must be used inside the Studio workspace layout');
  return value;
}

/**
 * The workspace shell owns every piece of session state and lives in the route-group layout, so
 * moving between sections re-renders only the panel instead of re-authenticating and refetching.
 */
export default function StudioWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeSection = pathname.split('/')[2] as StudioSection | undefined;
  const section: StudioSection =
    routeSection && sectionItems.some((item) => item.id === routeSection)
      ? routeSection
      : 'create';
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<Record<string, string>>({});
  const [user, setUser] = useState<StudioUser>();
  const [mobileNav, setMobileNav] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [presets, setPresets] = useState<CategoryPreset[]>(fallbackPresets);
  const [category, setCategory] = useState('clothing');
  const [sceneId, setSceneId] = useState('studio');
  const [variants, setVariants] = useState(1);
  const [creativeOptions, setCreativeOptions] =
    useState<Record<string, string>>(clothingOptionDefaults);
  const [brief, setBrief] = useState('');
  const [productType, setProductType] = useState('');
  const [file, setFile] = useState<File>();
  const [inputPreview, setInputPreview] = useState<string>();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [runtime, setRuntime] = useState<RuntimeConfiguration>();
  const [activeGeneration, setActiveGeneration] = useState<Generation>();
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [booting, setBooting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [analysis, setAnalysis] = useState<ProductAnalysis>();
  const [analyzing, setAnalyzing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<{ id: string; name: string }>();

  const selectedCategory = useMemo(
    () => presets.find((item) => item.id === category) ?? presets[0],
    [category, presets],
  );
  const selectedScene = selectedCategory?.scenes.find((item) => item.id === sceneId);

  const hasGenerationPermission = user?.permissions.includes('generation:create') ?? false;
  const canGenerate = hasGenerationPermission && Boolean(runtime?.configured);
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
        setCreativeOptions(
          defaultsForCategory(nextPresets.find((item) => item.id === 'clothing') ?? nextPresets[0]),
        );
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

  // Campaign cards and gallery cards hand their direction over through session storage, which
  // survives the client-side navigation to the Create panel without adding query-string state.
  useEffect(() => {
    if (booting || section !== 'create') return;
    const stored = window.sessionStorage.getItem(reuseSettingsKey);
    if (!stored) return;
    window.sessionStorage.removeItem(reuseSettingsKey);
    try {
      const handoff = JSON.parse(stored) as ReusableSettings & {
        campaignId?: string;
        campaignName?: string;
      };
      applyDirection(presets, handoff);
      if (handoff.campaignId && handoff.campaignName) {
        setActiveCampaign({ id: handoff.campaignId, name: handoff.campaignName });
      } else {
        setNotice('Settings applied. Add your product photo and generate.');
      }
    } catch {
      // Corrupted hand-off payloads are simply ignored.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, section, pathname]);

  function applyDirection(availablePresets: CategoryPreset[], source: ReusableSettings): void {
    const preset = availablePresets.find((item) => item.id === source.category);
    if (!preset) return;
    setCategory(preset.id);
    // AI-written scenes belong to another user's product analysis, so fall back to a preset scene.
    const sceneIsPreset = preset.scenes.some((scene) => scene.id === source.sceneId);
    setSceneId(sceneIsPreset ? source.sceneId : (preset.scenes[0]?.id ?? 'studio'));
    setCreativeOptions({ ...defaultsForCategory(preset), ...(source.creativeOptions ?? {}) });
    setBrief(source.brief ?? '');
    setProductType(source.productType ?? '');
  }

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
    // The previous analysis described a different product; keeping it would mislabel this one.
    setAnalysis(undefined);
    if (isAiScene(sceneId)) setSceneId(selectedCategory?.scenes[0]?.id ?? 'studio');
  }

  async function analyzeProduct() {
    if (!file) {
      setError('Add a source image before analysing it.');
      return;
    }
    setError(undefined);
    setAnalyzing(true);
    const body = new FormData();
    body.append('image', file);
    if (productType.trim()) body.append('productType', productType.trim());
    if (brief.trim()) body.append('brief', brief.trim());
    try {
      const response = await authFetch('/generations/analyze', { method: 'POST', body });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const result = (await response.json()) as ProductAnalysis;
      setAnalysis(result);
      // The vision model also picks the category, and its read of the photo beats the default.
      if (result.category !== category && presets.some((item) => item.id === result.category)) {
        setCategory(result.category);
        setCreativeOptions(defaultsForCategory(presets.find((i) => i.id === result.category)));
      }
      if (result.scenes[0]) setSceneId(`ai:${result.scenes[0].id}`);
      setNotice(`Aluna analysed your product: ${result.productType}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not analyse this product.');
    } finally {
      setAnalyzing(false);
    }
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
    setCreativeOptions(defaultsForCategory(next));
    if (next?.scenes[0]) setSceneId(next.scenes[0].id);
  }

  function changeCreativeOption(optionId: string, value: string) {
    setCreativeOptions((current) => ({ ...current, [optionId]: value }));
  }

  function randomizeCreativeOptions() {
    if (!selectedCategory?.optionGroups) return;
    setCreativeOptions((current) =>
      Object.fromEntries(
        selectedCategory.optionGroups!.flatMap((group) =>
          group.options.map((definition) => {
            if (definition.id === 'presentation') {
              return [definition.id, current[definition.id] ?? definition.defaultValue];
            }
            const next = definition.choices[Math.floor(Math.random() * definition.choices.length)];
            return [definition.id, next?.id ?? definition.defaultValue];
          }),
        ),
      ),
    );
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
    if (productType.trim()) body.append('productType', productType.trim());
    body.append('options', JSON.stringify(creativeOptions));
    if (brief.trim()) body.append('brief', brief.trim());
    if (analysis && isAiScene(sceneId)) body.append('analysisId', analysis.id);
    if (activeCampaign) body.append('campaignId', activeCampaign.id);
    try {
      const response = await authFetch('/generations', { method: 'POST', body });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const created = (await response.json()) as {
        id: string;
        status: GenerationStatus;
        provider: string;
        model: string;
        category: string;
        sceneId: string;
        contextWarnings: string[];
      };
      const queued: Generation = {
        id: created.id,
        status: created.status,
        provider: created.provider,
        model: created.model,
        category: created.category,
        sceneId: created.sceneId,
        productType: productType.trim() || null,
        brief: brief.trim() || null,
        creativeOptions,
        contextWarnings: created.contextWarnings,
        outputKeys: [],
        resultUrls: [],
        costUsd: 0,
        durationMs: 0,
        error: null,
        createdAt: new Date().toISOString(),
      };
      setActiveGeneration(queued);
      setGenerations((current) => [queued, ...current]);
      if (created.contextWarnings.length) setNotice(created.contextWarnings.join(' '));
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

  async function toggleShare(generation: Generation): Promise<void> {
    try {
      const response = await authFetch(`/generations/${generation.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: !generation.sharedAt }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const next = (await response.json()) as Generation;
      setGenerations((current) => current.map((item) => (item.id === next.id ? next : item)));
      setActiveGeneration((current) => (current?.id === next.id ? next : current));
      setNotice(
        next.sharedAt
          ? 'This campaign is now visible in the shared gallery.'
          : 'This campaign was removed from the shared gallery.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update sharing.');
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
          {sectionItems.slice(0, workspaceSectionCount).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={section === item.id ? 'active' : ''}
                key={item.id}
                href={sectionHref(item.id)}
                onClick={() => setMobileNav(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.id === 'library' && <small>{completedAssets}</small>}
              </Link>
            );
          })}
          <p>Manage</p>
          {sectionItems.slice(workspaceSectionCount).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={section === item.id ? 'active' : ''}
                key={item.id}
                href={sectionHref(item.id)}
                onClick={() => setMobileNav(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="studio-sidebar-foot">
          <Link href="/studio/presets">
            <BookOpen size={16} />
            Prompting guide
          </Link>
          <button type="button" onClick={() => setLogoutOpen(true)}>
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
              <small>Personal account</small>
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
              {runtime?.provider === 'cloudflare'
                ? 'FLUX.2 Klein'
                : runtime?.provider === 'gemini'
                  ? 'Nano Banana'
                  : 'GPT Image 2'}
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

        {notice && (
          <div className="studio-context-notice" role="status">
            <Sparkles size={16} />
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(undefined)}>
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

        <StudioContext.Provider
          value={{
            user,
            presets,
            generations,
            runtime,
            assetUrls,
            changeCategory,
            downloadResult,
            createProps: {
              activeGeneration,
              activeCampaign,
              assetUrls,
              brief,
              productType,
              canGenerate,
              creativeOptions,
              engineConfigured: Boolean(runtime?.configured),
              hasGenerationPermission,
              category,
              file,
              fileInput,
              inputPreview,
              presets,
              sceneId,
              selectedCategory,
              selectedScene,
              submitting,
              variants,
              maxVariants: user?.maxVariantsPerRequest ?? 12,
              analysis,
              analyzing,
              hasFile: Boolean(file),
              onAnalyze: analyzeProduct,
              onBriefChange: setBrief,
              onProductTypeChange: setProductType,
              onCategoryChange: changeCategory,
              onCreativeOptionChange: changeCreativeOption,
              onDownload: downloadResult,
              onDrop,
              onFileChange,
              onSceneChange: setSceneId,
              onRandomizeCreativeOptions: randomizeCreativeOptions,
              onSubmit: createGeneration,
              onVariantsChange: setVariants,
              onDetachCampaign: () => setActiveCampaign(undefined),
              onToggleShare: (generation) => void toggleShare(generation),
            },
          }}
        >
          {children}
        </StudioContext.Provider>
      </section>
      {logoutOpen && (
        <ConfirmDialog
          title="Sign out of Studio?"
          message="Your completed campaigns stay saved, but you will need to sign in again to continue working."
          confirmLabel="Sign out"
          tone="danger"
          onCancel={() => setLogoutOpen(false)}
          onConfirm={() => void signOut()}
        />
      )}
    </main>
  );
}

type CreateSectionProps = {
  activeGeneration?: Generation;
  activeCampaign?: { id: string; name: string };
  assetUrls: Record<string, string>;
  brief: string;
  productType: string;
  canGenerate: boolean;
  creativeOptions: Record<string, string>;
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
  maxVariants: number;
  analysis?: ProductAnalysis;
  analyzing: boolean;
  hasFile: boolean;
  onAnalyze: () => void;
  onBriefChange: (value: string) => void;
  onProductTypeChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onCreativeOptionChange: (optionId: string, value: string) => void;
  onDownload: (path: string, index: number) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRandomizeCreativeOptions: () => void;
  onSceneChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onVariantsChange: (value: number) => void;
  onDetachCampaign: () => void;
  onToggleShare: (generation: Generation) => void;
};

export function CreateSection(props: CreateSectionProps) {
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

      {props.activeCampaign && (
        <div className="studio-campaign-chip" role="status">
          <FolderKanban size={15} />
          <span>
            New photos will be saved to campaign <strong>{props.activeCampaign.name}</strong>
          </span>
          <button
            type="button"
            aria-label="Stop saving to this campaign"
            onClick={props.onDetachCampaign}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="studio-create-grid">
        <form className="studio-builder" onSubmit={props.onSubmit}>
          <section className="studio-card">
            <div className="studio-card-title studio-options-title">
              <span>01</span>
              <div>
                <h2>Source photo</h2>
                <p>Use a clear, uncropped photo. Max 15 MB.</p>
              </div>
              <button
                className="studio-analyze-product"
                type="button"
                disabled={!props.hasFile || props.analyzing}
                onClick={() => void props.onAnalyze()}
              >
                {props.analyzing ? (
                  <>
                    <LoaderCircle className="is-spinning" size={14} /> Analysing…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> {props.analysis ? 'Re-analyse' : 'Analyse product'}
                  </>
                )}
              </button>
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

            <div className="studio-ai-director">
              <div className="studio-ai-director-head">
                <div>
                  <strong>AI Art Director</strong>
                  <small>
                    {props.analysis
                      ? `Read your product and wrote ${props.analysis.scenes.length} scenes for it.`
                      : 'Let Aluna study the photo and write scenes for this exact product.'}
                  </small>
                </div>
              </div>

              {props.analysis && (
                <>
                  <div className="studio-ai-readout">
                    <p>
                      <strong>{props.analysis.productType}</strong>
                      <span>{Math.round(props.analysis.confidence * 100)}% confident</span>
                    </p>
                    <p>{props.analysis.summary}</p>
                    {props.analysis.attributes.visibleText.length > 0 && (
                      <p className="studio-ai-chips">
                        {props.analysis.attributes.visibleText.map((text) => (
                          <span key={text}>{text}</span>
                        ))}
                      </p>
                    )}
                    {props.analysis.attributes.handlingNotes.length > 0 && (
                      <ul>
                        {props.analysis.attributes.handlingNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="studio-scene-list">
                    {props.analysis.scenes.map((scene) => (
                      <button
                        className={props.sceneId === `ai:${scene.id}` ? 'active' : ''}
                        key={scene.id}
                        type="button"
                        onClick={() => props.onSceneChange(`ai:${scene.id}`)}
                      >
                        <span>
                          <strong>{scene.name}</strong>
                          <small>{scene.rationale}</small>
                        </span>
                        <i className="studio-radio" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="studio-card">
            <div className="studio-card-title">
              <span>02</span>
              <div>
                <h2>Creative direction</h2>
                <p>Choose a product type and campaign setting.</p>
              </div>
            </div>
            <label className="studio-label" htmlFor="product-type">
              Exact product type <span>Helps Creative Director choose a credible context</span>
            </label>
            <input
              className="studio-product-type-input"
              id="product-type"
              maxLength={160}
              placeholder="Example: creatine monohydrate powder, oversized cotton T-shirt…"
              value={props.productType}
              onChange={(event) => props.onProductTypeChange(event.target.value)}
            />
            <label className="studio-label">Product category</label>
            <div className="studio-category-grid">
              {props.presets.map((item) => (
                <button
                  className={props.category === item.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => props.onCategoryChange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="studio-label">
              {props.analysis ? 'Or use a fixed preset' : 'Scene preset'}
            </label>
            <div className="studio-scene-list">
              {props.selectedCategory?.scenes.map((scene, index) => (
                <button
                  className={props.sceneId === scene.id ? 'active' : ''}
                  key={scene.id}
                  type="button"
                  onClick={() => props.onSceneChange(scene.id)}
                >
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
          </section>

          <section className="studio-card studio-options-card">
            <div className="studio-card-title studio-options-title">
              <span>03</span>
              <div>
                <h2>
                  {props.category === 'clothing' ? 'Model & shot direction' : 'Shot direction'}
                </h2>
                <p>
                  Shape the campaign, then let every result become its own original composition.
                </p>
              </div>
              <button
                className="studio-randomize"
                type="button"
                onClick={props.onRandomizeCreativeOptions}
              >
                <Shuffle size={14} /> Surprise me
              </button>
            </div>

            {props.category === 'clothing' && props.creativeOptions.presentation === 'on-model' && (
              <div className="studio-unique-note">
                <Sparkles size={16} />
                <span>
                  <strong>Fresh casting is built in.</strong>
                  Each output creates a different fictional adult model, face, pose, camera angle,
                  and lighting nuance—even when two customers select the same setup.
                </span>
              </div>
            )}

            <div className="studio-option-groups">
              {props.selectedCategory?.optionGroups
                ?.filter(
                  (group) =>
                    props.creativeOptions.presentation === 'on-model' ||
                    !group.id.startsWith('model-'),
                )
                .map((group) => (
                  <div className="studio-option-group" key={group.id}>
                    <div className="studio-option-group-head">
                      <strong>{group.label}</strong>
                      <span>{group.description}</span>
                    </div>
                    <div className="studio-option-grid">
                      {group.options.map((definition) => {
                        const value =
                          props.creativeOptions[definition.id] ?? definition.defaultValue;
                        const selected = definition.choices.find((choice) => choice.id === value);
                        return (
                          <label className="studio-option-field" key={definition.id}>
                            <span>{definition.label}</span>
                            <select
                              aria-label={definition.label}
                              data-option-id={definition.id}
                              value={value}
                              onChange={(event) =>
                                props.onCreativeOptionChange(definition.id, event.target.value)
                              }
                            >
                              {definition.choices.map((choice) => (
                                <option key={choice.id} value={choice.id}>
                                  {choice.label}
                                </option>
                              ))}
                            </select>
                            <small>{selected?.description ?? definition.description}</small>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="studio-card">
            <div className="studio-card-title">
              <span>04</span>
              <div>
                <h2>Output plan</h2>
                <p>Add a final note and choose how many campaign images to create.</p>
              </div>
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
                  onClick={() =>
                    props.onVariantsChange(Math.min(props.maxVariants, props.variants + 1))
                  }
                >
                  +
                </button>
              </div>
            </div>
            <div className="studio-variant-presets" aria-label="Quick variant count">
              {[1, 2, 4, 6, 8, 12]
                .filter((count) => count <= props.maxVariants)
                .map((count) => (
                  <button
                    className={props.variants === count ? 'active' : ''}
                    key={count}
                    type="button"
                    onClick={() => props.onVariantsChange(count)}
                  >
                    {count} {count === 1 ? 'image' : 'images'}
                  </button>
                ))}
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
                ? `Generate ${props.variants} ${props.variants === 1 ? 'image' : 'images'}`
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
              <span>Campaign results</span>
              <strong>
                {props.selectedCategory?.label} / {props.selectedScene?.name}
              </strong>
            </div>
            {props.activeGeneration &&
              (props.activeGeneration.status === 'done' ? (
                <button
                  className={`studio-share-btn ${props.activeGeneration.sharedAt ? 'is-shared' : ''}`}
                  type="button"
                  onClick={() => props.onToggleShare(props.activeGeneration!)}
                >
                  <Share2 size={14} />
                  {props.activeGeneration.sharedAt ? 'Shared · remove' : 'Share to gallery'}
                </button>
              ) : (
                <span className="studio-live">
                  <i /> Live generation
                </span>
              ))}
          </div>

          {!props.activeGeneration && (
            <div className="studio-output-empty">
              <ImageIcon size={26} />
              <strong>Your results appear here</strong>
              <p>
                Set the campaign parameters on the left, then generate to watch every variant
                arrive live in this panel.
              </p>
            </div>
          )}

          {props.activeGeneration && (
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
                            ? generationFailureMessage(props.activeGeneration)
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

function useHydratedAssets(paths: string[]): Record<string, string> {
  const urls = useRef<Record<string, string>>({});
  const [map, setMap] = useState<Record<string, string>>({});
  const signature = paths.join('|');

  useEffect(() => {
    let cancelled = false;
    const missing = paths.filter((path) => !urls.current[path]).slice(0, 60);
    void Promise.all(
      missing.map(async (path) => {
        try {
          const response = await authFetch(path);
          if (!response.ok) return;
          const url = URL.createObjectURL(await response.blob());
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          urls.current[path] = url;
          setMap((current) => ({ ...current, [path]: url }));
        } catch {
          // Cards stay usable even when one asset cannot be hydrated.
        }
      }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const current = urls.current;
    return () => {
      Object.values(current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  return map;
}

/** Hands a campaign or gallery direction to the Create panel across a client-side navigation. */
function stashHandoff(
  settings: ReusableSettings & { campaignId?: string; campaignName?: string },
): void {
  window.sessionStorage.setItem(reuseSettingsKey, JSON.stringify(settings));
}

export function CampaignsSection({ presets }: { presets: CategoryPreset[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>();
  const [error, setError] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [productType, setProductType] = useState('');
  const [category, setCategory] = useState(presets[0]?.id ?? 'clothing');
  const [sceneId, setSceneId] = useState(presets[0]?.scenes[0]?.id ?? 'studio');
  const [brief, setBrief] = useState('');

  const selectedPreset = presets.find((item) => item.id === category) ?? presets[0];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch('/campaigns');
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        const next = (await response.json()) as Campaign[];
        if (!cancelled) setCampaigns(next);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load campaigns.');
          setCampaigns([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSaving(true);
    try {
      const response = await authFetch('/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          sceneId,
          productType: productType.trim() || undefined,
          brief: brief.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const created = (await response.json()) as Campaign;
      setCampaigns((current) => [created, ...(current ?? [])]);
      setFormOpen(false);
      setName('');
      setProductType('');
      setBrief('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the campaign.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Campaign workspace</span>
          <h1>Your campaigns.</h1>
          <p>Define a product and its direction once, then generate as many photos as you need.</p>
        </div>
        <button
          className="studio-primary-action"
          type="button"
          onClick={() => setFormOpen((open) => !open)}
        >
          <Plus size={17} /> {formOpen ? 'Close' : 'New campaign'}
        </button>
      </div>

      {error && (
        <div className="studio-error" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}

      {formOpen && (
        <form className="studio-card studio-campaign-form" onSubmit={createCampaign}>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Campaign name</span>
              <input
                maxLength={80}
                minLength={2}
                placeholder="Example: Summer sneaker drop"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>Exact product type</span>
              <input
                maxLength={160}
                placeholder="Example: canvas low-top sneakers"
                value={productType}
                onChange={(event) => setProductType(event.target.value)}
              />
            </label>
            <label>
              <span>Category</span>
              <select
                value={category}
                onChange={(event) => {
                  const next = presets.find((item) => item.id === event.target.value);
                  setCategory(event.target.value);
                  if (next?.scenes[0]) setSceneId(next.scenes[0].id);
                }}
              >
                {presets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Scene preset</span>
              <select value={sceneId} onChange={(event) => setSceneId(event.target.value)}>
                {selectedPreset?.scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full-width">
              <span>Campaign brief (optional)</span>
              <textarea
                maxLength={500}
                placeholder="Shared direction for every photo in this campaign…"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
              />
            </label>
          </div>
          <div className="studio-campaign-form-actions">
            <button className="studio-primary-action" disabled={saving} type="submit">
              {saving ? <LoaderCircle size={15} className="is-spinning" /> : <Plus size={15} />}
              Create campaign
            </button>
          </div>
        </form>
      )}

      {!campaigns ? (
        <div className="studio-empty">
          <LoaderCircle size={25} />
          <strong>Loading campaigns</strong>
        </div>
      ) : campaigns.length === 0 && !formOpen ? (
        <EmptyState
          icon={FolderKanban}
          title="No campaigns yet"
          copy="Create a campaign to define a product once and generate many photos for it."
        />
      ) : (
        <div className="studio-campaign-grid">
          {campaigns.map((item) => (
            <article key={item.id}>
              <div className={`studio-campaign-cover is-${item.category}`}>
                <Boxes size={30} />
                <span>{displayCategory(item.category)}</span>
              </div>
              <div>
                <h3>{item.name}</h3>
                <p>
                  {item.productType || 'Product not specified'} ·{' '}
                  {displayScene(item.category, item.sceneId)}
                </p>
                <footer>
                  <span>
                    {item.runs} {item.runs === 1 ? 'run' : 'runs'} · {item.assets} photos
                  </span>
                  <span>{formatDate(item.updatedAt)}</span>
                </footer>
                <div className="studio-campaign-actions">
                  <Link href={`/studio/campaigns/${item.id}`}>Open</Link>
                  <button
                    className="is-primary"
                    type="button"
                    onClick={() => {
                      stashHandoff({
                        category: item.category,
                        sceneId: item.sceneId,
                        productType: item.productType,
                        brief: item.brief,
                        creativeOptions: item.creativeOptions,
                        campaignId: item.id,
                        campaignName: item.name,
                      });
                      router.push('/studio');
                    }}
                  >
                    <Sparkles size={13} /> Generate
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function CampaignDetailSection({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<CampaignDetail>();
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const assetPaths = useMemo(
    () => detail?.generations.flatMap((run) => run.resultUrls) ?? [],
    [detail],
  );
  const images = useHydratedAssets(assetPaths);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch(`/campaigns/${id}`);
        if (response.status === 404) {
          if (!cancelled) setMissing(true);
          return;
        }
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        const next = (await response.json()) as CampaignDetail;
        if (!cancelled) setDetail(next);
      } catch (caught) {
        if (!cancelled)
          setError(caught instanceof Error ? caught.message : 'Could not load this campaign.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleRunShare(run: CampaignRun) {
    try {
      const response = await authFetch(`/generations/${run.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: !run.sharedAt }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const next = (await response.json()) as { sharedAt: string | null };
      setDetail((current) =>
        current
          ? {
              ...current,
              generations: current.generations.map((item) =>
                item.id === run.id ? { ...item, sharedAt: next.sharedAt } : item,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update sharing.');
    }
  }

  async function download(path: string, index: number) {
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

  async function removeCampaign() {
    const response = await authFetch(`/campaigns/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setError(await apiErrorMessage(response));
      setDeleteOpen(false);
      return;
    }
    router.push('/studio/campaigns');
  }

  if (missing) {
    return (
      <div className="studio-content">
        <EmptyState
          icon={FolderKanban}
          title="Campaign not found"
          copy="It may have been deleted. Head back to your campaign list."
        />
        <Link className="studio-back-link" href="/studio/campaigns">
          <ArrowLeft size={15} /> All campaigns
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="studio-content">
        <div className="studio-empty">
          <LoaderCircle size={25} />
          <strong>Opening campaign</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-content">
      <Link className="studio-back-link" href="/studio/campaigns">
        <ArrowLeft size={15} /> All campaigns
      </Link>
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Campaign</span>
          <h1>{detail.name}</h1>
          <p>
            {detail.productType || 'Product not specified'} ·{' '}
            {displayCategory(detail.category)} / {displayScene(detail.category, detail.sceneId)}
            {detail.brief ? ` · ${detail.brief}` : ''}
          </p>
        </div>
        <div className="studio-detail-actions">
          <button
            className="studio-danger-action"
            type="button"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            className="studio-primary-action"
            type="button"
            onClick={() => {
              stashHandoff({
                category: detail.category,
                sceneId: detail.sceneId,
                productType: detail.productType,
                brief: detail.brief,
                creativeOptions: detail.creativeOptions,
                campaignId: detail.id,
                campaignName: detail.name,
              });
              router.push('/studio');
            }}
          >
            <Sparkles size={15} /> Generate photos
          </button>
        </div>
      </div>

      {error && (
        <div className="studio-error" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}

      {detail.generations.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No photos yet"
          copy="Generate the first batch — every run you start from this campaign lands here."
        />
      ) : (
        <div className="studio-run-list">
          {detail.generations.map((run) => (
            <section className="studio-card studio-run" key={run.id}>
              <header>
                <div>
                  <span className={`studio-status is-${run.status}`}>{statusCopy[run.status]}</span>
                  <strong>{displayScene(run.category, run.sceneId)}</strong>
                  <small>
                    {formatDate(run.createdAt)} · {run.requestedVariants}{' '}
                    {run.requestedVariants === 1 ? 'image' : 'images'} requested
                  </small>
                </div>
                {run.status === 'done' && run.outputKeys.length > 0 && (
                  <button
                    className={`studio-share-btn ${run.sharedAt ? 'is-shared' : ''}`}
                    type="button"
                    onClick={() => void toggleRunShare(run)}
                  >
                    <Share2 size={14} />
                    {run.sharedAt ? 'Shared · remove' : 'Share to gallery'}
                  </button>
                )}
              </header>
              {run.status === 'failed' && run.error && <p className="studio-run-error">{run.error}</p>}
              {run.resultUrls.length > 0 && (
                <div className="studio-library-grid studio-run-grid">
                  {run.resultUrls.map((path, index) => (
                    <article key={path}>
                      {images[path] ? (
                        <img src={images[path]} alt={`Campaign photo ${index + 1}`} />
                      ) : (
                        <div>
                          <LoaderCircle size={22} />
                        </div>
                      )}
                      <footer>
                        <span>
                          <strong>Variant {String(index + 1).padStart(2, '0')}</strong>
                        </span>
                        <button
                          type="button"
                          aria-label={`Download photo ${index + 1}`}
                          onClick={() => void download(path, index)}
                        >
                          <Download size={15} />
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {deleteOpen && (
        <ConfirmDialog
          title={`Delete "${detail.name}"?`}
          message="The campaign container is removed. Already generated photos stay in your history and library."
          confirmLabel="Delete campaign"
          tone="danger"
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void removeCampaign()}
        />
      )}
    </div>
  );
}

export function GallerySection() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>();
  const [error, setError] = useState<string>();
  const covers = useMemo(
    () => (items ?? []).map((item) => item.assetUrls[0]).filter(Boolean),
    [items],
  );
  const images = useHydratedAssets(covers);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch('/gallery');
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        const next = (await response.json()) as GalleryItem[];
        if (!cancelled) setItems(next);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load the gallery.');
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function applySettings(item: GalleryItem) {
    stashHandoff({
      category: item.category,
      sceneId: item.sceneId,
      productType: item.productType,
      brief: item.brief,
      creativeOptions: item.creativeOptions,
    });
    router.push('/studio');
  }

  async function unshare(item: GalleryItem) {
    try {
      const response = await authFetch(`/generations/${item.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: false }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      setItems((current) => current?.filter((entry) => entry.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this item.');
    }
  }

  return (
    <div className="studio-content">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Community</span>
          <h1>Shared gallery.</h1>
          <p>
            Campaigns other creators chose to share. Reuse any direction with your own product.
          </p>
        </div>
      </div>

      {error && (
        <div className="studio-error" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}

      {!items ? (
        <div className="studio-empty">
          <LoaderCircle size={25} />
          <strong>Loading gallery</strong>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Nothing shared yet"
          copy="Finish a campaign and press “Share to gallery” to publish the first one."
        />
      ) : (
        <div className="studio-library-grid studio-gallery-grid">
          {items.map((item) => (
            <article key={item.id}>
              {item.assetUrls[0] && images[item.assetUrls[0]] ? (
                <img
                  src={images[item.assetUrls[0]]}
                  alt={`Shared ${displayCategory(item.category)} campaign`}
                />
              ) : (
                <div>
                  <LoaderCircle size={22} />
                </div>
              )}
              <footer>
                <span>
                  <strong>{item.productType || displayCategory(item.category)}</strong>
                  <small>
                    {displayScene(item.category, item.sceneId)} · by {item.author}
                  </small>
                </span>
              </footer>
              <div className="studio-gallery-actions">
                <button className="is-primary" type="button" onClick={() => applySettings(item)}>
                  <WandSparkles size={13} /> Use these settings
                </button>
                {item.mine && (
                  <button type="button" onClick={() => void unshare(item)}>
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibrarySection({
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

export function PresetsSection({
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

export function HistorySection({ generations }: { generations: Generation[] }) {
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
                    : item.provider === 'gemini'
                      ? 'Nano Banana'
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

export function SettingsSection({ runtime, user }: { runtime?: RuntimeConfiguration; user: StudioUser }) {
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
              <h2>Account access</h2>
              <p>This Studio account belongs to one person.</p>
            </div>
          </header>
          <label>
            Account type
            <input value={user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Studio user'} readOnly />
          </label>
          <label>
            Request allowance
            <input
              value={`${user.requestLimitPerHour || 'Unlimited'} per hour · ${user.requestLimitPerDay || 'Unlimited'} per day`}
              readOnly
            />
          </label>
          <label>
            Generation limits
            <input
              value={`${user.maxVariantsPerRequest} images per request · ${user.maxConcurrentRequests} concurrent`}
              readOnly
            />
          </label>
          <span className="studio-config-note">
            One active login is allowed. Signing in on a new device signs out the previous session.
          </span>
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
