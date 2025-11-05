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

      await apiClient.createItem(formData);
      setMessage('Item created successfully!');

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
      setMessage(error.message || 'Failed to create item');
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
