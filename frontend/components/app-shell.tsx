'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import type { User } from '@/lib/api';
import { auth } from '@/lib/auth';
import { ITEM_CREATED_EVENT } from '@/lib/events';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      await auth.restore();
      if (!mounted) {
        return;
      }
      setCurrentUser(auth.getUser());
    };

    void restore();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentUser(auth.getUser());
  }, [pathname]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleItemCreated = () => {
      // Close the sidebar on mobile after capturing an item
      setIsSidebarOpen(false);
    };

    window.addEventListener(ITEM_CREATED_EVENT, handleItemCreated);
    return () => {
      window.removeEventListener(ITEM_CREATED_EVENT, handleItemCreated);
    };
  }, []);

  const isHomepage = pathname === '/';

  return (
    <div className="relative min-h-screen bg-gray-50 lg:flex">
      {!isHomepage && (
        <AppSidebar
          currentUser={currentUser}
          isMobileOpen={isSidebarOpen}
          onMobileToggle={setIsSidebarOpen}
          onLogout={() => setCurrentUser(null)}
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        {!isHomepage && (
          <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 shadow-xs lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Injest.io</p>
                <p className="text-base font-semibold text-gray-900">
                  {pathname.replace('/', '') || 'Dashboard'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FeedbackDialog
                  userEmail={currentUser?.email}
                  buttonVariant="ghost"
                  buttonSize="sm"
                  triggerClassName="text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                />
                <AvatarMenu
                  user={currentUser}
                  onLogout={() => setCurrentUser(null)}
                />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
