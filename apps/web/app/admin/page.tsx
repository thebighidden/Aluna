'use client';

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
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

type Section = 'overview' | 'usage' | 'generations' | 'users' | 'system';
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
    failures: number;
    lastActivity: string | null;
  }>;
  recentGenerations: Array<{
    id: string;
    user: Pick<StudioUser, 'id' | 'name' | 'email' | 'role'> | null;
    status: string;
    provider: string;
    model: string;
    quality: string;
    imageSize: string;
    category: string;
    sceneId: string;
    requestedVariants: number;
    completedVariants: number;
    totalTokens: number;
    providerUsageUnits: number;
    providerUsageUnit: string;
    costUsd: number;
    durationMs: number;
    error: string | null;
    errorCode: string | null;
    createdAt: string;
  }>;
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
    providerId: 'cloudflare' | 'openai';
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
    latestProviderError: string | null;
    latestProviderErrorCode: string | null;
  };
  platformUsage: {
    connected: boolean;
    reason: string | null;
    images: number;
    requests: number;
    costUsd: number;
  };
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

const navItems: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'usage', label: 'Usage & cost', icon: BarChart3 },
  { id: 'generations', label: 'Generations', icon: ImageIcon },
  { id: 'users', label: 'Users & roles', icon: Users },
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
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [viewer, setViewer] = useState<StudioUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      setMessage(null);
      try {
        const [me, overviewResponse, usersResponse] = await Promise.all([
          currentUser(),
          authFetch(`/admin/overview?days=${range}`),
          authFetch('/users'),
        ]);
        if (!overviewResponse.ok) throw new Error(await apiErrorMessage(overviewResponse));
        if (!usersResponse.ok) throw new Error(await apiErrorMessage(usersResponse));
        setViewer(me);
        setOverview((await overviewResponse.json()) as AdminOverview);
        setTeam((await usersResponse.json()) as TeamMember[]);
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
              <small>{viewer?.role ?? 'OWNER'}</small>
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
          {section === 'usage' && overview && <Usage overview={overview} />}
          {section === 'generations' && overview && <Generations overview={overview} />}
          {section === 'users' && overview && (
            <UsersPanel
              team={team}
              consumption={overview.userConsumption}
              reload={() => void load(true)}
              setMessage={setMessage}
              openInvite={() => setInviteOpen(true)}
            />
          )}
          {section === 'system' && overview && <SystemHealth overview={overview} />}
        </div>
      </section>
      {inviteOpen && (
        <AddUserModal close={() => setInviteOpen(false)} reload={() => void load(true)} />
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

function Usage({ overview }: { overview: AdminOverview }) {
  const maxSpend = Math.max(...overview.categoryBreakdown.map((item) => item.spendUsd), 0.000001);
  return (
    <>
      <PageHeading
        eyebrow="Consumption center"
        title="Every image. Every dollar."
        copy="Track provider requests, metered usage, estimated spend and consumption by team member."
      />
      <section className="ops-metrics ops-metrics--three">
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

function Generations({ overview }: { overview: AdminOverview }) {
  return (
    <>
      <PageHeading
        eyebrow="Generation ledger"
        title="Inspect every request."
        copy="A traceable record of model settings, completed variants, timing, tokens, costs and failures."
      />
      <RecentTable runs={overview.recentGenerations} detailed />
    </>
  );
}

function RecentTable({
  runs,
  detailed = false,
}: {
  runs: AdminOverview['recentGenerations'];
  detailed?: boolean;
}) {
  return (
    <section className="ops-card ops-table-card">
      <div className="ops-card-head">
        <div>
          <span>Live database</span>
          <h2>{detailed ? 'All recent generations' : 'Recent generations'}</h2>
        </div>
        <strong>{runs.length} shown</strong>
      </div>
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
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={detailed ? 8 : 7} className="ops-empty">
                  No generation activity in this period.
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
  team,
  consumption,
  reload,
  setMessage,
  openInvite,
}: {
  team: TeamMember[];
  consumption: AdminOverview['userConsumption'];
  reload: () => void;
  setMessage: (message: string | null) => void;
  openInvite: () => void;
}) {
  const update = async (id: string, path: 'role' | 'status', body: object) => {
    setMessage(null);
    try {
      const response = await authFetch(`/users/${id}/${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'User could not be updated.');
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Access control"
        title="People, roles and consumption."
        copy="Create accounts, assign permissions, suspend access and see exactly who is using image generation."
      />
      <section className="ops-card ops-users-card">
        <div className="ops-card-head">
          <div>
            <span>Workspace team</span>
            <h2>{team.length} user accounts</h2>
          </div>
          <button className="ops-inline-button" type="button" onClick={openInvite}>
            <Plus aria-hidden="true" />
            New account
          </button>
        </div>
        <div className="ops-user-list">
          {team.map((user) => {
            const usage = consumption.find((item) => item.id === user.id);
            return (
              <article key={user.id}>
                <div className="ops-user-identity">
                  <span>{user.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <div className="ops-user-stat">
                  <small>Requests</small>
                  <strong>{usage?.requests ?? 0}</strong>
                </div>
                <div className="ops-user-stat">
                  <small>Spend</small>
                  <strong>{money(usage?.spendUsd ?? 0)}</strong>
                </div>
                <label>
                  <span>Role</span>
                  <select
                    value={user.role}
                    onChange={(event) => void update(user.id, 'role', { role: event.target.value })}
                  >
                    <option>OWNER</option>
                    <option>ADMIN</option>
                    <option>CREATOR</option>
                    <option>VIEWER</option>
                  </select>
                </label>
                <button
                  className={`ops-user-state ${user.isActive ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => void update(user.id, 'status', { isActive: !user.isActive })}
                >
                  {user.isActive ? 'Active' : 'Suspended'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function SystemHealth({ overview }: { overview: AdminOverview }) {
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
      role: form.get('role'),
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
        <p>The user can sign in immediately with the password you set.</p>
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
        <label>
          <span>Role</span>
          <select name="role" defaultValue="CREATOR">
            <option value="ADMIN">Admin — full operations access</option>
            <option value="CREATOR">Creator — generate and manage assets</option>
            <option value="VIEWER">Viewer — read-only access</option>
          </select>
        </label>
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
