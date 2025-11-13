'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';

import 'swagger-ui-react/swagger-ui.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  Image as ImageIcon,
  Inbox,
  Link2,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  PAID_PLAN_ORDER,
  SUBSCRIPTION_PLANS,
  formatPlanPrice,
  type SubscriptionTier,
} from '@/lib/subscriptionPlans';
import { HomepagePricingPlans } from '@/components/homepage-pricing-plans';
import { API_URL, apiClient, type User } from '@/lib/api';
import { auth } from '@/lib/auth';
import { toast } from 'sonner';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function hasPlusAccess(user: User | null): boolean {
  if (!user) {
    return false;
  }

  if (user.is_premium) {
    return true;
  }

  const tier = user.subscription_tier;
  return tier === 'plus' || tier === 'pro';
}

const openApiUrl = joinUrl(API_URL, '/api/openapi.json');

const exampleCurl = `curl \\
  -X POST "${joinUrl(API_URL, '/api/items')}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $INJEST_SESSION_TOKEN" \\
  -d '{
    "title": "Brand refresh inspiration",
    "url": "https://example.com/design/deck",
    "tags": ["brand", "design"]
  }'`;

type ApiKeyInfoState = {
  hasKey: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
};

type ExternalEndpoint = {
  method: string;
  path: string;
  useCase: string;
};

const externalApiEndpoints: ExternalEndpoint[] = [
  {
    method: 'POST',
    path: '/items',
    useCase: 'Capture a new item, including optional attachments, from your own tools.',
  },
  {
    method: 'GET',
    path: '/items',
    useCase: 'List your indexed items. Supports limit and offset for pagination.',
  },
  {
    method: 'GET',
    path: '/items/:id',
    useCase: 'Retrieve full details for a specific item by its ID.',
  },
  {
    method: 'GET',
    path: '/search',
    useCase: 'Search across your items with a query using the q parameter.',
  },
];

const externalApiBaseUrl = `${API_URL.replace(/\/+$/, '')}/api/external`;

