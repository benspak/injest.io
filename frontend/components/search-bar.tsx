'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient, type SearchResult, type SearchFilters } from '@/lib/api';

interface SearchBarProps {
  onResultsChange?: (results: SearchResult[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onQueryChange?: (query: string) => void;
  minQueryLength?: number;
  filters?: SearchFilters;
}

export function SearchBar({
  onResultsChange,
  onLoadingChange,
  onQueryChange,
  minQueryLength = 2,
  filters,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const clearedResultsRef = useRef(true);
  const lastReportedLoadingRef = useRef(false);
  const lastSearchedQueryRef = useRef<string>('');
  const lastSearchedFiltersRef = useRef<string>('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateLoadingState = (next: boolean) => {
    setLoading((prev) => {
      if (prev === next) {
        return prev;
      }
      return next;
    });

    if (lastReportedLoadingRef.current !== next) {
      lastReportedLoadingRef.current = next;
      onLoadingChange?.(next);
    }
  };

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

  useEffect(() => {
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (!query || query.length < minQueryLength) {
      updateLoadingState(false);

      if (!clearedResultsRef.current) {
        onResultsChange?.([]);
        clearedResultsRef.current = true;
        lastSearchedQueryRef.current = '';
        lastSearchedFiltersRef.current = '';
      }

      return;
    }

    // Create a search key from query + filters to detect actual changes
    const normalizedQuery = query.trim().toLowerCase();
    const filtersKey = JSON.stringify(filters || {});
    const searchKey = `${normalizedQuery}::${filtersKey}`;
    const lastSearchKey = `${lastSearchedQueryRef.current}::${lastSearchedFiltersRef.current}`;

    // Only search if the query or filters actually changed
    if (searchKey === lastSearchKey) {
      return;
    }

    clearedResultsRef.current = false;

    searchTimeoutRef.current = setTimeout(async () => {
      const currentQuery = query.trim();
      const normalizedCurrentQuery = currentQuery.toLowerCase();
      const currentFiltersKey = JSON.stringify(filters || {});
      const currentSearchKey = `${normalizedCurrentQuery}::${currentFiltersKey}`;

      // Only proceed if search key is different from last search and query is valid
      if (currentSearchKey !== lastSearchKey && currentQuery.length >= minQueryLength) {
        // Store the search key we're about to execute
        const executingSearchKey = currentSearchKey;
        lastSearchedQueryRef.current = normalizedCurrentQuery;
        lastSearchedFiltersRef.current = currentFiltersKey;

        updateLoadingState(true);
        try {
          const response = await apiClient.search(currentQuery, {
            limit: 10,
            filters,
          });
          const newResults = response.results ?? [];

          // Only update if search key hasn't changed during the async operation
          const finalQuery = query.trim().toLowerCase();
          const finalFiltersKey = JSON.stringify(filters || {});
          const finalSearchKey = `${finalQuery}::${finalFiltersKey}`;

          if (finalSearchKey === executingSearchKey) {
            onResultsChange?.(newResults);
          }
        } catch (error) {
          console.error('Search error:', error);
          // Only clear if search key still matches
          const finalQuery = query.trim().toLowerCase();
          const finalFiltersKey = JSON.stringify(filters || {});
          const finalSearchKey = `${finalQuery}::${finalFiltersKey}`;

          if (finalSearchKey === executingSearchKey) {
            onResultsChange?.([]);
          }
        } finally {
          updateLoadingState(false);
        }
      }
      searchTimeoutRef.current = null;
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [filters, minQueryLength, onLoadingChange, onResultsChange, query]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search your knowledge base..."
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);
            onQueryChange?.(nextQuery);
            if (!nextQuery || nextQuery.length < minQueryLength) {
              onResultsChange?.([]);
            }
          }}
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
    </div>
  );
}
