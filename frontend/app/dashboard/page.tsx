'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchBar } from '@/components/search-bar';
import { CaptureForm } from '@/components/capture-form';
import { ItemList } from '@/components/item-list';
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
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const bookmarkFileInputRef = useRef<HTMLInputElement>(null);
  const bookmarkPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [hasAttachmentsFilter, setHasAttachmentsFilter] = useState<boolean>(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
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
        if (fileTypeFilter) {
          emailItems = emailItems.filter(item => {
            if (!item.attachments || item.attachments.length === 0) return false;
            return item.attachments.some((att: any) => {
              const mimetype = (att.mimetype || '').toLowerCase();
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
  }, [loadingMore, hasMore, loading, offset, sourceFilter, hasAttachmentsFilter, fileTypeFilter]);

  // Reload items when filters change
  useEffect(() => {
    if (!authLoading && auth.isAuthenticated()) {
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, hasAttachmentsFilter, fileTypeFilter]);

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

    setImportingBookmarks(true);
    try {
      const result = await apiClient.importBookmarks(file);
      handleImportSuccess(result.total);
    } catch (error: any) {
      console.error('Error importing bookmarks:', error);
      toast.error(error.message || 'Failed to start bookmark import');
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



  if (authLoading || loading) {
    return <div className="container mx-auto px-3 sm:px-4 md:px-6 py-8">Loading...</div>;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold">Injest.io</h1>
          <div className="flex gap-2 sm:gap-4 items-center">
            {currentUser && (
              <div className="flex flex-col items-end mr-2 sm:mr-4">
                <span className="text-xs sm:text-sm text-gray-700 font-medium">
                  {currentUser.email}
                </span>
                {currentUser.is_premium && (
                  <span className="text-xs text-blue-600 font-semibold">
                    Pro
                  </span>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
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
