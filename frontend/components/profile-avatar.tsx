'use client';

import { API_URL } from '@/lib/api';

interface ProfileAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-10 w-10 text-lg',
  md: 'h-16 w-16 text-2xl',
  lg: 'h-24 w-24 text-3xl',
  xl: 'h-32 w-32 text-4xl',
};

export function ProfileAvatar({ avatarUrl, name, size = 'md', className = '' }: ProfileAvatarProps) {
  const sizeClass = sizeClasses[size];
  const getAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    return `${API_URL}/api/uploads/${url}`;
  };

  const fullUrl = getAvatarUrl(avatarUrl);
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className={`relative ${className}`}>
      {fullUrl ? (
        <img
          src={fullUrl}
          alt={name || 'Avatar'}
          className={`${sizeClass} rounded-full object-cover border-2 border-gray-200`}
        />
      ) : (
        <div className={`${sizeClass} rounded-full bg-gray-300 flex items-center justify-center border-2 border-gray-200`}>
          <span className={`font-bold text-gray-600 ${size === 'sm' ? 'text-sm' : ''}`}>
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}
