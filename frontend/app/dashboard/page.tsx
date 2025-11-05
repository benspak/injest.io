'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SearchBar } from '@/components/search-bar';
import { CaptureForm } from '@/components/capture-form';
import { ItemList } from '@/components/item-list';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { apiClient, Item, ReceivedEmail } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Restore auth from token
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      loadItems();
    };

    checkAuth();
  }, [router]);

  const loadItems = async () => {
    try {
      // Fetch both items and emails
      const [itemsData, emailsResponse] = await Promise.all([
        apiClient.getItems(50).catch(() => []),
        apiClient.getReceivedEmails(50).catch(() => ({ data: [], has_more: false })),
      ]);

      // Transform emails into item-like format for unified display
      const emailItems: Item[] = (emailsResponse.data || []).map((email: ReceivedEmail) => {
        // Strip HTML tags for description preview
        const textPreview = email.text || (email.html ? email.html.replace(/<[^>]*>/g, '').substring(0, 200) : '');

        return {
          id: `resend-email-${email.id}`,
          owner_id: '',
          type: 'email' as const,
          title: email.subject,
          description: textPreview,
          created_at: email.created_at,
          updated_at: email.created_at,
          isResendEmail: true,
          resendEmailId: email.id,
          attachments: email.attachments?.map((att) => ({
            filename: att.id,
            originalname: att.filename,
            mimetype: att.content_type,
            size: att.size,
            attachmentId: att.id,
          })) || [],
          source: `email:${email.from}`,
        };
      });

      // Combine and sort by date (newest first)
      const allItems = [...itemsData, ...emailItems].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await apiClient.deleteItem(itemId);
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  if (authLoading || loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Injest.io</h1>
          <div className="flex gap-4 items-center">
            <Button
              variant="outline"
              onClick={() => {
                auth.logout();
                router.push('/login');
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
          {/* Search bar - first on mobile */}
          <div className="lg:hidden order-1">
            <SearchBar />
          </div>

          {/* Item list - third on mobile, first column on desktop */}
          <div className="lg:col-span-2 order-3 lg:order-1">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-4">Your Items</h2>
            </div>
            <ItemList
              items={items}
              onDelete={handleDelete}
            />
          </div>

          {/* Right sidebar - second on mobile, second column on desktop */}
          <div className="lg:col-span-1 order-2 lg:order-2">
            {/* Search bar - hidden on mobile, shown on desktop */}
            <div className="mb-4 hidden lg:block">
              <SearchBar />
            </div>
            <CaptureForm onItemCreated={loadItems} />
          </div>
        </div>
      </main>
    </div>
  );
}
