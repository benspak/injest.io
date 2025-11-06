'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchBar } from '@/components/search-bar';
import { CaptureForm } from '@/components/capture-form';
import { ItemList } from '@/components/item-list';
import { ImportPaymentDialog } from '@/components/import-payment-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { apiClient, Item, ReceivedEmail } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [importingBookmarks, setImportingBookmarks] = useState(false);
  const [importingConnections, setImportingConnections] = useState(false);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [pendingBookmarkFile, setPendingBookmarkFile] = useState<File | null>(null);
  const [pendingBookmarkCount, setPendingBookmarkCount] = useState(0);
  const [showConnectionsPaymentDialog, setShowConnectionsPaymentDialog] = useState(false);
  const [pendingConnectionsFile, setPendingConnectionsFile] = useState<File | null>(null);
  const [pendingConnectionsCount, setPendingConnectionsCount] = useState(0);
  const bookmarkFileInputRef = useRef<HTMLInputElement>(null);
  const connectionsFileInputRef = useRef<HTMLInputElement>(null);
  const bookmarkPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [hasAttachmentsFilter, setHasAttachmentsFilter] = useState<boolean>(false);
  const BATCH_SIZE = 50;

  useEffect(() => {
    const checkAuth = async () => {
      // Restore auth from token
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Reset pagination state and load initial items
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
    };

    checkAuth();

    // Cleanup polling interval on unmount
    return () => {
      if (bookmarkPollIntervalRef.current) {
        clearInterval(bookmarkPollIntervalRef.current);
      }
    };
  }, [router]);

  const loadIndexedCount = async () => {
    try {
      const response = await apiClient.getIndexedItemCount();
      setIndexedCount(response.count);
    } catch (error) {
      console.error('Error loading indexed count:', error);
    }
  };

  const loadItems = async (currentOffset: number = 0, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setItems([]);
        setOffset(0);
        setHasMore(true);
      }

      // Build filters object
      const filters: { source?: string; hasAttachments?: boolean } = {};
      if (sourceFilter) {
        filters.source = sourceFilter;
      }
      if (hasAttachmentsFilter) {
        filters.hasAttachments = true;
      }

      // Fetch items with pagination and filters
      const itemsData = await apiClient.getItems(BATCH_SIZE, currentOffset, filters).catch(() => []);

      // For emails, we only fetch the first batch to avoid duplicates
      // Subsequent loads will only fetch database items
      let emailItems: Item[] = [];
      // Only fetch email items if no source filter is set, or if filtering for email sources
      if (currentOffset === 0 && (!sourceFilter || sourceFilter === 'email' || sourceFilter.startsWith('email:'))) {
        const emailsResponse = await apiClient.getReceivedEmails(BATCH_SIZE).catch(() => ({ data: [], has_more: false }));

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
    } catch (error) {
      console.error('Error loading items:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreItems = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;

    setLoadingMore(true);
    try {
      // Use current offset from state by reading it directly
      const currentOffset = offset;

      // Build filters object
      const filters: { source?: string; hasAttachments?: boolean } = {};
      if (sourceFilter) {
        filters.source = sourceFilter;
      }
      if (hasAttachmentsFilter) {
        filters.hasAttachments = true;
      }

      // Fetch items with pagination and filters
      const itemsData = await apiClient.getItems(BATCH_SIZE, currentOffset, filters).catch(() => []);

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
    } catch (error) {
      console.error('Error loading more items:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, offset, sourceFilter, hasAttachmentsFilter]);

  // Reload items when filters change
  useEffect(() => {
    if (!authLoading && auth.isAuthenticated()) {
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, hasAttachmentsFilter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreSentinelRef.current || !hasMore || loading || loadingMore) return;

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

    observer.observe(loadMoreSentinelRef.current);

    return () => {
      if (loadMoreSentinelRef.current) {
        observer.unobserve(loadMoreSentinelRef.current);
      }
    };
  }, [hasMore, loading, loadingMore, loadMoreItems]);

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await apiClient.deleteItem(itemId);
      // Reset and reload from beginning
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount();
    } catch (error) {
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

    // First, parse the file to count bookmarks (we'll need to do this on the client side)
    // For now, we'll let the server handle it and show payment dialog if needed
    setPendingBookmarkFile(file);

    // Try to import - server will tell us if payment is needed
    setImportingBookmarks(true);
    try {
      const result = await apiClient.importBookmarks(file);

      // Success - no payment needed (premium user)
      handleImportSuccess(result.total);
    } catch (error: any) {
      console.error('Error importing bookmarks:', error);

      // Check if payment is required
      if (error.message && error.message.includes('Payment required')) {
        // Parse bookmark count from file (rough estimate or ask server)
        // For now, we'll show the dialog and let the server tell us the count
        // We need to parse the file client-side to get the count
        parseBookmarkCount(file).then((count) => {
          if (count > 555) {
            toast.error(`You can import up to 555 bookmarks per payment. Your file has ${count} bookmarks.`);
            setImportingBookmarks(false);
            return;
          }
          setPendingBookmarkCount(count);
          setShowPaymentDialog(true);
        });
      } else {
        toast.error(error.message || 'Failed to start bookmark import');
        setImportingBookmarks(false);
      }
    }
  };

  const parseBookmarkCount = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const html = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href]');
        // Count unique URLs
        const urls = new Set<string>();
        links.forEach((link) => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('http')) {
            urls.add(href);
          }
        });
        resolve(urls.size);
      };
      reader.readAsText(file);
    });
  };

  const handlePaymentComplete = async (paymentIntentId: string) => {
    if (!pendingBookmarkFile) return;

    setImportingBookmarks(true);
    try {
      const result = await apiClient.importBookmarks(pendingBookmarkFile, paymentIntentId);
      handleImportSuccess(result.total);
    } catch (error: any) {
      console.error('Error importing bookmarks after payment:', error);
      toast.error(error.message || 'Failed to start bookmark import');
      setImportingBookmarks(false);
    } finally {
      setPendingBookmarkFile(null);
      setPendingBookmarkCount(0);
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

  const handlePaymentCancel = () => {
    setPendingBookmarkFile(null);
    setPendingBookmarkCount(0);
    setImportingBookmarks(false);
    if (bookmarkFileInputRef.current) {
      bookmarkFileInputRef.current.value = '';
    }
  };

  const parseConnectionsCount = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csv = e.target?.result as string;
        const lines = csv.split(/\r?\n/);
        // Skip first 3 rows (metadata/notes rows) and header row (row 4)
        // Count data rows starting from row 5 (index 4 after skipping 3)
        const dataLines = lines.slice(4).filter(line => line.trim().length > 0);
        resolve(dataLines.length);
      };
      reader.readAsText(file);
    });
  };

  const handleImportConnections = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please select a CSV file');
      return;
    }

    // First, parse the file to count connections
    setPendingConnectionsFile(file);

    // Try to import - server will tell us if payment is needed
    setImportingConnections(true);
    try {
      const result = await apiClient.importConnections(file);

      // Success - no payment needed (premium user)
      handleConnectionsImportSuccess(result.total);
    } catch (error: any) {
      console.error('Error importing connections:', error);

      // Check if payment is required
      if (error.message && error.message.includes('Payment required')) {
        // Parse connection count from file
        parseConnectionsCount(file).then((count) => {
          setPendingConnectionsCount(count);
          setShowConnectionsPaymentDialog(true);
        });
      } else {
        toast.error(error.message || 'Failed to start connections import');
        setImportingConnections(false);
      }
    }
  };

  const handleConnectionsPaymentComplete = async (paymentIntentId: string) => {
    if (!pendingConnectionsFile) return;

    setImportingConnections(true);
    try {
      const result = await apiClient.importConnections(pendingConnectionsFile, paymentIntentId);
      handleConnectionsImportSuccess(result.total);
    } catch (error: any) {
      console.error('Error importing connections after payment:', error);
      toast.error(error.message || 'Failed to start connections import');
      setImportingConnections(false);
    } finally {
      setPendingConnectionsFile(null);
      setPendingConnectionsCount(0);
    }
  };

  const handleConnectionsImportSuccess = (total: number) => {
    // Show success message with note about background processing
    toast.success(
      `Import started! Processing ${total} connection${total !== 1 ? 's' : ''} in the background. They will appear in your list as they are imported.`,
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

    // Stop polling after 2 minutes (connections should be processed by then)
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

    setImportingConnections(false);
    // Reset file input
    if (connectionsFileInputRef.current) {
      connectionsFileInputRef.current.value = '';
    }
  };

  const handleConnectionsPaymentCancel = () => {
    setPendingConnectionsFile(null);
    setPendingConnectionsCount(0);
    setImportingConnections(false);
    if (connectionsFileInputRef.current) {
      connectionsFileInputRef.current.value = '';
    }
  };

  if (authLoading || loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Injest.io</h1>
          <div className="flex gap-4 items-center">
            <Button
              variant="outline"
              onClick={() => {
                auth.logout();
                router.push('/login');
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Search bar - first thing after nav, bold and wide like Google */}
      <div className="bg-white border-b py-8">
        <div className="container mx-auto px-4">
          <SearchBar />
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const force = confirm('Force re-enrichment? This will re-fetch metadata even for bookmarks that already have it.\n\nClick OK to force, Cancel to skip already-enriched bookmarks.');
                    if (!confirm(`This will ${force ? 'force re-fetch' : 'fetch'} metadata for all your bookmarks. This may take a while. Continue?`)) {
                      return;
                    }
                    try {
                      const result = await apiClient.reEnrichBookmarks(force);
                      toast.success(
                        `Re-enrichment started! Processing ${result.total} bookmark${result.total !== 1 ? 's' : ''} in the background.`,
                        { duration: 6000 }
                      );
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to start re-enrichment');
                    }
                  }}
                >
                  Re-enrich All Bookmarks
                </Button>
                <p className="text-xs text-muted-foreground">
                  Export your browser bookmarks as HTML and import them here. Use "Re-enrich" to fetch metadata for existing bookmarks.
                </p>
                <p className="text-xs text-amber-600 font-medium">
                  💰 $5 per import (due to OpenAI token usage for metadata enrichment)
                </p>
              </CardContent>
            </Card>

            {/* Import Connections Card */}
            <Card>
              <CardHeader>
                <CardTitle>Import LinkedIn Connections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={connectionsFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportConnections}
                  className="hidden"
                  id="connections-file-input"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => connectionsFileInputRef.current?.click()}
                  disabled={importingConnections}
                >
                  {importingConnections ? 'Importing...' : 'Import Connections from CSV'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const force = confirm('Force re-indexing? This will re-index even connections that already have embeddings.\n\nClick OK to force, Cancel to skip already-indexed connections.');
                    if (!confirm(`This will ${force ? 'force re-index' : 'index'} all your LinkedIn connections. This may take a while. Continue?`)) {
                      return;
                    }
                    try {
                      const result = await apiClient.reIndexConnections(force);
                      toast.success(
                        `Re-indexing started! Processing ${result.total} connection${result.total !== 1 ? 's' : ''} in the background.`,
                        { duration: 6000 }
                      );
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to start re-indexing');
                    }
                  }}
                >
                  Re-index All Connections
                </Button>
                <p className="text-xs text-muted-foreground">
                  Export your LinkedIn connections as CSV and import them here. Each connection will be created as a contact item. Use "Re-index" to create embeddings for search.
                </p>
                <p className="text-xs text-amber-600 font-medium">
                  💰 $5 per import (due to OpenAI token usage for metadata enrichment)
                </p>
              </CardContent>
            </Card>

            {/* Important Links Card */}
            <Card>
              <CardHeader>
                <CardTitle>Important Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <a
                    href="https://x.com/settings/download_your_data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Download X (Twitter) Data
                  </a>
                  <a
                    href="https://www.linkedin.com/mypreferences/d/download-my-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Download LinkedIn Data
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Item list - second column on desktop, second on mobile */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-xl font-semibold">
                  Your Items
                  {indexedCount !== null && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({indexedCount} indexed)
                    </span>
                  )}
                </h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Source Filter */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="source-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Source:
                    </label>
                    <select
                      id="source-filter"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Sources</option>
                      <option value="web">Web</option>
                      <option value="bookmark">Bookmark</option>
                      <option value="email">Email</option>
                      <option value="linkedin-connection">LinkedIn Connection</option>
                    </select>
                  </div>
                  {/* Attachments Filter */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAttachmentsFilter}
                        onChange={(e) => setHasAttachmentsFilter(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span>With Files</span>
                    </label>
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

      <ImportPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        count={pendingBookmarkCount}
        type="bookmark"
        onPaymentComplete={handlePaymentComplete}
        onCancel={handlePaymentCancel}
      />
      <ImportPaymentDialog
        open={showConnectionsPaymentDialog}
        onOpenChange={setShowConnectionsPaymentDialog}
        count={pendingConnectionsCount}
        type="connection"
        onPaymentComplete={handleConnectionsPaymentComplete}
        onCancel={handleConnectionsPaymentCancel}
      />
    </div>
  );
}
