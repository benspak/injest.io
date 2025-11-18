'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  id?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 12,
  id,
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewMode('editor')}
          className={cn(viewMode === 'editor' && 'bg-blue-50')}
        >
          Editor
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewMode('split')}
          className={cn(viewMode === 'split' && 'bg-blue-50')}
        >
          Split
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewMode('preview')}
          className={cn(viewMode === 'preview' && 'bg-blue-50')}
        >
          Preview
        </Button>
      </div>
      <div
        className={cn(
          'border rounded-md overflow-hidden',
          viewMode === 'split' && 'grid grid-cols-2',
          viewMode === 'editor' && 'grid grid-cols-1',
          viewMode === 'preview' && 'grid grid-cols-1'
        )}
      >
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div className={cn('border-r border-gray-200', viewMode === 'split' && 'min-h-[400px]')}>
            <Textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              className="resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full"
            />
          </div>
        )}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="bg-white p-4 overflow-y-auto" style={{ minHeight: viewMode === 'split' ? '400px' : 'auto', maxHeight: '600px' }}>
            <div className="prose prose-sm max-w-none email-preview">
              {value.trim() ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '14px', marginBottom: '6px' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '12px', marginBottom: '6px' }}>{children}</h3>,
                    p: ({ children }) => <p style={{ marginTop: '8px', marginBottom: '8px', lineHeight: '1.6' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '24px' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '24px' }}>{children}</ol>,
                    li: ({ children }) => <li style={{ marginTop: '4px', marginBottom: '4px' }}>{children}</li>,
                    a: ({ href, children }) => <a href={href || '#'} style={{ color: '#2563eb', textDecoration: 'underline' }}>{children}</a>,
                    code: ({ children, className }) => (
                      <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em' }}>
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => <pre style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '4px', overflow: 'auto', marginTop: '8px', marginBottom: '8px' }}>{children}</pre>,
                    blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #e5e7eb', paddingLeft: '16px', marginTop: '8px', marginBottom: '8px', color: '#6b7280' }}>{children}</blockquote>,
                    table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '8px', marginBottom: '8px' }}>{children}</table>,
                    th: ({ children }) => <th style={{ border: '1px solid #e5e7eb', padding: '8px', backgroundColor: '#f9fafb', fontWeight: 'bold', textAlign: 'left' }}>{children}</th>,
                    td: ({ children }) => <td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>{children}</td>,
                  } as Components}
                >
                  {value}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">{placeholder || 'Start typing to see preview...'}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
