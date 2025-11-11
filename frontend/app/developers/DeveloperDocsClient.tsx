'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import 'swagger-ui-react/swagger-ui.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { API_URL, apiClient, type User } from '@/lib/api';
import { auth } from '@/lib/auth';

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
  return tier === 'plus' || tier === 'power' || tier === 'pro';
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

export default function DeveloperDocsClient() {
  const router = useRouter();
  const docsRef = useRef<HTMLDivElement | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.getUser());
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  useEffect(() => {
    const restoreAuth = async () => {
      await auth.restore();
      const restoredUser = auth.getUser();
      setCurrentUser(restoredUser ?? null);
      setAuthLoading(false);

      if (!restoredUser) {
        router.push('/login');
      }
    };

    restoreAuth();
  }, [router]);

  const allowed = useMemo(() => hasPlusAccess(currentUser), [currentUser]);

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

  useEffect(() => {
    if (!authLoading && allowed && !spec && !specLoading && !specError) {
      void loadSpec();
    }
  }, [allowed, authLoading, loadSpec, spec, specError, specLoading]);

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

  if (authLoading) {
    return <div className="container mx-auto px-4 py-16">Loading developer documentation…</div>;
  }

  if (!currentUser) {
    return null;
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <Card className="border border-blue-200 shadow-lg">
            <CardContent className="space-y-4 pt-6">
              <h1 className="text-3xl font-bold text-gray-900">Plus membership required</h1>
              <p className="text-gray-700">
                API access and developer tooling are available for Plus plans and above. Upgrade to unlock authenticated
                API keys, semantic search integrations, and automation workflows.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings">
                  <Button>Manage subscription</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">Back to dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Developer Docs</h1>
            <p className="mt-2 text-gray-600">
              Build on top of Injest with secure authentication, flexible ingestion, and semantic search APIs.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost">← Back to Dashboard</Button>
          </Link>
        </div>

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
                Create an account and request a magic link from the dashboard, or use the{' '}
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
              item payload you use in the dashboard.
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
  );
}
