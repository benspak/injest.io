'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { User } from '@/lib/api';
import { auth } from '@/lib/auth';

type AvatarMenuProps = {
  user: User | null;
};

export function AvatarMenu({ user }: AvatarMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const avatarInitial = useMemo(() => {
    if (!user?.email) {
      return '?';
    }

    return user.email.charAt(0).toUpperCase();
  }, [user]);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatarInitial}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
            {user.is_premium && <p className="mt-1 text-xs font-semibold uppercase text-blue-600">Pro</p>}
          </div>
          <div className="flex flex-col">
            <Link
              href="/settings"
              role="menuitem"
              className="px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
