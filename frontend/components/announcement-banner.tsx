'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const ANNOUNCEMENT_STORAGE_KEY = 'announcement-dismiss-2025-11-image-persist';

export function AnnouncementBanner() {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY);
    if (storedValue === 'true') {
      setIsOpen(false);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, 'true');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 text-white">
      <div className="container mx-auto flex max-w-full items-start gap-4 px-3 py-3 sm:px-4 md:px-6">
        <p className="text-sm leading-relaxed sm:text-base">
          Image persisting issue should now be resolved. If you have items that have metadata, but no image preview,
          please use the feedback button and let us know. We will purge your indexed files and ask you to reupload them.
          Afterwards, all image previews should persist.
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="ml-auto flex-shrink-0 rounded-full bg-white/20 p-1 text-white transition hover:bg-white/30"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
