'use client';

import { MouseEvent, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { apiClient, Item, LinkMetadata } from '@/lib/api';
import { Share2, FolderPlus } from 'lucide-react';
import { ShareItemDialog } from '@/components/share-item-dialog';
import { AddToCollectionDialog } from '@/components/add-to-collection-dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface ItemListProps {
  items: Item[];
  onDelete?: (itemId: string) => void;
}

type Attachment = NonNullable<Item['attachments']>[number];

export function ItemList({ items, onDelete }: ItemListProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemDetails, setItemDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkMetadata, setLinkMetadata] = useState<Record<string, LinkMetadata>>({});
  const [loadingMetadata, setLoadingMetadata] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingItem, setEditingItem] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [emailSummary, setEmailSummary] = useState<string[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [emailBodyExpanded, setEmailBodyExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    itemId: string;
    resendEmailId?: string;
    file: Attachment;
    previewSrc: string | null;
  } | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title?: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [addToCollectionDialogOpen, setAddToCollectionDialogOpen] = useState(false);
  const [itemCollections, setItemCollections] = useState<Record<string, string[]>>({});
  const [spamUpdatingItemId, setSpamUpdatingItemId] = useState<string | null>(null);

  // Helper to get display title/description (supports both new unified and old structure)
  const getItemDisplay = (item: Item) => {
    // Use unified fields first (new structure)
    if (item.title || item.description) {
      return {
        title: item.title || '',
        description: item.description || '',
      };
    }

    // Fallback to parsing raw for backward compatibility (old items)
    if (item.raw) {
      try {
        const parsed = JSON.parse(item.raw);
        return {
          title: parsed.title || parsed.subject || '',
          description: parsed.description || parsed.body || parsed.text || item.raw.substring(0, 200),
        };
      } catch {
        return {
          title: '',
          description: item.raw.substring(0, 200),
        };
      }
    }

    return { title: '', description: '' };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  };

  const fetchLinkMetadata = async (itemId: string, url: string) => {
    // Don't fetch if already loaded or currently loading
    if (linkMetadata[itemId] || loadingMetadata.has(itemId)) {
      return;
    }

    setLoadingMetadata((prev) => new Set(prev).add(itemId));
    try {
      // This endpoint will return saved metadata if it exists, or fetch and save it if not
      const metadata = await apiClient.getItemMetadata(itemId);
      setLinkMetadata((prev) => ({
        ...prev,
        [itemId]: metadata,
      }));
    } catch (error) {
      console.error('Error fetching link metadata:', error);
      // Set basic metadata on error
      setLinkMetadata((prev) => ({
        ...prev,
        [itemId]: { url, title: url },
      }));
    } finally {
      setLoadingMetadata((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDownloadFile = async (itemId: string, file: Attachment, resendEmailId?: string) => {
    try {
      const attachmentId = file.attachmentId || file.id;

      if (apiClient.isRemoteAttachment(file)) {
        if (resendEmailId && attachmentId) {
          await apiClient.downloadEmailAttachment(resendEmailId, attachmentId);
          return;
        }

        if (file.url) {
          window.open(file.url, '_blank', 'noopener,noreferrer');
          return;
        }

        throw new Error('Remote attachment is missing download metadata');
      }

      await apiClient.downloadFile(itemId, file.filename);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(`Failed to download ${file.originalname}. Please try again.`);
    }
  };

  const handleItemClick = async (item: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
    setLoadingDetails(true);
    setEditingNotes(false);
    setEditingItem(false);
    setEmailBodyExpanded(false);
    setDescriptionExpanded(false);

    try {
      // If this is a Resend email, fetch full email details
      if (item.isResendEmail && item.resendEmailId) {
        const emailDetails = await apiClient.getReceivedEmail(item.resendEmailId);
        // Transform email to item-like format, including attachments so images can render
        const emailAsItem = {
          ...item,
          title: emailDetails.subject,
          description: emailDetails.text || emailDetails.html || '',
          html: emailDetails.html,
          text: emailDetails.text,
          from: emailDetails.from,
          to: emailDetails.to,
          cc: emailDetails.cc,
          bcc: emailDetails.bcc,
          reply_to: emailDetails.reply_to,
          message_id: emailDetails.message_id,
          headers: emailDetails.headers,
          attachments: emailDetails.attachments
            ? emailDetails.attachments.map((att) => ({
                filename: att.filename,
                originalname: att.filename,
                mimetype: att.content_type,
                size: att.size,
                attachmentId: att.id,
                url: att.download_url,
                id: att.id,
                // Preserve content_id from Resend so we can rewrite cid: URLs in HTML
                contentId: att.content_id ? att.content_id.replace(/[<>]/g, '') : undefined,
              }))
            : undefined,
        };
        setItemDetails(emailAsItem);
        setNotesValue('');
        setEditTitle(emailDetails.subject);
        setEditDescription(emailDetails.text || emailDetails.html || '');

        // Fetch email summary
        setLoadingSummary(true);
        try {
          const summaryResponse = await apiClient.generateEmailSummary(item.resendEmailId);
          setEmailSummary(summaryResponse.summary || []);
        } catch (error) {
          console.error('Error fetching email summary:', error);
          setEmailSummary([]);
        } finally {
          setLoadingSummary(false);
        }
      } else {
        // Regular item
        const details = await apiClient.getItem(item.id);
        setItemDetails(details);
        setNotesValue(details.notes || '');

        // Set edit fields
        const display = getItemDisplay(details);
        setEditTitle(details.title || display.title || '');
        setEditDescription(details.description || display.description || '');

        // Check if this is an email item stored in database
        if (details.type === 'email') {
          // Extract HTML and text from raw field for database-stored emails
          if (details.raw) {
            try {
              const rawData = JSON.parse(details.raw);
              if (rawData.body || rawData.html || rawData.text) {
                // Add HTML and text to itemDetails for proper display
                (details as any).html = rawData.html || rawData.body || '';
                (details as any).text = rawData.text || rawData.body || '';
              }
            } catch {
              // Ignore parsing errors
            }
          }

          // Check for summary in clean field
          if (details.clean) {
            try {
              const parsedSummary = JSON.parse(details.clean);
              if (Array.isArray(parsedSummary) && parsedSummary.length > 0) {
                setEmailSummary(parsedSummary);
              }
            } catch {
              // If clean field isn't valid JSON, try to fetch summary from API
              // Find resend_email_id from raw field
              try {
                if (details.raw) {
                  const rawData = JSON.parse(details.raw);
                  if (rawData.resend_email_id) {
                    setLoadingSummary(true);
                    try {
                      const summaryResponse = await apiClient.generateEmailSummary(rawData.resend_email_id);
                      setEmailSummary(summaryResponse.summary || []);
                    } catch (error) {
                      console.error('Error fetching email summary:', error);
                      setEmailSummary([]);
                    } finally {
                      setLoadingSummary(false);
                    }
                  }
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }

        // Use saved metadata from details, or fetch if missing
        if (details.url) {
          if (details.link_metadata) {
            // Use saved metadata
            setLinkMetadata((prev) => ({
              ...prev,
              [details.id]: details.link_metadata as LinkMetadata,
            }));
          } else {
            // Fetch metadata if not saved (will also save it)
            fetchLinkMetadata(details.id, details.url);
          }
        }
      }
    } catch (error) {
      console.error('Error loading item details:', error);
      // If API fails, use the item data we already have
      setItemDetails(item);
      setNotesValue(item.notes || '');
      const display = getItemDisplay(item);
      setEditTitle(item.title || display.title || '');
      setEditDescription(item.description || display.description || '');
      // Use saved metadata from item if available
      if (item.link_metadata) {
        const metadata = item.link_metadata;
        setLinkMetadata((prev) => ({
          ...prev,
          [item.id]: metadata,
        }));
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    // Only close when explicitly set to false (clicking overlay or close button)
    // Radix UI prevents closing when clicking inside DialogContent by default
    if (open === false) {
      setDialogOpen(false);
      setSelectedItem(null);
      setItemDetails(null);
      setEditingNotes(false);
      setEditingItem(false);
      setNotesValue('');
      setEditTitle('');
      setEditDescription('');
      setEmailSummary([]);
      setEmailBodyExpanded(false);
      setDescriptionExpanded(false);
      setImageDialogOpen(false);
      setSelectedImage(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedItem || !itemDetails) return;

    // Resend emails can't have notes (they're not in the database)
    if (itemDetails.isResendEmail) {
      alert('Notes are not available for emails from Resend. Import the email as an item to add notes.');
      return;
    }

    setSavingNotes(true);
    try {
      const updatedItem = await apiClient.updateItemNotes(itemDetails.id, notesValue);
      setItemDetails(updatedItem);
      setEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes. Please try again.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveItem = async () => {
    if (!selectedItem || !itemDetails) return;

    // Resend emails can't be edited (they're not in the database)
    if (itemDetails.isResendEmail) {
      alert('Resend emails cannot be edited. Import the email as an item to edit it.');
      return;
    }

    setSavingItem(true);
    try {
      const updates: { title?: string; description?: string } = {};

      // Update title and description for all items
      updates.title = editTitle;
      updates.description = editDescription;

      const updatedItem = await apiClient.updateItem(itemDetails.id, updates);
      setItemDetails(updatedItem);

      setEditingItem(false);

      // Refresh the item list - trigger parent refresh if callback available
      // The parent component should handle refreshing the list
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item. Please try again.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleToggleSpam = async (item: Item) => {
    if (!item || item.isResendEmail || item.type !== 'email') {
      return;
    }

    setSpamUpdatingItemId(item.id);
    try {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const isSpam = tags.includes('spam');
      const updated = isSpam
        ? await apiClient.unmarkItemAsSpam(item.id)
        : await apiClient.markItemAsSpam(item.id);

      // Update selected item/details state if they match
      setItemDetails((current: any) => {
        if (!current || current.id !== updated.id) {
          return current;
        }
        return { ...current, tags: updated.tags };
      });
      setSelectedItem((current) => {
        if (!current || current.id !== updated.id) {
          return current;
        }
        return { ...current, tags: updated.tags };
      });
    } catch (error) {
      console.error('Error toggling spam status:', error);
      toast.error('Failed to update spam status.');
    } finally {
      setSpamUpdatingItemId(null);
    }
  };

  const handleImageAttachmentClick = (
    event: MouseEvent<HTMLImageElement>,
    file: Attachment,
    itemId: string,
    resendEmailId?: string
  ) => {
    event.stopPropagation();
    const previewSrc = apiClient.getAttachmentPreviewUrl(itemId, file, true);
    const resolvedAttachmentId = file.attachmentId ?? file.id;
    const attachmentForState = resolvedAttachmentId
      ? ({ ...file, attachmentId: resolvedAttachmentId } as Attachment)
      : file;

    setSelectedImage({
      itemId,
      resendEmailId,
      file: attachmentForState,
      previewSrc,
    });
    setImageDialogOpen(true);
  };

  const openShareDialog = (item: Item, titleOverride?: string) => {
    const display = getItemDisplay(item);
    const shareTitle =
      titleOverride ||
      (item.link_metadata && (item.link_metadata as LinkMetadata | undefined)?.title) ||
      display.title ||
      item.title ||
      'Untitled item';

    setShareTarget({ id: item.id, title: shareTitle });
    setShareDialogOpen(true);
  };




  const renderItemContent = (item: Item, fullDetails = false) => {
    const display = getItemDisplay(item);

    if (fullDetails) {
      // Show full content
      return (
        <div className="space-y-4">
          {item.title && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Title</h4>
              <p className="text-sm">{item.title}</p>
            </div>
          )}
          {item.description && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{item.description}</p>
            </div>
          )}
          {item.url && (
            <div>
              <h4 className="text-sm font-semibold mb-2">URL</h4>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-blue-600 hover:underline break-all"
              >
                {item.url}
              </a>
            </div>
          )}
          {item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Attachments</h4>
              <div className="space-y-2">
                {item.attachments.map((file: Attachment, idx: number) => {
                  const isImage = apiClient.isImageMimetype(file.mimetype);
                  const targetItem = itemDetails || item;
                  const previewUrl =
                    isImage && targetItem
                      ? apiClient.getAttachmentPreviewUrl(targetItem.id, file, true)
                      : null;

                  return (
                    <div
                      key={idx}
                      className={`${isImage ? 'space-y-2' : 'flex items-center justify-between'} p-2 bg-gray-50 border rounded-md`}
                    >
                      {isImage && previewUrl ? (
                        <>
                          <img
                            src={previewUrl}
                            alt={file.originalname}
                            className="w-full max-w-md h-auto rounded-md object-contain max-h-64"
                            onError={(e) => {
                              // Fallback to download button if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.image-fallback');
                                if (fallback) {
                                  (fallback as HTMLElement).style.display = 'flex';
                                }
                              }
                            }}
                          />
                          <div className="image-fallback hidden flex items-center justify-between w-full">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{file.originalname}</p>
                              {typeof file.size === 'number' && (
                                <p className="text-xs text-muted-foreground">
                                  {Math.round(file.size / 1024)} KB
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                const downloadItem = itemDetails || item;
                                handleDownloadFile(downloadItem.id, file, downloadItem.resendEmailId);
                              }}
                            >
                              Download
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{file.originalname}</p>
                            {typeof file.size === 'number' && (
                              <p className="text-xs text-muted-foreground">
                                {Math.round(file.size / 1024)} KB
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              const downloadItem = itemDetails || item;
                              handleDownloadFile(
                                downloadItem.id,
                                file,
                                (downloadItem as Item | undefined)?.resendEmailId ??
                                  (downloadItem as any)?.resendEmailId
                              );
                            }}
                          >
                            Download
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Truncated preview - for email items, show first 200 characters
    const isEmail = item.type === 'email' || item.isResendEmail;
    if (isEmail && display.description && display.description.length > 200) {
      return (
        <p className="text-sm text-muted-foreground">
          {display.description.substring(0, 200)}...
        </p>
      );
    }

    return (
      <p className={`text-sm text-muted-foreground ${fullDetails ? '' : 'line-clamp-3'}`}>
        {display.description}
      </p>
    );
  };

  const handleToggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedItems(new Set());
  };

  const handleToggleItemSelection = (itemId: string, event?: MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    // Only select items that can be added to collections (exclude Resend emails)
    const selectableItems = items.filter((item) => !item.isResendEmail);
    const selectableItemIds = selectableItems.map((item) => item.id);
    const allSelected = selectableItemIds.every((id) => selectedItems.has(id));

    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(selectableItemIds));
    }
  };

  const handleAddToCollection = () => {
    setAddToCollectionDialogOpen(true);
  };

  const handleCollectionSuccess = () => {
    // Refresh item collections
    items.forEach((item) => {
      if (!item.isResendEmail) {
        apiClient.getItemCollections(item.id).then((collections) => {
          setItemCollections((prev) => ({
            ...prev,
            [item.id]: collections.map((c) => c.id),
          }));
        }).catch(() => {});
      }
    });
    setSelectedItems(new Set());
  };

  // Load collections for items on mount
  useEffect(() => {
    items.forEach((item) => {
      if (!item.isResendEmail && !itemCollections[item.id]) {
        apiClient.getItemCollections(item.id).then((collections) => {
          setItemCollections((prev) => ({
            ...prev,
            [item.id]: collections.map((c) => c.id),
          }));
        }).catch(() => {});
      }
    });
  }, [items]);

  return (
    <>
      {bulkMode && items.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={
                (() => {
                  const selectableItems = items.filter((item) => !item.isResendEmail);
                  return selectableItems.length > 0 && selectableItems.every((item) => selectedItems.has(item.id));
                })()
              }
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-700">
              {selectedItems.size} of {items.filter((item) => !item.isResendEmail).length} selected
              {items.some((item) => item.isResendEmail) && (
                <span className="text-xs text-gray-500 ml-1">
                  ({items.filter((item) => item.isResendEmail).length} Resend email{items.filter((item) => item.isResendEmail).length !== 1 ? 's' : ''} excluded)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleAddToCollection}
              disabled={selectedItems.size === 0}
              size="sm"
              variant="outline"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Add to Collection
            </Button>
            <Button onClick={handleToggleBulkMode} size="sm" variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!bulkMode && items.length > 0 && (
        <div className="px-4 py-2 flex justify-end border-b">
          <Button onClick={handleToggleBulkMode} size="sm" variant="outline">
            Select Items
          </Button>
        </div>
      )}

      <div className="space-y-0">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No items yet</p>
        ) : (
          items.map((item) => {
            const display = getItemDisplay(item);
            // Use saved metadata from item first, then check local state
            const itemMetadata = item.link_metadata || linkMetadata[item.id];
            const hasUrl = !!item.url;

            // Only fetch metadata if URL exists and metadata isn't already loaded
            if (hasUrl && item.url && !item.link_metadata && !itemMetadata && !loadingMetadata.has(item.id)) {
              fetchLinkMetadata(item.id, item.url);
            }

            // Get title for display
            const itemTitle = itemMetadata?.title || display.title || item.title || 'Untitled';

            // Get description preview
            const descriptionPreview = itemMetadata?.description || display.description || '';
            const truncatedDescription = descriptionPreview.length > 150
              ? descriptionPreview.substring(0, 150) + '...'
              : descriptionPreview;

            // Format date for compact display
            const date = new Date(item.created_at);
            const timeAgo = formatRelativeTime(date);

            // Get image for preview - prioritize metadata image, then first image attachment
            let previewImage: string | null = null;
            let previewImageAlt = '';

            if (itemMetadata?.image) {
              previewImage = itemMetadata.image;
              previewImageAlt = itemMetadata.title || 'Preview';
            } else if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
              const imageAttachments = item.attachments.filter((file: any) =>
                apiClient.isImageMimetype(file.mimetype)
              );
              if (imageAttachments.length > 0) {
                const firstImage = imageAttachments[0];
                previewImage = apiClient.getAttachmentPreviewUrl(item.id, firstImage, true);
                previewImageAlt = firstImage.originalname || 'Attachment';
              }
            }

            const itemCollectionIds = itemCollections[item.id] || [];
            const isSelected = selectedItems.has(item.id);
            const canAddToCollection = !item.isResendEmail;
            const isSpam = Array.isArray(item.tags) && item.tags.includes('spam');

            return (
              <div
                key={item.id}
                className={`border-b border-gray-200 hover:bg-gray-50 transition-colors px-4 py-3 group ${
                  bulkMode && !canAddToCollection ? 'opacity-50' : ''
                } ${bulkMode ? '' : 'cursor-pointer'} ${isSelected ? 'bg-blue-50' : ''}`}
                onClick={(e) => {
                  if (bulkMode && canAddToCollection) {
                    handleToggleItemSelection(item.id, e);
                  } else if (!bulkMode) {
                    handleItemClick(item);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  {bulkMode && (
                    <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                      {canAddToCollection ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleItemSelection(item.id)}
                        />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center text-gray-400" title="Resend emails cannot be added to collections">
                          <span className="text-xs">—</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Left side - image preview */}
                  {previewImage && (
                    <div className="flex-shrink-0 w-32 h-32 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      <img
                        src={previewImage}
                        alt={previewImageAlt}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Right side - main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate flex-1 flex items-center gap-2">
                        <span className="truncate">{itemTitle}</span>
                        {isSpam && (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 border border-red-100">
                            Spam
                          </span>
                        )}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          openShareDialog(item, itemMetadata?.title);
                        }}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="Share item"
                        aria-label="Share item"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Description preview */}
                    {truncatedDescription && (
                      <p className="text-xs text-gray-600 line-clamp-1 mb-1.5">
                        {truncatedDescription}
                      </p>
                    )}

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      <span className="whitespace-nowrap">{timeAgo}</span>
                      {item.type && (
                        <>
                          <span>•</span>
                          <span className="whitespace-nowrap capitalize">{item.type}</span>
                        </>
                      )}
                      {item.isResendEmail && (
                        <>
                          <span>•</span>
                          <span className="whitespace-nowrap">Resend</span>
                        </>
                      )}
                      {item.source && (
                        <>
                          <span>•</span>
                          <span className="whitespace-nowrap truncate max-w-[200px]">{item.source}</span>
                        </>
                      )}
                      {item.attachments && item.attachments.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="whitespace-nowrap">
                            {item.attachments.length} attachment{item.attachments.length !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                      {hasUrl && item.url && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px] text-blue-600">
                            {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </span>
                        </>
                      )}
                      {itemCollectionIds.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="whitespace-nowrap text-blue-600">
                            {itemCollectionIds.length} collection{itemCollectionIds.length !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddToCollectionDialog
        open={addToCollectionDialogOpen}
        onOpenChange={setAddToCollectionDialogOpen}
        itemIds={Array.from(selectedItems)}
        onSuccess={handleCollectionSuccess}
      />

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto overflow-x-hidden w-[calc(100vw-2rem)] sm:w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl left-4 right-4 sm:left-[50%] sm:right-auto translate-x-0 sm:translate-x-[-50%] top-4 sm:top-[50%] translate-y-0 sm:translate-y-[-50%] p-4 sm:p-6">
          <DialogHeader>
            <div className="overflow-hidden">
              <DialogTitle className="pr-8 break-words">
                {loadingDetails
                  ? 'Loading...'
                  : selectedItem && itemDetails
                    ? getItemDisplay(itemDetails).title || itemDetails.title || 'Item Details'
                    : 'Item Details'}
              </DialogTitle>
              <DialogDescription className="break-words">
                {loadingDetails
                  ? 'Please wait while we load the item details.'
                  : selectedItem && itemDetails
                    ? `${formatDate(itemDetails.created_at)}${itemDetails.type ? ` • ${itemDetails.type}` : ''}${itemDetails.source ? ` • ${itemDetails.source}` : ''}`
                    : ''}
              </DialogDescription>
            </div>
          </DialogHeader>
          {loadingDetails ? (
            <div className="py-8 text-center">Loading item details...</div>
          ) : selectedItem && itemDetails ? (
            <>

              <div className="space-y-4 mt-4 overflow-x-hidden">
                {/* Show URL metadata in dialog if available */}
                {itemDetails.url && (itemDetails.link_metadata || linkMetadata[itemDetails.id]) && (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    {(() => {
                      const metadata = itemDetails.link_metadata || linkMetadata[itemDetails.id];
                      const display = getItemDisplay(itemDetails);
                      return (
                        <>
                          {metadata?.image && (
                            <div className="w-full bg-gray-100 overflow-hidden" style={{ maxHeight: '120px' }}>
                              <img
                                src={metadata.image}
                                alt={metadata.title || 'Link preview'}
                                className="w-full h-auto max-h-[120px] object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  // Hide parent container if image fails
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.style.display = 'none';
                                  }
                                }}
                                onLoad={(e) => {
                                  // Ensure image is visible when loaded successfully
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'block';
                                }}
                              />
                            </div>
                          )}
                          <div className="p-4">
                            {metadata?.title && !display.title && (
                              <h4 className="text-base font-semibold mb-2">{metadata.title}</h4>
                            )}
                            {metadata?.description && (
                              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                                {metadata.description}
                              </p>
                            )}
                            <a
                              href={metadata?.url || itemDetails.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-words overflow-wrap-anywhere flex items-center gap-2 group"
                            >
                              <svg
                                className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                />
                              </svg>
                              {metadata?.url || itemDetails.url}
                            </a>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Edit mode */}
                {editingItem ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold mb-1 block">Title</label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Enter title..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1 block">Description</label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Enter description..."
                        className="min-h-[150px]"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1 block">URL</label>
                      <Input
                        type="url"
                        value={itemDetails.url || ''}
                        onChange={(e) => {
                          // URL editing would need to be handled in handleSaveItem
                        }}
                        placeholder="Enter URL..."
                        disabled
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">URL editing coming soon</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveItem}
                        disabled={savingItem}
                      >
                        {savingItem ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingItem(false);
                          const display = getItemDisplay(itemDetails);
                          setEditTitle(itemDetails.title || display.title || '');
                          setEditDescription(itemDetails.description || display.description || '');
                        }}
                        disabled={savingItem}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Regular content - only show if not URL with metadata or if additional content exists */
                  <>
                    {/* Attachments */}
                    {itemDetails.attachments && Array.isArray(itemDetails.attachments) && itemDetails.attachments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Attachments</h4>
                        <div className="space-y-2">
                          {itemDetails.attachments.map((file: Attachment, idx: number) => {
                            const isImage = apiClient.isImageMimetype(file.mimetype);
                            return (
                              <div
                                key={idx}
                                className={`${isImage ? 'space-y-2' : 'flex items-center justify-between'} p-2 bg-gray-50 border rounded-md`}
                              >
                                {isImage ? (
                                  <>
                                    {(() => {
                                      const previewUrl = apiClient.getAttachmentPreviewUrl(itemDetails.id, file, true);
                                      return previewUrl ? (
                                        <img
                                          src={previewUrl}
                                          alt={file.originalname}
                                          className="w-full max-w-2xl h-auto rounded-md object-contain max-h-96 cursor-zoom-in"
                                          onError={(e) => {
                                            // Fallback to download button if image fails to load
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const parent = target.parentElement;
                                            if (parent) {
                                              const fallback = parent.querySelector('.image-fallback');
                                              if (fallback) {
                                                (fallback as HTMLElement).style.display = 'flex';
                                              }
                                            }
                                          }}
                                          onClick={(e) =>
                                            handleImageAttachmentClick(e, file, itemDetails.id, itemDetails.resendEmailId)
                                          }
                                        />
                                      ) : null;
                                    })()}
                                    <div className="image-fallback hidden flex items-center justify-between w-full">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{file.originalname}</p>
                                        {typeof file.size === 'number' && (
                                          <p className="text-xs text-muted-foreground">
                                            {Math.round(file.size / 1024)} KB
                                          </p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadFile(itemDetails.id, file, itemDetails.resendEmailId);
                                        }}
                                      >
                                        Download
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{file.originalname}</p>
                                      {typeof file.size === 'number' && (
                                        <p className="text-xs text-muted-foreground">
                                          {Math.round(file.size / 1024)} KB
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFile(itemDetails.id, file, itemDetails.resendEmailId);
                                      }}
                                    >
                                      Download
                                    </Button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Only show description if not already shown in metadata or if it's different */}
                    {(() => {
                      const display = getItemDisplay(itemDetails);
                      const hasMetadata = itemDetails.url && (itemDetails.link_metadata || linkMetadata[itemDetails.id]);
                      const metadata = itemDetails.link_metadata || linkMetadata[itemDetails.id];
                      const descriptionDifferent = display.description && metadata?.description !== display.description;

                      // Show description if no metadata OR if descriptions are different
                      if (!hasMetadata || descriptionDifferent) {
                        // Get the full email body - prioritize html/text from itemDetails, fallback to display.description
                        const fullBody = (itemDetails as any).html || (itemDetails as any).text || display.description;
                        if (fullBody) {
                          const isEmail = itemDetails.type === 'email' || itemDetails.isResendEmail;
                          const fullHtml = (itemDetails as any).html;
                          const fullText = (itemDetails as any).text || (fullHtml ? fullHtml.replace(/<[^>]*>/g, '') : fullBody);
                          const hasHtml = !!fullHtml;

                          // For HTML emails, strip tags to get length
                          const plainText = hasHtml ? fullHtml.replace(/<[^>]*>/g, '') : fullText;
                          const shouldTruncate = isEmail && plainText.length > 200;
                          const truncatedText = shouldTruncate && !emailBodyExpanded
                            ? plainText.substring(0, 200)
                            : plainText;

                          // For emails with HTML
                          if (hasHtml) {
                            // Rewrite cid: image sources to our attachment proxy URLs when rendering
                            const rewrittenHtml = (() => {
                              try {
                                const attachments = (itemDetails as any).attachments as Attachment[] | undefined;
                                if (!attachments || attachments.length === 0) {
                                  return fullHtml;
                                }

                                const cidToUrl = new Map<string, string>();
                                for (const att of attachments) {
                                  const cid = (att as any).contentId as string | undefined;
                                  if (!cid) continue;
                                  const previewUrl = apiClient.getAttachmentPreviewUrl(
                                    (itemDetails as any).id,
                                    att,
                                    true
                                  );
                                  if (previewUrl) {
                                    cidToUrl.set(cid, previewUrl);
                                  }
                                }

                                if (cidToUrl.size === 0) {
                                  return fullHtml;
                                }

                                // Replace src="cid:..."/src='cid:...' with resolved URLs when we have a match
                                return fullHtml.replace(
                                  /src=["']cid:([^"']+)["']/gi,
                                  (match: string, cidValue: string) => {
                                    const normalizedCid = cidValue.replace(/[<>]/g, '');
                                    const url = cidToUrl.get(normalizedCid);
                                    if (!url) {
                                      return match;
                                    }
                                    return `src="${url}" data-original-cid="${normalizedCid}"`;
                                  }
                                );
                              } catch {
                                return fullHtml;
                              }
                            })();

                            return (
                              <div>
                                {emailBodyExpanded ? (
                                  // Show full HTML when expanded
                                  <div
                                    className="text-sm prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: rewrittenHtml }}
                                  />
                                ) : (
                                  // Show truncated plain text when collapsed
                                  <p className="text-sm whitespace-pre-wrap">{truncatedText}</p>
                                )}
                                {shouldTruncate && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEmailBodyExpanded(!emailBodyExpanded);
                                    }}
                                    className="text-sm text-blue-600 hover:underline mt-2"
                                  >
                                    {emailBodyExpanded ? 'Show less' : 'View all'}
                                  </button>
                                )}
                              </div>
                            );
                          } else if (isEmail) {
                            // For plain text emails
                            return (
                              <div>
                                <p className="text-sm whitespace-pre-wrap">{truncatedText}</p>
                                {shouldTruncate && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEmailBodyExpanded(!emailBodyExpanded);
                                    }}
                                    className="text-sm text-blue-600 hover:underline mt-2"
                                  >
                                    {emailBodyExpanded ? 'Show less' : 'View all'}
                                  </button>
                                )}
                              </div>
                            );
                          } else {
                            // For non-email items, check if description is longer than 250 characters
                            const description = display.description || fullBody;
                            const shouldTruncateDescription = description && description.length > 250;
                            const truncatedDescription = shouldTruncateDescription && !descriptionExpanded
                              ? description.substring(0, 250)
                              : description;

                            return (
                              <div>
                                <p className="text-sm whitespace-pre-wrap">{truncatedDescription}</p>
                                {shouldTruncateDescription && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDescriptionExpanded(!descriptionExpanded);
                                    }}
                                    className="text-sm text-blue-600 hover:underline mt-2"
                                  >
                                    {descriptionExpanded ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            );
                          }
                        }
                      }
                      return null;
                    })()}

                    {/* Show URL without metadata */}
                    {itemDetails.url && !itemDetails.link_metadata && !linkMetadata[itemDetails.id] && (
                      <div>
                        <a
                          href={itemDetails.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline break-words overflow-wrap-anywhere"
                        >
                          {itemDetails.url}
                        </a>
                      </div>
                    )}

                {/* Email-specific information */}
                {itemDetails.isResendEmail && (
                      <div className="space-y-2 border-t pt-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Email Details</h4>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="font-medium">From:</span> {itemDetails.from}
                            </div>
                            <div>
                              <span className="font-medium">To:</span> {Array.isArray(itemDetails.to) ? itemDetails.to.join(', ') : itemDetails.to}
                            </div>
                            {itemDetails.cc && itemDetails.cc.length > 0 && (
                              <div>
                                <span className="font-medium">CC:</span> {itemDetails.cc.join(', ')}
                              </div>
                            )}
                            {itemDetails.bcc && itemDetails.bcc.length > 0 && (
                              <div>
                                <span className="font-medium">BCC:</span> {itemDetails.bcc.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                {/* Email Summary */}
                    {((itemDetails.isResendEmail || itemDetails.type === 'email') && (emailSummary.length > 0 || loadingSummary)) && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-2">Summary</h4>
                        {loadingSummary ? (
                          <div className="text-sm text-muted-foreground">Generating summary...</div>
                        ) : emailSummary.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {emailSummary.map((bullet, idx) => (
                              <li key={idx} className="text-muted-foreground">{bullet}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}
                  </>
                )}

                {/* Notes section (available for all items, not just URLs) - not for Resend emails */}
                {!editingItem && !itemDetails.isResendEmail && itemDetails.notes !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold">Notes</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingNotes(true)}
                      >
                        {itemDetails.notes ? 'Edit Notes' : 'Add Notes'}
                      </Button>
                    </div>
                    {editingNotes ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add your notes about this link..."
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                          >
                            {savingNotes ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingNotes(false);
                              setNotesValue(itemDetails.notes || '');
                            }}
                            disabled={savingNotes}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-3 rounded-md">
                        {itemDetails.notes ? (
                          <p className="text-sm whitespace-pre-wrap">{itemDetails.notes}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No notes added yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}



                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => openShareDialog(itemDetails)}
                  >
                    Share
                  </Button>
                  {!editingItem && !itemDetails.isResendEmail && (
                    <Button
                      variant="outline"
                      onClick={() => setEditingItem(true)}
                    >
                      Edit
                    </Button>
                  )}
                  {!itemDetails.isResendEmail && itemDetails.type === 'email' && (
                    <Button
                      variant="outline"
                      onClick={() => handleToggleSpam(itemDetails)}
                      disabled={spamUpdatingItemId === itemDetails.id}
                    >
                      {spamUpdatingItemId === itemDetails.id
                        ? 'Updating...'
                        : Array.isArray(itemDetails.tags) && itemDetails.tags.includes('spam')
                          ? 'Unmark spam'
                          : 'Mark as spam'}
                    </Button>
                  )}
                  {onDelete && !itemDetails.isResendEmail && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (itemDetails && confirm('Are you sure you want to delete this item?')) {
                          onDelete(itemDetails.id);
                          handleCloseDialog(false);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                  {itemDetails.isResendEmail && (
                    <p className="text-xs text-muted-foreground">
                      This is an email from Resend. Import it as an item to edit or add notes.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={imageDialogOpen}
        onOpenChange={(open) => {
          setImageDialogOpen(open);
          if (!open) {
            setSelectedImage(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] sm:w-full sm:max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedImage?.file.originalname || 'Image preview'}</DialogTitle>
            {selectedImage?.file.size && (
              <DialogDescription>
                {(selectedImage.file.size / 1024).toFixed(1)} KB
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedImage && selectedImage.previewSrc && (
            <div className="space-y-4">
              <div className="relative w-full">
                <img
                  src={selectedImage.previewSrc}
                  alt={selectedImage.file.originalname}
                  className="w-full h-auto max-h-[80vh] object-contain rounded-md bg-black/5"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadFile(selectedImage.itemId, selectedImage.file, selectedImage.resendEmailId);
                  }}
                >
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ShareItemDialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            setShareTarget(null);
          }
        }}
        itemId={shareTarget?.id}
        itemTitle={shareTarget?.title}
      />
    </>
  );
}
