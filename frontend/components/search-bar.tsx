'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchResults } from './search-results';
import { apiClient } from '@/lib/api';

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiClient.search(query);
        setResults(response.results || []);
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
      <Input
        type="text"
        placeholder="Search... (Cmd+K)"
        className="max-w-md w-full"
        onClick={() => setOpen(true)}
        readOnly
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg sm:text-xl">Search</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Search your knowledge base..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full text-base sm:text-sm"
            />
            {loading && <p className="text-sm text-muted-foreground px-1">Searching...</p>}
            {!loading && query && results.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">No results found</p>
            )}
            {results.length > 0 && <SearchResults results={results} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
