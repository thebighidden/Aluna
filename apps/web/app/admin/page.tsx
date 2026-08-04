'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Cpu,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGate } from './admin-gate';
import {
  apiErrorMessage,
  authFetch,
  currentUser,
  logout,
  type StudioUser,
} from '../lib/auth-client';

type Section = 'overview' | 'traffic' | 'usage' | 'generations' | 'users' | 'system';
type Range = 7 | 30 | 90;

type AdminOverview = {
  range: { days: number; from: string; to: string };
  summary: {
    requests: number;
    images: number;
    spendUsd: number;
    successRate: number;
    averageDurationMs: number;
    failed: number;
    totalUsers: number;
    activeUsers: number;
    siteVisits: number;
    uniqueVisitors: number;
    waitlistSubscribers: number;
    totalTokens: number;
    providerUsageUnits: number;
    providerUsageUnit: string;
  };
  trend: Array<{
    date: string;
    label: string;
    requests: number;
    images: number;
    spendUsd: number;
    failures: number;
  }>;
  trafficTrend: Array<{
    date: string;
    label: string;
    visits: number;
    visitors: number;
  }>;
  topPages: Array<{ path: string; visits: number; visitors: number }>;
  deviceBreakdown: Array<{ device: string; visits: number }>;
  categoryBreakdown: Array<{
    category: string;
    requests: number;
    images: number;
    spendUsd: number;
  }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  providerBreakdown: Array<{
    provider: string;
    requests: number;
    images: number;
    spendUsd: number;
    usageUnits: number;
    usageUnit: string;
  }>;
  userConsumption: Array<{
    id: string;
    name: string;
    email: string;
    role: StudioUser['role'];
    isActive: boolean;
    requests: number;
    images: number;
    spendUsd: number;
    totalTokens: number;
    providerUsage: Array<{ provider: string; units: number; unit: string }>;
    failures: number;
    lastActivity: string | null;
  }>;
  recentGenerations: GenerationRun[];
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
    paused: number;
    workers: number;
    healthy: boolean;
    error?: string;
  };
  configuration: {
    provider: string;
    providerId: 'cloudflare' | 'gemini' | 'openai';
    configured: boolean;
    missingConfiguration: string[];
    model: string;
    quality: string;
    imageSize: string;
    storage: string;
    costMode: string;
    usageUnit: string;
    dailyFreeUnits: number | null;
    todayProviderUnits: number;
    remainingFreeUnits: number | null;
    estimatedImagesRemaining: number | null;
    dailyCreditValueUsd: number | null;
    remainingCreditValueUsd: number | null;
    latestProviderError: string | null;
    latestProviderErrorCode: string | null;
    availableProviders: Array<{
      provider: 'cloudflare' | 'gemini' | 'openai';
      providerLabel: string;
      model: string;
      quality: string;
      imageSize: string;
      configured: boolean;
      missingConfiguration: string[];
      usageUnit: string;
    }>;
  };
  platformUsage: {
    connected: boolean;
    reason: string | null;
    images: number;
    requests: number;
    costUsd: number;
  };
};

type GenerationRun = {
  id: string;
  user: Pick<StudioUser, 'id' | 'name' | 'email' | 'role'> | null;
  status: string;
  provider: string;
  model: string;
  quality: string;
  imageSize: string;
  category: string;
  sceneId: string;
  brief: string | null;
  creativeOptions: Record<string, string> | null;
  inputUrl: string;
  resultUrls: string[];
  requestedVariants: number;
  completedVariants: number;
  inputTokens: number;
  inputTextTokens: number;
  inputImageTokens: number;
  outputTokens: number;
  totalTokens: number;
  providerUsageUnits: number;
  providerUsageUnit: string;
  costUsd: number;
  durationMs: number;
  error: string | null;
  errorCode: string | null;
  createdAt: string;
};

type GenerationAudit = { total: number; skip: number; take: number; items: GenerationRun[] };

type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: StudioUser['role'];
  isActive: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  requestLimitPerHour: number;
  requestLimitPerDay: number;
  maxVariantsPerRequest: number;
  maxConcurrentRequests: number;
  policyUsage: {
    requestsThisHour: number;
    requestsToday: number;
    activeRequests: number;
  };
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  updatedAt: string;
  _count: { generations: number };
};

