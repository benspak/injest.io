'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { BookmarkImportCard } from '@/components/bookmark-import-card';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default function ImportsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
      }
    };

    void init();
  }, [router]);

  if (authLoading) {
    return <div className="container mx-auto px-4 py-12">Loading...</div>;
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto max-w-full px-3 py-4 sm:px-4 md:px-6 flex items-center justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">Imports</h1>
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

      <main className="container mx-auto max-w-3xl px-3 py-6 sm:px-4 md:px-6 sm:py-8 space-y-6">
        <BookmarkImportCard />

        <Card>
          <CardHeader>
            <CardTitle>Export your bookmarks as HTML</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Importing requires an HTML export of your bookmarks. Most browsers let you save one from their
              bookmarks or favorites manager.
            </p>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-900">Google Chrome</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Bookmarks Manager (Option + Command + B on macOS).</li>
                  <li>Select the three-dot menu and choose &ldquo;Export bookmarks&rdquo;.</li>
                  <li>Save the generated HTML file.</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-gray-900">Safari</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>From the menu bar choose File → Export → Bookmarks.</li>
                  <li>Pick a destination and click Save to generate an HTML file.</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-gray-900">Firefox</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open the Library window (Shift + Command + O on macOS).</li>
                  <li>Use Import and Backup → Export Bookmarks to HTML.</li>
                  <li>Save the HTML file when prompted.</li>
                </ol>
              </div>
            </div>
            <p>
              Need an export from Google services? Head to{' '}
              <Link
                href="https://takeout.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Google Takeout
              </Link>{' '}
              and include bookmarks in your export.
            </p>
            <p>
              Once you have the HTML file ready, upload it above and we&apos;ll import the bookmarks in the
              background. Items will appear in your workspace as they are processed.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
