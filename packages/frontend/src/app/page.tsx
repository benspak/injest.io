'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Item } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Plus, CheckCircle2, Circle, Brain } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [showCapture, setShowCapture] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await api.getItems({ limit: 20 });
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const results = await api.searchItems(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!captureText.trim()) return;
    try {
      await api.createItem({ raw: captureText });
      setCaptureText('');
      setShowCapture(false);
      loadItems();
    } catch (error) {
      console.error('Capture failed:', error);
    }
  };

  const handleTaskify = async (id: string) => {
    try {
      await api.taskifyItem(id);
      loadItems();
    } catch (error) {
      console.error('Taskify failed:', error);
    }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    try {
      await api.toggleTask(id, !completed);
      loadItems();
    } catch (error) {
      console.error('Toggle task failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Brain AI</h1>
          </div>
          <Button onClick={() => setShowCapture(!showCapture)}>
            <Plus className="h-4 w-4 mr-2" />
            Capture
          </Button>
        </div>

        {/* Global Search */}
        <div className="mb-8">
          <div className="flex gap-2">
            <Input
              placeholder="Ask your brain anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        {/* Capture Form */}
        {showCapture && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Capture</CardTitle>
              <CardDescription>Throw anything at your brain</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                placeholder="Type, paste, or paste a link..."
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowCapture(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCapture}>Save</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Search Results</h2>
            <div className="space-y-4">
              {searchResults.map((result, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle>{result.title || 'Result'}</CardTitle>
                    <CardDescription>
                      Similarity: {(result.similarity * 100).toFixed(1)}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {result.clean || result.raw}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTaskify(result.id)}
                      >
                        Taskify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Items */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Recent Items</h2>
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {item.title || item.type}
                      </CardTitle>
                      <CardDescription>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {item.isTask && (
                      <button
                        onClick={() => handleToggleTask(item.id, item.taskCompleted || false)}
                        className="mt-1"
                      >
                        {item.taskCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">
                    {item.clean || item.raw.substring(0, 200)}
                    {item.raw.length > 200 && '...'}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex gap-2 mb-4">
                      {item.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-secondary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {!item.isTask && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTaskify(item.id)}
                      >
                        Taskify
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
