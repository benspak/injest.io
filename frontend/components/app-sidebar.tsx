'use client';

import { Fragment, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Code, FolderKanban, Home, Menu, Send, UploadCloud, Users, X } from 'lucide-react';
import { CaptureForm } from '@/components/capture-form';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AvatarMenu } from '@/components/avatar-menu';
import type { User } from '@/lib/api';

type AppSidebarProps = {
  currentUser: User | null;
  isMobileOpen: boolean;
  onMobileToggle: (nextOpen: boolean) => void;
  onLogout: () => void;
};

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: Home,
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: FolderKanban,
  },
  {
    href: '/send',
    label: 'Send',
    icon: Send,
  },
  {
    href: '/imports',
    label: 'Imports',
    icon: UploadCloud,
  },
  {
    href: '/contacts',
    label: 'Contacts',
    icon: Users,
  },
  {
    href: '/developers',
    label: 'API Docs',
    icon: Code,
  },
];

export function AppSidebar({ currentUser, isMobileOpen, onMobileToggle, onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = Boolean(currentUser);

  const handleNavigate = useCallback(
    (href: string) => {
      onMobileToggle(false);
      router.push(href);
    },
    [onMobileToggle, router]
  );

  const navigation = useMemo(() => {
    return NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const isActive = pathname.startsWith(item.href);

      return (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            isActive
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          onClick={() => handleNavigate(item.href)}
        >
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      );
    });
  }, [handleNavigate, pathname]);

  return (
    <Fragment>
      {isMobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => onMobileToggle(false)}
          aria-label="Close sidebar overlay"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-gray-200 bg-white px-4 py-6 transition-transform duration-200 ease-in-out lg:w-96 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        aria-label="Primary"
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-gray-900" onClick={() => onMobileToggle(false)}>
            Injest.io
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 lg:hidden"
            onClick={() => onMobileToggle(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-1">{navigation}</div>

        <div className="mt-2">
          <FeedbackDialog
            userEmail={currentUser?.email}
            buttonVariant="ghost"
            buttonSize="sm"
            triggerClassName="w-full justify-start gap-3 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            buttonText="Feedback"
          />
        </div>

        {isAuthenticated ? (
          <div className="mt-6 space-y-4 overflow-y-auto pb-6">
            <CaptureForm />
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <p className="font-medium text-gray-900">Log in to capture new items</p>
            <p className="mt-1 text-xs text-gray-600">
              Uploads and imports are available once you sign in.
            </p>
          </div>
        )}

        <div className="mt-auto" />
      </aside>

      <button
        type="button"
        className={`fixed bottom-6 right-6 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 lg:hidden ${
          isMobileOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        onClick={() => onMobileToggle(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
    </Fragment>
  );
}
