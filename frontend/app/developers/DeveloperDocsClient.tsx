'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, apiClient, type User } from '@/lib/api';
import { auth } from '@/lib/auth';
import { toast } from 'sonner';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}


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

export default function DeveloperDocsClient() {
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.getUser());
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

  const isAuthenticated = Boolean(currentUser);

  useEffect(() => {
    if (!isAuthenticated) {
      setApiKeyInfo(null);
      setGeneratedApiKey(null);
      if (!authLoading) {
        setApiKeyInfoLoading(false);
      }
    }
  }, [isAuthenticated, authLoading]);

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
  }, []);

  const handleRevokeApiKey = useCallback(async () => {
    if (!auth.isAuthenticated()) {
      toast.error('Sign in to manage API keys.');
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
  }, [apiKeyInfo?.hasKey, loadApiKeyInfo]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void loadApiKeyInfo();
    }
  }, [isAuthenticated, authLoading, loadApiKeyInfo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
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

            {isAuthenticated ? (
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
          <Card className="border border-gray-200 shadow-lg">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-gray-900">Base URLs</h2>
              <dl className="mt-4 space-y-3 text-sm text-gray-700">
                <div>
                  <dt className="font-medium text-gray-900">Primary</dt>
                  <dd className="font-mono text-xs md:text-sm">{API_URL}</dd>
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
        </div>
      </div>
    </div>
  );
}
