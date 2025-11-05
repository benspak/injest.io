'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface ItemListProps {
  items: Item[];
  onDelete?: (itemId: string) => void;
}

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

  const handleDownloadFile = async (itemId: string, filename: string, originalname: string, attachmentId?: string, resendEmailId?: string) => {
    try {
      // If this is a Resend email attachment, use the Resend API
      if (resendEmailId && attachmentId) {
        await apiClient.downloadEmailAttachment(resendEmailId, attachmentId);
      } else {
        // Regular item file download
        await apiClient.downloadFile(itemId, filename);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(`Failed to download ${originalname}. Please try again.`);
    }
  };

  const handleItemClick = async (item: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
    setLoadingDetails(true);
    setEditingNotes(false);
    setEditingItem(false);

    try {
      // If this is a Resend email, fetch full email details
      if (item.isResendEmail && item.resendEmailId) {
        const emailDetails = await apiClient.getReceivedEmail(item.resendEmailId);
        // Transform email to item-like format
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
        };
        setItemDetails(emailAsItem);
        setNotesValue('');
        setEditTitle(emailDetails.subject);
        setEditDescription(emailDetails.text || emailDetails.html || '');
      } else {
        // Regular item
        const details = await apiClient.getItem(item.id);
        setItemDetails(details);
        setNotesValue(details.notes || '');

        // Set edit fields
        const display = getItemDisplay(details);
        setEditTitle(details.title || display.title || '');
        setEditDescription(details.description || display.description || '');

        // Use saved metadata from details, or fetch if missing
        if (details.url) {
          if (details.link_metadata) {
            // Use saved metadata
            setLinkMetadata((prev) => ({
              ...prev,
              [details.id]: details.link_metadata,
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
        setLinkMetadata((prev) => ({
          ...prev,
          [item.id]: item.link_metadata,
        }));
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedItem(null);
    setItemDetails(null);
    setEditingNotes(false);
    setEditingItem(false);
    setNotesValue('');
    setEditTitle('');
    setEditDescription('');
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
                {item.attachments.map((file: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-gray-50 border rounded-md"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.originalname}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(file.size / 1024)} KB
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (itemDetails) {
                          handleDownloadFile(
                            itemDetails.id,
                            file.filename,
                            file.originalname,
                            file.attachmentId,
                            itemDetails.resendEmailId
                          );
                        }
                      }}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Truncated preview
    return (
      <p className={`text-sm text-muted-foreground ${fullDetails ? '' : 'line-clamp-3'}`}>
        {display.description}
      </p>
    );
  };

  return (
    <>
      <div className="space-y-4">
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

            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleItemClick(item)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {itemMetadata ? itemMetadata.title : (display.title || item.title || 'Untitled')}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(item.created_at)}
                        {item.type && ` • ${item.type}`}
                        {item.isResendEmail && ' • Resend'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* URL preview with metadata */}
                  {hasUrl && itemMetadata && (
                    <div className="mb-3 border rounded-lg overflow-hidden bg-white">
                      {itemMetadata.image && (
                        <div className="aspect-video w-full bg-gray-100 overflow-hidden">
                          <img
                            src={itemMetadata.image}
                            alt={itemMetadata.title || 'Link preview'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              // Hide parent container if image fails
                              const parent = target.closest('.aspect-video') as HTMLElement | null;
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
                      <div className="p-3">
                        {itemMetadata.title && !display.title && (
                          <h5 className="text-sm font-semibold mb-1 line-clamp-1">
                            {itemMetadata.title}
                          </h5>
                        )}
                        {itemMetadata.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {itemMetadata.description}
                          </p>
                        )}
                        <a
                          href={itemMetadata.url || item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:underline break-all flex items-center gap-1"
                        >
                          <svg
                            className="w-3 h-3 flex-shrink-0"
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
                          {itemMetadata.url || item.url}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Regular content */}
                  {(!hasUrl || !itemMetadata) && renderItemContent(item, false)}


                  {item.source && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Source: {item.source}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {loadingDetails ? (
            <div className="py-8 text-center">Loading item details...</div>
          ) : selectedItem && itemDetails ? (
            <>
              <DialogHeader>
                <div>
                  <DialogTitle>
                    {getItemDisplay(itemDetails).title || itemDetails.title || 'Item Details'}
                  </DialogTitle>
                  <DialogDescription>
                    {formatDate(itemDetails.created_at)}
                    {itemDetails.type && ` • ${itemDetails.type}`}
                    {itemDetails.source && ` • ${itemDetails.source}`}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Show URL metadata in dialog if available */}
                {itemDetails.url && (itemDetails.link_metadata || linkMetadata[itemDetails.id]) && (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    {(() => {
                      const metadata = itemDetails.link_metadata || linkMetadata[itemDetails.id];
                      const display = getItemDisplay(itemDetails);
                      return (
                        <>
                          {metadata?.image && (
                            <div className="aspect-video w-full bg-gray-100 overflow-hidden">
                              <img
                                src={metadata.image}
                                alt={metadata.title || 'Link preview'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  // Hide parent container if image fails
                                  const parent = target.closest('.aspect-video') as HTMLElement | null;
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
                              className="text-sm text-blue-600 hover:underline break-all flex items-center gap-2 group"
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
                    {/* Only show description if not already shown in metadata or if it's different */}
                    {(() => {
                      const display = getItemDisplay(itemDetails);
                      const hasMetadata = itemDetails.url && (itemDetails.link_metadata || linkMetadata[itemDetails.id]);
                      const metadata = itemDetails.link_metadata || linkMetadata[itemDetails.id];
                      const descriptionDifferent = display.description && metadata?.description !== display.description;

                      // Show description if no metadata OR if descriptions are different
                      // Skip showing description for Resend emails here as we'll show it in email content section
                      if (itemDetails.isResendEmail) {
                        return null;
                      }
                      if (!hasMetadata || descriptionDifferent) {
                        if (display.description) {
                          return (
                            <div>
                              <p className="text-sm whitespace-pre-wrap">{display.description}</p>
                            </div>
                          );
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
                          className="text-sm text-blue-600 hover:underline break-all"
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

                    {/* Email content (HTML or text) */}
                    {itemDetails.isResendEmail && (itemDetails.html || itemDetails.text) && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-2">Email Content</h4>
                        {itemDetails.html ? (
                          <div
                            className="text-sm prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: itemDetails.html }}
                          />
                        ) : (
                          <div className="text-sm whitespace-pre-wrap">
                            {itemDetails.text}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    {itemDetails.attachments && Array.isArray(itemDetails.attachments) && itemDetails.attachments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Attachments</h4>
                        <div className="space-y-2">
                          {itemDetails.attachments.map((file: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-gray-50 border rounded-md"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">{file.originalname}</p>
                                <p className="text-xs text-muted-foreground">
                                  {Math.round(file.size / 1024)} KB
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(
                                    itemDetails.id,
                                    file.filename,
                                    file.originalname,
                                    file.attachmentId,
                                    itemDetails.resendEmailId
                                  );
                                }}
                              >
                                Download
                              </Button>
                            </div>
                          ))}
                        </div>
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



                <div className="flex gap-2 pt-4 border-t">
                  {!editingItem && !itemDetails.isResendEmail && (
                    <Button
                      variant="outline"
                      onClick={() => setEditingItem(true)}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && !itemDetails.isResendEmail && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (selectedItem && confirm('Are you sure you want to delete this item?')) {
                          onDelete(selectedItem.id);
                          handleCloseDialog();
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
    </>
  );
}
