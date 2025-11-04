'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { CaptureView } from '@/components/CaptureView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, Item } from '@/lib/api';
import { LogOut, CheckSquare, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/');
      return;
    }

    api.setToken(token);
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [userData, itemsData] = await Promise.all([
        api.getMe(),
        api.listItems({ limit: 20 }),
      ]);
      setUser(userData.user);
      setItems(itemsData.items);
    } catch (error) {
      console.error('Load error:', error);
      localStorage.removeItem('auth_token');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/');
  };

  const handleTaskify = async (itemId: string) => {
    try {
      await api.taskify(itemId);
      await loadData();
    } catch (error) {
      console.error('Taskify error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Injest.io</h1>
          <div className="flex items-center gap-4">
            <SearchBar />
            <Link href="/dashboard/tasks">
              <Button variant="ghost" size="sm">
                <CheckSquare className="h-4 w-4 mr-2" />
                Tasks
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Items</h2>
              <div className="space-y-4">
                {items.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No items yet. Start capturing!
                    </CardContent>
                  </Card>
                ) : (
                  items.map((item) => (
                    <Card key={item.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{item.type}</CardTitle>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1">
                                {item.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-2 py-0.5 bg-secondary rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTaskify(item.id)}
                          >
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardDescription>
                          {new Date(item.createdAt).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{item.clean || item.raw}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <CaptureView />
          </div>
        </div>
      </main>
    </div>
  );
}
