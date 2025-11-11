'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

export function ContactImportCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.vcf') && !fileName.endsWith('.vcard')) {
      toast.error('Please select a vCard (.vcf) contacts file.');
      event.target.value = '';
      return;
    }

    setIsImporting(true);

    try {
      const result = await apiClient.importContacts(file);

      const { imported, processed, skipped } = result;
      const skippedTotal = (skipped?.duplicates ?? 0) + (skipped?.missingDetails ?? 0);

      let message = `Imported ${imported} contact${imported === 1 ? '' : 's'} from ${processed} record${processed === 1 ? '' : 's'}.`;
      if (skippedTotal > 0) {
        message += ` Skipped ${skippedTotal} entr${skippedTotal === 1 ? 'y' : 'ies'} that were duplicates or missing details.`;
      }

      toast.success(message, { duration: 6000 });
    } catch (error: unknown) {
      console.error('Error importing contacts:', error);
      const message = (error as { message?: string })?.message ?? 'Failed to import contacts.';
      toast.error(message);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Contacts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".vcf,.vcard,text/vcard,application/vcard,application/x-vcard"
          onChange={handleFileChange}
          className="hidden"
          id="contact-file-input"
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? 'Importing...' : 'Import Contacts from vCard'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Upload a vCard (.vcf) file to add contacts to your workspace.
        </p>
      </CardContent>
    </Card>
  );
}
