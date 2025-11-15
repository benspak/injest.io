'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Edit2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AvatarMenu } from '@/components/avatar-menu';
import { ItemList } from '@/components/item-list';
import { auth } from '@/lib/auth';
import { apiClient, Collection, Item } from '@/lib/api';
import { CollectionDialog } from '@/components/collection-dialog';

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 50;

  useEffect(() => {
    const checkAuth = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      if (params?.id) {
        await loadCollection();
        await loadItems(0, true);
      }
    };

    checkAuth();
  }, [params?.id, router]);

  const loadCollection = async () => {
    try {
      if (!params?.id || typeof params.id !== 'string') {
        return;
      }
      const data = await apiClient.getCollection(params.id);
      setCollection(data);
    } catch (error) {
      console.error('Error loading collection:', error);
      toast.error('Failed to load collection');
      router.push('/collections');
    }
  };

  const loadItems = useCallback(async (currentOffset: number = 0, reset: boolean = false) => {
    if (!params?.id || typeof params.id !== 'string') {
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

      const itemsData = await apiClient.getCollectionItems(
        params.id,
        BATCH_SIZE,
        currentOffset
      );

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
  }, [params?.id]);

  const handleUpdateCollection = async (data: {
    title: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    if (!collection) return;

    try {
      const updated = await apiClient.updateCollection(collection.id, data);
      setCollection(updated);
      toast.success('Collection updated');
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating collection:', error);
      toast.error('Failed to update collection');
    }
  };

  const handleDeleteCollection = async () => {
    if (!collection) return;

    if (!confirm('Are you sure you want to delete this collection? This will remove all items from it.')) {
      return;
    }

    try {
      await apiClient.deleteCollection(collection.id);
      toast.success('Collection deleted');
      router.push('/collections');
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!collection) return;

    try {
      await apiClient.removeItemFromCollection(collection.id, itemId);
      toast.success('Item removed from collection');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      // Update item count
      if (collection.item_count !== undefined) {
        setCollection({
          ...collection,
          item_count: Math.max(0, (collection.item_count || 0) - 1),
        });
      }
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item from collection');
    }
  };

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
        rootMargin: '200px', // Start loading 200px before reaching the sentinel
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
    };
  }, [hasMore, loadMoreItems, loading, loadingMore]);

  if (authLoading || (loading && !collection)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">Loading...</div>
      </div>
    );
  }

  if (!collection) {
    return null;
  }

  const currentUser = auth.getUser();
  const collectionColor = collection.color || '#6366f1';
  const collectionIcon = collection.icon || 'folder';

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex items-center gap-3">
            <Link href="/collections">
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
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              onClick={() => setEditDialogOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              onClick={handleDeleteCollection}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm text-red-600 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
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
                {collection.item_count ?? 0} item{(collection.item_count ?? 0) !== 1 ? 's' : ''}
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
                <ItemList
                  items={items}
                  onDelete={(itemId) => handleRemoveItem(itemId)}
                />
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

      <CollectionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleUpdateCollection}
        collection={collection}
      />
    </div>
  );
}
