'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { SearchResults } from '@/components/search-results';
import { ItemList } from '@/components/item-list';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AvatarMenu } from '@/components/avatar-menu';
import { auth } from '@/lib/auth';
import { apiClient, Item, API_URL, type SearchResult, type SearchFilters } from '@/lib/api';
import { BOOKMARK_IMPORT_EVENT, ITEM_CREATED_EVENT } from '@/lib/events';
import { toast } from 'sonner';

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const [filteredIndexedCount, setFilteredIndexedCount] = useState<number | null>(null);
  const bookmarkPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bookmarkPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bookmarkInitialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
  const hasAttachmentsFilter = fileTypeFilter !== '';
  const itemStreamRef = useRef<EventSource | null>(null);
  const [itemStreamRetry, setItemStreamRetry] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const searchSentinelRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 50;
  const SEARCH_BATCH_SIZE = 10;
  const searchFilters: SearchFilters = { entities: ['item'] };

  const isOutboundEmailItem = (item: Item): boolean => {
    const source = item.source?.toLowerCase() ?? '';
    return source.startsWith('send_workflow:') || source === 'send_workflow:outbound';
  };

  const handleSearchResultsChange = useCallback((results: SearchResult[], append: boolean = false) => {
    if (append) {
      setSearchResults((prev) => {
        // Create a map to track existing results by entityType:entityId
        const existingKeys = new Set(prev.map((r) => `${r.entityType}:${r.entityId}`));
        // Filter out duplicates from new results
        const uniqueNewResults = results.filter(
          (r) => !existingKeys.has(`${r.entityType}:${r.entityId}`)
        );
        return [...prev, ...uniqueNewResults];
      });
    } else {
      setSearchResults(results);
      setSearchOffset(0);
      setSearchHasMore(results.length === SEARCH_BATCH_SIZE && results.length > 0);
    }
  }, []);

  const handleSearchLoadingChange = useCallback((isLoading: boolean) => {
    setSearchLoading(isLoading);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
    // Reset search state when query changes
    if (value.length < 2) {
      setSearchResults([]);
      setSearchOffset(0);
      setSearchHasMore(true);
    }
  }, []);

  const loadMoreSearchResults = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2 || searchLoadingMore || !searchHasMore) {
      return;
    }

    // Don't load more if we already have 50 results (max limit)
    setSearchResults((prev) => {
      if (prev.length >= 50) {
        setSearchHasMore(false);
        return prev;
      }
      return prev;
    });

    setSearchLoadingMore(true);
    try {
      const nextOffset = searchOffset + SEARCH_BATCH_SIZE;
      const response = await apiClient.search(searchQuery, {
        limit: SEARCH_BATCH_SIZE,
        offset: nextOffset,
        filters: searchFilters,
      });
      const newResults = response.results ?? [];

      if (newResults.length > 0) {
        // Use functional update to get current length and deduplicate
        setSearchResults((prev) => {
          // Create a map to track existing results by entityType:entityId
          const existingKeys = new Set(prev.map((r) => `${r.entityType}:${r.entityId}`));
          // Filter out duplicates from new results
          const uniqueNewResults = newResults.filter(
            (r) => !existingKeys.has(`${r.entityType}:${r.entityId}`)
          );
          const updated = [...prev, ...uniqueNewResults];
          // Don't load more if we've reached 50 results or got fewer than batch size
          const totalResults = updated.length;
          setSearchHasMore(totalResults < 50 && newResults.length === SEARCH_BATCH_SIZE);
          return updated;
        });
        setSearchOffset(nextOffset);
      } else {
        setSearchHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more search results:', error);
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchQuery, searchOffset, searchLoadingMore, searchHasMore, searchFilters]);

  const itemMatchesFilters = useCallback((item: Item): boolean => {
    // Always hide outbound workflow emails from the inbox
    if (isOutboundEmailItem(item)) {
      return false;
    }

    if (sourceFilter) {
      if (sourceFilter === 'email') {
        const isEmailSource = (item.source?.toLowerCase().startsWith('email:') ?? false) || item.type === 'email';
        if (!isEmailSource) {
          return false;
        }
      } else if (sourceFilter === 'slack') {
        const isSlackSource = (item.source?.toLowerCase().startsWith('slack:') ?? false) ||
                              (Array.isArray(item.tags) && item.tags.includes('slack'));
        if (!isSlackSource) {
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


  const buildFilters = useCallback(() => {
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
    return filters;
  }, [fileTypeFilter, hasAttachmentsFilter, sourceFilter]);


  const loadIndexedCount = useCallback(async (filters?: { source?: string; hasAttachments?: boolean; fileType?: string }) => {
    try {
      const response = await apiClient.getIndexedItemCount(filters);
      setIndexedCount(response.count);
      const hasFiltersApplied = filters != null && Object.keys(filters).length > 0;
      if (hasFiltersApplied) {
        const nextFilteredCount =
          typeof response.filteredCount === 'number' ? response.filteredCount : response.count;
        setFilteredIndexedCount(nextFilteredCount);
      } else {
        setFilteredIndexedCount(null);
      }
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
        .catch((): Item[] => [])
        .then((fetchedItems) => fetchedItems.filter((item) => !isOutboundEmailItem(item)));

      // Combine items (itemsData already includes email items from the database)
      const allItems = [...itemsData];

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
      loadIndexedCount(buildFilters());
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
  }, [buildFilters, loadIndexedCount, loadItems, router]);

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
        .catch((): Item[] => [])
        .then((fetchedItems) => fetchedItems.filter((item) => !isOutboundEmailItem(item)));

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
      // Set loading state BEFORE clearing items to prevent flicker
      setLoading(true);
      setOffset(0);
      setItems([]);
      setHasMore(true);
      const filters = buildFilters();
      loadItems(0, true);
      loadIndexedCount(filters);
    }
  }, [authLoading, buildFilters, fileTypeFilter, hasAttachmentsFilter, loadIndexedCount, loadItems, sourceFilter]);

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

  // Intersection Observer for search infinite scroll
  useEffect(() => {
    // Only set up observer when we have search results and query is valid
    if (searchQuery.length < 2) return;

    const sentinel = searchSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && searchHasMore && !searchLoadingMore && !searchLoading) {
          loadMoreSearchResults();
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
      observer.disconnect();
    };
  }, [searchHasMore, searchLoading, searchLoadingMore, searchQuery, loadMoreSearchResults]);

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
          void loadIndexedCount(buildFilters());
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

        void loadIndexedCount(buildFilters());
      } catch (error) {
        console.error('Failed to handle indexed item event:', error);
      }
    };

    eventSource.addEventListener('indexed', handleIndexed);

    eventSource.addEventListener('open', () => {
      console.log('Item stream connected');
    });

    eventSource.onerror = (event) => {
      const readyState = eventSource.readyState;
      const stateMessage =
        readyState === EventSource.CONNECTING ? 'CONNECTING' :
        readyState === EventSource.OPEN ? 'OPEN' :
        readyState === EventSource.CLOSED ? 'CLOSED' : 'UNKNOWN';

      console.error('Item stream error:', {
        readyState: stateMessage,
        url: streamUrl,
        type: event.type,
        target: event.target,
      });

      // Only retry if the connection was closed unexpectedly
      // Don't retry if it's already closed (might be intentional)
      if (readyState === EventSource.CLOSED) {
        eventSource.close();
        itemStreamRef.current = null;
        setTimeout(() => {
          setItemStreamRetry((retry) => retry + 1);
        }, 3000);
      }
    };

    return () => {
      eventSource.removeEventListener('indexed', handleIndexed);
      eventSource.close();
      itemStreamRef.current = null;
    };
  }, [authLoading, buildFilters, hasAttachmentsFilter, itemMatchesFilters, itemStreamRetry, loadIndexedCount, sourceFilter, fileTypeFilter]);

  const handleDelete = async (itemId: string) => {
    try {
      await apiClient.deleteItem(itemId);
      // Reset and reload from beginning
      setOffset(0);
      setItems([]);
      setHasMore(true);
      loadItems(0, true);
      loadIndexedCount(buildFilters());
    } catch (error: unknown) {
      console.error('Error deleting item:', error);
    }
  };

  const refreshItems = useCallback(() => {
    setOffset(0);
    setItems([]);
    setHasMore(true);
    const filters = buildFilters();
    loadItems(0, true);
    loadIndexedCount(filters);
  }, [buildFilters, loadIndexedCount, loadItems]);

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
  const inboxLocalPart =
    currentUser?.inbound_email_handle ||
    currentUser?.public_username ||
    currentUser?.email?.split('@')[0] ||
    '';
  const inboxAddress = inboxLocalPart ? `${inboxLocalPart}@injest.io` : '';
  const filtersApplied = Boolean(sourceFilter || fileTypeFilter);
  const filteredCountDisplay = filteredIndexedCount ?? '—';

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inbox</h1>
            {inboxAddress && (
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700 border border-gray-200 max-w-full">
                <span className="uppercase tracking-wide text-gray-500">Your email inbox</span>
                <span className="truncate font-semibold text-gray-900">{inboxAddress}</span>
              </div>
            )}
          </div>
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
            filters={searchFilters}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                Your Items
                {indexedCount !== null && (
                  <span className="ml-2 text-xs font-normal text-gray-500 sm:text-sm">
                    {filtersApplied
                      ? `(${filteredCountDisplay} of ${indexedCount} indexed)`
                      : `(${indexedCount} indexed)`}
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <label htmlFor="source-filter" className="whitespace-nowrap text-xs font-medium text-gray-700 sm:text-sm">
                      Source:
                    </label>
                    <select
                      id="source-filter"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Sources</option>
                      <option value="web">Web</option>
                      <option value="bookmark">Bookmark</option>
                      <option value="email">Email</option>
                      <option value="slack">Slack</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <label htmlFor="file-type-filter" className="whitespace-nowrap text-xs font-medium text-gray-700 sm:text-sm">
                      File Type:
                    </label>
                    <select
                      id="file-type-filter"
                      value={fileTypeFilter}
                      onChange={(e) => setFileTypeFilter(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6 min-h-[200px]">
            {searchQuery.length >= 2 ? (
              <div className="relative">
                {searchLoading && (
                  <div className="py-8 text-center text-muted-foreground absolute inset-0 flex items-center justify-center">
                    Searching…
                  </div>
                )}
                <div
                  className={`transition-opacity duration-200 ${
                    searchLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  {searchResults.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No results match your search.
                    </div>
                  ) : (
                    <>
                      <SearchResults results={searchResults} />
                      <div ref={searchSentinelRef} className="py-4 text-center min-h-[50px]">
                        {searchLoadingMore && (
                          <div className="text-sm text-muted-foreground">Loading more results...</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : loading && items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Loading items…</div>
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
