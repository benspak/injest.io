'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemList } from '@/components/item-list';
import { apiClient, Collection, Item } from '@/lib/api';

export default function PublicCollectionPage() {
  const params = useParams<{ token: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 50;

  useEffect(() => {
    if (params?.token) {
      loadCollection();
    }
  }, [params?.token]);

  const loadCollection = async () => {
    if (!params?.token || typeof params.token !== 'string') {
      return;
    }

    try {
      setLoading(true);
      const collectionData = await apiClient.getPublicCollectionByToken(params.token);
      setCollection(collectionData);

      // Load initial items if provided
      if (collectionData.items && Array.isArray(collectionData.items)) {
        setItems(collectionData.items);
        setHasMore(collectionData.items.length === BATCH_SIZE);
        setOffset(collectionData.items.length);
      } else {
        setItems([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
      toast.error('Collection not found or not publicly shareable');
      setCollection(null);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = useCallback(async (currentOffset: number = 0, reset: boolean = false) => {
    if (!collection || !params?.token) {
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        setItems([]);
        setOffset(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      // Fetch more items using the public endpoint with pagination
      const response = await apiClient.getPublicCollectionByToken(
        params.token,
        BATCH_SIZE,
        currentOffset
      );

      const itemsData = response.items || [];
      const hasMoreItems = itemsData.length === BATCH_SIZE;

      if (reset) {
        setItems(itemsData);
        setHasMore(hasMoreItems);
        setOffset(BATCH_SIZE);
      } else {
        setItems((prev) => [...prev, ...itemsData]);
        setHasMore(hasMoreItems);
        setOffset((prev) => prev + BATCH_SIZE);
      }
    } catch (error) {
      console.error('Error loading collection items:', error);
      toast.error('Failed to load items');
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [collection, params?.token]);

  const loadMoreItems = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      loadItems(offset, false);
    }
  }, [loadingMore, hasMore, loading, offset, loadItems]);

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
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
    };
  }, [hasMore, loadMoreItems, loading, loadingMore]);

  if (loading && !collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">Loading...</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-600">Collection not found or not publicly shareable.</p>
              <Link href="/">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const collectionColor = collection.color || '#6366f1';
  const collectionIcon = collection.icon || 'folder';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: collectionColor }}
              >
                {collectionIcon}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{collection.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Globe className="h-4 w-4" />
              <span>Public Collection</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Collection Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {collection.description && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{collection.description}</p>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                {collection.item_count ?? items.length} item{(collection.item_count ?? items.length) !== 1 ? 's' : ''}
              </span>
              <span>•</span>
              <span>Created {new Date(collection.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Items</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Loading items…</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No items in this collection yet
              </div>
            ) : (
              <>
                <ItemList items={items} onDelete={undefined} />
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
