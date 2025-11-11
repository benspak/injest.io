'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { BOOKMARK_IMPORT_EVENT } from '@/lib/events';

export function BookmarkImportCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.endsWith('.html') && file.type !== 'text/html') {
      toast.error('Please select an HTML bookmark file');
      event.target.value = '';
      return;
    }

    setIsImporting(true);

    try {
      const result = await apiClient.importBookmarks(file);
      toast.success(
        `Import started! Processing ${result.total} bookmark${result.total === 1 ? '' : 's'} in the background. They will appear in your list as they are imported.`,
        { duration: 6000 }
      );

      window.dispatchEvent(
        new CustomEvent(BOOKMARK_IMPORT_EVENT, {
          detail: {
            total: result.total,
          },
        })
      );
    } catch (error: unknown) {
      console.error('Error importing bookmarks:', error);
      const message =
        (error as { message?: string })?.message ?? 'Failed to start bookmark import';
      toast.error(message);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Bookmarks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,text/html"
          onChange={handleFileChange}
          className="hidden"
          id="bookmark-file-input"
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? 'Importing...' : 'Import Bookmarks from HTML'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Export your browser bookmarks as HTML and import them here.
        </p>
      </CardContent>
    </Card>
  );
}
