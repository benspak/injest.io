'use client';

import { Fragment, useCallback, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FolderKanban, Inbox, LayoutDashboard, Menu, Send, UploadCloud, Users, X, Folder, ChevronRight, ChevronDown, MessageSquare, Gift, Archive, Ban, UserX, Sparkles } from 'lucide-react';
import { CaptureForm } from '@/components/capture-form';
import { AvatarMenu } from '@/components/avatar-menu';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/api';
import type { SubscriptionTier } from '@/lib/subscriptionPlans';

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
    icon: LayoutDashboard,
  },
  {
    href: '/collections',
    label: 'Collections',
    icon: Folder,
  },
  {
    href: '/contacts',
    label: 'Contacts',
    icon: Users,
  },
  {
    href: '/imports',
    label: 'Imports',
    icon: UploadCloud,
  },
  {
    href: '/referrals',
    label: 'Referrals',
    icon: Gift,
  },
];

const INBOX_SUB_ITEMS = [
  {
    href: '/send',
    label: 'Send',
    icon: Send,
  },
  {
    href: '/inbox/sent',
    label: 'Outbox',
    icon: Archive,
  },
  {
    href: '/inbox/spam',
    label: 'Spam',
    icon: Ban,
  },
  {
    href: '/inbox/unsubscribe',
    label: 'Unsubscribe',
    icon: UserX,
  },
  {
    href: '/slack',
    label: 'Slack',
    icon: MessageSquare,
  },
];

/**
 * Determine if a user is on the free tier
 */
function isFreeUser(user: User | null): boolean {
  if (!user) {
    return false;
  }

  // Check subscription_tier first
  if (user.subscription_tier) {
    return user.subscription_tier === 'free';
  }

  // Fallback to is_premium flag
  return !user.is_premium;
}

export function AppSidebar({ currentUser, isMobileOpen, onMobileToggle, onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = Boolean(currentUser);

  // Determine if inbox section should be expanded by default
  const isInboxRoute = pathname.startsWith('/inbox') || pathname === '/send' || pathname === '/slack';
  const [isInboxExpanded, setIsInboxExpanded] = useState(isInboxRoute);

  // Update expanded state when pathname changes to inbox routes
  useEffect(() => {
    if (isInboxRoute) {
      setIsInboxExpanded(true);
    }
  }, [isInboxRoute]);

  const handleNavigate = useCallback(
    (href: string) => {
      onMobileToggle(false);
      router.push(href);
    },
    [onMobileToggle, router]
  );

  const toggleInbox = useCallback(() => {
    setIsInboxExpanded((prev) => !prev);
  }, []);

  const navigation = useMemo(() => {
    const items: JSX.Element[] = [];

    NAV_ITEMS.forEach((item) => {
      // Insert Inbox section after Collections
      if (item.href === '/collections') {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        items.push(
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

        // Insert Inbox section after Collections
        const isInboxActive = pathname.startsWith('/inbox') || pathname === '/send' || pathname === '/slack';
        const ChevronIcon = isInboxExpanded ? ChevronDown : ChevronRight;

        items.push(
          <div key="inbox-section">
            <div
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isInboxActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Link
                href="/inbox"
                className="flex flex-1 items-center gap-3"
                onClick={() => handleNavigate('/inbox')}
              >
                <Inbox className="h-4 w-4" />
                <span>Inbox</span>
              </Link>
              <button
                type="button"
                onClick={toggleInbox}
                className="p-1 -mr-1 transition hover:opacity-80"
                aria-label={isInboxExpanded ? 'Collapse inbox' : 'Expand inbox'}
              >
                <ChevronIcon className="h-4 w-4" />
              </button>
            </div>
            {isInboxExpanded && (
              <div className="mt-1 space-y-1">
                {INBOX_SUB_ITEMS.map((subItem) => {
                  const isActive = pathname.startsWith(subItem.href) || pathname === subItem.href;
                  const SubIcon = subItem.icon;
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 pl-8 text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      onClick={() => handleNavigate(subItem.href)}
                    >
                      {SubIcon && <SubIcon className="h-4 w-4" />}
                      <span>{subItem.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
        return;
      }

      const Icon = item.icon;
      const isActive = pathname.startsWith(item.href);

      items.push(
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

    return items;
  }, [handleNavigate, pathname, isInboxExpanded, toggleInbox]);

  return (
    <Fragment>
      {isMobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-xs transition-opacity lg:hidden"
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

        {/* Upgrade to Pro section for free users */}
        {isAuthenticated && isFreeUser(currentUser) && (
          <div className="mt-6">
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Upgrade to Pro
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Get unlimited items, priority support, and more.
                  </p>
                  <Link href="/settings?upgrade=pro" onClick={() => onMobileToggle(false)}>
                    <Button className="w-full text-xs" size="sm" variant="default">
                      Upgrade Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

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
        className={`fixed bottom-6 right-6 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 lg:hidden ${
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
