'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AvatarMenu } from '@/components/avatar-menu';
import { auth } from '@/lib/auth';
import { apiClient, Collection } from '@/lib/api';
import { CollectionDialog } from '@/components/collection-dialog';
import { CollectionCard } from '@/components/collection-card';

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      loadCollections();
    };

    checkAuth();
  }, [router]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCollections();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (data: {
    title: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    try {
      await apiClient.createCollection(data);
      toast.success('Collection created');
      setCreateDialogOpen(false);
      await loadCollections();
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to create collection');
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collection? This will remove all items from it.')) {
      return;
    }

    try {
      await apiClient.deleteCollection(id);
      toast.success('Collection deleted');
      await loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Failed to delete collection');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">Loading...</div>
      </div>
    );
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Collections</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Collection
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
        {collections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No collections yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create a collection to organize your items
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Collection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onDelete={handleDeleteCollection}
              />
            ))}
          </div>
        )}
      </main>

      <CollectionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={handleCreateCollection}
      />
    </div>
  );
}