const navItems: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'traffic', label: 'Site analytics', icon: Activity },
  { id: 'usage', label: 'Usage & cost', icon: BarChart3 },
  { id: 'generations', label: 'Generations', icon: ImageIcon },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'system', label: 'System health', icon: Server },
];

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'No activity';
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('overview');
  const [range, setRange] = useState<Range>(30);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [generationAudit, setGenerationAudit] = useState<GenerationAudit>({
    total: 0,
    skip: 0,
    take: 100,
    items: [],
  });
  const [viewer, setViewer] = useState<StudioUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [selectedRun, setSelectedRun] = useState<GenerationRun | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      setMessage(null);
      try {
        const [me, overviewResponse, usersResponse, generationsResponse] = await Promise.all([
          currentUser(),
          authFetch(`/admin/overview?days=${range}`),
          authFetch('/users'),
          authFetch('/admin/generations?take=100'),
        ]);
        if (!overviewResponse.ok) throw new Error(await apiErrorMessage(overviewResponse));
        if (!usersResponse.ok) throw new Error(await apiErrorMessage(usersResponse));
        if (!generationsResponse.ok) throw new Error(await apiErrorMessage(generationsResponse));
        setViewer(me);
        setOverview((await overviewResponse.json()) as AdminOverview);
        setAccounts((await usersResponse.json()) as UserAccount[]);
        setGenerationAudit((await generationsResponse.json()) as GenerationAudit);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Dashboard data could not be loaded.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectSection = (next: Section) => {
    setSection(next);
    setMenuOpen(false);
  };

  const signOut = async () => {
    await logout();
    router.replace('/admin/login');
  };

  const loadMoreGenerations = async () => {
    const response = await authFetch(
      `/admin/generations?take=100&skip=${generationAudit.items.length}`,
    );
    if (!response.ok) {
      setMessage(await apiErrorMessage(response));
      return;
    }
    const next = (await response.json()) as GenerationAudit;
    setGenerationAudit((current) => ({ ...next, items: [...current.items, ...next.items] }));
  };

  if (loading && !overview) {
    return (
      <main className="ops-loading">
        <LoaderCircle aria-hidden="true" />
        <strong>Loading operations data</strong>
        <span>Checking users, generations, cost and queue health.</span>
      </main>
    );
  }

  return (
    <main className="ops-shell">
      <button
        className={`ops-backdrop ${menuOpen ? 'is-visible' : ''}`}
        aria-label="Close navigation"
        type="button"
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="ops-sidebar-head">
          <Link className="ops-logo" href="/">
            Aluna<span>°</span>
          </Link>
          <button
            className="ops-mobile-close"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <span className="ops-workspace-label">Admin workspace</span>
        <nav className="ops-nav" aria-label="Dashboard sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={section === item.id ? 'is-active' : ''}
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}
        </nav>
        <div className="ops-sidebar-bottom">
          <Link href="/studio">
            <Sparkles aria-hidden="true" />
            Open Studio
          </Link>
          <div className="ops-profile">
            <span>{viewer?.name.slice(0, 2).toUpperCase() ?? 'AL'}</span>
            <div>
              <strong>{viewer?.name ?? 'Administrator'}</strong>
              <small>SUPER ADMIN</small>
            </div>
            <button type="button" onClick={signOut} aria-label="Sign out">
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <section className="ops-main">
        <header className="ops-topbar">
          <button
            className="ops-menu"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu aria-hidden="true" />
          </button>
          <div>
            <small>Operations</small>
            <strong>{navItems.find((item) => item.id === section)?.label}</strong>
          </div>
          <div className="ops-top-actions">
            <select
              value={range}
              onChange={(event) => setRange(Number(event.target.value) as Range)}
              aria-label="Analytics date range"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              type="button"
              onClick={() => void load(true)}
              aria-label="Refresh dashboard"
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? 'is-spinning' : ''} aria-hidden="true" />
            </button>
            <button className="ops-primary" type="button" onClick={() => setInviteOpen(true)}>
              <Plus aria-hidden="true" />
              Add user
            </button>
          </div>
        </header>

        <div className="ops-content">
          {message && (
            <div className="ops-alert ops-alert--error">
              <AlertTriangle aria-hidden="true" />
              <span>{message}</span>
            </div>
          )}
          {overview?.configuration.latestProviderErrorCode === 'billing_limit' && (
            <div className="ops-alert ops-alert--warning">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>Image generation is paused by the provider billing limit.</strong>
                <span>{overview.configuration.latestProviderError}</span>
              </div>
            </div>
          )}
          {overview && !overview.configuration.configured && (
            <div className="ops-alert ops-alert--warning">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>The image provider needs configuration.</strong>
                <span>
                  Add {overview.configuration.missingConfiguration.join(' and ')} to the API
                  environment.
                </span>
              </div>
            </div>
          )}
          {overview?.configuration.latestProviderErrorCode === 'daily_budget' && (
            <div className="ops-alert ops-alert--warning">
              <Gauge aria-hidden="true" />
              <div>
                <strong>The daily demo generation allowance is exhausted.</strong>
                <span>Cloudflare Workers AI free usage resets at 00:00 UTC.</span>
              </div>
            </div>
          )}
          {section === 'overview' && overview && <Overview overview={overview} />}
          {section === 'traffic' && overview && <Traffic overview={overview} />}
          {section === 'usage' && overview && <Usage overview={overview} />}
          {section === 'generations' && overview && (
            <Generations
              runs={generationAudit.items}
              total={generationAudit.total}
              onInspect={setSelectedRun}
              onLoadMore={() => void loadMoreGenerations()}
            />
          )}
          {section === 'users' && overview && (
            <UsersPanel
              accounts={accounts}
              consumption={overview.userConsumption}
              reload={() => void load(true)}
              setMessage={setMessage}
              openInvite={() => setInviteOpen(true)}
              editUser={setEditingUser}
            />
          )}
          {section === 'system' && overview && (
            <SystemHealth
              overview={overview}
              reload={() => void load(true)}
              setMessage={setMessage}
            />
          )}
        </div>
      </section>
      {inviteOpen && (
        <AddUserModal close={() => setInviteOpen(false)} reload={() => void load(true)} />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          close={() => setEditingUser(null)}
          reload={() => void load(true)}
        />
      )}
      {selectedRun && (
        <GenerationDetailModal run={selectedRun} close={() => setSelectedRun(null)} />
      )}
    </main>
  );
}

function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="ops-page-heading">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

