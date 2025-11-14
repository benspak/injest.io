'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { auth } from '@/lib/auth';
import { apiClient, type User } from '@/lib/api';
import { API_URL } from '@/lib/api';

function ProfileSettingsPageContent() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);

  // Form state
  const [publicUsername, setPublicUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [xProfileUrl, setXProfileUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [profilePrivate, setProfilePrivate] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Error states
  const [usernameError, setUsernameError] = useState('');
  const [formError, setFormError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getMyProfile();
      const userProfile = response.profile;
      setProfile(userProfile);

      // Populate form fields
      setPublicUsername(userProfile.public_username || '');
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');
      setHeadline(userProfile.headline || '');
      setBio(userProfile.bio || '');
      setCompany(userProfile.company || '');
      setProjectTitle(userProfile.project_title || '');
      setProjectDescription(userProfile.project_description || '');
      setZipCode(userProfile.zip_code || '');
      setXProfileUrl(userProfile.x_profile_url || '');
      setYoutubeUrl(userProfile.youtube_url || '');
      setGithubUrl(userProfile.github_url || '');
      setLinkedinUrl(userProfile.linkedin_url || '');
      setProfilePrivate(userProfile.profile_private || false);

      // Set avatar preview
      if (userProfile.avatar_url) {
        const avatarUrl = `${API_URL}/api/uploads/${userProfile.avatar_url}`;
        setAvatarPreview(avatarUrl);
      } else {
        setAvatarPreview(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile';
      toast.error(message);
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      setAuthReady(true);
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (authReady) {
      void loadProfile();
    }
  }, [authReady, loadProfile]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setUsernameError('');

    try {
      await apiClient.updateProfile({
        public_username: publicUsername.trim() || undefined,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        company: company.trim() || undefined,
        project_title: projectTitle.trim() || undefined,
        project_description: projectDescription.trim() || undefined,
        zip_code: zipCode.trim() || undefined,
        x_profile_url: xProfileUrl.trim() || undefined,
        youtube_url: youtubeUrl.trim() || undefined,
        github_url: githubUrl.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        avatar: avatarFile || undefined,
      });

      toast.success('Profile updated successfully');
      await loadProfile();
      // Refresh auth user to update AvatarMenu
      try {
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.user) {
          auth.setUser(userResponse.user);
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
      setAvatarFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
      setFormError(message);

      // Check if it's a username error
      if (message.toLowerCase().includes('username')) {
        setUsernameError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrivacyToggle = async () => {
    const newPrivacy = !profilePrivate;
    setProfilePrivate(newPrivacy);

    try {
      await apiClient.updateProfilePrivacy(newPrivacy);
      toast.success(`Profile is now ${newPrivacy ? 'private' : 'public'}`);
      await loadProfile();
      // Refresh auth user to update AvatarMenu
      try {
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.user) {
          auth.setUser(userResponse.user);
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update privacy setting';
      toast.error(message);
      // Revert toggle on error
      setProfilePrivate(!newPrivacy);
    }
  };

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
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold">Profile Settings</h1>
          <div className="flex items-center gap-2 sm:gap-4">
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

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-3xl space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Public Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="public-username">Public Username</Label>
                  <Input
                    id="public-username"
                    type="text"
                    value={publicUsername}
                    onChange={(e) => {
                      setPublicUsername(e.target.value);
                      setUsernameError('');
                    }}
                    placeholder="johndoe"
                    maxLength={30}
                  />
                  {usernameError && (
                    <p className="text-sm text-red-600">{usernameError}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    3-30 characters, letters, numbers, hyphens, and underscores only. This will be your public profile URL.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g., Software Engineer at Company"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500">
                    A short description that appears on your profile ({headline.length}/100 characters)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="resize-none"
                    maxLength={250}
                  />
                  <p className="text-xs text-gray-500">
                    A longer description about yourself, your interests, and what you do ({bio.length}/250 characters)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g., Acme Inc."
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500">
                    Your current company or organization ({company.length}/200 characters)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip-code">Zip Code</Label>
                  <Input
                    id="zip-code"
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="12345"
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar</Label>
                  <div className="flex items-center gap-4">
                    {avatarPreview && (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="h-20 w-20 rounded-full object-cover border border-gray-300"
                      />
                    )}
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    JPG, PNG, or WebP. Maximum 5MB. Square images recommended.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-title">Project Title</Label>
                  <Input
                    id="project-title"
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="e.g., Building a new mobile app"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500">
                    Title of the project you're working on ({projectTitle.length}/200 characters)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Project Description</Label>
                  <Textarea
                    id="project-description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Tell us about your project..."
                    rows={4}
                    className="resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500">
                    Describe what you're working on and what makes it interesting ({projectDescription.length}/500 characters)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="x-profile">X (Twitter) Profile</Label>
                  <Input
                    id="x-profile"
                    type="url"
                    value={xProfileUrl}
                    onChange={(e) => setXProfileUrl(e.target.value)}
                    placeholder="https://x.com/username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube Channel</Label>
                  <Input
                    id="youtube"
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/@username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github">GitHub Profile</Label>
                  <Input
                    id="github"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn Profile</Label>
                  <Input
                    id="linkedin"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Make Profile Private</p>
                    <p className="text-xs text-gray-500">
                      When private, your profile will not be visible to others.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrivacyToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      profilePrivate ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        profilePrivate ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/settings')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12">
          Loading profile settings...
        </div>
      }
    >
      <ProfileSettingsPageContent />
    </Suspense>
  );
}
