'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Plus, Link as LinkIcon, FileText } from 'lucide-react';

export function CaptureView() {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'note' | 'link' | 'file'>('note');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      await api.createItem({
        type: type === 'link' ? 'link' : type === 'file' ? 'file' : 'note',
        raw: content,
        source: {
          app: 'web',
        },
      });
      setContent('');
      alert('Item captured!');
    } catch (error) {
      console.error('Capture error:', error);
      alert('Failed to capture item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture</CardTitle>
        <CardDescription>Add anything to your brain</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === 'note' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('note')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Note
            </Button>
            <Button
              type="button"
              variant={type === 'link' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('link')}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Link
            </Button>
            <Button
              type="button"
              variant={type === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('file')}
            >
              <FileText className="h-4 w-4 mr-2" />
              File
            </Button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              type === 'link'
                ? 'Paste URL or link...'
                : type === 'file'
                ? 'Paste file content or description...'
                : 'Type or paste anything...'
            }
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Capturing...' : 'Capture'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
