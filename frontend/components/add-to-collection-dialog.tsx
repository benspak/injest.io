'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiClient, Collection } from '@/lib/api';
import { CollectionDialog } from './collection-dialog';

interface AddToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds: string[];
  onSuccess?: () => void;
}

export function AddToCollectionDialog({
  open,
  onOpenChange,
  itemIds,
  onSuccess,
}: AddToCollectionDialogProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [itemCollections, setItemCollections] = useState<Record<string, Collection[]>>({});

  useEffect(() => {
    if (open && itemIds.length > 0) {
      loadCollections();
      loadItemCollections();
    } else {
      setSelectedCollections(new Set());
      setItemCollections({});
    }
  }, [open, itemIds]);

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

  const loadItemCollections = async () => {
    try {
      const collectionsMap: Record<string, Collection[]> = {};
      await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const cols = await apiClient.getItemCollections(itemId);
            collectionsMap[itemId] = cols;
          } catch (error) {
            console.error(`Error loading collections for item ${itemId}:`, error);
            collectionsMap[itemId] = [];
          }
        })
      );
      setItemCollections(collectionsMap);

      // Pre-select collections that all items are already in
      if (itemIds.length > 0) {
        const firstItemCollections = collectionsMap[itemIds[0]] || [];
        const commonCollections = firstItemCollections.filter((col) =>
          itemIds.every((itemId) =>
            (collectionsMap[itemId] || []).some((c) => c.id === col.id)
          )
        );
        setSelectedCollections(new Set(commonCollections.map((c) => c.id)));
      }
    } catch (error) {
      console.error('Error loading item collections:', error);
    }
  };

  const handleToggleCollection = (collectionId: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedCollections.size === 0) {
      toast.error('Please select at least one collection');
      return;
    }

    // Filter out Resend email items (they can't be added to collections)
    const validItemIds = itemIds.filter((itemId) => {
      // Resend emails have IDs starting with "resend-email-"
      return !itemId.startsWith('resend-email-');
    });

    if (validItemIds.length === 0) {
      toast.error('Resend email items cannot be added to collections. Please import them as items first.');
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<void>[] = [];

      // Add items to selected collections
      for (const collectionId of selectedCollections) {
        const itemCollectionsForCollection = validItemIds
          .map((itemId) => itemCollections[itemId] || [])
          .filter((cols) => cols.some((c) => c.id === collectionId));

        // Only add items that aren't already in this collection
        const itemsToAdd = validItemIds.filter((itemId) => {
          const itemCols = itemCollections[itemId] || [];
          return !itemCols.some((c) => c.id === collectionId);
        });

        if (itemsToAdd.length > 0) {
          promises.push(
            apiClient.addItemsToCollection(collectionId, itemsToAdd).then(() => {})
          );
        }
      }

      // Remove items from unselected collections
      for (const collection of collections) {
        if (!selectedCollections.has(collection.id)) {
          const itemsToRemove = validItemIds.filter((itemId) => {
            const itemCols = itemCollections[itemId] || [];
            return itemCols.some((c) => c.id === collection.id);
          });

          for (const itemId of itemsToRemove) {
            promises.push(
              apiClient.removeItemFromCollection(collection.id, itemId).then(() => {})
            );
          }
        }
      }

      await Promise.all(promises);

      const skippedCount = itemIds.length - validItemIds.length;
      toast.success(
        `Updated ${validItemIds.length} item${validItemIds.length !== 1 ? 's' : ''} in ${selectedCollections.size} collection${selectedCollections.size !== 1 ? 's' : ''}${skippedCount > 0 ? ` (${skippedCount} Resend email${skippedCount !== 1 ? 's' : ''} skipped)` : ''}`
      );

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error updating collections:', error);
      toast.error('Failed to update collections');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCollection = async (data: {
    title: string;
    description?: string;
    color?: string;
    icon?: string;
  }) => {
    try {
      const newCollection = await apiClient.createCollection(data);
      toast.success('Collection created');
      setCreateDialogOpen(false);
      await loadCollections();
      // Select the newly created collection
      setSelectedCollections((prev) => new Set([...prev, newCollection.id]));
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Failed to create collection');
    }
  };

  const isItemInCollection = (itemId: string, collectionId: string): boolean => {
    const itemCols = itemCollections[itemId] || [];
    return itemCols.some((c) => c.id === collectionId);
  };

  const getCollectionStatus = (collectionId: string): 'all' | 'some' | 'none' => {
    const inCollection = itemIds.filter((itemId) => isItemInCollection(itemId, collectionId));
    if (inCollection.length === itemIds.length) return 'all';
    if (inCollection.length > 0) return 'some';
    return 'none';
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!saving) {
            onOpenChange(next);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add to Collection{itemIds.length > 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              Select collection{itemIds.length > 1 ? 's' : ''} for {itemIds.length} item
              {itemIds.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading collections...</div>
          ) : (
            <div className="space-y-4">
              {collections.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="mb-4">No collections yet</p>
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    Create Collection
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.map((collection) => {
                    const status = getCollectionStatus(collection.id);
                    const isSelected = selectedCollections.has(collection.id);
                    const collectionColor = collection.color || '#6366f1';
                    const collectionIcon = collection.icon || '📁';

                    return (
                      <div
                        key={collection.id}
                        className="flex items-center gap-3 p-3 rounded-md border hover:bg-gray-50"
                      >
                        <Checkbox
                          id={`collection-${collection.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleCollection(collection.id)}
                          disabled={saving}
                        />
                        <Label
                          htmlFor={`collection-${collection.id}`}
                          className="flex-1 cursor-pointer flex items-center gap-2"
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-white text-xs"
                            style={{ backgroundColor: collectionColor }}
                          >
                            {collectionIcon}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{collection.title}</div>
                            {status === 'some' && (
                              <div className="text-xs text-gray-500">
                                Some items already in this collection
                              </div>
                            )}
                            {status === 'all' && (
                              <div className="text-xs text-gray-500">
                                All items already in this collection
                              </div>
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={() => setCreateDialogOpen(true)}
                variant="outline"
                className="w-full"
                disabled={saving}
              >
                + Create New Collection
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || selectedCollections.size === 0}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CollectionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={handleCreateCollection}
      />
    </>
  );
}
