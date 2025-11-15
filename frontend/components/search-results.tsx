'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  apiClient,
  type Item,
  type LinkMetadata,
  type SearchResult,
  type Contact,
} from '@/lib/api';

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
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
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const isClickInsideRef = useRef(false);

  type Attachment = NonNullable<Item['attachments']>[number];

  // Helper to get display title/description (supports both new unified and old structure)
  const getItemDisplay = (item?: SearchResult['item'] | Item | null) => {
    if (!item) {
      return { title: '', description: '' };
    }
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) {
      return `${Math.max(minutes, 0)}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 48) {
      return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    if (days < 14) {
      return `${days}d ago`;
    }
    const weeks = Math.round(days / 7);
    if (weeks < 10) {
      return `${weeks}w ago`;
    }
    const months = Math.round(days / 30);
    if (months < 24) {
      return `${months}mo ago`;
    }
    const years = Math.round(days / 365);
    return `${years}y ago`;
  };

  const formatScore = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    const clamped = Math.max(0, Math.min(value, 1));
    return `${Math.round(clamped * 100)}%`;
  };

  const fetchLinkMetadata = async (itemId: string, url: string) => {
    // Don't fetch if already loaded or currently loading
    if (linkMetadata[itemId] || loadingMetadata.has(itemId)) {
      return;
    }

    setLoadingMetadata((prev) => new Set(prev).add(itemId));
    try {
      const metadata = await apiClient.getItemMetadata(itemId);
      setLinkMetadata((prev) => ({
        ...prev,
        [itemId]: metadata,
      }));
    } catch (error) {
      console.error('Error fetching link metadata:', error);
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

  const buildItemFromResult = (result: SearchResult): Item | null => {
    if (result.entityType !== 'item') {
      return null;
    }

    const existingItem = result.item as Item | undefined;
    if (existingItem) {
      return existingItem;
    }

    if (!result.document) {
      return null;
    }

    const documentMetadata = (result.document.metadata ?? {}) as Record<string, unknown>;
    const createdAt =
      typeof documentMetadata.createdAt === 'string'
        ? documentMetadata.createdAt
        : new Date().toISOString();
    const updatedAt =
      typeof documentMetadata.updatedAt === 'string'
        ? documentMetadata.updatedAt
        : createdAt;

    const derivedSource =
      typeof documentMetadata.source === 'string' ? documentMetadata.source : undefined;
    const derivedTypeRaw =
      typeof documentMetadata.type === 'string' ? documentMetadata.type.toLowerCase().trim() : undefined;
    const derivedType: Item['type'] =
      derivedTypeRaw && ['note', 'link', 'file', 'email'].includes(derivedTypeRaw)
        ? (derivedTypeRaw as Item['type'])
        : undefined;
    const derivedUrl =
      typeof documentMetadata.url === 'string' && documentMetadata.url.length > 0
        ? documentMetadata.url
        : undefined;
    const derivedTags = Array.isArray(result.document.tags)
      ? (result.document.tags as string[])
      : undefined;

    return {
      id: result.entityId,
      owner_id: 'unknown-owner',
      type: derivedType,
      raw: undefined,
      title: result.document.title ?? undefined,
      description: result.document.summary ?? undefined,
      url: derivedUrl,
      attachments: [],
      clean: result.document.summary ?? undefined,
      tags: derivedTags,
      source: derivedSource,
      embedding_id: undefined,
      link_metadata: undefined,
      notes: undefined,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  };

  const handleItemClick = async (item?: SearchResult['item'] | Item | null) => {
    if (!item) {
      return;
    }

    setSelectedItem(item as Item);
    setDialogOpen(true);
    isClickInsideRef.current = false; // Reset click tracking
    setLoadingDetails(true);
    setEditingNotes(false);
    setEditingItem(false);
    setEmailBodyExpanded(false);

    try {
      // Check if this is an email item (either Resend or database-stored)
      const isResendEmail = (item as any).isResendEmail && (item as any).resendEmailId;
      const isEmailType = item.type === 'email' || (item as any).type === 'email';

      // If this is a Resend email, fetch full email details
      if (isResendEmail) {
        const emailDetails = await apiClient.getReceivedEmail((item as any).resendEmailId);
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
          isResendEmail: true,
        };
        setItemDetails(emailAsItem);
        setNotesValue('');
        setEditTitle(emailDetails.subject);
        setEditDescription(emailDetails.text || emailDetails.html || '');

        // Fetch email summary
        setLoadingSummary(true);
        try {
          const summaryResponse = await apiClient.generateEmailSummary((item as any).resendEmailId);
          setEmailSummary(summaryResponse.summary || []);
        } catch (error) {
          console.error('Error fetching email summary:', error);
          setEmailSummary([]);
        } finally {
          setLoadingSummary(false);
        }
      } else {
        // Regular item - fetch full details
        const details = await apiClient.getItem(item.id);
        setItemDetails(details);
        setNotesValue(details.notes || '');

        const display = getItemDisplay(details);
        setEditTitle(details.title || display.title || '');
        setEditDescription(details.description || display.description || '');

        // Check if this is an email item stored in database
        if (details.type === 'email' || isEmailType) {
          // Try to extract email details from raw field or description
          let emailText = details.description || '';
          let emailHtml: string | undefined = undefined;
          let resendEmailId: string | undefined = undefined;

          // Try to parse raw field for email data
          if (details.raw) {
            try {
              const rawData = JSON.parse(details.raw);
              if (rawData.body || rawData.text || rawData.html) {
                emailText = rawData.text || rawData.body || '';
                emailHtml = rawData.html;
              }
              // Extract email metadata
              if (rawData.from) {
                (details as any).from = rawData.from;
              }
              if (rawData.to) {
                (details as any).to = rawData.to;
              }
              if (rawData.cc) {
                (details as any).cc = rawData.cc;
              }
              if (rawData.bcc) {
                (details as any).bcc = rawData.bcc;
              }

              // Extract resend_email_id if available
              if (rawData.resend_email_id) {
                resendEmailId = rawData.resend_email_id;
              }
            } catch {
              // If raw parsing fails, continue with description
            }
          }

          // Set email-specific fields
          (details as any).html = emailHtml;
          (details as any).text = emailText;
          (details as any).type = 'email';

          // Check if there's a summary in clean field
          if (details.clean) {
            try {
              const parsedSummary = JSON.parse(details.clean);
              if (Array.isArray(parsedSummary) && parsedSummary.length > 0) {
                setEmailSummary(parsedSummary);
              } else {
                // If clean field exists but isn't a valid summary array, try to fetch/generate
                setLoadingSummary(true);
              }
            } catch {
              // If clean field isn't valid JSON, try to fetch summary
              setLoadingSummary(true);
            }
          } else {
            // No summary yet, try to fetch/generate it
            setLoadingSummary(true);
          }

          // Try to fetch summary if we have a resend_email_id
          if (resendEmailId) {
            try {
              const summaryResponse = await apiClient.generateEmailSummary(resendEmailId);
              setEmailSummary(summaryResponse.summary || []);
            } catch (error) {
              console.error('Error fetching email summary:', error);
              setEmailSummary([]);
            } finally {
              setLoadingSummary(false);
            }
          } else if (details.id) {
            // No resend_email_id, try to generate summary using item ID
            try {
              const summaryResponse = await apiClient.generateItemEmailSummary(details.id);
              setEmailSummary(summaryResponse.summary || []);
            } catch (error) {
              console.error('Error generating email summary:', error);
              setEmailSummary([]);
            } finally {
              setLoadingSummary(false);
            }
          } else {
            setLoadingSummary(false);
          }
        }

        // Use saved metadata from details, or fetch if missing
        if (details.url) {
          if (details.link_metadata) {
            const metadata = details.link_metadata;
            setLinkMetadata((prev) => ({
              ...prev,
              [details.id]: metadata,
            }));
          } else {
            fetchLinkMetadata(details.id, details.url);
          }
        }
      }
    } catch (error) {
      console.error('Error loading item details:', error);
      // If API fails, use the item data we already have
      setItemDetails(item);
      setNotesValue((item as any).notes || '');
      const display = getItemDisplay(item);
      setEditTitle(item.title || display.title || '');
      setEditDescription(item.description || display.description || '');
      if ((item as any).link_metadata) {
        const metadata = (item as any).link_metadata as LinkMetadata;
        setLinkMetadata((prev) => ({
          ...prev,
          [item.id]: metadata,
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
    setEmailSummary([]);
    setEmailBodyExpanded(false);
  };

  const handleOpenChange = (open: boolean) => {
    // Only close if the click was outside the dialog
    if (open === false) {
      // Check if the click was inside - if so, prevent closing
      if (isClickInsideRef.current) {
        // Click was inside, prevent closing and reset flag
        isClickInsideRef.current = false;
        // Use requestAnimationFrame to ensure state update happens after Radix processes the event
        requestAnimationFrame(() => {
          setDialogOpen(true);
        });
        return;
      }
      // Click was outside, allow closing
      handleCloseDialog();
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedItem || !itemDetails) return;

    if ((itemDetails as any).isResendEmail) {
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

    if ((itemDetails as any).isResendEmail) {
      alert('Resend emails cannot be edited. Import the email as an item to edit it.');
      return;
    }

    setSavingItem(true);
    try {
      const updates: { title?: string; description?: string } = {};
      updates.title = editTitle;
      updates.description = editDescription;

      const updatedItem = await apiClient.updateItem(itemDetails.id, updates);
      setItemDetails(updatedItem);
      setEditingItem(false);
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item. Please try again.');
    } finally {
      setSavingItem(false);
    }
  };

  return (
    <>
      <div className="space-y-2 sm:space-y-3">
        {results.map((result) => {
          if (result.entityType === 'contact') {
            const contact = result.contact as Contact | undefined;
            if (!contact) {
              return null;
            }

            const contactTitle =
              contact.name || contact.email || contact.phone || 'Unnamed Contact';
            const contactSubtitle = contact.email
              ? contact.phone
                ? `${contact.email} • ${contact.phone}`
                : contact.email
              : contact.phone ?? '';

            const similarityLabel =
              typeof result.similarity === 'number'
                ? `${Math.round(Math.min(Math.max(result.similarity, 0), 1) * 100)}% match`
                : null;
            const summary = result.document?.summary ?? null;
            const tags = result.document?.tags ?? [];

            return (
              <Card key={`contact-${contact.id}`} className="bg-white">
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-col gap-1 pr-2">
                      <CardTitle className="text-sm sm:text-base leading-tight">
                        {contactTitle}
                      </CardTitle>
                      {contactSubtitle && (
                        <div className="text-xs text-muted-foreground">{contactSubtitle}</div>
                      )}
                    </div>
                    {similarityLabel && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {similarityLabel}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  {summary && (
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 whitespace-pre-wrap">
                      {summary}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground">
                    {contact.email && (
                      <div>
                        <span className="font-semibold text-foreground mr-1">Email:</span>
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div>
                        <span className="font-semibold text-foreground mr-1">Phone:</span>
                        {contact.phone}
                      </div>
                    )}
                  </div>
                  {tags && tags.length > 0 && (
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-secondary px-2 py-1 rounded capitalize"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }

          const item = buildItemFromResult(result);
          if (!item) {
            return null;
          }

          const display = getItemDisplay(item);
          const documentMetadata = (result.document?.metadata ?? {}) as Record<string, unknown>;
          const metadata = item.link_metadata;
          const hasUrl = !!item.url;
          const displayTitle = metadata?.title || display.title || item.title || 'Untitled';
          const displayDescription =
            metadata?.description ||
            item.description ||
            display.description ||
            result.document?.summary ||
            item.clean ||
            '';
          const overallScore = result.scores?.overall ?? result.similarity;
          const vectorScore = result.scores?.vector ?? undefined;
          const recencyScore = result.scores?.recency ?? undefined;
          const relativeTime = item.created_at ? formatRelativeTime(item.created_at) : '';
          const overallScoreLabel = formatScore(overallScore);

          return (
            <Card
              key={item.id}
              className="cursor-pointer hover:bg-accent"
              onClick={() => handleItemClick(item)}
            >
              <CardHeader className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div className="flex flex-col gap-1 pr-2">
                    <CardTitle className="text-sm sm:text-base leading-tight">{displayTitle}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.type && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize">{item.type}</span>
                      )}
                      {item.source && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5">{item.source}</span>
                      )}
                      {relativeTime && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5">{relativeTime}</span>
                      )}
                      {vectorScore !== undefined && vectorScore > 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                          Vector {formatScore(vectorScore)}
                        </span>
                      )}
                      {recencyScore !== undefined && recencyScore > 0 && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">
                          Recency {formatScore(recencyScore)}
                        </span>
                      )}
                    </div>
                  </div>
                  {overallScoreLabel && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {overallScoreLabel} match
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {/* URL preview with metadata */}
                {hasUrl && metadata && item.url && (
                  <div className="mb-3 border rounded-lg overflow-hidden">
                    {metadata.image && (
                      <div className="w-full bg-gray-100 overflow-hidden" style={{ maxHeight: '120px' }}>
                        <img
                          src={metadata.image}
                          alt={metadata.title || 'Link preview'}
                          className="w-full h-auto max-h-[120px] object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-2 sm:p-3">
                      {metadata.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
                          {metadata.description}
                        </p>
                      )}
                      <a
                        href={metadata.url || item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs sm:text-sm text-blue-600 hover:underline break-all"
                      >
                        {metadata.url || item.url}
                      </a>
                    </div>
                  </div>
                )}

                {/* Image attachments preview - show if no URL metadata image or no URL at all */}
                {(!hasUrl || !metadata?.image) && item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0 && (() => {
                  const imageAttachments = (item.attachments as Attachment[]).filter((file) =>
                    apiClient.isImageMimetype(file.mimetype)
                  );
                  if (imageAttachments.length > 0) {
                    const firstImage = imageAttachments[0];
                    const previewUrl = apiClient.getAttachmentPreviewUrl(item.id, firstImage, true);
                    if (!previewUrl) return null;
                    return (
                      <div className="mb-3 border rounded-lg overflow-hidden bg-white">
                        <div className="w-full bg-gray-100 overflow-hidden" style={{ maxHeight: '120px' }}>
                          <img
                            src={previewUrl}
                            alt={firstImage.originalname}
                            className="w-full h-auto max-h-[120px] object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.style.display = 'none';
                              }
                            }}
                          />
                        </div>
                        {item.attachments.length > 1 && (
                          <div className="p-2 text-xs text-muted-foreground text-center">
                            +{item.attachments.length - 1} more file
                            {item.attachments.length - 1 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Regular content for items without URL or without metadata */}
                {(!hasUrl || !metadata) && displayDescription && (
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                    {displayDescription}
                  </p>
                )}

                {/* Show notes if available */}
                {item.notes && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Notes:</p>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 whitespace-pre-wrap">
                      {item.notes}
                    </p>
                  </div>
                )}

                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {item.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-secondary px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {item.source && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Source: {item.source}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          ref={dialogContentRef}
          className="max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto overflow-x-hidden w-auto sm:w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl left-2 right-2 sm:left-[50%] sm:right-auto translate-x-0 sm:translate-x-[-50%] top-4 sm:top-[50%] translate-y-0 sm:translate-y-[-50%] p-4 sm:p-6"
          onInteractOutside={(e) => {
            // This only fires when clicking OUTSIDE the dialog
            // Mark that click was outside so dialog can close
            isClickInsideRef.current = false;
            // Allow closing when clicking on overlay (outside)
            // But prevent if clicking on interactive elements that might be outside
            const target = e.target as HTMLElement;
            if (target.closest('button') ||
                target.closest('input') ||
                target.closest('textarea') ||
                target.closest('a') ||
                target.closest('[role="button"]')) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            // This only fires when clicking OUTSIDE the dialog
            // Mark that click was outside so dialog can close
            isClickInsideRef.current = false;
            const target = e.target as HTMLElement;
            if (target.closest('button') ||
                target.closest('input') ||
                target.closest('textarea') ||
                target.closest('a') ||
                target.closest('[role="button"]')) {
              e.preventDefault();
            }
          }}
          onPointerDown={(e) => {
            // Mark that the click was inside the dialog content
            // This fires before onOpenChange, so we can prevent closing
            isClickInsideRef.current = true;
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Mark that the click was inside the dialog content
            isClickInsideRef.current = true;
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            // Mark that the click was inside the dialog content
            isClickInsideRef.current = true;
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            // Mark that the touch was inside the dialog content (for mobile)
            isClickInsideRef.current = true;
            e.stopPropagation();
          }}
        >
          <div
            onPointerDown={(e) => {
              // Mark that the click was inside the dialog content
              // But exclude the close button (X) - it should be able to close
              const target = e.target as HTMLElement;
              if (!target.closest('button[data-radix-dialog-close]') &&
                  !target.closest('[data-radix-dialog-close]')) {
                isClickInsideRef.current = true;
              }
              e.stopPropagation();
            }}
            onClick={(e) => {
              // Mark that the click was inside the dialog content
              // But exclude the close button (X)
              const target = e.target as HTMLElement;
              if (!target.closest('button[data-radix-dialog-close]') &&
                  !target.closest('[data-radix-dialog-close]')) {
                isClickInsideRef.current = true;
              }
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              // Mark that the click was inside the dialog content
              // But exclude the close button (X)
              const target = e.target as HTMLElement;
              if (!target.closest('button[data-radix-dialog-close]') &&
                  !target.closest('[data-radix-dialog-close]')) {
                isClickInsideRef.current = true;
              }
              e.stopPropagation();
            }}
          >
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
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.style.display = 'none';
                                  }
                                }}
                                onLoad={(e) => {
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
                    <div className="flex gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveItem();
                        }}
                        disabled={savingItem}
                      >
                        {savingItem ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
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
                  <>
                    {/* Regular content */}
                    {(() => {
                      const display = getItemDisplay(itemDetails);
                      const hasMetadata = itemDetails.url && (itemDetails.link_metadata || linkMetadata[itemDetails.id]);
                      const metadata = itemDetails.link_metadata || linkMetadata[itemDetails.id];
                      const descriptionDifferent = display.description && metadata?.description !== display.description;

                      if (!hasMetadata || descriptionDifferent) {
                        // Get the full email body - prioritize html/text from itemDetails, fallback to display.description
                        const fullBody = (itemDetails as any).html || (itemDetails as any).text || display.description;
                        if (fullBody) {
                          const isEmail = itemDetails.type === 'email' || (itemDetails as any).isResendEmail;
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
                            return (
                              <div>
                                {emailBodyExpanded ? (
                                  // Show full HTML when expanded
                                  <div
                                    className="text-sm prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: fullHtml }}
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
                          } else {
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
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {itemDetails.url}
                        </a>
                      </div>
                    )}

                    {/* Email-specific information */}
                    {((itemDetails as any).isResendEmail || itemDetails.type === 'email') && ((itemDetails as any).from || itemDetails.source) && (
                      <div className="space-y-2 border-t pt-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Email Details</h4>
                          <div className="space-y-1 text-sm">
                            {(itemDetails as any).from && (
                              <div>
                                <span className="font-medium">From:</span> {(itemDetails as any).from}
                              </div>
                            )}
                            {(itemDetails as any).to && (
                              <div>
                                <span className="font-medium">To:</span> {Array.isArray((itemDetails as any).to) ? (itemDetails as any).to.join(', ') : (itemDetails as any).to}
                              </div>
                            )}
                            {(itemDetails as any).cc && Array.isArray((itemDetails as any).cc) && (itemDetails as any).cc.length > 0 && (
                              <div>
                                <span className="font-medium">CC:</span> {(itemDetails as any).cc.join(', ')}
                              </div>
                            )}
                            {(itemDetails as any).bcc && Array.isArray((itemDetails as any).bcc) && (itemDetails as any).bcc.length > 0 && (
                              <div>
                                <span className="font-medium">BCC:</span> {(itemDetails as any).bcc.join(', ')}
                              </div>
                            )}
                            {!((itemDetails as any).from) && itemDetails.source && itemDetails.source.startsWith('email:') && (
                              <div>
                                <span className="font-medium">From:</span> {itemDetails.source.replace('email:', '')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email Summary */}
                    {((itemDetails as any).isResendEmail || itemDetails.type === 'email') && (
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
                        ) : (
                          <div className="text-sm text-muted-foreground">No summary available</div>
                        )}
                      </div>
                    )}


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
                                    {apiClient.getAttachmentPreviewUrl(itemDetails.id, file, true) && (
                                      <img
                                        src={apiClient.getAttachmentPreviewUrl(itemDetails.id, file, true)!}
                                        alt={file.originalname}
                                        className="w-full max-w-2xl h-auto rounded-md object-contain max-h-96"
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
                                    )}
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
                                          handleDownloadFile(itemDetails.id, file, (itemDetails as any).resendEmailId);
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
                                        handleDownloadFile(itemDetails.id, file, (itemDetails as any).resendEmailId);
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
                  </>
                )}

                {/* Notes section */}
                {!editingItem && !(itemDetails as any).isResendEmail && itemDetails.notes !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold">Notes</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNotes(true);
                        }}
                      >
                        {itemDetails.notes ? 'Edit Notes' : 'Add Notes'}
                      </Button>
                    </div>
                    {editingNotes ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add your notes about this item..."
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveNotes();
                            }}
                            disabled={savingNotes}
                          >
                            {savingNotes ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
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
                  {!editingItem && !(itemDetails as any).isResendEmail && (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {(itemDetails as any).isResendEmail && (
                    <p className="text-xs text-muted-foreground">
                      This is an email from Resend. Import it as an item to edit or add notes.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
