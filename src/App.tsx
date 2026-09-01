import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowUpRight, BookOpen, Check, CircleHelp, Clipboard, Code2, ExternalLink, FileText, GitBranch, Github, Layers3, Link as LinkIcon, RefreshCw, RotateCcw, Search, Share2, ShieldCheck, Star, Users, X, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const DEMO_SLUG = 'vercel/next.js';

type SignalStatus = 'strong' | 'watch' | 'needs-attention';

interface Repository {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  language: string;
  topics: string[];
  license: string | null;
  defaultBranch: string;
  updatedAt: string;
  createdAt: string;
}
interface Contributor { login: string; avatarUrl: string; contributions: number; }
interface ActivityPoint { label: string; value: number; }
interface HealthSignal { label: string; score: number; status: SignalStatus; detail: string; }
interface Report {
  overallScore: number;
  repo: Repository;
  signals: HealthSignal[];
  activity: ActivityPoint[];
  contributors: Contributor[];
  highlights: string[];
  risks: string[];
}

interface GithubRepository {
  owner: { login: string };
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string | null;
  topics?: string[];
  license?: { spdx_id?: string | null } | null;
  default_branch: string;
  updated_at: string;
  created_at: string;
}
interface GithubContributor { login: string; avatar_url: string; contributions: number; }
interface GithubCommit { commit?: { author?: { date?: string | null } | null } | null; }

const demoReport: Report = {
  overallScore: 86,
  repo: {
    owner: 'vercel',
    name: 'next.js',
    fullName: 'vercel/next.js',
    description: 'The React Framework for the Web',
    htmlUrl: 'https://github.com/vercel/next.js',
    stars: 136400,
    forks: 29400,
    openIssues: 3128,
    watchers: 136400,
    language: 'TypeScript',
    topics: ['react', 'framework', 'nextjs', 'vercel'],
    license: 'MIT',
    defaultBranch: 'canary',
    updatedAt: '2026-08-29T15:44:00Z',
    createdAt: '2016-10-05T17:35:56Z',
  },
  signals: [
    { label: 'Documentation', score: 94, status: 'strong', detail: 'Clear project positioning, a visible README, and a permissive license.' },
    { label: 'Activity', score: 91, status: 'strong', detail: 'Recent commits and a steady release cadence indicate an active project.' },
    { label: 'Community', score: 89, status: 'strong', detail: 'A broad contributor base and healthy fork-to-star ratio build trust.' },
    { label: 'Maintainability', score: 76, status: 'watch', detail: 'Issue volume is meaningful; triage signals are worth reviewing before sharing.' },
    { label: 'Presentation', score: 88, status: 'strong', detail: 'A focused description and useful topic taxonomy make the repo legible.' },
  ],
  activity: [
    { label: '26 Aug', value: 25 }, { label: '27 Aug', value: 38 }, { label: '28 Aug', value: 31 },
    { label: '29 Aug', value: 52 }, { label: '30 Aug', value: 44 }, { label: '31 Aug', value: 67 },
    { label: '01 Sep', value: 58 },
  ],
  contributors: [
    { login: 'timneutkens', avatarUrl: 'https://github.com/timneutkens.png', contributions: 1248 },
    { login: 'shuding', avatarUrl: 'https://github.com/shuding.png', contributions: 973 },
    { login: 'ijjk', avatarUrl: 'https://github.com/ijjk.png', contributions: 706 },
    { login: 'styfle', avatarUrl: 'https://github.com/styfle.png', contributions: 491 },
  ],
  highlights: ['Well-defined entry point for new readers', 'Current activity is easy to verify', 'Strong open-source trust markers'],
  risks: ['Open issue volume may need context', 'Canary is the default branch'],
};

function compactNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function normalizeSlug(raw: string) {
  return raw.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git\/?$/, '').replace(/^\/+|\/+$/g, '');
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository not found. Check the owner and repository name.');
    if (response.status === 403) throw new Error('GitHub rate limit reached. Try again in a little while.');
    throw new Error('GitHub could not return this repository right now.');
  }
  return response.json() as Promise<T>;
}