function Overview({ overview }: { overview: AdminOverview }) {
  const max = Math.max(...overview.trend.map((day) => day.requests), 1);
  const cards = [
    {
      label: 'Generation requests',
      value: compact(overview.summary.requests),
      note: `${overview.summary.images} completed images`,
      icon: Sparkles,
    },
    {
      label: 'Estimated spend',
      value: money(overview.summary.spendUsd),
      note: overview.configuration.costMode,
      icon: CircleDollarSign,
    },
    {
      label: 'Success rate',
      value: `${overview.summary.successRate}%`,
      note: `${overview.summary.failed} failed requests`,
      icon: CheckCircle2,
    },
    {
      label: 'Active users',
      value: `${overview.summary.activeUsers}`,
      note: `${overview.summary.totalUsers} total accounts`,
      icon: Users,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={`${overview.range.days}-day overview`}
        title="Workspace at a glance."
        copy="Live usage, cost, user activity and generation reliability from the Aluna database."
      />
      <section className="ops-metrics">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <article key={label}>
            <div>
              <Icon aria-hidden="true" />
              <span>Live</span>
            </div>
            <small>{label}</small>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </section>
      <section className="ops-grid ops-grid--wide">
        <article className="ops-card ops-chart-card">
          <div className="ops-card-head">
            <div>
              <span>Request volume</span>
              <h2>Generation activity</h2>
            </div>
            <strong>{overview.summary.requests} requests</strong>
          </div>
          <div className="ops-bars" aria-label="Generation requests by day">
            {overview.trend.map((day, index) => (
              <div key={day.date} title={`${day.label}: ${day.requests} requests`}>
                <i
                  style={{
                    height: `${Math.max(day.requests ? (day.requests / max) * 100 : 3, 3)}%`,
                  }}
                  className={day.failures ? 'has-failure' : ''}
                />
                <small>{index % Math.ceil(overview.trend.length / 7) === 0 ? day.label : ''}</small>
              </div>
            ))}
          </div>
        </article>
        <QueueCard overview={overview} />
      </section>
      <RecentTable runs={overview.recentGenerations.slice(0, 8)} />
    </>
  );
}

function QueueCard({ overview }: { overview: AdminOverview }) {
  const queue = overview.queue;
  return (
    <article className="ops-card ops-queue-card">
      <div className="ops-card-head">
        <div>
          <span>Redis & BullMQ</span>
          <h2>Queue health</h2>
        </div>
        <em className={queue.healthy ? 'is-good' : 'is-bad'}>
          {queue.healthy ? 'Online' : 'Unavailable'}
        </em>
      </div>
      <div className="ops-queue-total">
        <strong>{queue.active + queue.waiting}</strong>
        <span>open jobs</span>
      </div>
      <dl>
        <div>
          <dt>Generating</dt>
          <dd>{queue.active}</dd>
        </div>
        <div>
          <dt>Waiting</dt>
          <dd>{queue.waiting}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{queue.failed}</dd>
        </div>
        <div>
          <dt>Workers online</dt>
          <dd>{queue.workers}</dd>
        </div>
      </dl>
    </article>
  );
}

function Traffic({ overview }: { overview: AdminOverview }) {
  const maxVisits = Math.max(...overview.trafficTrend.map((day) => day.visits), 1);
  const humanVisits = overview.deviceBreakdown
    .filter((item) => item.device !== 'bot')
    .reduce((sum, item) => sum + item.visits, 0);
  return (
    <>
      <PageHeading
        eyebrow="First-party analytics"
        title="See who visits Aluna."
        copy="Privacy-conscious page views, unique visitors, popular routes and device mix recorded by the application."
      />
      <section className="ops-metrics ops-metrics--three">
        <article>
          <div>
            <Activity aria-hidden="true" />
            <span>Live</span>
          </div>
          <small>Page views</small>
          <strong>{compact(overview.summary.siteVisits)}</strong>
          <p>Across the selected period</p>
        </article>
        <article>
          <div>
            <Users aria-hidden="true" />
            <span>Unique</span>
          </div>
          <small>Visitors</small>
          <strong>{compact(overview.summary.uniqueVisitors)}</strong>
          <p>Anonymous browser identifiers</p>
        </article>
        <article>
          <div>
            <ShieldCheck aria-hidden="true" />
            <span>Private</span>
          </div>
          <small>Human page views</small>
          <strong>{compact(humanVisits)}</strong>
          <p>No raw IP addresses stored</p>
        </article>
      </section>
      <section className="ops-grid ops-grid--wide">
        <article className="ops-card ops-chart-card">
          <div className="ops-card-head">
            <div>
              <span>Traffic volume</span>
              <h2>Visits by day</h2>
            </div>
            <strong>{overview.summary.uniqueVisitors} visitors</strong>
          </div>
          <div className="ops-bars" aria-label="Site visits by day">
            {overview.trafficTrend.map((day, index) => (
              <div key={day.date} title={`${day.label}: ${day.visits} visits`}>
                <i
                  style={{
                    height: `${Math.max(day.visits ? (day.visits / maxVisits) * 100 : 3, 3)}%`,
                  }}
                />
                <small>
                  {index % Math.ceil(overview.trafficTrend.length / 7) === 0 ? day.label : ''}
                </small>
              </div>
            ))}
          </div>
        </article>
        <article className="ops-card">
          <div className="ops-card-head">
            <div>
              <span>Device mix</span>
              <h2>How people browse</h2>
            </div>
          </div>
          <div className="ops-category-list">
            {overview.deviceBreakdown.map((item) => (
              <div key={item.device}>
                <div>
                  <strong>{item.device}</strong>
                  <span>{item.visits} views</span>
                </div>
                <i>
                  <b
                    style={{
                      width: `${overview.summary.siteVisits ? (item.visits / overview.summary.siteVisits) * 100 : 0}%`,
                    }}
                  />
                </i>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="ops-card ops-table-card">
        <div className="ops-card-head">
          <div>
            <span>Popular routes</span>
            <h2>Most visited pages</h2>
          </div>
          <strong>{overview.topPages.length} routes</strong>
        </div>
        <div className="ops-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>Views</th>
                <th>Unique visitors</th>
              </tr>
            </thead>
            <tbody>
              {overview.topPages.length ? (
                overview.topPages.map((page) => (
                  <tr key={page.path}>
                    <td>
                      <strong>{page.path}</strong>
                    </td>
                    <td>{page.visits}</td>
                    <td>{page.visitors}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="ops-empty" colSpan={3}>
                    Visits will appear here as people browse the site.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Usage({ overview }: { overview: AdminOverview }) {
  const maxSpend = Math.max(...overview.categoryBreakdown.map((item) => item.spendUsd), 0.000001);
  return (
    <>
      <PageHeading
        eyebrow="Consumption center"
        title="Every image. Every dollar."
        copy="Track provider requests, metered usage, estimated spend and consumption by customer."
      />
      <section className="ops-metrics">
        <article>
          <div>
            <ImageIcon aria-hidden="true" />
            <span>Database</span>
          </div>
          <small>Images delivered</small>
          <strong>{compact(overview.summary.images)}</strong>
          <p>{overview.summary.requests} requests</p>
        </article>
        <article>
          <div>
            <Gauge aria-hidden="true" />
            <span>Provider telemetry</span>
          </div>
          <small>Total {overview.summary.providerUsageUnit}</small>
          <strong>{compact(overview.summary.providerUsageUnits)}</strong>
          <p>Metered for {overview.configuration.provider}</p>
        </article>
        <article>
          <div>
            <CircleDollarSign aria-hidden="true" />
            <span>{overview.platformUsage.connected ? 'Reconciled' : 'Estimated'}</span>
          </div>
          <small>Provider cost</small>
          <strong>
            {money(
              overview.platformUsage.connected
                ? overview.platformUsage.costUsd
                : overview.summary.spendUsd,
            )}
          </strong>
          <p>
            {overview.platformUsage.connected
              ? 'Provider invoice data'
              : 'Local list-price estimate'}
          </p>
        </article>
        <article>
          <div>
            <Gauge aria-hidden="true" />
            <span>{overview.configuration.remainingFreeUnits === null ? 'Paid' : 'Today'}</span>
          </div>
          <small>Provider allowance remaining</small>
          <strong>
            {overview.configuration.remainingFreeUnits === null
              ? 'Metered'
              : compact(overview.configuration.remainingFreeUnits)}
          </strong>
          <p>
            {overview.configuration.estimatedImagesRemaining === null
              ? 'Controlled by provider billing'
              : `About ${overview.configuration.estimatedImagesRemaining} images · ${money(
                  overview.configuration.remainingCreditValueUsd ?? 0,
                )} free value`}
          </p>
        </article>
      </section>
      {!overview.platformUsage.connected && (
        <div className="ops-alert">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Organization reconciliation is optional.</strong>
            <span>{overview.platformUsage.reason}</span>
          </div>
        </div>
      )}
      <section className="ops-grid ops-grid--equal">
        <article className="ops-card">
          <div className="ops-card-head">
            <div>
              <span>Category mix</span>
              <h2>Cost by product type</h2>
            </div>
          </div>
          <div className="ops-category-list">
            {overview.categoryBreakdown.map((item) => (
              <div key={item.category}>
                <div>
                  <strong>{item.category}</strong>
                  <span>
                    {item.requests} requests · {money(item.spendUsd)}
                  </span>
                </div>
                <i>
                  <b
                    style={{
                      width: `${Math.max((item.spendUsd / maxSpend) * 100, item.requests ? 5 : 0)}%`,
                    }}
                  />
                </i>
              </div>
            ))}
          </div>
        </article>
        <article className="ops-card">
          <div className="ops-card-head">
            <div>
              <span>Team allocation</span>
              <h2>Top consumers</h2>
            </div>
          </div>
          <div className="ops-consumers">
            {overview.userConsumption
              .sort((a, b) => b.spendUsd - a.spendUsd)
              .slice(0, 6)
              .map((user) => (
                <div key={user.id}>
                  <span>{user.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>
                      {user.requests} requests · {user.images} images
                    </small>
                  </div>
                  <b>{money(user.spendUsd)}</b>
                </div>
              ))}
          </div>
        </article>
        <article className="ops-card">
          <div className="ops-card-head">
            <div>
              <span>Provider mix</span>
              <h2>Engine consumption</h2>
            </div>
          </div>
          <div className="ops-consumers">
            {overview.providerBreakdown.map((provider) => (
              <div key={provider.provider}>
                <span>{provider.provider.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{provider.provider}</strong>
                  <small>
                    {provider.images} images · {compact(provider.usageUnits)} {provider.usageUnit}
                  </small>
                </div>
                <b>{money(provider.spendUsd)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function Generations({
  runs,
  total,
  onInspect,
  onLoadMore,
}: {
  runs: GenerationRun[];
  total: number;
  onInspect: (run: GenerationRun) => void;
  onLoadMore: () => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const filtered = runs.filter((run) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch =
      !needle ||
      [run.id, run.category, run.sceneId, run.user?.name, run.user?.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    return matchesSearch && (status === 'all' || run.status === status);
  });
  return (
    <>
      <PageHeading
        eyebrow="Generation ledger"
        title="Inspect every request."
        copy="Open any operation to compare its source photo, generated outputs, settings, timing, usage, spend and errors."
      />
      <section className="ops-card ops-table-card">
        <div className="ops-card-head ops-audit-head">
          <div>
            <span>Complete database</span>
            <h2>{total} generation operations</h2>
          </div>
          <div className="ops-audit-filters">
            <input
              aria-label="Search generation operations"
              placeholder="Search user, email, category or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter generation status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="done">Done</option>
              <option value="failed">Failed</option>
              <option value="generating">Generating</option>
              <option value="analyzing">Analyzing</option>
              <option value="queued">Queued</option>
            </select>
          </div>
        </div>
        <RecentTable runs={filtered} detailed onInspect={onInspect} />
        {runs.length < total && (
          <button className="ops-load-more" type="button" onClick={onLoadMore}>
            Load more operations
          </button>
        )}
      </section>
    </>
  );
}

function RecentTable({
  runs,
  detailed = false,
  onInspect,
}: {
  runs: GenerationRun[];
  detailed?: boolean;
  onInspect?: (run: GenerationRun) => void;
}) {
  return (
    <section className={detailed ? 'ops-audit-table' : 'ops-card ops-table-card'}>
      {!detailed && (
        <div className="ops-card-head">
          <div>
            <span>Live database</span>
            <h2>Recent generations</h2>
          </div>
          <strong>{runs.length} shown</strong>
        </div>
      )}
      <div className="ops-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Owner / request</th>
              <th>Category</th>
              <th>Variants</th>
              <th>Status</th>
              {detailed && <th>Model</th>}
              <th>Usage</th>
              <th>Cost</th>
              <th>Created</th>
              {onInspect && <th>Details</th>}
            </tr>
          </thead>
          <tbody>
            {runs.length ? (
              runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <strong>{run.user?.name ?? 'System / CLI'}</strong>
                    <small>{run.id.slice(0, 10)}…</small>
                  </td>
                  <td>
                    <strong className="ops-capitalize">{run.category}</strong>
                    <small>{run.sceneId}</small>
                  </td>
                  <td>
                    {run.completedVariants} / {run.requestedVariants}
                  </td>
                  <td>
                    <span className={`ops-status ops-status--${run.status}`}>{run.status}</span>
                    {run.errorCode && <small>{run.errorCode.replaceAll('_', ' ')}</small>}
                  </td>
                  {detailed && (
                    <td>
                      <strong>{run.model}</strong>
                      <small>
                        {run.quality} · {run.imageSize}
                      </small>
                    </td>
                  )}
                  <td>
                    {compact(run.providerUsageUnits || run.totalTokens)}
                    <small>{run.providerUsageUnit}</small>
                  </td>
                  <td>{money(run.costUsd)}</td>
                  <td>{dateTime(run.createdAt)}</td>
                  {onInspect && (
                    <td>
                      <button
                        className="ops-view-button"
                        type="button"
                        onClick={() => onInspect(run)}
                      >
                        View
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={detailed ? (onInspect ? 9 : 8) : 7} className="ops-empty">
                  No generation activity matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersPanel({
  accounts,
  consumption,
  reload,
  setMessage,
  openInvite,
  editUser,
}: {
  accounts: UserAccount[];
  consumption: AdminOverview['userConsumption'];
  reload: () => void;
  setMessage: (message: string | null) => void;
  openInvite: () => void;
  editUser: (user: UserAccount) => void;
}) {
  const updateStatus = async (id: string, isActive: boolean) => {
    setMessage(null);
    try {
      const response = await authFetch(`/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'User could not be updated.');
    }
  };
  const deleteUser = async (user: UserAccount) => {
    if (!window.confirm(`Delete ${user.name}'s account? Their generation history will be kept.`)) {
      return;
    }
    setMessage(null);
    try {
      const response = await authFetch(`/users/${user.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'User could not be deleted.');
    }
  };
  const updateBan = async (user: UserAccount, hours: number | null) => {
    setMessage(null);
    try {
      const response = await authFetch(`/users/${user.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannedUntil: hours === null ? null : new Date(Date.now() + hours * 60 * 60 * 1_000),
          banReason: hours === null ? null : 'Temporary suspension by Super Admin',
        }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'User ban could not be updated.');
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Access control"
        title="Customers and consumption."
        copy="Create individual Studio accounts, suspend access, and see every customer's images, provider usage, spend, failures, and last activity."
      />
      <section className="ops-card ops-users-card">
        <div className="ops-card-head">
          <div>
            <span>Customer accounts</span>
            <h2>{accounts.length} accounts</h2>
          </div>
          <button className="ops-inline-button" type="button" onClick={openInvite}>
            <Plus aria-hidden="true" />
            New account
          </button>
        </div>
        <div className="ops-user-list">
          {accounts.map((user) => {
            const usage = consumption.find((item) => item.id === user.id);
            const usageLabel = usage?.providerUsage.length
              ? usage.providerUsage.map((item) => `${compact(item.units)} ${item.unit}`).join(' + ')
              : '0 units';
            const isSuperAdmin = user.role === 'SUPER_ADMIN';
            const isBanned = Boolean(
              user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now(),
            );
            return (
              <article key={user.id}>
                <div className="ops-user-identity">
                  <span>{user.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    <em>
                      {isSuperAdmin
                        ? 'Super Admin · Protected'
                        : isBanned
                          ? `Banned until ${dateTime(user.bannedUntil)}`
                          : user.lastLoginAt
                            ? `Last login ${dateTime(user.lastLoginAt)}`
                            : usage?.lastActivity
                              ? `Last generation ${dateTime(usage.lastActivity)}`
                              : 'Studio user · No activity'}
                    </em>
                  </div>
                </div>
                <div className="ops-user-stat">
                  <small>Requests</small>
                  <strong>
                    {user.policyUsage.requestsThisHour}/{user.requestLimitPerHour || '∞'} hr
                  </strong>
                  <em>
                    {user.policyUsage.requestsToday}/{user.requestLimitPerDay || '∞'} today
                  </em>
                </div>
                <div className="ops-user-stat">
                  <small>Images</small>
                  <strong>{usage?.images ?? 0}</strong>
                  <em>Max {user.maxVariantsPerRequest} per request</em>
                </div>
                <div className="ops-user-stat">
                  <small>Provider usage</small>
                  <strong>{usageLabel}</strong>
                </div>
                <div className="ops-user-stat">
                  <small>Spend</small>
                  <strong>{money(usage?.spendUsd ?? 0)}</strong>
                  <em>{usage?.failures ?? 0} failed</em>
                </div>
                <div className="ops-user-controls">
                  <button
                    className={`ops-user-state ${user.isActive && !isBanned ? 'is-active' : ''}`}
                    type="button"
                    disabled={isSuperAdmin}
                    onClick={() => void updateStatus(user.id, !user.isActive)}
                  >
                    {isSuperAdmin
                      ? 'Protected'
                      : !user.isActive
                        ? 'Deactivated'
                        : isBanned
                          ? 'Temporarily banned'
                          : 'Active'}
                  </button>
                  <div className="ops-user-actions">
                    <button
                      className={isBanned ? 'is-warning' : ''}
                      type="button"
                      disabled={isSuperAdmin}
                      onClick={() => void updateBan(user, isBanned ? null : 24)}
                      aria-label={isBanned ? `Unban ${user.name}` : `Ban ${user.name} for 24 hours`}
                    >
                      {isBanned ? <Clock3 aria-hidden="true" /> : <Ban aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      disabled={isSuperAdmin}
                      onClick={() => editUser(user)}
                      aria-label={`Edit ${user.name}`}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                    <button
                      className="is-danger"
                      type="button"
                      disabled={isSuperAdmin}
                      onClick={() => void deleteUser(user)}
                      aria-label={`Delete ${user.name}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function SystemHealth({
  overview,
  reload,
  setMessage,
}: {
  overview: AdminOverview;
  reload: () => void;
  setMessage: (message: string | null) => void;
}) {
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const selectProvider = async (provider: 'cloudflare' | 'gemini' | 'openai') => {
    setSavingProvider(provider);
    setMessage(null);
    try {
      const response = await authFetch('/admin/generation-provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Generation model could not be changed.');
    } finally {
      setSavingProvider(null);
    }
  };
  const items = [
    {
      label: 'API & database',
      value: 'Connected',
      good: true,
      note: 'Authenticated NestJS services are responding.',
    },
    {
      label: 'Generation queue',
      value: overview.queue.healthy ? 'Connected' : 'Unavailable',
      good: overview.queue.healthy,
      note: `${overview.queue.workers} worker process${overview.queue.workers === 1 ? '' : 'es'} online.`,
    },
    {
      label: 'Image provider',
      value: !overview.configuration.configured
        ? 'Needs configuration'
        : overview.configuration.latestProviderErrorCode === 'billing_limit'
          ? 'Billing blocked'
          : 'Configured',
      good:
        overview.configuration.configured &&
        overview.configuration.latestProviderErrorCode !== 'billing_limit',
      note: `${overview.configuration.provider} · ${overview.configuration.model}`,
    },
    {
      label: 'Result storage',
      value: overview.configuration.storage,
      good: true,
      note:
        overview.configuration.storage === 'Local disk'
          ? 'R2 is not configured; local fallback is active.'
          : 'Cloud object storage is active.',
    },
    {
      label: 'Daily provider allowance',
      value:
        overview.configuration.remainingFreeUnits === null
          ? 'Metered billing'
          : `${compact(overview.configuration.remainingFreeUnits)} remaining`,
      good:
        overview.configuration.remainingFreeUnits === null ||
        overview.configuration.remainingFreeUnits > 0,
      note:
        overview.configuration.estimatedImagesRemaining === null
          ? (overview.platformUsage.reason ?? 'Provider usage is tracked per request.')
          : `Approximately ${overview.configuration.estimatedImagesRemaining} demo images remain today.`,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Infrastructure"
        title="Know what is healthy."
        copy="Operational status for the API, generation worker, Redis queue, storage and provider configuration."
      />
      <section className="ops-card ops-model-control">
        <div className="ops-card-head">
          <div>
            <span>Image engine</span>
            <h2>Choose the active generation model</h2>
          </div>
          <Cpu aria-hidden="true" />
        </div>
        <p>
          This is a global setting. New jobs use the selected engine; jobs already queued keep the
          model they started with.
        </p>
        <div className="ops-model-options">
          {overview.configuration.availableProviders.map((provider) => {
            const isCurrent = provider.provider === overview.configuration.providerId;
            return (
              <article className={isCurrent ? 'is-current' : ''} key={provider.provider}>
                <div>
                  <span>{provider.providerLabel}</span>
                  <strong>{provider.model}</strong>
                  <small>
                    {provider.quality} · {provider.imageSize}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={!provider.configured || isCurrent || Boolean(savingProvider)}
                  onClick={() => void selectProvider(provider.provider)}
                >
                  {savingProvider === provider.provider
                    ? 'Switching…'
                    : isCurrent
                      ? 'Active'
                      : provider.configured
                        ? 'Use model'
                        : `Needs ${provider.missingConfiguration.join(' + ')}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="ops-system-grid">
        {items.map((item) => (
          <article key={item.label}>
            <span className={item.good ? 'is-good' : 'is-warning'}>
              {item.good ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <AlertTriangle aria-hidden="true" />
              )}
            </span>
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="ops-card ops-config-card">
        <div className="ops-card-head">
          <div>
            <span>Runtime configuration</span>
            <h2>Generation defaults</h2>
          </div>
        </div>
        <dl>
          <div>
            <dt>Model</dt>
            <dd>{overview.configuration.model}</dd>
          </div>
          <div>
            <dt>Quality</dt>
            <dd>{overview.configuration.quality}</dd>
          </div>
          <div>
            <dt>Output size</dt>
            <dd>{overview.configuration.imageSize}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{overview.configuration.storage}</dd>
          </div>
          <div>
            <dt>Provider usage today</dt>
            <dd>
              {compact(overview.configuration.todayProviderUnits)}{' '}
              {overview.configuration.usageUnit}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function AddUserModal({ close, reload }: { close: () => void; reload: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
      requestLimitPerHour: Number(form.get('requestLimitPerHour')),
      requestLimitPerDay: Number(form.get('requestLimitPerDay')),
      maxVariantsPerRequest: Number(form.get('maxVariantsPerRequest')),
      maxConcurrentRequests: Number(form.get('maxConcurrentRequests')),
    };
    try {
      const response = await authFetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      close();
      reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account could not be created.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
      <button
        className="ops-modal-backdrop"
        type="button"
        onClick={close}
        aria-label="Close dialog"
      />
      <form onSubmit={submit}>
        <div className="ops-modal-head">
          <div>
            <span>Workspace access</span>
            <h2 id="add-user-title">Create a user</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close dialog">
            <X aria-hidden="true" />
          </button>
        </div>
        <p>
          The customer receives one personal Studio account and can use every campaign and asset
          feature. Admin analytics remain private to the Super Admin.
        </p>
        {error && <div className="ops-form-error">{error}</div>}
        <label>
          <span>Full name</span>
          <input name="name" minLength={2} maxLength={80} required placeholder="Nora El Mansouri" />
        </label>
        <label>
          <span>Email address</span>
          <input name="email" type="email" required placeholder="nora@company.com" />
        </label>
        <label>
          <span>Temporary password</span>
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            required
            placeholder="At least 12 characters"
          />
        </label>
        <div className="ops-form-grid">
          <label>
            <span>Requests per hour</span>
            <input name="requestLimitPerHour" type="number" min={0} max={10000} defaultValue={10} />
          </label>
          <label>
            <span>Requests per day</span>
            <input name="requestLimitPerDay" type="number" min={0} max={100000} defaultValue={30} />
          </label>
          <label>
            <span>Images per request</span>
            <input name="maxVariantsPerRequest" type="number" min={1} max={12} defaultValue={12} />
          </label>
          <label>
            <span>Concurrent requests</span>
            <input name="maxConcurrentRequests" type="number" min={1} max={10} defaultValue={1} />
          </label>
        </div>
        <button className="ops-submit" type="submit" disabled={saving}>
          {saving ? (
            <LoaderCircle className="is-spinning" aria-hidden="true" />
          ) : (
            <UserRoundCog aria-hidden="true" />
          )}
          {saving ? 'Creating account' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

function EditUserModal({
  user,
  close,
  reload,
}: {
  user: UserAccount;
  close: () => void;
  reload: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const accountPayload = {
      name: form.get('name'),
      email: form.get('email'),
      ...(password ? { password } : {}),
    };
    const banHours = String(form.get('banDuration') ?? 'unchanged');
    const accessPayload = {
      requestLimitPerHour: Number(form.get('requestLimitPerHour')),
      requestLimitPerDay: Number(form.get('requestLimitPerDay')),
      maxVariantsPerRequest: Number(form.get('maxVariantsPerRequest')),
      maxConcurrentRequests: Number(form.get('maxConcurrentRequests')),
      banReason: String(form.get('banReason') ?? '').trim() || null,
      ...(banHours === 'clear'
        ? { bannedUntil: null }
        : banHours !== 'unchanged'
          ? { bannedUntil: new Date(Date.now() + Number(banHours) * 60 * 60 * 1_000) }
          : {}),
    };
    try {
      const response = await authFetch(`/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountPayload),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const accessResponse = await authFetch(`/users/${user.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accessPayload),
      });
      if (!accessResponse.ok) throw new Error(await apiErrorMessage(accessResponse));
      close();
      reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account could not be updated.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
      <button
        className="ops-modal-backdrop"
        type="button"
        onClick={close}
        aria-label="Close dialog"
      />
      <form onSubmit={submit}>
        <div className="ops-modal-head">
          <div>
            <span>Account data</span>
            <h2 id="edit-user-title">Edit {user.name}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close dialog">
            <X aria-hidden="true" />
          </button>
        </div>
        <p>
          Manage identity, timed bans and generation limits. Password changes and new bans sign the
          user out of every device.
        </p>
        {error && <div className="ops-form-error">{error}</div>}
        <label>
          <span>Full name</span>
          <input name="name" minLength={2} maxLength={80} required defaultValue={user.name} />
        </label>
        <label>
          <span>Email address</span>
          <input name="email" type="email" required defaultValue={user.email} />
        </label>
        <label>
          <span>New password · optional</span>
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            placeholder="Leave blank to keep the current password"
          />
        </label>
        <div className="ops-form-section">
          <div>
            <Ban aria-hidden="true" />
            <span>Timed access ban</span>
          </div>
          <div className="ops-form-grid">
            <label>
              <span>Ban duration</span>
              <select name="banDuration" defaultValue="unchanged">
                <option value="unchanged">Keep current ban</option>
                <option value="clear">No ban / clear ban</option>
                <option value="1">1 hour</option>
                <option value="6">6 hours</option>
                <option value="24">1 day</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
                <option value="720">30 days</option>
              </select>
            </label>
            <label>
              <span>Reason</span>
              <input
                name="banReason"
                maxLength={240}
                defaultValue={user.banReason ?? ''}
                placeholder="Optional internal reason"
              />
            </label>
          </div>
          {user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now() && (
            <small>Currently banned until {dateTime(user.bannedUntil)}</small>
          )}
        </div>
        <div className="ops-form-section">
          <div>
            <Gauge aria-hidden="true" />
            <span>Generation limits</span>
          </div>
          <div className="ops-form-grid">
            <label>
              <span>Requests per hour · 0 = unlimited</span>
              <input
                name="requestLimitPerHour"
                type="number"
                min={0}
                max={10000}
                required
                defaultValue={user.requestLimitPerHour}
              />
            </label>
            <label>
              <span>Requests per day · 0 = unlimited</span>
              <input
                name="requestLimitPerDay"
                type="number"
                min={0}
                max={100000}
                required
                defaultValue={user.requestLimitPerDay}
              />
            </label>
            <label>
              <span>Maximum images per request</span>
              <input
                name="maxVariantsPerRequest"
                type="number"
                min={1}
                max={12}
                required
                defaultValue={user.maxVariantsPerRequest}
              />
            </label>
            <label>
              <span>Concurrent requests</span>
              <input
                name="maxConcurrentRequests"
                type="number"
                min={1}
                max={10}
                required
                defaultValue={user.maxConcurrentRequests}
              />
            </label>
          </div>
          <small>
            Current usage: {user.policyUsage.requestsThisHour} this hour,{' '}
            {user.policyUsage.requestsToday} today, {user.policyUsage.activeRequests} active.
          </small>
        </div>
        <button className="ops-submit" type="submit" disabled={saving}>
          {saving ? (
            <LoaderCircle className="is-spinning" aria-hidden="true" />
          ) : (
            <Pencil aria-hidden="true" />
          )}
          {saving ? 'Saving changes' : 'Save account'}
        </button>
      </form>
    </div>
  );
}

function ProtectedAsset({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void authFetch(path)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) return <div className="ops-protected-asset is-empty">Preview unavailable</div>;
  if (!url) return <div className="ops-protected-asset is-empty">Loading image</div>;
  return (
    <div
      className="ops-protected-asset"
      role="img"
      aria-label={label}
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

function GenerationDetailModal({ run, close }: { run: GenerationRun; close: () => void }) {
  return (
    <div
      className="ops-modal ops-audit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-title"
    >
      <button
        className="ops-modal-backdrop"
        type="button"
        onClick={close}
        aria-label="Close dialog"
      />
      <section className="ops-modal-panel">
        <div className="ops-modal-head">
          <div>
            <span>Generation operation</span>
            <h2 id="audit-title">{run.user?.name ?? 'System / CLI'}</h2>
            <small>{run.id}</small>
          </div>
          <button type="button" onClick={close} aria-label="Close dialog">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="ops-audit-summary">
          <div>
            <small>Status</small>
            <span className={`ops-status ops-status--${run.status}`}>{run.status}</span>
          </div>
          <div>
            <small>Owner</small>
            <strong>{run.user?.email || 'No linked account'}</strong>
          </div>
          <div>
            <small>Created</small>
            <strong>{dateTime(run.createdAt)}</strong>
          </div>
          <div>
            <small>Duration</small>
            <strong>{(run.durationMs / 1_000).toFixed(1)} seconds</strong>
          </div>
          <div>
            <small>Usage</small>
            <strong>
              {compact(run.providerUsageUnits || run.totalTokens)} {run.providerUsageUnit}
            </strong>
          </div>
          <div>
            <small>Cost</small>
            <strong>{money(run.costUsd)}</strong>
          </div>
        </div>
        <div className="ops-audit-media">
          <article>
            <span>Source photo</span>
            <ProtectedAsset path={run.inputUrl} label="Generation source photo" />
          </article>
          {run.resultUrls.map((path, index) => (
            <article key={path}>
              <span>Output {String(index + 1).padStart(2, '0')}</span>
              <ProtectedAsset path={path} label={`Generation output ${index + 1}`} />
            </article>
          ))}
          {!run.resultUrls.length && (
            <article>
              <span>Outputs</span>
              <div className="ops-protected-asset is-empty">No completed output</div>
            </article>
          )}
        </div>
        <div className="ops-audit-details">
          <article>
            <span>Campaign</span>
            <strong className="ops-capitalize">
              {run.category} · {run.sceneId}
            </strong>
            <p>{run.brief || 'No custom campaign brief.'}</p>
          </article>
          <article>
            <span>Provider</span>
            <strong>{run.model}</strong>
            <p>
              {run.provider} · {run.quality} · {run.imageSize} · {run.completedVariants}/
              {run.requestedVariants} outputs
            </p>
          </article>
          <article>
            <span>Creative controls</span>
            <strong>{Object.keys(run.creativeOptions ?? {}).length} saved choices</strong>
            <p>
              {Object.entries(run.creativeOptions ?? {})
                .map(([key, value]) => `${key}: ${value}`)
                .join(' · ') || 'Default scene controls were used.'}
            </p>
          </article>
        </div>
        {run.error && (
          <div className="ops-alert ops-alert--error">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>{run.errorCode?.replaceAll('_', ' ') || 'Generation failed'}</strong>
              <span>{run.error}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
