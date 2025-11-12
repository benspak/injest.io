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
    if (!query || query.length < minQueryLength) {
      updateLoadingState(false);

      if (!clearedResultsRef.current) {
        onResultsChange?.([]);
        clearedResultsRef.current = true;
      }

      return;
    }

    clearedResultsRef.current = false;

    const timeoutId = setTimeout(async () => {
      updateLoadingState(true);
      try {
        const response = await apiClient.search(query, {
          filters,
        });
        const newResults = response.results ?? [];
        onResultsChange?.(newResults);
      } catch (error) {
        console.error('Search error:', error);
        onResultsChange?.([]);
      } finally {
        updateLoadingState(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
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
