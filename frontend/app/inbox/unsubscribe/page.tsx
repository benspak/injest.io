'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { auth } from '@/lib/auth';
import { apiClient, type Item } from '@/lib/api';
import { extractUnsubscribeLinks, type UnsubscribeLink } from '@/lib/unsubscribeExtractor';
import { ExternalLink, Mail, Calendar } from 'lucide-react';

export default function UnsubscribePage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [unsubscribeLinks, setUnsubscribeLinks] = useState<UnsubscribeLink[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadUnsubscribeLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all email items
      // We'll fetch in batches to get all emails
      const allItems: Item[] = [];
      const BATCH_SIZE = 100;
      let offset = 0;
      let hasMore = true;
      const MAX_ITEMS = 1000; // Limit to prevent excessive loading

      while (hasMore && allItems.length < MAX_ITEMS) {
        const items = await apiClient.getItems(BATCH_SIZE, offset, {});
        if (items.length === 0) {
          hasMore = false;
          break;
        }
        allItems.push(...items);
        hasMore = items.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      }

      // Filter to only email items
      const emailItems = allItems.filter((item) => item.type === 'email');

      if (emailItems.length === 0) {
        setUnsubscribeLinks([]);
        return;
      }

      // Extract unsubscribe links from all emails
      const allLinks: UnsubscribeLink[] = [];
      emailItems.forEach((item) => {
        try {
          const links = extractUnsubscribeLinks(item);
          allLinks.push(...links);
        } catch (err) {
          // Skip items that fail to parse
          console.warn('Failed to extract unsubscribe links from item:', item.id, err);
        }
      });

      // Remove duplicates (same URL from same email)
      const uniqueLinks = allLinks.filter((link, index, self) =>
        index === self.findIndex((l) => l.url === link.url && l.emailId === link.emailId)
      );

      // Sort by date (newest first)
      uniqueLinks.sort((a, b) => {
        const dateA = new Date(a.emailDate).getTime();
        const dateB = new Date(b.emailDate).getTime();
        return dateB - dateA;
      });

      setUnsubscribeLinks(uniqueLinks);
    } catch (err) {
      console.error('Error loading unsubscribe links:', err);
      setError('Failed to load unsubscribe links. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      loadUnsubscribeLinks();
    };

    checkAuth();
  }, [router, loadUnsubscribeLinks]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const currentUser = auth.getUser();
  const inboxLocalPart =
    currentUser?.inbound_email_handle ||
    currentUser?.public_username ||
    currentUser?.email?.split('@')[0] ||
    '';
  const inboxAddress = inboxLocalPart ? `${inboxLocalPart}@injest.io` : '';

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Unsubscribe</h1>
            {inboxAddress && (
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700 border border-gray-200 max-w-full">
                <span className="uppercase tracking-wide text-gray-500">Your email inbox</span>
                <span className="truncate font-semibold text-gray-900">{inboxAddress}</span>
              </div>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex sm:gap-4">
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

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {unsubscribeLinks.length === 0 && !loading && (
          <div className="rounded-lg bg-white border border-gray-200 p-8 text-center">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No unsubscribe links found</h2>
            <p className="text-sm text-gray-600">
              We couldn't find any unsubscribe links in your emails. This could mean:
            </p>
            <ul className="mt-4 text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
              <li>• Your emails don't contain unsubscribe links</li>
              <li>• The links are in a format we don't recognize</li>
              <li>• You haven't received any emails yet</li>
            </ul>
          </div>
        )}

        {unsubscribeLinks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold text-gray-900">{unsubscribeLinks.length}</span>{' '}
                unsubscribe {unsubscribeLinks.length === 1 ? 'link' : 'links'}
              </p>
            </div>

            <div className="space-y-3">
              {unsubscribeLinks.map((link, index) => (
                <div
                  key={`${link.emailId}-${link.url}-${index}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {link.emailFrom || 'Unknown sender'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2 line-clamp-1">{link.emailSubject}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(link.emailDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline break-all max-w-full"
                        onClick={(e) => {
                          // Allow the link to open, but also log for analytics if needed
                          console.log('Unsubscribe link clicked:', link.url);
                        }}
                      >
                        <span className="break-all">{link.url}</span>
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