function buildActivity(commits: GithubCommit[]) {
  const buckets = new Map<string, number>();
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(today.getDate() - i);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }
  commits.forEach((commit) => {
    const date = commit.commit?.author?.date?.slice(0, 10);
    if (date && buckets.has(date)) buckets.set(date, (buckets.get(date) ?? 0) + 1);
  });
  return Array.from(buckets, ([key, value]) => ({
    label: new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
    value,
  }));
}

async function loadReport(rawSlug: string): Promise<Report> {
  const slug = normalizeSlug(rawSlug);
  if (!/^[^/\s]+\/[^/\s]+$/.test(slug)) throw new Error('Enter a public GitHub URL or an owner/repository name.');
  const [owner, name] = slug.split('/');
  const repo = await githubJson<GithubRepository>(`https://api.github.com/repos/${owner}/${name}`);
  const [contributorsResult, commitsResult] = await Promise.allSettled([
    githubJson<GithubContributor[]>(`https://api.github.com/repos/${owner}/${name}/contributors?per_page=5`),
    githubJson<GithubCommit[]>(`https://api.github.com/repos/${owner}/${name}/commits?per_page=100`),
  ]);
  const contributors = contributorsResult.status === 'fulfilled' ? contributorsResult.value : [];
  const commits = commitsResult.status === 'fulfilled' ? commitsResult.value : [];
  const repository: Repository = {
    owner: repo.owner.login, name: repo.name, fullName: repo.full_name, description: repo.description ?? 'No description provided.',
    htmlUrl: repo.html_url, stars: repo.stargazers_count, forks: repo.forks_count, openIssues: repo.open_issues_count,
    watchers: repo.watchers_count, language: repo.language ?? 'Not specified', topics: repo.topics ?? [],
    license: repo.license?.spdx_id ?? null, defaultBranch: repo.default_branch, updatedAt: repo.updated_at, createdAt: repo.created_at,
  };
  const ageDays = Math.floor((Date.now() - new Date(repository.updatedAt).getTime()) / 86400000);
  const activityCount = commits.length;
  const docsScore = Math.min(100, 58 + (repository.description !== 'No description provided.' ? 18 : 0) + (repository.license ? 12 : 0) + Math.min(12, repository.topics.length * 3));
  const activityScore = Math.max(34, Math.min(98, 96 - Math.min(54, Math.max(0, ageDays - 5) * 2) + Math.min(8, activityCount / 12)));
  const communityScore = Math.max(36, Math.min(98, 62 + Math.min(18, Math.log10(repository.stars + 1) * 2.6) + Math.min(18, contributors.length * 2)));
  const maintainScore = Math.max(38, Math.min(96, 91 - Math.min(42, repository.openIssues / 160)));
  const presentationScore = Math.min(98, 54 + (repository.description !== 'No description provided.' ? 16 : 0) + Math.min(18, repository.topics.length * 4) + (repository.language !== 'Not specified' ? 10 : 0));
  const signals: HealthSignal[] = [
    { label: 'Documentation', score: Math.round(docsScore), status: docsScore >= 82 ? 'strong' : docsScore >= 65 ? 'watch' : 'needs-attention', detail: repository.license ? 'Description and license are visible to a first-time visitor.' : 'Add a license so visitors can understand how this work can be used.' },
    { label: 'Activity', score: Math.round(activityScore), status: activityScore >= 82 ? 'strong' : activityScore >= 65 ? 'watch' : 'needs-attention', detail: ageDays < 30 ? `Updated ${relativeDate(repository.updatedAt)} with ${activityCount} recent commits sampled.` : `Last update was ${relativeDate(repository.updatedAt)}; consider setting expectations for visitors.` },
    { label: 'Community', score: Math.round(communityScore), status: communityScore >= 82 ? 'strong' : communityScore >= 65 ? 'watch' : 'needs-attention', detail: `${compactNumber(repository.stars)} stars and ${compactNumber(repository.forks)} forks provide a useful trust signal.` },
    { label: 'Maintainability', score: Math.round(maintainScore), status: maintainScore >= 82 ? 'strong' : maintainScore >= 65 ? 'watch' : 'needs-attention', detail: `${compactNumber(repository.openIssues)} open issues are visible; issue volume is a context signal, not a verdict.` },
    { label: 'Presentation', score: Math.round(presentationScore), status: presentationScore >= 82 ? 'strong' : presentationScore >= 65 ? 'watch' : 'needs-attention', detail: repository.topics.length ? `${repository.topics.length} topics help the repository show up with the right context.` : 'Add a few focused topics to make the repository easier to understand.' },
  ];
  const highlights = signals.filter((signal) => signal.status === 'strong').slice(0, 3).map((signal) => `${signal.label} is sending a strong signal`);
  const risks = signals.filter((signal) => signal.status !== 'strong').map((signal) => signal.detail.split('.')[0]);
  return {
    overallScore: Math.round(signals.reduce((sum, signal) => sum + signal.score, 0) / signals.length),
    repo: repository, signals, activity: buildActivity(commits),
    contributors: contributors.slice(0, 5).map((item) => ({ login: item.login, avatarUrl: item.avatar_url, contributions: item.contributions })),
    highlights: highlights.length ? highlights : ['Repository data loaded successfully'],
    risks: risks.length ? risks : ['No immediate risks surfaced by this quick scan'],
  };
}

