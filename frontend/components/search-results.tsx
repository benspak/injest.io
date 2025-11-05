'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LinkMetadata } from '@/lib/api';

interface SearchResult {
  item: {
    id: string;
    type?: string;
    raw?: string;
    title?: string;
    description?: string;
    url?: string;
    attachments?: any[];
    clean?: string;
    tags?: string[];
    source?: string;
    link_metadata?: LinkMetadata;
    notes?: string;
    created_at: string;
  };
  similarity: number;
}

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  // Helper to get display title/description (supports both new unified and old structure)
  const getItemDisplay = (item: SearchResult['item']) => {
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

  return (
    <div className="space-y-2 sm:space-y-3">
      {results.map((result) => {
        const display = getItemDisplay(result.item);
        const metadata = result.item.link_metadata;
        const hasUrl = !!result.item.url;
        const displayTitle = metadata?.title || display.title || result.item.title || 'Untitled';
        const displayDescription = metadata?.description || result.item.description || display.description || result.item.clean || '';

        return (
          <Card key={result.item.id} className="cursor-pointer hover:bg-accent">
            <CardHeader className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <CardTitle className="text-sm sm:text-base leading-tight pr-2">{displayTitle}</CardTitle>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {(result.similarity * 100).toFixed(0)}% match
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {/* URL preview with metadata */}
              {hasUrl && metadata && (
                <div className="mb-3 border rounded-lg overflow-hidden">
                  {metadata.image && (
                    <div className="aspect-video w-full bg-gray-100 overflow-hidden">
                      <img
                        src={metadata.image}
                        alt={metadata.title || 'Link preview'}
                        className="w-full h-full object-cover"
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
                      href={metadata.url || result.item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs sm:text-sm text-blue-600 hover:underline break-all"
                    >
                      {metadata.url || result.item.url}
                    </a>
                  </div>
                </div>
              )}

              {/* Regular content for items without URL or without metadata */}
              {(!hasUrl || !metadata) && displayDescription && (
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                  {displayDescription}
                </p>
              )}

              {/* Show notes if available */}
              {result.item.notes && (
                <div className="mt-2 p-2 bg-gray-50 rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Notes:</p>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 whitespace-pre-wrap">
                    {result.item.notes}
                  </p>
                </div>
              )}

              {result.item.tags && result.item.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {result.item.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-secondary px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {result.item.source && (
                <p className="text-xs text-muted-foreground mt-2">
                  Source: {result.item.source}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
