'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchBar } from '@/components/search-bar';
import { CaptureForm } from '@/components/capture-form';
import { ItemList } from '@/components/item-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AvatarMenu } from '@/components/avatar-menu';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { auth } from '@/lib/auth';
import { apiClient, Item, ReceivedEmail, API_URL } from '@/lib/api';

type ApiKeyInfoState = {
  hasKey: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [importingBookmarks, setImportingBookmarks] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | null>(null);
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfoState | null>(null);
  const [apiKeyInfoLoading, setApiKeyInfoLoading] = useState(true);
  const [apiKeyActionLoading, setApiKeyActionLoading] = useState(false);
  const [apiKeyActionType, setApiKeyActionType] = useState<'generate' | 'revoke' | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const bookmarkFileInputRef = useRef<HTMLInputElement>(null);
  const bookmarkPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [hasAttachmentsFilter, setHasAttachmentsFilter] = useState<boolean>(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
  const itemStreamRef = useRef<EventSource | null>(null);
  const [itemStreamRetry, setItemStreamRetry] = useState(0);
  const BATCH_SIZE = 50;
  const externalApiBaseUrl = `${API_URL.replace(/\/+$/, '')}/api/external`;

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

  const loadIndexedCount = useCallback(async () => {
    try {
      const response = await apiClient.getIndexedItemCount();
      setIndexedCount(response.count);
    } catch (error: unknown) {
      console.error('Error loading indexed count:', error);
    }
  }, []);

  const loadItems = useCallback(async (currentOffset: number = 0, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setItems([]);
        setOffset(0);
        setHasMore(true);
      }

      // Build filters object
      const filters: { source?: string; hasAttachments?: boolean; fileType?: string } = {};
      if (sourceFilter) {
        filters.source = sourceFilter;
      }
      if (hasAttachmentsFilter) {
        filters.hasAttachments = true;
      }
      if (fileTypeFilter) {
        filters.fileType = fileTypeFilter;
      }

      // Fetch items with pagination and filters
      const itemsData = await apiClient
        .getItems(BATCH_SIZE, currentOffset, filters)
        .catch((): Item[] => []);

      // For emails, we only fetch the first batch to avoid duplicates
      // Subsequent loads will only fetch database items
      let emailItems: Item[] = [];
      // Only fetch email items if no source filter is set, or if filtering for email sources
      if (currentOffset === 0 && (!sourceFilter || sourceFilter === 'email' || sourceFilter.startsWith('email:'))) {
        const emailsResponse = await apiClient
          .getReceivedEmails(BATCH_SIZE)
          .catch((): { data: ReceivedEmail[]; has_more: boolean } => ({ data: [], has_more: false }));

        // Extract resend_email_id from database items to check for duplicates
        const existingResendEmailIds = new Set<string>();
        itemsData.forEach((item) => {
          if (item.type === 'email' && item.raw) {
            try {
              const rawData = JSON.parse(item.raw);
              if (rawData.resend_email_id) {
                existingResendEmailIds.add(rawData.resend_email_id);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        });

        // Transform emails into item-like format for unified display
        // Only include emails that are NOT already in the database
        emailItems = (emailsResponse.data || [])
          .filter((email: ReceivedEmail) => !existingResendEmailIds.has(email.id))
          .map((email: ReceivedEmail) => {
            // Strip HTML tags for description preview
            const textPreview = email.text || (email.html ? email.html.replace(/<[^>]*>/g, '').substring(0, 200) : '');

            return {
              id: `resend-email-${email.id}`,
              owner_id: '',
              type: 'email' as const,
              title: email.subject,
              description: textPreview,
              created_at: email.created_at,
              updated_at: email.created_at,
              isResendEmail: true,
              resendEmailId: email.id,
              attachments: email.attachments?.map((att) => ({
                filename: att.id,
                originalname: att.filename,
                mimetype: att.content_type,
                size: att.size,
                attachmentId: att.id,
              })) || [],
              source: `email:${email.from}`,
            };
          });

        // Apply client-side filtering to email items
        if (sourceFilter === 'email') {
          // Keep all email items when filtering by 'email'
          // No additional filtering needed
        } else if (sourceFilter && !sourceFilter.startsWith('email:')) {
          // Filter out email items if source filter is set to something other than email
          emailItems = [];
        }
        if (hasAttachmentsFilter) {
          emailItems = emailItems.filter(item => item.attachments && item.attachments.length > 0);
        }
        if (fileTypeFilter) {
          emailItems = emailItems.filter(item => {
            if (!item.attachments || item.attachments.length === 0) return false;
            return item.attachments.some((attachment) => {
              const candidate = attachment as { mimetype?: string | null };
              const mimetype = candidate.mimetype?.toLowerCase() ?? '';
              if (fileTypeFilter === 'image') {
                return mimetype.startsWith('image/');
              } else if (fileTypeFilter === 'spreadsheet') {
                return mimetype.includes('spreadsheet') ||
                       mimetype.includes('excel') ||
                       mimetype === 'text/csv' ||
                       mimetype === 'application/csv';
              } else if (fileTypeFilter === 'document') {
                return mimetype === 'application/pdf' ||
                       mimetype.includes('word') ||
                       mimetype === 'text/plain' ||
                       mimetype === 'text/rtf';
              }
              return false;
            });
          });
        }
      }

      // Combine items
      const allItems = [...itemsData, ...emailItems];

      // Check if we have more items to load
      const hasMoreItems = itemsData.length === BATCH_SIZE;

      if (reset) {
        // Sort by date (newest first) and set items
        const sortedItems = allItems.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        setItems(sortedItems);
        setHasMore(hasMoreItems);
        setOffset(BATCH_SIZE);
      } else {
        // Append new items, maintaining sorted order
        setItems((prevItems) => {
          const combined = [...prevItems, ...allItems];
          // Remove duplicates by ID
          const uniqueItems = combined.filter((item, index, self) =>
            index === self.findIndex((i) => i.id === item.id)
          );
          // Sort by date (newest first)
          return uniqueItems.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
          });
        });
        setHasMore(hasMoreItems);
        setOffset((prev) => prev + BATCH_SIZE);
      }
    } catch (error: unknown) {
      console.error('Error loading items:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [BATCH_SIZE, fileTypeFilter, hasAttachmentsFilter, sourceFilter]);

  useEffect(() => {
    const checkAuth = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
      await loadApiKeyInfo();
    };

    checkAuth();

    return () => {
      if (bookmarkPollIntervalRef.current) {
        clearInterval(bookmarkPollIntervalRef.current);
      }
    };
  }, [loadApiKeyInfo, loadIndexedCount, loadItems, router]);

  const loadMoreItems = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;

    setLoadingMore(true);
    try {
      // Use current offset from state by reading it directly
      const currentOffset = offset;

      // Build filters object
      const filters: { source?: string; hasAttachments?: boolean; fileType?: string } = {};
      if (sourceFilter) {
        filters.source = sourceFilter;
      }
      if (hasAttachmentsFilter) {
        filters.hasAttachments = true;
      }
      if (fileTypeFilter) {
        filters.fileType = fileTypeFilter;
      }

      // Fetch items with pagination and filters
      const itemsData = await apiClient
        .getItems(BATCH_SIZE, currentOffset, filters)
        .catch((): Item[] => []);

      // Combine items
      const allItems = [...itemsData];

      // Check if we have more items to load
      const hasMoreItems = itemsData.length === BATCH_SIZE;

      // Append new items, maintaining sorted order
      setItems((prevItems) => {
        const combined = [...prevItems, ...allItems];
        // Remove duplicates by ID
        const uniqueItems = combined.filter((item, index, self) =>
          index === self.findIndex((i) => i.id === item.id)
        );
        // Sort by date (newest first)
        return uniqueItems.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
      });
      setHasMore(hasMoreItems);
      setOffset((prev) => prev + BATCH_SIZE);
    } catch (error: unknown) {
      console.error('Error loading more items:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, offset, sourceFilter, hasAttachmentsFilter, fileTypeFilter]);

  // Reload items when filters change
  useEffect(() => {
    if (!authLoading && auth.isAuthenticated()) {
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
    }
  }, [authLoading, fileTypeFilter, hasAttachmentsFilter, loadItems, sourceFilter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreItems();
        }
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before reaching the sentinel
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
    };
  }, [hasMore, loadMoreItems, loading, loadingMore]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (authLoading) {
      return;
    }

    if (!auth.isAuthenticated()) {
      if (itemStreamRef.current) {
        itemStreamRef.current.close();
        itemStreamRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    const apiUrl = API_URL.replace(/\/+$/, '');
    const streamUrl = `${apiUrl}/api/items/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);
    itemStreamRef.current = eventSource;

    const handleIndexed = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const newItem = payload?.item as Item | undefined;
        if (!newItem || !newItem.id) {
          return;
        }

        if (sourceFilter || hasAttachmentsFilter || fileTypeFilter) {
          return;
        }

        setItems((prevItems) => {
          const existingIndex = prevItems.findIndex((item) => item.id === newItem.id);
          const updated = existingIndex >= 0
            ? prevItems.map((item, index) => (index === existingIndex ? { ...item, ...newItem } : item))
            : [newItem, ...prevItems];

          const uniqueMap = new Map<string, Item>();
          updated.forEach((item) => {
            uniqueMap.set(item.id, item);
          });

          return Array.from(uniqueMap.values()).sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
          });
        });

        void loadIndexedCount();
      } catch (error) {
        console.error('Failed to handle indexed item event:', error);
      }
    };

    eventSource.addEventListener('indexed', handleIndexed);
    eventSource.onerror = (error) => {
      console.error('Item stream error:', error);
      eventSource.close();
      itemStreamRef.current = null;
      setTimeout(() => {
        setItemStreamRetry((retry) => retry + 1);
      }, 3000);
    };

    return () => {
      eventSource.removeEventListener('indexed', handleIndexed);
      eventSource.close();
      itemStreamRef.current = null;
    };
  }, [authLoading, hasAttachmentsFilter, itemStreamRetry, loadIndexedCount, sourceFilter, fileTypeFilter]);

  const handleDelete = async (itemId: string) => {
    try {
      await apiClient.deleteItem(itemId);
      // Reset and reload from beginning
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
    } catch (error: unknown) {
      console.error('Error deleting item:', error);
    }
  };

  const handleImportBookmarks = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.html') && file.type !== 'text/html') {
      toast.error('Please select an HTML bookmark file');
      return;
    }

    setImportingBookmarks(true);
    try {
      const result = await apiClient.importBookmarks(file);
      handleImportSuccess(result.total);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Error importing bookmarks:', error);
      toast.error(err?.message || 'Failed to start bookmark import');
      setImportingBookmarks(false);
    }
  };

  const handleImportSuccess = (total: number) => {
    // Show success message with note about background processing
    toast.success(
      `Import started! Processing ${total} bookmark${total !== 1 ? 's' : ''} in the background. They will appear in your list as they are imported.`,
      { duration: 6000 }
    );

    // Clear any existing polling interval
    if (bookmarkPollIntervalRef.current) {
      clearInterval(bookmarkPollIntervalRef.current);
    }

    // Start polling for new items periodically to show them as they appear
    bookmarkPollIntervalRef.current = setInterval(() => {
      // Reset and reload from beginning to show new items
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
    }, 3000); // Poll every 3 seconds

    // Stop polling after 2 minutes (bookmarks should be processed by then)
    setTimeout(() => {
      if (bookmarkPollIntervalRef.current) {
        clearInterval(bookmarkPollIntervalRef.current);
        bookmarkPollIntervalRef.current = null;
      }
      // Final refresh
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
    }, 120000);

    // Initial refresh after a short delay
    setTimeout(() => {
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
    }, 2000);

    setImportingBookmarks(false);
    // Reset file input
    if (bookmarkFileInputRef.current) {
      bookmarkFileInputRef.current.value = '';
    }
  };

  const handleExportItems = async (format: 'json' | 'csv') => {
    try {
      setExportingFormat(format);
      await apiClient.downloadItemsExport(format);
      toast.success(`Export started in ${format.toUpperCase()} format`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err?.message || 'Failed to export items');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleGenerateApiKey = async () => {
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err?.message || 'Failed to generate API key');
    } finally {
      setApiKeyActionLoading(false);
      setApiKeyActionType(null);
    }
  };

  const handleRevokeApiKey = async () => {
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err?.message || 'Failed to revoke API key');
    } finally {
      setApiKeyActionLoading(false);
      setApiKeyActionType(null);
    }
  };

  if (authLoading || loading) {
    return <div className="container mx-auto px-3 sm:px-4 md:px-6 py-8">Loading...</div>;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold">Injest.io</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
              onClick={() => router.push('/tasks')}
            >
              Tasks
            </Button>
            <FeedbackDialog
              userEmail={currentUser?.email}
              buttonVariant="outline"
              buttonSize="sm"
              triggerClassName="text-xs sm:text-sm"
            />
            <AvatarMenu user={currentUser} />
          </div>
        </div>
      </header>

      {/* Search bar - first thing after nav, bold and wide like Google */}
      <div className="bg-white border-b py-6 sm:py-8">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 max-w-full">
          <SearchBar />
        </div>
      </div>

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-full">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Capture New Item - first column on desktop, first on mobile */}
          <div className="lg:col-span-1 space-y-4">
            <CaptureForm onItemCreated={() => {
              // Reset and reload from beginning when new item is created
              setOffset(0);
              setItems([]);
              setHasMore(true);
              loadItems(0, true);
              loadIndexedCount();
            }} />

            {/* Import Bookmarks Card */}
            <Card>
              <CardHeader>
                <CardTitle>Import Bookmarks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={bookmarkFileInputRef}
                  type="file"
                  accept=".html,text/html"
                  onChange={handleImportBookmarks}
                  className="hidden"
                  id="bookmark-file-input"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => bookmarkFileInputRef.current?.click()}
                  disabled={importingBookmarks}
                >
                  {importingBookmarks ? 'Importing...' : 'Import Bookmarks from HTML'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Export your browser bookmarks as HTML and import them here.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Downloads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Export all enriched items as structured data. Hosted attachments are not included.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleExportItems('json')}
                    disabled={exportingFormat !== null}
                  >
                    {exportingFormat === 'json' ? 'Preparing JSON...' : 'Download JSON'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleExportItems('csv')}
                    disabled={exportingFormat !== null}
                  >
                    {exportingFormat === 'csv' ? 'Preparing CSV...' : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>External API Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate an API key to query your enriched data via REST without sharing your account token.
                </p>

                {apiKeyInfoLoading ? (
                  <p className="text-sm text-muted-foreground">Loading API key details...</p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm">
                      <p>
                        Key status:{' '}
                        <span className="font-semibold">
                          {apiKeyInfo?.hasKey ? 'Active' : 'Not generated'}
                        </span>
                      </p>
                      <p>Created: {formatTimestamp(apiKeyInfo?.createdAt ?? null)}</p>
                      <p>Last used: {formatTimestamp(apiKeyInfo?.lastUsedAt ?? null)}</p>
                    </div>

                    {generatedApiKey && (
                      <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase text-amber-800 tracking-wide">
                          Your new API key
                        </p>
                        <p className="mt-2 font-mono text-sm break-all">{generatedApiKey}</p>
                        <p className="mt-2 text-xs text-amber-700">
                          Copy this key now—you won&apos;t be able to see it again.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleGenerateApiKey}
                        disabled={apiKeyActionLoading}
                      >
                        {apiKeyActionLoading && apiKeyActionType === 'generate'
                          ? 'Generating...'
                          : apiKeyInfo?.hasKey
                            ? 'Regenerate API Key'
                            : 'Generate API Key'}
                      </Button>
                      {apiKeyInfo?.hasKey && (
                        <Button
                          variant="destructive"
                          onClick={handleRevokeApiKey}
                          disabled={apiKeyActionLoading}
                        >
                          {apiKeyActionLoading && apiKeyActionType === 'revoke'
                            ? 'Revoking...'
                            : 'Revoke Key'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Example requests
                  </p>
                  <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs font-mono">
{`curl -H "x-api-key: YOUR_API_KEY" "${externalApiBaseUrl}/items?limit=25"`}
                  </pre>
                  <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs font-mono">
{`curl -H "x-api-key: YOUR_API_KEY" "${externalApiBaseUrl}/search?q=meeting"`}
                  </pre>
                  <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs font-mono">
{`curl -H "x-api-key: YOUR_API_KEY" "${externalApiBaseUrl}/items/ITEM_ID"`}
                  </pre>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Item list - second column on desktop, second on mobile */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">
                  Your Items
                  {indexedCount !== null && (
                    <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
                      ({indexedCount} indexed)
                    </span>
                  )}
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  {/* Source Filter */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <label htmlFor="source-filter" className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                      Source:
                    </label>
                    <select
                      id="source-filter"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Sources</option>
                      <option value="web">Web</option>
                      <option value="bookmark">Bookmark</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  {/* Attachments Filter */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAttachmentsFilter}
                        onChange={(e) => setHasAttachmentsFilter(e.target.checked)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span>With Files</span>
                    </label>
                  </div>
                  {/* File Type Filter */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <label htmlFor="file-type-filter" className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                      File Type:
                    </label>
                    <select
                      id="file-type-filter"
                      value={fileTypeFilter}
                      onChange={(e) => setFileTypeFilter(e.target.value)}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Types</option>
                      <option value="image">Image</option>
                      <option value="spreadsheet">Spreadsheet</option>
                      <option value="document">Document</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <ItemList
              items={items}
              onDelete={handleDelete}
            />
            {/* Sentinel element for infinite scroll */}
            {hasMore && (
              <div ref={loadMoreSentinelRef} className="py-4 text-center">
                {loadingMore && (
                  <p className="text-sm text-muted-foreground">Loading more items...</p>
                )}
              </div>
            )}
            {!hasMore && items.length > 0 && (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">All items loaded</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
