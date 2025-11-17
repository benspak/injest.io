'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { SearchBar } from '@/components/search-bar';
import { SearchResults } from '@/components/search-results';
import { ItemList } from '@/components/item-list';
import { auth } from '@/lib/auth';
import { apiClient, type Item, type SearchFilters, type SearchResult } from '@/lib/api';

export default function SpamInboxPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const BATCH_SIZE = 50;
  const searchFilters: SearchFilters = { entities: ['item'] };

  const isSpamEmail = (item: Item): boolean => {
    return (
      item.type === 'email' &&
      Array.isArray(item.tags) &&
      item.tags.includes('spam')
    );
  };

  const loadItems = useCallback(
    async (currentOffset: number = 0, reset: boolean = false) => {
      try {
        if (reset) {
          setLoading(true);
          setItems([]);
          setOffset(0);
          setHasMore(true);
        }

        const fetched = await apiClient
          .getItems(BATCH_SIZE, currentOffset)
          .catch((): Item[] => []);

        const spamEmails = fetched.filter(isSpamEmail);
        const hasMoreItems = fetched.length === BATCH_SIZE;

        if (reset) {
          setItems(spamEmails);
          setOffset(BATCH_SIZE);
          setHasMore(hasMoreItems);
        } else {
          setItems((prev) => {
            const combined = [...prev, ...spamEmails];
            const unique = combined.filter(
              (item, index, self) => index === self.findIndex((i) => i.id === item.id),
            );
            return unique;
          });
          setOffset((prev) => prev + BATCH_SIZE);
          setHasMore(hasMoreItems);
        }
      } catch (error) {
        console.error('Error loading spam items:', error);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
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
    };

    void init();
  }, [loadItems, router]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    await loadItems(offset, false);
  }, [hasMore, loadItems, loading, loadingMore, offset]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          void loadMore();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore, loading, loadingMore]);

  const handleSearchResultsChange = useCallback((results: SearchResult[]) => {
    // Only show spam emails in search mode
    const filtered = results.filter(
      (result) => result.entityType === 'item' && result.item && isSpamEmail(result.item),
    );
    setSearchResults(filtered);
  }, []);

  const handleSearchLoadingChange = useCallback((isLoading: boolean) => {
    setSearchLoading(isLoading);
  }, []);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleDelete = useCallback(
    async (itemId: string) => {
      try {
        await apiClient.deleteItem(itemId);
        setItems((prev) => prev.filter((item) => item.id !== itemId));
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    },
    [],
  );

  if (authLoading || (loading && searchQuery.length < 2)) {
    return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">Loading...</div>;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Spam</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Emails you&apos;ve marked as spam. You can unmark them from the email details view.
            </p>
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
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6 min-h-[200px]">
          <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Spam classification is tag-based. Mark or unmark spam from the email details dialog.
          </div>
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
                    No spam emails match your search.
                  </div>
                ) : (
                  <SearchResults results={searchResults} />
                )}
              </div>
            </div>
          ) : loading && items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Loading spam emails…</div>
          ) : (
            <>
              <ItemList items={items} onDelete={handleDelete} />
              {hasMore && (
                <div ref={loadMoreSentinelRef} className="py-4 text-center">
                  {loadingMore && (
                    <p className="text-sm text-muted-foreground">Loading more spam emails...</p>
                  )}
                </div>
              )}
              {!hasMore && items.length > 0 && (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">All spam emails loaded</p>
                </div>
              )}
              {!hasMore && items.length === 0 && !loading && (
                <div className="py-8 text-center text-muted-foreground">
                  No spam emails yet.
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
