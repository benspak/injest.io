'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, Item } from '@/lib/api';
import { auth } from '@/lib/auth';

type Attachment = {
  filename: string;
  originalname: string;
  mimetype?: string;
  size?: number;
  attachmentId?: string;
};

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      await auth.restore();

      if (!auth.isAuthenticated()) {
        router.replace('/login');
        return;
      }

      const itemId = params?.id;
      if (!itemId) {
        setError('Missing item id');
        setLoading(false);
        return;
      }

      try {
        const data = await apiClient.getItem(itemId);
        setItem(data);
      } catch (err) {
        console.error('Error loading item:', err);
        setError('Unable to load item. It may have been deleted or you may not have access.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params?.id, router]);

  const imageAttachments = useMemo(() => {
    if (!Array.isArray(item?.attachments)) {
      return [];
    }

    return (item.attachments as Attachment[]).filter((attachment) =>
      apiClient.isImageMimetype(attachment.mimetype)
    );
  }, [item?.attachments]);

  const otherAttachments = useMemo(() => {
    if (!Array.isArray(item?.attachments)) {
      return [];
    }

    return (item.attachments as Attachment[]).filter(
      (attachment) => !apiClient.isImageMimetype(attachment.mimetype)
    );
  }, [item?.attachments]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString();
  };

  const handleDownload = async (attachment: Attachment) => {
    if (!item) return;

    try {
      await apiClient.downloadFile(item.id, attachment.filename);
    } catch (err) {
      console.error('Error downloading attachment:', err);
      toast.error(`Failed to download ${attachment.originalname}.`);
    }
  };

  if (!auth.isAuthenticated() && !loading) {
    return null;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex flex-col gap-1">
            <Link href="/tasks" className="text-sm text-blue-600 hover:underline">
              ← Back to Tasks
            </Link>
            <h1 className="text-xl font-semibold">Item Details</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
              onClick={() => router.push('/dashboard')}
            >
              Dashboard
            </Button>
            <FeedbackDialog
              userEmail={currentUser?.email}
              buttonVariant="outline"
              buttonSize="sm"
              triggerClassName="text-xs sm:text-sm"
            />
            <AvatarMenu user={currentUser} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading item…</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        ) : item ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">
                {item.title || 'Untitled item'}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                <span>Created: {formatDate(item.created_at)}</span>
                <span className="mx-2">•</span>
                <span>Updated: {formatDate(item.updated_at)}</span>
                {item.type && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="capitalize">{item.type}</span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {imageAttachments.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-gray-700">Image attachments</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {imageAttachments.map((attachment) => (
                      <div
                        key={attachment.filename}
                        className="overflow-hidden rounded-md border border-gray-200 bg-muted"
                      >
                        <img
                          src={apiClient.getFileUrl(item.id, attachment.filename, true)}
                          alt={attachment.originalname}
                          className="h-auto w-full object-contain"
                          onError={(event) => {
                            (event.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="border-t bg-white px-3 py-2">
                          <p className="text-sm font-medium">{attachment.originalname}</p>
                          {attachment.size && (
                            <p className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(0)} KB
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {otherAttachments.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-gray-700">Attachments</h2>
                  <ul className="space-y-2">
                    {otherAttachments.map((attachment) => (
                      <li
                        key={attachment.filename}
                        className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{attachment.originalname}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.mimetype || 'Unknown type'}
                            {attachment.size ? ` • ${(attachment.size / 1024).toFixed(0)} KB` : ''}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(attachment)}>
                          Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {item.url && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-700">Source link</h2>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline break-all"
                  >
                    {item.url}
                    <svg
                      className="ml-1 h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.5 19.5l15-15M9 4.5h10.5V15"
                      />
                    </svg>
                  </a>
                </section>
              )}

              {(item.description || item.clean) && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-700">Description</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.description || item.clean}
                  </p>
                </section>
              )}

              {item.notes && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-700">Notes</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>
                </section>
              )}

              {item.tags && item.tags.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-700">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
