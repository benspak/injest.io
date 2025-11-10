'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchResults } from './search-results';
import { apiClient, type SearchResult, type SearchFilters as ApiSearchFilters } from '@/lib/api';

type SearchTypeFilter = 'all' | 'note' | 'link' | 'file' | 'email' | 'task';
type SearchUploadedFilter = 'all' | 'me' | 'shared';

interface SearchUiFilters {
  type: SearchTypeFilter;
  uploadedBy: SearchUploadedFilter;
  tags: string[];
  hasAttachments: boolean;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<SearchUiFilters>({
    type: 'all',
    uploadedBy: 'all',
    tags: [],
    hasAttachments: false,
  });
  const [tagInput, setTagInput] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        input?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const apiFilters = useMemo<ApiSearchFilters>(() => {
    const next: ApiSearchFilters = {};
    if (filters.type !== 'all') {
      next.types = [filters.type];
    }
    if (filters.tags.length > 0) {
      next.tags = filters.tags;
    }
    if (filters.uploadedBy !== 'all') {
      next.uploadedBy = filters.uploadedBy;
    }
    if (filters.hasAttachments) {
      next.hasAttachments = true;
    }
    return next;
  }, [filters]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiClient.search(query, { filters: apiFilters });
        setResults(response.results ?? []);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setShowResults(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, apiFilters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = () => {
    const normalized = tagInput.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    setFilters((prev) => {
      if (prev.tags.includes(normalized)) {
        return prev;
      }
      return {
        ...prev,
        tags: [...prev.tags, normalized],
      };
    });
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.filter((existing) => existing !== tag),
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      type: 'all',
      uploadedBy: 'all',
      tags: [],
      hasAttachments: false,
    });
    setTagInput('');
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-full sm:max-w-3xl mx-auto">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search your knowledge base..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium px-4 sm:px-6 py-3 sm:py-4 rounded-full border-2 border-gray-300 shadow-lg hover:shadow-xl focus-visible:border-blue-500 focus-visible:shadow-xl transition-all"
          style={{
            fontSize: '16px',
            fontWeight: '500',
          }}
        />
        {loading && (
          <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Type</span>
            <select
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.type}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, type: event.target.value as SearchTypeFilter }))
              }
            >
              <option value="all">All</option>
              <option value="note">Notes</option>
              <option value="link">Links</option>
              <option value="file">Files</option>
              <option value="email">Emails</option>
              <option value="task">Tasks</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Uploaded by</span>
            <select
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.uploadedBy}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, uploadedBy: event.target.value as SearchUploadedFilter }))
              }
            >
              <option value="all">All</option>
              <option value="me">Me</option>
              <option value="shared">Shared with me</option>
            </select>
          </div>

          <Button
            type="button"
            size="sm"
            variant={filters.hasAttachments ? 'default' : 'outline'}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                hasAttachments: !prev.hasAttachments,
              }))
            }
          >
            {filters.hasAttachments ? 'Attachments • On' : 'Attachments'}
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Add tag and press Enter"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddTag();
                }
              }}
              className="h-9 w-48"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleAddTag}>
              Add Tag
            </Button>
          </div>

          {(filters.type !== 'all' ||
            filters.uploadedBy !== 'all' ||
            filters.hasAttachments ||
            filters.tags.length > 0) && (
            <Button type="button" size="sm" variant="ghost" onClick={handleResetFilters}>
              Reset filters
            </Button>
          )}
        </div>

        {filters.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.tags.map((tag) => (
              <Button
                key={tag}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => handleRemoveTag(tag)}
                className="flex items-center gap-2"
              >
                <span>#{tag}</span>
                <span aria-hidden="true">×</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[600px] overflow-y-auto z-50">
          {loading && (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="p-4 text-center text-gray-500">No results found</div>
          )}
          {results.length > 0 && <SearchResults results={results} />}
        </div>
      )}
    </div>
  );
}