export default function DeveloperDocsClient() {
  const docsRef = useRef<HTMLDivElement | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.getUser());
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfoState | null>(null);
  const [apiKeyInfoLoading, setApiKeyInfoLoading] = useState(true);
  const [apiKeyActionLoading, setApiKeyActionLoading] = useState(false);
  const [apiKeyActionType, setApiKeyActionType] = useState<'generate' | 'revoke' | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const restoreAuth = async () => {
      try {
        await auth.restore();
        if (!isMounted) {
          return;
        }
        const restoredUser = auth.getUser();
        setCurrentUser(restoredUser ?? null);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to restore authentication state:', error);
        }
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    void restoreAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const allowed = useMemo(() => hasPlusAccess(currentUser), [currentUser]);

  useEffect(() => {
    if (!allowed) {
      setApiKeyInfo(null);
      setGeneratedApiKey(null);
      if (!authLoading) {
        setApiKeyInfoLoading(false);
      }
    }
  }, [allowed, authLoading]);

  const loadSpec = useCallback(async () => {
    try {
      setSpecLoading(true);
      setSpecError(null);
      const specResponse = await apiClient.getOpenApiSpec();
      setSpec(specResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load the OpenAPI specification.';
      setSpecError(message);
    } finally {
      setSpecLoading(false);
    }
  }, []);

  const formatTimestamp = useCallback((value: string | null | undefined) => {
    if (!value) {
      return 'Never';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Never';
    }
    return date.toLocaleString();
  }, []);

  const loadApiKeyInfo = useCallback(async () => {
    if (!auth.isAuthenticated()) {
      setApiKeyInfo(null);
      setApiKeyInfoLoading(false);
      return;
    }

    setApiKeyInfoLoading(true);
    try {
      const info = await apiClient.getApiKeyInfo();
      setApiKeyInfo(info);
    } catch (error) {
      console.error('Error loading API key info:', error);
      setApiKeyInfo(null);
    } finally {
      setApiKeyInfoLoading(false);
    }
  }, []);

  const handleGenerateApiKey = useCallback(async () => {
    if (!auth.isAuthenticated()) {
      toast.error('Sign in to manage API keys.');
      return;
    }

    if (!allowed) {
      toast.error('Upgrade to Plus to manage API keys.');
      return;
    }

    try {
      setApiKeyActionLoading(true);
      setApiKeyActionType('generate');
      setGeneratedApiKey(null);
      const response = await apiClient.createApiKey();
      setGeneratedApiKey(response.apiKey);
      setApiKeyInfo({
        hasKey: true,
        createdAt: response.createdAt ?? new Date().toISOString(),
        lastUsedAt: response.lastUsedAt ?? null,
      });
      toast.success('New API key generated. Copy it now.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate API key';
      toast.error(message);
    } finally {
      setApiKeyActionLoading(false);
      setApiKeyActionType(null);
    }
  }, [allowed]);

  const handleRevokeApiKey = useCallback(async () => {
    if (!auth.isAuthenticated()) {
      toast.error('Sign in to manage API keys.');
      return;
    }

    if (!allowed) {
      toast.error('Upgrade to Plus to manage API keys.');
      return;
    }

    if (!apiKeyInfo?.hasKey) {
      toast.error('No API key to revoke');
      return;
    }

    if (!confirm('Revoke your API key? Existing integrations will stop working.')) {
      return;
    }

    try {
      setApiKeyActionLoading(true);
      setApiKeyActionType('revoke');
      await apiClient.revokeApiKey();
      setGeneratedApiKey(null);
      await loadApiKeyInfo();
      toast.success('API key revoked.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke API key';
      toast.error(message);
    } finally {
      setApiKeyActionLoading(false);
      setApiKeyActionType(null);
    }
  }, [allowed, apiKeyInfo?.hasKey, loadApiKeyInfo]);

  useEffect(() => {
    if (!spec && !specLoading && !specError) {
      void loadSpec();
    }
  }, [loadSpec, spec, specError, specLoading]);

  useEffect(() => {
    if (!authLoading && allowed) {
      void loadApiKeyInfo();
    }
  }, [allowed, authLoading, loadApiKeyInfo]);

  const handleDownloadSpec = useCallback(async () => {
    try {
      setDownloadLoading(true);
      const specResponse = await apiClient.getOpenApiSpec();
      const blob = new Blob([JSON.stringify(specResponse, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'injest-openapi.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download the OpenAPI specification.';
      setSpecError(message);
    } finally {
      setDownloadLoading(false);
    }
  }, []);

  const handleScrollToDocs = useCallback(() => {
    docsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const isAuthenticated = Boolean(currentUser);

  // Homepage sections data
  const valuePillars = [
    {
      id: 'capture',
      icon: Inbox,
      title: 'Capture files, email, and bookmarks',
      description:
        'Upload up to 25 MB attachments with checksum dedupe, forward to input@injest.io, and import bookmarks or Chrome captures without hand-tagging.',
    },
    {
      id: 'search',
      icon: Search,
      title: 'Search items and contacts together',
      description:
        'Semantic and keyword search covers notes, documents, and extracted contacts with filters for type, tags, source, attachments, and date.',
    },
    {
      id: 'act',
      icon: Send,
      title: 'Act on results immediately',
      description:
        'Generate send plans, email contacts with tracked attachments, and export JSON or CSV inside the same workspace.',
    },
  ];

  const connectedSurfaces = [
    {
      id: 'uploads',
      icon: ImageIcon,
      title: 'File uploads',
      subtitle: '25 MB per file with dedupe',
      bullets: [
        'Drag and drop PDFs, docs, and images; unsupported audio and video are blocked up front.',
        'OCR, text extraction, and entity detection run during background processing.',
        'Checksum matching skips duplicates and links back to the item already on file.',
      ],
    },
    {
      id: 'email',
      icon: Inbox,
      title: 'Forwarded email',
      subtitle: 'input@injest.io webhook',
      bullets: [
        'Verified users can forward through Resend; inbound mail becomes an indexed item automatically.',
        'Attachments are preserved and searchable alongside the message body.',
        'Received threads also show inside the inbox for review next to other items.',
      ],
    },
    {
      id: 'bookmarks',
      icon: Link2,
      title: 'Bookmarks & extension',
      subtitle: 'Chrome capture plus HTML import',
      bullets: [
        'Use the open-source Chrome extension to save the current tab with one click.',
        'Import browser bookmark HTML files; large batches queue in the background.',
        'Metadata is normalized so saved links surface with notes, tags, and source context.',
      ],
    },
  ];

  const workflowSteps = [
    {
      step: '1',
      title: 'Capture or forward content',
      description:
        'Upload attachments, send email to input@injest.io, or capture tabs and bookmarks from the browser.',
    },
    {
      step: '2',
      title: 'Injest enriches in the background',
      description:
        'Text extraction, embeddings, tagging, and contact detection run automatically while uploads finish.',
    },
    {
      step: '3',
      title: 'Search, share, and follow up',
      description:
        'Run semantic search, build send plans, and share items without leaving the inbox.',
    },
  ];

  const actionOptions = [
    {
      id: 'send-plan',
      icon: Sparkles,
      title: 'Generate send plan drafts',
      description: 'Use /api/send/plan to summarise contacts and matching items for any outbound prompt.',
    },
    {
      id: 'execute-send',
      icon: Send,
      title: 'Send tracked emails',
      description:
        'Compose with attachments and send through Resend via /api/send/execute while updating contact history.',
    },
    {
      id: 'export',
      icon: FileText,
      title: 'Share or export items',
      description: 'Create share links, email items to teammates, or download JSON and CSV exports on demand.',
    },
  ];

  const planDisplayOrder: SubscriptionTier[] = ['free', ...PAID_PLAN_ORDER];

  const planCopy: Record<
    SubscriptionTier,
    {
      badge?: string;
      priceNote: string;
      features: string[];
    }
  > = {
    free: {
      priceNote: 'forever',
      features: ['Up to 250 indexed items', 'Semantic search with filters', 'File & bookmark ingestion'],
    },
    plus: {
      badge: 'Most popular',
      priceNote: 'per month',
      features: [
        'Everything in Free',
        'Up to 2,500 indexed items',
        'Generate API keys for /api/external',
        'Send plan automation endpoints',
      ],
    },
    pro: {
      priceNote: 'per month',
      features: ['Everything in Plus', 'Up to 25,000 indexed items'],
    },
  };

  const pricingPlans = planDisplayOrder.map((tier) => {
    const plan = SUBSCRIPTION_PLANS[tier];
    const copy = planCopy[tier];
    return {
      tier: plan.id,
      name: plan.name,
      badge: copy.badge,
      priceDisplay: plan.monthlyPriceCents === 0 ? '$0' : formatPlanPrice(plan.monthlyPriceCents),
      priceNote: copy.priceNote,
      limit: `Up to ${plan.maxIndexedItems.toLocaleString()} indexed items`,
      description: plan.description,
      features: copy.features,
    };
  });

  const teamPlays = [
    {
      id: 'contacts',
      title: 'Contacts stay in sync',
      subtitle: 'Auto-extracted and editable',
      bullets: [
        'Email and file parsing detects contacts automatically and adds them to the workspace.',
        'Manage contacts with search, streaming updates, and manual edits from the contacts page.',
        'Send workflows record last interaction metadata the moment an email is delivered.',
      ],
    },
    {
      id: 'sharing',
      title: 'Sharing and exports',
      subtitle: 'Keep context intact',
      bullets: [
        'Share items via email or copy a restricted link with access checks.',
        'Download JSON or CSV exports containing normalized metadata and attachments.',
        'Live item streams refresh the inbox as enrichment finishes in the background.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="grid gap-12 md:grid-cols-2 md:items-center mb-24">
          <div className="text-center md:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 mb-6">
              <Sparkles className="w-4 h-4" />
              Capture. Search. Act.
            </p>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
              Keep files, email, and contacts searchable and ready to move.
            </h1>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Injest stores uploads, forwarded mail, and saved links in one workspace. Each item is enriched with OCR,
              embeddings, and detected contacts so it shows up the moment you need it.
            </p>
            <p className="text-lg text-blue-600 font-semibold mb-8 max-w-2xl md:max-w-lg mx-auto md:mx-0">
              Search from the inbox or API, share items with access checks, generate send plans, and export records
              without juggling extra tools.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8">
                  Start for free
                </Button>
              </Link>
              <Link href="/inbox">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Explore the inbox
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative aspect-[4/3] rounded-3xl border-2 border-white/60 shadow-2xl overflow-hidden">
              <Image
                src="/hero-image.png"
                alt="Injest.io workspace showing unified search and send flows"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 42rem, 100vw"
              />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-black/5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Value Pillars */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">What Injest ships today</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {valuePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card
                  key={pillar.id}
                  className="h-full border-2 border-gray-200 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <CardHeader className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{pillar.title}</CardTitle>
                    <CardDescription className="text-base text-gray-600">{pillar.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Connected Surfaces */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">Ways to bring data in</h2>
          <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
            {connectedSurfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <Card key={surface.id} className="border-2 border-gray-200 shadow-lg h-full">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl text-gray-900">{surface.title}</CardTitle>
                        <CardDescription className="text-base text-indigo-600">{surface.subtitle}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4 text-gray-600">
                      {surface.bullets.map((bullet) => (
                        <li key={bullet} className="text-base leading-relaxed">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">From capture to action in three steps</h2>
          <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-3">
            {workflowSteps.map((step) => (
              <Card key={step.step} className="border-2 border-gray-200 shadow-lg h-full text-center">
                <CardHeader className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
                    {step.step}
                  </div>
                  <CardTitle className="text-xl text-gray-900">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* API Example */}
        <div className="mb-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Use the REST API for ingestion and search</h2>
              <p className="text-lg text-gray-600 mb-6">
                Plus-tier users can generate API keys and call the `/api/external` endpoints from their own tools. Create
                items, search with the same filters used in the inbox, and pull full records when you need to sync
                downstream.
              </p>
              <ul className="space-y-3 text-gray-600">
                <li>✓ Upload JSON or multipart payloads and let enrichment run asynchronously.</li>
                <li>✓ Duplicate file hashes are skipped automatically with references to the original item.</li>
                <li>✓ Search responses include semantic scores, item metadata, and source details.</li>
              </ul>
            </div>
            <Card className="border-2 border-gray-200 shadow-xl bg-gray-950 text-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-mono text-gray-200">POST /api/external/items</CardTitle>
                <CardDescription className="text-sm text-gray-400">
                  Create an item with attachments using an external API key
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm leading-6 font-mono overflow-x-auto bg-gray-900 rounded-lg p-6 border border-gray-800">
                  {`curl -X POST https://api.injest.io/api/external/items \\
  -H "x-api-key: injest_sk_live_..." \\
  -F 'title=Launch checklist' \\
  -F 'tags=product,launch' \\
  -F 'attachments=@/path/to/brief.pdf;type=application/pdf'`}
                </pre>
                <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Response preview</p>
                  <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
                    {`{
  "queued": true,
  "uploadedCount": 1,
  "duplicateCount": 0,
  "message": "Queued 1 file(s) for enrichment. Processing may take a few minutes.",
  "files": [
    {
      "filename": "brief.pdf",
      "storedFilename": "3c8971f4-launch-checklist.pdf",
      "mimetype": "application/pdf",
      "size": 452381
    }
  ]
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Options */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">Automation tools built in</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {actionOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card key={option.id} className="border-2 border-gray-200 shadow-lg h-full">
                  <CardHeader className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{option.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{option.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Team Plays */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">Operations covered out of the box</h2>
          <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
            {teamPlays.map((play) => (
              <Card key={play.id} className="border-2 border-gray-200 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="text-2xl text-gray-900">{play.title}</CardTitle>
                  <CardDescription className="text-base text-blue-600">{play.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4 text-gray-600">
                    {play.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-blue-500 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-6 text-gray-900">Pricing that scales with your library</h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Start free, then raise the item cap as your archive grows. Every plan keeps OCR, enrichment, contacts,
            exports, and the inbox included.
          </p>
          <HomepagePricingPlans plans={pricingPlans} />
        </div>

        {/* CTA Section */}
        <div className="text-center py-16 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl text-white mb-24">
          <Sparkles className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-4xl font-bold mb-4">Ready to keep every asset searchable and actionable?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Create an account to capture files, mail, and bookmarks in one place, then search, share, and send without
            switching tools.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Create your free account
            </Button>
          </Link>
        </div>

        {/* Developer Docs Section */}
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Developer Docs</h1>
              <p className="mt-2 text-gray-600">
                Build on top of Injest with secure authentication, flexible ingestion, and semantic search APIs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link href="/inbox">
                  <Button variant="ghost">← Back to Inbox</Button>
                </Link>
              ) : (
                !authLoading && (
                  <>
                    <Link href="/login">
                      <Button>Sign in</Button>
                    </Link>
                    <Link href="/">
                      <Button variant="outline">Explore Injest</Button>
                    </Link>
                  </>
                )
              )}
            </div>
          </div>

          <Card className="border border-emerald-200 shadow-lg">
          <CardHeader>
            <CardTitle>External API Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Generate an API key to query your enriched data via REST without sharing your session token.
            </p>

            {!authLoading && !isAuthenticated ? (
              <div className="rounded-md border border-dashed border-gray-300 bg-white/70 p-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">Create a free account to get started</p>
                <p className="mt-2 text-gray-600">
                  Sign in to generate API keys and track usage for your workspace.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/login">
                    <Button size="sm">Sign in</Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      View plans
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}

            {isAuthenticated && !allowed ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-semibold">Upgrade required for API keys</p>
                <p className="mt-2 text-blue-800">
                  API access and developer tooling are available for Plus plans and above. Upgrade to unlock authenticated
                  API keys, semantic search integrations, and automation workflows.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/settings">
                    <Button size="sm">Manage subscription</Button>
                  </Link>
                </div>
              </div>
            ) : null}

            {isAuthenticated && allowed ? (
              apiKeyInfoLoading ? (
                <p className="text-sm text-gray-500">Loading API key details…</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-dashed bg-emerald-50/60 p-3 text-sm text-emerald-900">
                    <p>
                      Key status{' '}
                      <span className="font-semibold">
                        {apiKeyInfo?.hasKey ? 'Active' : 'Not generated'}
                      </span>
                    </p>
                    <p>Created: {formatTimestamp(apiKeyInfo?.createdAt ?? null)}</p>
                    <p>Last used: {formatTimestamp(apiKeyInfo?.lastUsedAt ?? null)}</p>
                  </div>

                  {generatedApiKey && (
                    <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Your new API key
                      </p>
                      <p className="mt-2 font-mono text-sm break-all">{generatedApiKey}</p>
                      <p className="mt-2 text-xs text-amber-700">
                        Copy this key now—you won&apos;t be able to see it again.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={handleGenerateApiKey} disabled={apiKeyActionLoading}>
                      {apiKeyActionLoading && apiKeyActionType === 'generate'
                        ? 'Generating…'
                        : apiKeyInfo?.hasKey
                          ? 'Regenerate API Key'
                          : 'Generate API Key'}
                    </Button>
                    {apiKeyInfo?.hasKey ? (
                      <Button variant="destructive" onClick={handleRevokeApiKey} disabled={apiKeyActionLoading}>
                        {apiKeyActionLoading && apiKeyActionType === 'revoke' ? 'Revoking…' : 'Revoke Key'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Available endpoints</p>
              <div className="space-y-2">
                {externalApiEndpoints.map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className="space-y-1 rounded-md border border-dashed bg-gray-50 p-3"
                  >
                    <p className="font-mono text-[11px] sm:text-xs">
                      <span className="mr-2 inline-block rounded-sm bg-emerald-100 px-1.5 py-[1px] font-semibold text-emerald-700">
                        {endpoint.method}
                      </span>
                      {`${externalApiBaseUrl}${endpoint.path}`}
                    </p>
                    <p className="text-xs text-gray-600">{endpoint.useCase}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Use with the Chrome extension</p>
              <ol className="list-decimal space-y-1 text-xs text-gray-600 list-inside">
                <li>Install the Injest Capture extension and pin it from the puzzle icon.</li>
                <li>
                  Open the extension, click <span className="font-medium">Settings</span>, and set the External API URL to{' '}
                  <code className="font-mono text-[11px] sm:text-xs">https://injest-api.onrender.com/api/external</code>.
                </li>
                <li>Paste your API key into the extension&apos;s API Key field.</li>
                <li>
                  Click <span className="font-medium">Test Connection</span>, then <span className="font-medium">Save Settings</span>.
                </li>
                <li>
                  Use the popup or <kbd className="rounded border px-1 py-0.5 text-xs">Cmd/CTRL+Shift+V</kbd> to capture items directly.
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-blue-200 shadow-lg">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900">Interactive Reference</h2>
              <p className="mt-2 text-gray-600">
                Explore every endpoint, payload, and response in the built-in Swagger UI. Try requests directly from your
                browser using your authenticated session.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={handleScrollToDocs}>View interactive docs</Button>
                <Button variant="outline" onClick={handleDownloadSpec} disabled={downloadLoading}>
                  {downloadLoading ? 'Preparing…' : 'Download OpenAPI JSON'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-lg">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900">Base URLs</h2>
              <dl className="mt-4 space-y-3 text-sm text-gray-700">
                <div>
                  <dt className="font-medium text-gray-900">Primary</dt>
                  <dd className="font-mono text-xs md:text-sm">{API_URL}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-900">OpenAPI Spec</dt>
                  <dd className="font-mono text-xs md:text-sm">{openApiUrl}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-900">Authentication</dt>
                  <dd className="text-sm text-gray-600">
                    All documentation requests use your session token automatically. For scripts, pass{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">Authorization: Bearer</code>{' '}
                    or <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-700">x-api-key</code>.
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

          <section className="mt-12 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Quick Start</h2>
              <ol className="mt-4 list-decimal space-y-3 pl-6 text-gray-700">
              <li>
                Create an account and request a magic link from the inbox, or use the{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">POST /api/auth/magic-link</code> endpoint.
              </li>
              <li>
                Verify the token via <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">GET /api/auth/verify</code>{' '}
                and store the session token or follow up with 2FA if required.
              </li>
              <li>
                Exchange the session token for a long-lived API key using{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">POST /api/auth/api-key</code>.
              </li>
              <li>
                Send authenticated requests with either the{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">Authorization: Bearer</code> header (session
                token) or the <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">x-api-key</code> header.
              </li>
            </ol>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Example: Create an Item</h2>
              <p className="mt-2 text-gray-700">
                Capture a new link, file, or set of notes in a single call. Background processing will index rich metadata
                for semantic search.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                <code>{exampleCurl}</code>
              </pre>
              <p className="mt-3 text-sm text-gray-600">
                Need to upload files? Switch to{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-sm text-gray-700">multipart/form-data</code> and
                attach up to 1,000 files per request. The queue response contains duplicate detection and processing
                status.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Search the Knowledge Base</h2>
              <p className="mt-2 text-gray-700">
                Use <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">GET /api/search</code> for semantic retrieval
                with filters for tags, types, and time ranges. Every request returns a similarity score and the normalized
                item payload you use in the inbox.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Rate Limits &amp; Best Practices</h2>
              <ul className="mt-4 space-y-3 text-gray-700">
                <li>
                  API keys are limited to 400 requests per minute. Responses include{' '}
                  <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">429</code> when exceeded—back off with
                  exponential retry.
                </li>
                <li>
                  Indexing runs asynchronously. Poll <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">GET /api/items</code>{' '}
                  or subscribe to email notifications to confirm enrichment.
                </li>
                <li>
                  Store the hashed API key on your side; Injest never shows the plaintext key again after creation.
                </li>
              </ul>
            </div>
          </section>

          <section ref={docsRef} className="mt-12">
            <Card className="border border-blue-200 shadow-lg">
              <CardContent className="space-y-4 pt-6">
                <h2 className="text-2xl font-semibold text-gray-900">Interactive API Explorer</h2>
                {specLoading && (
                  <p className="text-gray-600">Loading the OpenAPI specification. One moment…</p>
                )}
                {specError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {specError}
                  </div>
                )}
                {!specLoading && !specError && spec && (
                  <div className="overflow-hidden rounded-md border border-gray-200">
                    <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={0} />
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
