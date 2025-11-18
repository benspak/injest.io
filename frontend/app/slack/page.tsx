'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemList } from '@/components/item-list';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { auth } from '@/lib/auth';
import { apiClient, Item } from '@/lib/api';
import { toast } from 'sonner';
import { ExternalLink, MessageSquare, Hash } from 'lucide-react';

interface SlackMessage {
  id: string;
  item: Item;
  slackMessage: {
    workspaceId: string;
    channelId: string;
    messageTs: string;
    threadTs: string | null;
    text: string | null;
  };
  channel: {
    name: string | null;
    type: string | null;
  } | null;
  permalink: string;
}

export default function SlackPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [channels, setChannels] = useState<Array<{ id: string; name: string | null }>>([]);
  const [ingesting, setIngesting] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const BATCH_SIZE = 50;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await auth.restore();
        await auth.waitForRestore();
        if (!auth.isAuthenticated()) {
          router.push('/login');
          return;
        }
        setAuthLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const loadChannels = useCallback(async () => {
    try {
      // Get channels from messages
      const channelMap = new Map<string, string | null>();
      messages.forEach(msg => {
        if (msg.channel && !channelMap.has(msg.slackMessage.channelId)) {
          channelMap.set(msg.slackMessage.channelId, msg.channel.name);
        }
      });
      setChannels(Array.from(channelMap.entries()).map(([id, name]) => ({ id, name })));
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  }, [messages]);

  const loadMessages = useCallback(async (currentOffset: number = 0, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setMessages([]);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const response = await apiClient.getSlackMessages(
        undefined, // workspaceId - get all
        selectedChannel || undefined,
        BATCH_SIZE,
        currentOffset
      );

      console.log('[SlackPage] Loaded messages:', {
        count: response.messages?.length || 0,
        total: response.total,
        offset: currentOffset,
      });

      if (reset) {
        setMessages(response.messages || []);
      } else {
        setMessages(prev => [...prev, ...(response.messages || [])]);
      }

      setHasMore((response.messages?.length || 0) === BATCH_SIZE);
      setOffset(currentOffset + (response.messages?.length || 0));
    } catch (error) {
      console.error('Error loading Slack messages:', error);
      toast.error(`Failed to load Slack messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedChannel, BATCH_SIZE]);

  useEffect(() => {
    if (!authLoading && auth.isAuthenticated()) {
      // Get workspace ID from tokens
      apiClient.getSlackStatus().then(status => {
        if (status.connected && status.workspaceId) {
          setWorkspaceId(status.workspaceId);
        }
      });
      loadMessages(0, true);
    }
  }, [authLoading, loadMessages]);

  const handleIngest = async () => {
    if (!workspaceId) {
      toast.error('No workspace connected');
      return;
    }

    setIngesting(true);
    try {
      await apiClient.ingestSlackWorkspace(workspaceId);
      toast.success('Ingestion started! Messages will appear shortly.');
      // Reload messages after a short delay
      setTimeout(() => {
        loadMessages(0, true);
      }, 2000);
    } catch (error) {
      console.error('Error starting ingestion:', error);
      toast.error(`Failed to start ingestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIngesting(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (authLoading || loading || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          loadMessages(offset);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreSentinelRef.current) {
      observer.observe(loadMoreSentinelRef.current);
    }

    return () => {
      if (loadMoreSentinelRef.current) {
        observer.unobserve(loadMoreSentinelRef.current);
      }
    };
  }, [authLoading, loading, loadingMore, hasMore, offset, loadMessages]);

  // Convert Slack messages to items for ItemList
  const items: Item[] = messages.map(msg => ({
    ...msg.item,
    source: `slack:${msg.slackMessage.workspaceId}:${msg.slackMessage.channelId}`,
    tags: [...(msg.item.tags || []), 'slack', msg.channel?.name || 'slack'].filter(Boolean),
    notes: msg.slackMessage.threadTs
      ? `Thread: ${msg.slackMessage.threadTs}\nMessage: ${msg.slackMessage.messageTs}`
      : `Message: ${msg.slackMessage.messageTs}`,
    url: msg.permalink, // Use permalink as URL for quick access
  }));

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AvatarMenu user={currentUser} />
              <h1 className="text-xl font-semibold text-gray-900">Slack Messages</h1>
            </div>
            <div className="flex items-center gap-2">
              {workspaceId && (
                <Button
                  variant="default"
                  onClick={handleIngest}
                  disabled={ingesting}
                >
                  {ingesting ? 'Ingesting...' : 'Sync Messages'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push('/inbox')}
              >
                Back to Inbox
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* Channel filter */}
          {channels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Filter by Channel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedChannel === '' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedChannel('');
                      loadMessages(0, true);
                    }}
                  >
                    All Channels
                  </Button>
                  {channels.map(channel => (
                    <Button
                      key={channel.id}
                      variant={selectedChannel === channel.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedChannel(channel.id);
                        loadMessages(0, true);
                      }}
                    >
                      #{channel.name || 'Unknown'}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Messages list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages ({messages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && messages.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center space-y-4">
                  <p className="text-muted-foreground">
                    No Slack messages found yet.
                  </p>
                  {workspaceId && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Click "Sync Messages" above to import messages from your Slack workspace.
                      </p>
                      <Button
                        variant="default"
                        onClick={handleIngest}
                        disabled={ingesting}
                      >
                        {ingesting ? 'Ingesting...' : 'Sync Messages Now'}
                      </Button>
                    </div>
                  )}
                  {!workspaceId && (
                    <p className="text-sm text-muted-foreground">
                      Please connect your Slack workspace in settings first.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <ItemList items={items} />
                  {hasMore && (
                    <div ref={loadMoreSentinelRef} className="py-4 text-center">
                      {loadingMore && (
                        <p className="text-sm text-muted-foreground">Loading more messages...</p>
                      )}
                    </div>
                  )}
                  {!hasMore && messages.length > 0 && (
                    <div className="py-4 text-center">
                      <p className="text-sm text-muted-foreground">All messages loaded</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
