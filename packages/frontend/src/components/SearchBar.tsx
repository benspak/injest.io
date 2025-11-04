'use client';

import { useState, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import { api, SearchResult } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data.results);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-md border bg-background text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <Card className="relative w-full max-w-2xl max-h-[60vh] overflow-hidden">
            <Command className="rounded-lg">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Ask your brain..."
                  className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
                {loading && <span className="text-xs text-muted-foreground">Searching...</span>}
                <button
                  onClick={() => setOpen(false)}
                  className="ml-2 p-1 hover:bg-accent rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                {results.length === 0 && query && !loading && (
                  <Command.Empty>No results found.</Command.Empty>
                )}
                {results.map((result) => (
                  <Command.Item
                    key={result.id}
                    className="flex flex-col items-start gap-2 rounded-md px-3 py-2 hover:bg-accent cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-muted-foreground">
                        {result.type} • {new Date(result.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(result.similarity * 100)}% match
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">
                      {result.clean || result.raw}
                    </p>
                    {result.tags && result.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {result.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 bg-secondary rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Card>
        </div>
      )}
    </>
  );
}
