'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient, type PublicProfile, type Item, API_URL } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function PublicProfilePageContent() {
  const params = useParams();
  const username = params?.username as string;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileItems, setProfileItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!username) {
        setError('Username is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getPublicProfile(username);
        setProfile(response.profile);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        setError(message);

        // Check if it's a 404 or 403
        if (err instanceof Error && 'status' in err) {
          const status = (err as { status: number }).status;
          if (status === 404) {
            setError('Profile not found');
          } else if (status === 403) {
            setError('This profile is private');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [username]);

  useEffect(() => {
    const loadProfileItems = async () => {
      if (!username || error || !profile) {
        return;
      }

      try {
        setItemsLoading(true);
        const response = await apiClient.getProfileItems(username);
        setProfileItems(response.items);
      } catch (err) {
        console.error('Failed to load profile items:', err);
        // Don't show error to user, just log it
      } finally {
        setItemsLoading(false);
      }
    };

    void loadProfileItems();
  }, [username, profile, error]);

  const getAvatarUrl = (avatarUrl: string | null): string | null => {
    if (!avatarUrl) return null;
    return `${API_URL}/api/uploads/${avatarUrl}`;
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'x':
      case 'twitter':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'youtube':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );
      case 'github':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
              <p className="text-gray-600">{error || 'The profile you are looking for does not exist.'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avatarUrl = getAvatarUrl(profile.avatar_url);
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.public_username || 'User';

  const formatJoinDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `Joined ${month} ${year}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-4xl space-y-6">
        {/* Top Section: Short User Details */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center space-y-3">
              {/* Avatar */}
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-24 w-24 rounded-full object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center border-2 border-white shadow-md">
                    <span className="text-3xl font-bold text-gray-600">
                      {fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                {profile.public_username && (
                  <p className="text-gray-500 text-sm mt-0.5">@{profile.public_username}</p>
                )}
              </div>

              {/* Headline */}
              {profile.headline && (
                <p className="text-base text-gray-700 font-medium">{profile.headline}</p>
              )}

              {/* Location and Join Date */}
              {(profile.city || profile.created_at) && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-500">
                  {profile.city && (
                    <span className="inline-flex items-center">
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {profile.city}
                    </span>
                  )}
                  {profile.city && profile.created_at && (
                    <span>•</span>
                  )}
                  {profile.created_at && (
                    <span>{formatJoinDate(profile.created_at)}</span>
                  )}
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <div className="max-w-2xl w-full mt-2">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
                </div>
              )}

              {/* Social Links */}
              {(profile.x_profile_url || profile.youtube_url || profile.github_url || profile.linkedin_url) && (
                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  {profile.x_profile_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-2"
                    >
                      <a
                        href={profile.x_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        {getSocialIcon('x')}
                        <span>X</span>
                      </a>
                    </Button>
                  )}
                  {profile.youtube_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-2"
                    >
                      <a
                        href={profile.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        {getSocialIcon('youtube')}
                        <span>YouTube</span>
                      </a>
                    </Button>
                  )}
                  {profile.github_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-2"
                    >
                      <a
                        href={profile.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        {getSocialIcon('github')}
                        <span>GitHub</span>
                      </a>
                    </Button>
                  )}
                  {profile.linkedin_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-2"
                    >
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        {getSocialIcon('linkedin')}
                        <span>LinkedIn</span>
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Section */}
        {profile.company && (
          <Card className="border-2 border-blue-200 bg-blue-50/30">
            <CardContent className="pt-8 pb-8 px-6">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shadow-sm">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Current Company</h2>
                  <p className="text-base text-gray-800 font-medium leading-relaxed">{profile.company}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Project Section */}
        {(profile.project_title || profile.project_description) && (
          <Card className="border-2 border-purple-200 bg-purple-50/30">
            <CardContent className="pt-8 pb-8 px-6">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shadow-sm">
                    <svg
                      className="w-6 h-6 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-3">Current Project</h2>
                    {profile.project_title && (
                      <h3 className="text-base font-semibold text-gray-800 mb-3">{profile.project_title}</h3>
                    )}
                  </div>
                  {profile.project_description && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {profile.project_description}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items Feed Section */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Posted Items</h2>
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : profileItems.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No items posted yet.</p>
            ) : (
              <div className="space-y-0">
                {profileItems.map((item) => {
                  const formatRelativeTime = (date: Date) => {
                    const now = new Date();
                    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

                    if (diffInSeconds < 60) {
                      return 'just now';
                    }

                    const diffInMinutes = Math.floor(diffInSeconds / 60);
                    if (diffInMinutes < 60) {
                      return `${diffInMinutes}m ago`;
                    }

                    const diffInHours = Math.floor(diffInMinutes / 60);
                    if (diffInHours < 24) {
                      return `${diffInHours}h ago`;
                    }

                    const diffInDays = Math.floor(diffInHours / 24);
                    if (diffInDays < 7) {
                      return `${diffInDays}d ago`;
                    }

                    const diffInWeeks = Math.floor(diffInDays / 7);
                    if (diffInWeeks < 4) {
                      return `${diffInWeeks}w ago`;
                    }

                    const diffInMonths = Math.floor(diffInDays / 30);
                    if (diffInMonths < 12) {
                      return `${diffInMonths}mo ago`;
                    }

                    const diffInYears = Math.floor(diffInDays / 365);
                    return `${diffInYears}y ago`;
                  };

                  const date = new Date(item.created_at);
                  const timeAgo = formatRelativeTime(date);

                  // Get title for display
                  const itemTitle = item.link_metadata?.title || item.title || 'Untitled';

                  // Get description preview
                  const descriptionPreview = item.link_metadata?.description || item.description || '';
                  const truncatedDescription = descriptionPreview.length > 150
                    ? descriptionPreview.substring(0, 150) + '...'
                    : descriptionPreview;

                  // Get image for preview - prioritize metadata image, then first image attachment
                  let previewImage: string | null = null;
                  let previewImageAlt = '';

                  if (item.link_metadata?.image) {
                    previewImage = item.link_metadata.image;
                    previewImageAlt = item.link_metadata.title || 'Preview';
                  } else if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
                    const imageAttachments = item.attachments.filter((file: any) =>
                      apiClient.isImageMimetype(file.mimetype)
                    );
                    if (imageAttachments.length > 0) {
                      const firstImage = imageAttachments[0];
                      previewImage = apiClient.getAttachmentPreviewUrl(item.id, firstImage, true);
                      previewImageAlt = firstImage.originalname || 'Attachment';
                    }
                  }

                  return (
                    <Link
                      key={item.id}
                      href={`/items/${item.id}`}
                      className="block cursor-pointer border-b border-gray-200 hover:bg-gray-50 transition-colors px-4 py-3 group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Left side - image preview */}
                        {previewImage && (
                          <div className="flex-shrink-0 w-32 h-32 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                            <img
                              src={previewImage}
                              alt={previewImageAlt}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        {/* Right side - main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 truncate flex-1">
                              {itemTitle}
                            </h3>
                          </div>

                          {/* Description preview */}
                          {truncatedDescription && (
                            <p className="text-xs text-gray-600 line-clamp-1 mb-1.5">
                              {truncatedDescription}
                            </p>
                          )}

                          {/* Metadata row */}
                          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                            <span className="whitespace-nowrap">{timeAgo}</span>
                            {item.type && (
                              <>
                                <span>•</span>
                                <span className="whitespace-nowrap capitalize">{item.type}</span>
                              </>
                            )}
                            {item.source && (
                              <>
                                <span>•</span>
                                <span className="whitespace-nowrap truncate max-w-[200px]">{item.source}</span>
                              </>
                            )}
                            {item.attachments && item.attachments.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="whitespace-nowrap">
                                  {item.attachments.length} attachment{item.attachments.length !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                            {item.url && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[200px] text-blue-600">
                                  {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function PublicProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <PublicProfilePageContent />
    </Suspense>
  );
}
