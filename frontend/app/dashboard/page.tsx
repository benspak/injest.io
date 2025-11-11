'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { ItemList } from '@/components/item-list';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AvatarMenu } from '@/components/avatar-menu';
import { auth } from '@/lib/auth';
import { apiClient, Item, ReceivedEmail, API_URL, type SearchResult } from '@/lib/api';
import { BOOKMARK_IMPORT_EVENT, ITEM_CREATED_EVENT } from '@/lib/events';

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const bookmarkPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bookmarkPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bookmarkInitialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [hasAttachmentsFilter, setHasAttachmentsFilter] = useState<boolean>(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
  const itemStreamRef = useRef<EventSource | null>(null);
  const [itemStreamRetry, setItemStreamRetry] = useState(0);
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const BATCH_SIZE = 50;
  const handleSearchResultsChange = useCallback((results: SearchResult[]) => {
    setSearchResults(results.map((result) => result.item));
  }, []);

  const handleSearchLoadingChange = useCallback((isLoading: boolean) => {
    setSearchLoading(isLoading);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const itemMatchesFilters = useCallback((item: Item): boolean => {
    if (sourceFilter) {
      if (sourceFilter === 'email') {
        const isEmailSource = (item.source?.toLowerCase().startsWith('email:') ?? false) || item.type === 'email';
        if (!isEmailSource) {
          return false;
        }
      } else if (sourceFilter.startsWith('email:')) {
        if ((item.source ?? '').toLowerCase() !== sourceFilter.toLowerCase()) {
          return false;
        }
      } else if ((item.source ?? '') !== sourceFilter) {
        return false;
      }
    }

    if (hasAttachmentsFilter) {
      if (!item.attachments || item.attachments.length === 0) {
        return false;
      }
    }

    if (fileTypeFilter) {
      if (!item.attachments || item.attachments.length === 0) {
        return false;
      }

      const matchesFileType = item.attachments.some((attachment) => {
        const mimetype = attachment?.mimetype?.toLowerCase() ?? '';
        if (!mimetype) {
          return false;
        }
        if (fileTypeFilter === 'image') {
          return mimetype.startsWith('image/');
        }
        if (fileTypeFilter === 'spreadsheet') {
          return (
            mimetype.includes('spreadsheet') ||
            mimetype.includes('excel') ||
            mimetype === 'text/csv' ||
            mimetype === 'application/csv'
          );
        }
        if (fileTypeFilter === 'document') {
          return (
            mimetype === 'application/pdf' ||
            mimetype.includes('word') ||
            mimetype === 'text/plain' ||
            mimetype === 'text/rtf'
          );
        }
        return false;
      });

      if (!matchesFileType) {
        return false;
      }
    }

    return true;
  }, [fileTypeFilter, hasAttachmentsFilter, sourceFilter]);


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
    };

    checkAuth();

    return () => {
      if (bookmarkPollIntervalRef.current) {
        clearInterval(bookmarkPollIntervalRef.current);
        bookmarkPollIntervalRef.current = null;
      }
      if (bookmarkPollTimeoutRef.current) {
        clearTimeout(bookmarkPollTimeoutRef.current);
        bookmarkPollTimeoutRef.current = null;
      }
      if (bookmarkInitialTimeoutRef.current) {
        clearTimeout(bookmarkInitialTimeoutRef.current);
        bookmarkInitialTimeoutRef.current = null;
      }
    };
  }, [loadIndexedCount, loadItems, router]);

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

        if (!itemMatchesFilters(newItem)) {
          void loadIndexedCount();
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
  }, [authLoading, hasAttachmentsFilter, itemMatchesFilters, itemStreamRetry, loadIndexedCount, sourceFilter, fileTypeFilter]);

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

  const refreshItems = useCallback(() => {
    setOffset(0);
    setItems([]);
    setHasMore(true);
    loadItems(0, true);
    loadIndexedCount();
  }, [loadIndexedCount, loadItems]);

  const startBookmarkPolling = useCallback(() => {
    refreshItems();

    if (bookmarkPollIntervalRef.current) {
      clearInterval(bookmarkPollIntervalRef.current);
    }
    bookmarkPollIntervalRef.current = setInterval(() => {
      refreshItems();
    }, 3000);

    if (bookmarkPollTimeoutRef.current) {
      clearTimeout(bookmarkPollTimeoutRef.current);
    }
    bookmarkPollTimeoutRef.current = setTimeout(() => {
      if (bookmarkPollIntervalRef.current) {
        clearInterval(bookmarkPollIntervalRef.current);
        bookmarkPollIntervalRef.current = null;
      }
      refreshItems();
      if (bookmarkPollTimeoutRef.current) {
        clearTimeout(bookmarkPollTimeoutRef.current);
        bookmarkPollTimeoutRef.current = null;
      }
    }, 120000);

    if (bookmarkInitialTimeoutRef.current) {
      clearTimeout(bookmarkInitialTimeoutRef.current);
    }
    bookmarkInitialTimeoutRef.current = setTimeout(() => {
      refreshItems();
      if (bookmarkInitialTimeoutRef.current) {
        clearTimeout(bookmarkInitialTimeoutRef.current);
        bookmarkInitialTimeoutRef.current = null;
      }
    }, 2000);
  }, [refreshItems]);

  useEffect(() => {
    const handleBookmarkImport = () => {
      startBookmarkPolling();
    };

    window.addEventListener(BOOKMARK_IMPORT_EVENT, handleBookmarkImport);

    return () => {
      window.removeEventListener(BOOKMARK_IMPORT_EVENT, handleBookmarkImport);
    };
  }, [startBookmarkPolling]);

  useEffect(() => {
    const handleItemCreated = () => {
      refreshItems();
    };

    window.addEventListener(ITEM_CREATED_EVENT, handleItemCreated);

    return () => {
      window.removeEventListener(ITEM_CREATED_EVENT, handleItemCreated);
    };
  }, [refreshItems]);

  if (authLoading || (loading && searchQuery.length < 2)) {
    return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">Loading...</div>;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="hidden items-center gap-2 sm:flex sm:gap-4">
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
      <div className="border-b bg-white py-6 sm:py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <SearchBar
            onResultsChange={handleSearchResultsChange}
            onLoadingChange={handleSearchLoadingChange}
            onQueryChange={handleSearchQueryChange}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                Your Items
                {indexedCount !== null && (
                  <span className="ml-2 text-xs font-normal text-gray-500 sm:text-sm">
                    ({indexedCount} indexed)
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label htmlFor="source-filter" className="whitespace-nowrap text-xs font-medium text-gray-700 sm:text-sm">
                    Source:
                  </label>
                  <select
                    id="source-filter"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Sources</option>
                    <option value="web">Web</option>
                    <option value="bookmark">Bookmark</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 sm:gap-2 sm:text-sm">
                    <input
                      type="checkbox"
                      checked={hasAttachmentsFilter}
                      onChange={(e) => setHasAttachmentsFilter(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 sm:h-4 sm:w-4"
                    />
                    <span>With Files</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <label htmlFor="file-type-filter" className="whitespace-nowrap text-xs font-medium text-gray-700 sm:text-sm">
                    File Type:
                  </label>
                  <select
                    id="file-type-filter"
                    value={fileTypeFilter}
                    onChange={(e) => setFileTypeFilter(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            {searchQuery.length >= 2 ? (
              searchLoading ? (
                <div className="py-8 text-center text-muted-foreground">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No items match your search.
                </div>
              ) : (
                <ItemList items={searchResults} onDelete={handleDelete} />
              )
            ) : (
              <>
                <ItemList items={items} onDelete={handleDelete} />
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