function scoreColor(score: number) {
  return score >= 82 ? 'text-[#0b6d67]' : score >= 65 ? 'text-[#b47728]' : 'text-[#c34c3e]';
}

function statusLabel(status: SignalStatus) {
  return status === 'strong' ? 'Strong' : status === 'watch' ? 'Watch' : 'Needs attention';
}

function StatusMark({ status }: { status: SignalStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-signal text-[10px] uppercase tracking-[.12em] ${status === 'strong' ? 'border-[#9dcdbb]/80 bg-[#e6f3ed] text-[#146b5d]' : status === 'watch' ? 'border-[#e2c58b]/80 bg-[#fff4db] text-[#946322]' : 'border-[#e6aaa0]/80 bg-[#fce9e5] text-[#a44338]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'strong' ? 'bg-[#1c9a82]' : status === 'watch' ? 'bg-[#d69737]' : 'bg-[#c34c3e]'}`} />
      {statusLabel(status)}
    </span>
  );
}

function AvatarCircle({ person }: { person: Contributor }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#f7f5ee] bg-[#d9ebe1] font-mono-signal text-[11px] font-medium text-[#21685d]" title={person.login}>
      {person.login.slice(0, 2).toUpperCase()}
    </div>
  ) : (
    <img className="h-10 w-10 shrink-0 rounded-full border-2 border-[#f7f5ee] bg-[#d9ebe1] object-cover" src={person.avatarUrl} alt={`${person.login} avatar`} onError={() => setFailed(true)} />
  );
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 326.7;
  return (
    <div className="relative h-40 w-40 shrink-0" aria-label={`Overall health score ${score} out of 100`} data-testid="status-overall-score">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" role="img">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#dce7df" strokeWidth="7" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="#0b6d67" strokeLinecap="round" strokeWidth="7" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-signal text-[11px] uppercase tracking-[.15em] text-[#71817d]">health</span>
        <strong className="font-mono-signal text-4xl font-medium tracking-[-.08em] text-[#18343a]">{score}</strong>
        <span className="font-mono-signal text-[10px] text-[#71817d]">/ 100</span>
      </div>
    </div>
  );
}

function ActivityChart({ points }: { points: ActivityPoint[] }) {
  const max = Math.max(5, ...points.map((point) => point.value));
  const coords = points.map((point, index) => `${index * 100 / Math.max(1, points.length - 1)},${78 - (point.value / max) * 58}`).join(' ');
  return (
    <div data-testid="chart-activity">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">commit pulse</p>
          <p className="mt-1 text-sm text-[#49605f]">Last seven days sampled</p>
        </div>
        <span className="font-mono-signal text-xs text-[#0b6d67]">{points.reduce((sum, item) => sum + item.value, 0)} commits</span>
      </div>
      {points.some((point) => point.value > 0) ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full overflow-visible" aria-label="Commit activity chart">
          <path d={`M 0,78 L ${coords} L 100,78 Z`} fill="rgba(11,109,103,.10)" />
          <polyline points={coords} fill="none" stroke="#0b6d67" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => <circle key={`${point.label}-${index}`} cx={index * 100 / Math.max(1, points.length - 1)} cy={78 - (point.value / max) * 58} fill="#b7dd4c" r="2.1" stroke="#0b6d67" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        </svg>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[#c8d4cc] text-sm text-[#71817d]">No recent commits returned by GitHub.</div>
      )}
      <div className="mt-2 flex justify-between font-mono-signal text-[10px] text-[#8a9893]">
        {points.map((point, index) => <span key={`${point.label}-label-${index}`}>{point.label}</span>)}
      </div>
    </div>
  );
}

function LoadingReport() {
  return (
    <div className="space-y-5" aria-live="polite" data-testid="status-loading">
      <div className="skeleton-signal h-52 rounded-[2rem] border border-[#d9e0da] bg-[#e4eae2]" />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="skeleton-signal h-72 rounded-[2rem] border border-[#d9e0da] bg-[#e4eae2]" />
        <div className="skeleton-signal h-72 rounded-[2rem] border border-[#d9e0da] bg-[#e4eae2]" />
      </div>
    </div>
  );
}

function SignalRow({ signal, index }: { signal: HealthSignal; index: number }) {
  return (
    <div className="group flex items-center gap-3 border-b border-[#e4e8e2] py-4 last:border-0" data-testid={`row-signal-${index}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf0e8] font-mono-signal text-[11px] text-[#55726c]">0{index + 1}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[#234045]">{signal.label}</span>
          <span className={`font-mono-signal text-sm font-medium ${scoreColor(signal.score)}`}>{signal.score}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e7ece7]">
          <div className={`h-full rounded-full ${signal.score >= 82 ? 'bg-[#45a993]' : signal.score >= 65 ? 'bg-[#d7a652]' : 'bg-[#cb6c5e]'}`} style={{ width: `${signal.score}%` }} />
        </div>
      </div>
      <StatusMark status={signal.status} />
    </div>
  );
}

function Home() {
  const initialSlug = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('repo') ?? '';
  }, []);
  const [report, setReport] = useState<Report>(demoReport);
  const [input, setInput] = useState(initialSlug || DEMO_SLUG);
  const [phase, setPhase] = useState<'demo' | 'loading' | 'live' | 'error'>(initialSlug ? 'loading' : 'demo');
  const [error, setError] = useState('');
  const [view, setView] = useState<'overview' | 'signals'>('overview');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!initialSlug) return;
    void loadReport(initialSlug).then((nextReport) => {
      setReport(nextReport);
      setInput(nextReport.repo.fullName);
      setPhase('live');
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Unable to load this repository.');
      setPhase('error');
    });
  }, [initialSlug]);

  const handleLoad = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = normalizeSlug(input);
    setError('');
    setNotice('');
    setPhase('loading');
    void loadReport(slug).then((nextReport) => {
      setReport(nextReport);
      setInput(nextReport.repo.fullName);
      setPhase('live');
      window.history.replaceState(null, '', `${window.location.pathname}?repo=${encodeURIComponent(nextReport.repo.fullName)}`);
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Unable to load this repository.');
      setPhase('error');
    });
  };

  const resetDemo = () => {
    setReport(demoReport);
    setInput(DEMO_SLUG);
    setPhase('demo');
    setError('');
    setNotice('');
    setView('overview');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const shareReport = () => {
    const url = `${window.location.origin}${window.location.pathname}?repo=${encodeURIComponent(report.repo.fullName)}`;
    window.history.replaceState(null, '', `${window.location.pathname}?repo=${encodeURIComponent(report.repo.fullName)}`);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url).then(() => setNotice('Report link copied to clipboard.')).catch(() => setNotice('Share link ready in your address bar.'));
    } else {
      setNotice('Share link ready in your address bar.');
    }
    window.setTimeout(() => setNotice(''), 3500);
  };

  return (
    <main className="grain signal-field min-h-[100dvh] bg-[#f2efe6] text-[#18343a]">
      <header className="px-4 pt-4 sm:px-8 lg:px-12">
        <div className="nav-island mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#183f42] text-[#b7dd4c]"><Activity size={18} /></div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-.03em] text-[#18343a]">RepoPulse</p>
              <p className="font-mono-signal text-[9px] uppercase tracking-[.17em] text-[#71817d]">repository signal lab</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="flex items-center gap-2 font-mono-signal text-[10px] uppercase tracking-[.14em] text-[#71817d]"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#299a7d]" /> public data only</span>
            <button type="button" onClick={resetDemo} className="island-btn inline-flex items-center gap-2 border border-[#c8d4cc] bg-[#f7f6f0] px-3.5 py-2 text-xs font-medium text-[#49605f] motion hover:border-[#0b6d67] hover:text-[#0b6d67]" data-testid="button-reset-demo"><RotateCcw size={13} /> Reset demo</button>
          </div>
          <button type="button" onClick={resetDemo} className="island-btn rounded-full p-2 text-[#49605f] sm:hidden" aria-label="Reset demo report" data-testid="button-reset-demo-mobile"><RotateCcw size={16} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:px-12">
        <section className="rise-in mb-14 grid gap-10 lg:grid-cols-[1fr_minmax(390px,510px)] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b7cdbd] bg-[#e8f0e6] px-3 py-1.5 font-mono-signal text-[10px] uppercase tracking-[.2em] text-[#0b6d67]"><Zap size={13} /> fast repository readout</div>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[.98] tracking-[-.075em] text-[#19363b] sm:text-6xl lg:text-[5rem]">Is this repo ready <span className="text-[#0b6d67]">to be seen?</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#60716e]">A calm, credible read on the signals people notice first — before you send the link.</p>
          </div>
          <form onSubmit={handleLoad} className="command-shell" data-testid="form-load-repository">
            <div className="rounded-[1.35rem] border border-[#d1ddd3] bg-[#faf9f3] p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,.88)]">
            <label htmlFor="repository-input" className="mb-2 block px-3 pt-1 font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">inspect a public repository</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78908a]" size={16} />
                <input id="repository-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="owner/repository" className="h-12 w-full rounded-full border border-[#d2ddd4] bg-[#f4f3ec] pl-10 pr-3 font-mono-signal text-sm text-[#18343a] outline-none motion placeholder:text-[#9aa7a1] focus:border-[#0b6d67] focus:ring-2 focus:ring-[#b7dd4c]/50" data-testid="input-repository" />
              </div>
              <button type="submit" disabled={phase === 'loading' || !input.trim()} className="group island-btn inline-flex h-12 shrink-0 items-center gap-2 bg-[#0b6d67] pl-4 pr-2 text-sm font-medium text-[#f5f5e9] motion hover:bg-[#075b57] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-load-repository"><span className="hidden sm:inline">{phase === 'loading' ? 'Reading' : 'Inspect'}</span><span className="icon-island bg-[#075b57]">{phase === 'loading' ? <RefreshCw className="spin-soft" size={15} /> : <ArrowUpRight size={15} />}</span></button>
            </div>
            <p className="mt-2 px-3 pb-1 text-[11px] text-[#879590]">Try a GitHub URL or <button type="button" className="font-medium text-[#0b6d67] underline decoration-[#b7dd4c] underline-offset-2" onClick={() => setInput(DEMO_SLUG)} data-testid="button-use-demo">use the demo</button>.</p>
            </div>
          </form>
        </section>

        {error && (
          <div className="rise-in mb-6 flex items-start gap-3 rounded-[1.25rem] border border-[#e5b0a7] bg-[#fff0ec] px-4 py-3 text-sm text-[#923f35]" role="alert" data-testid="status-error">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <div className="flex-1"><strong className="font-medium">Could not inspect that repository.</strong> <span>{error}</span></div>
            <button type="button" onClick={() => setError('')} className="rounded p-1 hover:bg-[#f8d9d2]" aria-label="Dismiss error" data-testid="button-dismiss-error"><X size={15} /></button>
          </div>
        )}
        {notice && <div className="rise-in fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#183f42] px-4 py-3 text-sm text-[#eff5df] shadow-[0_12px_30px_rgba(17,49,48,.18)]" role="status" data-testid="status-notice"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b7dd4c] text-[#183f42]"><Check size={14} /></span>{notice}</div>}

        {phase === 'loading' ? <LoadingReport /> : (
          <>
            <section className="bezel-shell rise-in rise-in-delay-1" data-testid="card-repository-report">
              <div className="bezel-core overflow-hidden">
              <div className="flex flex-col gap-6 border-b border-[#dce4dc] p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between lg:p-8">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-[#e3eee5] text-[#0b6d67]"><Github size={30} /></div>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="truncate text-2xl font-semibold tracking-[-.045em] text-[#19363b]" data-testid="text-repository-name">{report.repo.fullName}</h2>
                      {phase === 'demo' ? <span className="rounded-full bg-[#eaf0dd] px-2.5 py-1 font-mono-signal text-[10px] uppercase tracking-[.13em] text-[#557026]">demo scan</span> : <span className="rounded-full bg-[#e6f3ed] px-2.5 py-1 font-mono-signal text-[10px] uppercase tracking-[.13em] text-[#146b5d]">live scan</span>}
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-[#60716e]" data-testid="text-repository-description">{report.repo.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-signal text-[11px] text-[#71817d]">
                      <span className="inline-flex items-center gap-1.5"><Code2 size={13} className="text-[#0b6d67]" />{report.repo.language}</span>
                      <span className="inline-flex items-center gap-1.5"><GitBranch size={13} className="text-[#0b6d67]" />{report.repo.defaultBranch}</span>
                      <span className="inline-flex items-center gap-1.5"><RefreshCw size={13} className="text-[#0b6d67]" />updated {relativeDate(report.repo.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a href={report.repo.htmlUrl} target="_blank" rel="noreferrer" className="island-btn inline-flex items-center gap-2 rounded-full border border-[#c8d4cc] bg-[#f7f6f0] px-3.5 py-2 text-xs font-medium text-[#49605f] motion hover:border-[#0b6d67] hover:text-[#0b6d67]" data-testid="link-open-github"><ExternalLink size={14} /> Open on GitHub</a>
                  <button type="button" onClick={shareReport} className="group island-btn inline-flex items-center gap-2 bg-[#183f42] pl-3.5 pr-1.5 py-1.5 text-xs font-medium text-[#edf4df] motion hover:bg-[#0b6d67]" data-testid="button-share-report"><span>Share</span><span className="icon-island"><Share2 size={13} /></span></button>
                </div>
              </div>
              <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[180px_1fr_220px] lg:items-center lg:p-8">
                <div className="flex justify-center lg:justify-start"><ScoreRing score={report.overallScore} /></div>
                <div>
                  <p className="font-mono-signal text-[10px] uppercase tracking-[.18em] text-[#71817d]">signal summary</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[#19363b]">{report.overallScore >= 82 ? 'Ready for a closer look.' : report.overallScore >= 65 ? 'Promising, with a few flags.' : 'Worth a little more preparation.'}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#60716e]">RepoPulse weighs visible documentation, recent motion, community proof, and the small details that shape a first impression.</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {report.repo.topics.slice(0, 5).map((topic) => <span key={topic} className="rounded-md border border-[#d2ddd4] bg-[#f1f4ed] px-2.5 py-1 font-mono-signal text-[10px] text-[#55726c]" data-testid={`tag-topic-${topic}`}>{topic}</span>)}
                    {!report.repo.topics.length && <span className="font-mono-signal text-[11px] text-[#9aa7a1]">no topics listed</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                  <Metric icon={<Star size={14} />} label="stars" value={compactNumber(report.repo.stars)} />
                  <Metric icon={<GitBranch size={14} />} label="forks" value={compactNumber(report.repo.forks)} />
                  <Metric icon={<CircleHelp size={14} />} label="open issues" value={compactNumber(report.repo.openIssues)} />
                  <Metric icon={<Users size={14} />} label="watchers" value={compactNumber(report.repo.watchers)} />
                </div>
              </div>
              </div>
            </section>

            <div className="mt-10 flex items-center justify-between border-b border-[#cbd8ce] pb-3">
              <div className="tab-rail">
                <button type="button" onClick={() => setView('overview')} className={`rounded-full px-3.5 py-2 font-mono-signal text-[10px] uppercase tracking-[.14em] motion ${view === 'overview' ? 'bg-[#f9f8f2] text-[#0b6d67] shadow-[inset_0_1px_1px_rgba(255,255,255,.9)]' : 'text-[#83908a] hover:text-[#49605f]'}`} data-testid="tab-overview">Overview</button>
                <button type="button" onClick={() => setView('signals')} className={`rounded-full px-3.5 py-2 font-mono-signal text-[10px] uppercase tracking-[.14em] motion ${view === 'signals' ? 'bg-[#f9f8f2] text-[#0b6d67] shadow-[inset_0_1px_1px_rgba(255,255,255,.9)]' : 'text-[#83908a] hover:text-[#49605f]'}`} data-testid="tab-detailed-signals">Detailed signals</button>
              </div>
              <span className="hidden items-center gap-1.5 font-mono-signal text-[10px] text-[#84928c] sm:flex"><ShieldCheck size={13} /> no auth required</span>
            </div>

            {view === 'overview' ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
                <section className="bezel-card rise-in rise-in-delay-2 p-6 sm:p-8" data-testid="card-health-signals">
                  <div className="mb-2 flex items-start justify-between"><div><p className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">the five signals</p><h3 className="mt-1 text-xl font-semibold tracking-[-.04em] text-[#19363b]">What people will feel</h3></div><Layers3 size={20} className="text-[#91a39a]" /></div>
                  <div>{report.signals.map((signal, index) => <SignalRow key={signal.label} signal={signal} index={index} />)}</div>
                   <button type="button" onClick={() => setView('signals')} className="group island-btn mt-4 inline-flex items-center gap-3 bg-[#e8f0e6] py-1.5 pl-3.5 pr-1.5 font-mono-signal text-[10px] uppercase tracking-[.13em] text-[#0b6d67] motion hover:bg-[#dcebd8]" data-testid="button-view-all-signals"><span>View signal notes</span><span className="icon-island bg-[#d6e8d2]"><ArrowUpRight size={14} /></span></button>
                </section>
                <section className="bezel-card rise-in rise-in-delay-3 p-6 sm:p-8" data-testid="card-activity">
                  <ActivityChart points={report.activity} />
                  <div className="mt-7 border-t border-[#e4e8e2] pt-5"><p className="mb-3 font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">repository shape</p><div className="flex flex-wrap items-center gap-2 text-sm text-[#49605f]"><span className="inline-flex items-center gap-2"><BookOpen size={14} className="text-[#0b6d67]" />{report.repo.license ?? 'No license'} license</span><span className="text-[#bac3bd]">/</span><span className="inline-flex items-center gap-2"><FileText size={14} className="text-[#0b6d67]" />created {new Date(report.repo.createdAt).getFullYear()}</span></div></div>
                </section>
                <section className="bezel-card-dark rise-in rise-in-delay-2 p-6 text-[#eef5e4] sm:p-8" data-testid="card-highlights">
                  <div className="mb-6 flex items-center justify-between"><div><p className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#9eb9a2]">signal notes</p><h3 className="mt-1 text-xl font-semibold tracking-[-.04em]">The short version</h3></div><Clipboard size={20} className="text-[#b7dd4c]" /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><p className="mb-3 font-mono-signal text-[10px] uppercase tracking-[.14em] text-[#b7dd4c]">working well</p><ul className="space-y-3">{report.highlights.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-5 text-[#e2ece0]"><Check size={15} className="mt-0.5 shrink-0 text-[#b7dd4c]" />{item}</li>)}</ul></div>
                    <div><p className="mb-3 font-mono-signal text-[10px] uppercase tracking-[.14em] text-[#e2a591]">worth knowing</p><ul className="space-y-3">{report.risks.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-5 text-[#e7ddcf]"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#e2a591]" />{item}</li>)}</ul></div>
                  </div>
                </section>
                <section className="bezel-card rise-in rise-in-delay-3 p-6 sm:p-8" data-testid="card-contributors">
                  <div className="mb-5 flex items-start justify-between"><div><p className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">people behind it</p><h3 className="mt-1 text-xl font-semibold tracking-[-.04em] text-[#19363b]">Top contributors</h3></div><Users size={20} className="text-[#91a39a]" /></div>
                  {report.contributors.length ? <div className="space-y-3">{report.contributors.slice(0, 4).map((person, index) => <div className="flex items-center gap-3" key={person.login} data-testid={`row-contributor-${index}`}><AvatarCircle person={person} /><span className="min-w-0 flex-1 truncate text-sm font-medium text-[#385153]">{person.login}</span><span className="font-mono-signal text-[11px] text-[#71817d]">{person.contributions.toLocaleString()} commits</span></div>)}</div> : <div className="rounded-xl border border-dashed border-[#c8d4cc] p-5 text-sm text-[#71817d]" data-testid="empty-contributors">GitHub did not return contributor data for this repository.</div>}
                  <p className="mt-5 border-t border-[#e4e8e2] pt-4 font-mono-signal text-[10px] leading-5 text-[#8a9893]">A small sample from the public contributors endpoint. This is a trust cue, not a leaderboard.</p>
                </section>
              </div>
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
                 <section className="bezel-card p-6 sm:p-8" data-testid="card-detailed-signals">
                  <div className="mb-6"><p className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">detailed inspection</p><h3 className="mt-1 text-2xl font-semibold tracking-[-.05em] text-[#19363b]">Read the evidence behind the score.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#60716e]">These signals are intentionally legible. RepoPulse does not pretend to know the whole project; it shows what a public visitor can verify quickly.</p></div>
                  <div className="space-y-3">{report.signals.map((signal, index) => <article key={signal.label} className="rounded-xl border border-[#dce4dc] bg-[#f4f5ef] p-4 sm:p-5" data-testid={`card-signal-detail-${index}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="font-mono-signal text-xs text-[#8a9893]">0{index + 1}</span><h4 className="font-medium text-[#29474a]">{signal.label}</h4><StatusMark status={signal.status} /></div><span className={`font-mono-signal text-lg ${scoreColor(signal.score)}`}>{signal.score}<span className="ml-1 text-[10px] text-[#8a9893]">/100</span></span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dfe7df]"><div className={`h-full rounded-full ${signal.score >= 82 ? 'bg-[#45a993]' : signal.score >= 65 ? 'bg-[#d7a652]' : 'bg-[#cb6c5e]'}`} style={{ width: `${signal.score}%` }} /></div><p className="mt-3 text-sm leading-6 text-[#60716e]">{signal.detail}</p></article>)}</div>
                </section>
                <aside className="space-y-5">
                   <section className="bezel-card p-5" data-testid="card-repository-facts"><p className="font-mono-signal text-[10px] uppercase tracking-[.16em] text-[#71817d]">repository facts</p><dl className="mt-4 space-y-3 text-sm"><Fact label="owner" value={report.repo.owner} /><Fact label="branch" value={report.repo.defaultBranch} /><Fact label="license" value={report.repo.license ?? 'Not specified'} /><Fact label="created" value={new Date(report.repo.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} /><Fact label="last update" value={relativeDate(report.repo.updatedAt)} /></dl></section>
                   <section className="bezel-card border-[#d8dfc6] bg-[#eff4df] p-5" data-testid="card-methodology"><div className="flex items-center gap-2 text-[#557026]"><CircleHelp size={16} /><p className="font-mono-signal text-[10px] uppercase tracking-[.16em]">how to read this</p></div><p className="mt-3 text-sm leading-6 text-[#52654e]">A good score means the public surface is easy to trust at a glance. It is not a code-quality audit, security review, or project endorsement.</p></section>
                </aside>
              </div>
            )}
          </>
        )}
        <footer className="mt-12 flex flex-col gap-3 border-t border-[#d5ded6] pt-5 text-[11px] text-[#84928c] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono-signal uppercase tracking-[.12em]">RepoPulse / public repository intelligence</span>
          <span className="inline-flex items-center gap-2"><LinkIcon size={12} /> No tokens. No private repos. Just the visible signal.</span>
        </footer>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-[1.1rem] border border-[#dce4dc] bg-[#f3f5ef] px-3 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,.85)]" data-testid={`metric-${label.replace(/\s/g, '-')}`}><div className="mb-1 flex items-center gap-1.5 text-[#78908a]">{icon}<span className="font-mono-signal text-[9px] uppercase tracking-[.1em]">{label}</span></div><p className="font-mono-signal text-lg tracking-[-.04em] text-[#29474a]">{value}</p></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#e4e8e2] pb-2 last:border-0 last:pb-0"><dt className="font-mono-signal text-[10px] uppercase tracking-[.1em] text-[#84928c]">{label}</dt><dd className="truncate text-right text-[#385153]">{value}</dd></div>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;