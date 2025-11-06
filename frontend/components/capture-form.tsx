'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

interface CaptureFormProps {
  onItemCreated?: () => void;
}

export function CaptureForm({ onItemCreated }: CaptureFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validate that at least one field is provided
    if (!title && !description && !url && files.length === 0) {
      setMessage('Please provide at least a title, description, URL, or attachment');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();

      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      if (url) formData.append('url', url);
      if (notes) formData.append('notes', notes);

      // Add file attachments
      files.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await apiClient.createItem(formData);

      // Check if this is a batch processing response
      if (response && typeof response === 'object' && 'batch' in response && response.batch === true) {
        const batchResponse = response as {
          batch: boolean;
          total: number;
          created: number;
          failed: number;
          items?: any[];
          errors?: Array<{ filename: string; error: string }>;
        };

        if (batchResponse.created > 0) {
          if (batchResponse.failed > 0) {
            setMessage(
              `Successfully created ${batchResponse.created} item(s). ${batchResponse.failed} file(s) failed to process.`
            );
          } else {
            setMessage(`Successfully created ${batchResponse.created} item(s)!`);
          }
        } else {
          setMessage(`Failed to process all ${batchResponse.total} file(s).`);
        }
      } else {
        // Single item response
        setMessage('Item created successfully!');
      }

      // Reset form
      setTitle('');
      setDescription('');
      setUrl('');
      setNotes('');
      setFiles([]);

      // Clear file input element
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notify parent component to refresh items list
      if (onItemCreated) {
        onItemCreated();
      }
    } catch (error: any) {
      // Extract error message from API response
      let errorMessage = 'Failed to create item';

      if (error.message) {
        errorMessage = error.message;

        // Provide more user-friendly messages for specific errors
        if (errorMessage.includes('File too large') || errorMessage.includes('LIMIT_FILE_SIZE')) {
          errorMessage = 'File too large. Maximum file size is 50MB. Please choose a smaller file.';
        } else if (errorMessage.includes('Too many files') || errorMessage.includes('LIMIT_FILE_COUNT')) {
          errorMessage = 'Too many files. You can upload a maximum of 10 files at once.';
        } else if (errorMessage.includes('File upload error')) {
          errorMessage = 'File upload failed. Please try again or choose a different file.';
        }
      }

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture New Item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <Input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px]"
          />

          <Input
            type="url"
            placeholder="URL (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <Input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
          />

          {files.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {files.length} file(s) selected
            </div>
          )}

          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px]"
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Item'}
          </Button>

          {message && (
            <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
