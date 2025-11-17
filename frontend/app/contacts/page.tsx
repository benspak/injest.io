'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient, API_URL, type Contact } from '@/lib/api';
import { auth } from '@/lib/auth';
import { toast } from 'sonner';

const CONTACTS_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

type LoadContactsOptions = {
  offset?: number;
  reset?: boolean;
  search?: string;
};

export default function ContactsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; contact?: Contact } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [matchedProfileUsername, setMatchedProfileUsername] = useState<string | null>(null);
  const [loadingMatchedProfile, setLoadingMatchedProfile] = useState(false);
  const [formValues, setFormValues] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedinUrl: string;
    xUrl: string;
    githubUrl: string;
  }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    xUrl: '',
    githubUrl: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const contactStreamRef = useRef<EventSource | null>(null);
  const [contactStreamRetry, setContactStreamRetry] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const importToastIdsRef = useRef<Map<string, string | number>>(new Map());

  const matchesSearch = useCallback((contact: Contact, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    const name = contact.name?.toLowerCase() ?? '';
    const email = contact.email?.toLowerCase() ?? '';
    const phone = contact.phone ?? '';
    const phoneDigits = phone.replace(/\D+/g, '');
    const queryDigits = normalizedQuery.replace(/\D+/g, '');

    if (name.includes(normalizedQuery) || email.includes(normalizedQuery)) {
      return true;
    }

    if (queryDigits) {
      return phoneDigits.includes(queryDigits);
    }

    return false;
  }, []);

  const loadContacts = useCallback(
    async ({ offset = 0, reset = false, search }: LoadContactsOptions = {}) => {
      const effectiveSearch = search ?? appliedSearch;

      if (reset) {
        setLoading(true);
        setError(null);
        setContacts([]);
        setHasMore(false);
        setNextOffset(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await apiClient.getContacts(CONTACTS_PAGE_SIZE, offset, effectiveSearch);
        const incoming = response.contacts ?? [];

        setContacts((prev) => {
          if (reset) {
            return incoming;
          }

          const existingIds = new Set(prev.map((contact) => contact.id));
          const merged = [...prev];

          incoming.forEach((contact) => {
            if (!existingIds.has(contact.id)) {
              merged.push(contact);
            }
          });

          return merged;
        });

        setHasMore(response.pagination?.hasMore ?? false);
        setNextOffset(response.pagination?.nextOffset ?? null);
      } catch (fetchError) {
        console.error('Failed to load contacts:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load contacts');
      } finally {
        if (reset) {
          setLoading(false);
        }
        setLoadingMore(false);
      }
    },
    [appliedSearch]
  );

  const refreshContactCount = useCallback(
    async (searchTerm: string) => {
      try {
        const response = await apiClient.getContactCount(searchTerm);
        setContactsCount(response.count);
      } catch (error) {
        console.error('Failed to load contact count:', error);
      }
    },
    []
  );

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
      }
    };

    void initialize();
  }, [router]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!auth.isAuthenticated()) {
      return;
    }

    void loadContacts({ offset: 0, reset: true });
  }, [appliedSearch, authLoading, loadContacts]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!auth.isAuthenticated()) {
      return;
    }

    void refreshContactCount(appliedSearch);
  }, [appliedSearch, authLoading, refreshContactCount]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (authLoading) {
      return;
    }

    if (!auth.isAuthenticated()) {
      if (contactStreamRef.current) {
        contactStreamRef.current.close();
        contactStreamRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    const apiUrl = API_URL.replace(/\/+$/, '');
    const streamUrl = `${apiUrl}/api/contacts/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);
    contactStreamRef.current = eventSource;

    const handleUpserted = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const contact = payload?.contact as Contact | undefined;
        if (!contact || !contact.id) {
          return;
        }

        setContacts((prev) => {
          const existingIndex = prev.findIndex((existing) => existing.id === contact.id);
          const matches = matchesSearch(contact, appliedSearch);

          if (!matches) {
            if (existingIndex >= 0) {
              const next = prev.filter((existing) => existing.id !== contact.id);
              return next;
            }
            return prev;
          }

          const next = existingIndex >= 0
            ? prev.map((existing, index) => (index === existingIndex ? contact : existing))
            : [contact, ...prev];

          return next
            .slice()
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });

        void refreshContactCount(appliedSearch);
      } catch (error) {
        console.error('Failed to handle contact stream event:', error);
      }
    };

    const handleDeleted = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const contactId = payload?.contactId as string | undefined;
        if (!contactId) {
          return;
        }
        setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
        void refreshContactCount(appliedSearch);
      } catch (error) {
        console.error('Failed to handle contact deletion event:', error);
      }
    };

    const handleImportStatus = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as {
          status?: 'started' | 'completed' | 'failed';
          importId?: string;
          fileName?: string;
          total?: number;
          imported?: number;
          skipped?: { duplicates?: number; missingDetails?: number };
          error?: string;
        };

        const status = payload?.status;
        const importId = payload?.importId;

        if (!status || !importId) {
          return;
        }

        const fileLabel = payload.fileName ? `"${payload.fileName}"` : 'the uploaded file';
        const skippedDuplicates = payload.skipped?.duplicates ?? 0;
        const skippedMissingDetails = payload.skipped?.missingDetails ?? 0;
        const skippedTotal = skippedDuplicates + skippedMissingDetails;

        if (status === 'started') {
          const total = payload.total ?? 0;
          const message =
            total > 0
              ? `Importing ${total} contact${total === 1 ? '' : 's'} from ${fileLabel}...`
              : `Importing contacts from ${fileLabel}...`;
          const toastId = toast.loading(message);
          importToastIdsRef.current.set(importId, toastId);
          return;
        }

        const existingToastId = importToastIdsRef.current.get(importId);
        const toastOptions: { id?: string | number; duration: number } =
          existingToastId !== undefined
            ? { id: existingToastId, duration: 6000 }
            : { duration: 6000 };

        if (status === 'completed') {
          const imported = payload.imported ?? 0;
          const total = payload.total ?? 0;

          let message = `Imported ${imported} contact${imported === 1 ? '' : 's'}`;
          if (total > 0) {
            message += ` from ${total} record${total === 1 ? '' : 's'}`;
          }
          message += ` in ${fileLabel}.`;

          if (skippedTotal > 0) {
            message += ` Skipped ${skippedTotal} entr${skippedTotal === 1 ? 'y' : 'ies'} (duplicates or missing details).`;
          }

          toast.success(message, toastOptions);
          if (existingToastId) {
            importToastIdsRef.current.delete(importId);
          }
          return;
        }

        if (status === 'failed') {
          const errorMessage = payload.error ?? 'Failed to import contacts.';
          toast.error(errorMessage, toastOptions);
          if (existingToastId) {
            importToastIdsRef.current.delete(importId);
          }
        }
      } catch (error) {
        console.error('Failed to handle contact import status event:', error);
      }
    };

    eventSource.addEventListener('contact-upserted', handleUpserted);
    eventSource.addEventListener('contact-deleted', handleDeleted);
    eventSource.addEventListener('contact-import', handleImportStatus);

    eventSource.onerror = (error) => {
      console.error('Contact stream error:', error);
      eventSource.close();
      contactStreamRef.current = null;
      setTimeout(() => {
        setContactStreamRetry((retry) => retry + 1);
      }, 3000);
    };

    return () => {
      eventSource.removeEventListener('contact-upserted', handleUpserted);
      eventSource.removeEventListener('contact-deleted', handleDeleted);
      eventSource.removeEventListener('contact-import', handleImportStatus);
      eventSource.close();
      if (contactStreamRef.current === eventSource) {
        contactStreamRef.current = null;
      }
    };
  }, [appliedSearch, authLoading, contactStreamRetry, matchesSearch, refreshContactCount]);

  const currentUser = auth.getUser();

  const resetDialog = useCallback(() => {
    setDialogState(null);
    setFormValues({ firstName: '', lastName: '', email: '', phone: '', linkedinUrl: '', xUrl: '', githubUrl: '' });
    setFormError(null);
    setSavingContact(false);
  }, []);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsDialogOpen(false);
        resetDialog();
      } else {
        setIsDialogOpen(true);
      }
    },
    [resetDialog]
  );

  const openCreateDialog = useCallback(() => {
    setDialogState({ mode: 'create' });
    setFormValues({ firstName: '', lastName: '', email: '', phone: '', linkedinUrl: '', xUrl: '', githubUrl: '' });
    setFormError(null);
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((contact: Contact) => {
    setDialogState({ mode: 'edit', contact });
    setFormValues({
      firstName: contact.first_name ?? '',
      lastName: contact.last_name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      linkedinUrl: contact.linkedin_url ?? '',
      xUrl: contact.x_url ?? '',
      githubUrl: contact.github_url ?? '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  }, []);

  const handleFormChange = useCallback(
    (field: 'firstName' | 'lastName' | 'email' | 'phone' | 'linkedinUrl' | 'xUrl' | 'githubUrl', value: string) => {
      setFormValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleSubmitContact = useCallback(async () => {
    if (!dialogState) {
      return;
    }

    const trimmedFirstName = formValues.firstName.trim();
    const trimmedLastName = formValues.lastName.trim();
    const trimmedEmail = formValues.email.trim();
    const trimmedPhone = formValues.phone.trim();
    const trimmedLinkedinUrl = formValues.linkedinUrl.trim();
    const trimmedXUrl = formValues.xUrl.trim();
    const trimmedGithubUrl = formValues.githubUrl.trim();

    if (!trimmedFirstName && !trimmedLastName && !trimmedEmail && !trimmedPhone) {
      setFormError('Provide at least one of first name, last name, email, or phone.');
      return;
    }

    setFormError(null);
    setSavingContact(true);

    const payload = {
      firstName: trimmedFirstName || null,
      lastName: trimmedLastName || null,
      email: trimmedEmail || null,
      phone: trimmedPhone || null,
      linkedinUrl: trimmedLinkedinUrl || null,
      xUrl: trimmedXUrl || null,
      githubUrl: trimmedGithubUrl || null,
    };

    try {
      if (dialogState.mode === 'create') {
        await apiClient.createContact(payload);
      } else if (dialogState.contact) {
        await apiClient.updateContact(dialogState.contact.id, payload);
      }

      setIsDialogOpen(false);
      resetDialog();
      await loadContacts({ offset: 0, reset: true });
      void refreshContactCount(appliedSearch);
    } catch (submitError) {
      console.error('Failed to save contact:', submitError);
      if (submitError instanceof Error) {
        setFormError(submitError.message);
      } else {
        setFormError('Failed to save contact. Please try again.');
      }
    } finally {
      setSavingContact(false);
    }
  }, [appliedSearch, dialogState, formValues, loadContacts, refreshContactCount, resetDialog]);

  const handleDeleteContact = useCallback(
    async (contact: Contact) => {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm(`Delete contact "${contact.name ?? contact.email ?? 'Unnamed contact'}"?`);
        if (!confirmed) {
          return;
        }
      }

      setDeletingContactId(contact.id);
      setError(null);

      try {
        await apiClient.deleteContact(contact.id);
        setIsViewDialogOpen(false);
        setViewingContact(null);
        await loadContacts({ offset: 0, reset: true });
        void refreshContactCount(appliedSearch);
      } catch (deleteError) {
        console.error('Failed to delete contact:', deleteError);
        setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete contact');
      } finally {
        setDeletingContactId(null);
      }
    },
    [appliedSearch, loadContacts, refreshContactCount]
  );

  const handleViewContact = useCallback(async (contact: Contact) => {
    setViewingContact(contact);
    setIsViewDialogOpen(true);
    setMatchedProfileUsername(null);

    // Fetch matched profile username if available
    if (contact.matched_user_id) {
      setLoadingMatchedProfile(true);
      try {
        const response = await apiClient.getPublicUsernameByUserId(contact.matched_user_id);
        setMatchedProfileUsername(response.username);
      } catch (error) {
        // Silently fail - profile might be private or not found
        console.warn('Failed to fetch matched profile username:', error);
      } finally {
        setLoadingMatchedProfile(false);
      }
    }
  }, []);

  const handleEditFromView = useCallback(() => {
    if (!viewingContact) {
      return;
    }
    setIsViewDialogOpen(false);
    openEditDialog(viewingContact);
  }, [viewingContact, openEditDialog]);

  const handleDeleteFromView = useCallback(() => {
    if (!viewingContact) {
      return;
    }
    void handleDeleteContact(viewingContact);
  }, [viewingContact, handleDeleteContact]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) {
      return;
    }

    const offset = nextOffset ?? contacts.length;
    void loadContacts({ offset, reset: false });
  }, [contacts.length, hasMore, loadContacts, loading, loadingMore, nextOffset]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleLoadMore, hasMore, loading, loadingMore]);

  if (authLoading && contacts.length === 0) {
    return <div className="container mx-auto px-3 sm:px-4 md:px-6 py-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Contacts
            {contactsCount !== null && (
              <span className="ml-2 text-xs font-normal text-gray-500 sm:text-sm">
                ({contactsCount.toLocaleString()} indexed)
              </span>
            )}
          </h1>
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

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-full">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm sm:text-base text-muted-foreground">
                Contacts are automatically extracted from OCR’d files and images. When we detect an email address, we add it here for quick reference.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={openCreateDialog}>
                  Add contact
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="contact-search" className="sr-only">
              Search contacts
            </label>
            <Input
              id="contact-search"
              ref={searchInputRef}
              type="search"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-12 w-full rounded-full border-2 border-gray-300 px-5 text-base font-medium shadow-xs transition-all focus-visible:border-blue-500 focus-visible:ring-blue-500 sm:h-14 sm:px-6 sm:text-lg"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Shortcut: ⌘K (Ctrl+K) to focus search
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && contacts.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-16 text-center text-sm text-muted-foreground">
              Loading contacts…
            </div>
          ) : contacts.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-16 text-center text-sm text-muted-foreground">
              {appliedSearch
                ? 'No contacts match your search.'
                : 'No contacts detected yet. Upload files that include names, emails, or phone numbers to see them here.'}
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-md border border-gray-200 bg-white">
              <table className="w-full table-auto divide-y divide-gray-200 text-sm">
                <colgroup>
                  <col className="w-auto md:w-[7%]" />
                  <col className="w-auto md:w-[8%]" />
                  <col className="w-auto md:w-[5%]" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map((contact) => {
                    const displayName =
                      contact.name ||
                      contact.email ||
                      contact.phone ||
                      'Unnamed contact';

                    const updatedAt = contact.updated_at
                      ? new Date(contact.updated_at).toLocaleString()
                      : null;

                    const nameLabel = displayName;

                    return (
                      <tr
                        key={contact.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleViewContact(contact)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 align-middle">
                          <span className="block truncate" title={nameLabel}>
                            {displayName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 align-middle">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-blue-600 wrap-break-word hover:underline"
                              title={contact.email}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 align-middle wrap-break-word">
                          {updatedAt ? (
                            <span>{updatedAt}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hasMore ? (
                <div
                  ref={loadMoreSentinelRef}
                  className="border-t border-gray-200 px-4 py-4 text-center text-sm text-muted-foreground"
                >
                  {loadingMore ? 'Loading more contacts…' : 'Scroll to load more contacts'}
                </div>
              ) : contacts.length > 0 ? (
                <div className="border-t border-gray-200 px-4 py-4 text-center text-sm text-muted-foreground">
                  All contacts loaded
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <Dialog
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setViewingContact(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              View full contact information
            </DialogDescription>
          </DialogHeader>

          {viewingContact && (
            <div className="space-y-4 py-2">
              {/* Name fields in a grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">First Name</Label>
                  <div className="text-sm text-gray-900">
                    {viewingContact.first_name || <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Last Name</Label>
                  <div className="text-sm text-gray-900">
                    {viewingContact.last_name || <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Email</Label>
                  <div className="text-sm text-gray-900">
                    {viewingContact.email ? (
                      <a
                        href={`mailto:${viewingContact.email}`}
                        className="text-blue-600 hover:underline wrap-break-word"
                      >
                        {viewingContact.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Phone</Label>
                  <div className="text-sm text-gray-900">
                    {viewingContact.phone ? (
                      <a
                        href={`tel:${viewingContact.phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {viewingContact.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Social Profiles */}
              {(viewingContact.linkedin_url || viewingContact.x_url || viewingContact.github_url) && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Social Profiles</Label>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {viewingContact.linkedin_url && (
                      <a
                        href={viewingContact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        LinkedIn
                      </a>
                    )}
                    {viewingContact.x_url && (
                      <a
                        href={viewingContact.x_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        X.com
                      </a>
                    )}
                    {viewingContact.github_url && (
                      <a
                        href={viewingContact.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        GitHub
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Matched Profile */}
              {viewingContact.matched_user_id && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Matched Profile</Label>
                  <div className="text-sm text-gray-900">
                    {loadingMatchedProfile ? (
                      <span className="text-muted-foreground">Loading...</span>
                    ) : matchedProfileUsername ? (
                      <a
                        href={`/u/${matchedProfileUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        @{matchedProfileUsername}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Profile not available (may be private)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Dates in a grid */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Created</Label>
                  <div className="text-xs text-gray-500">
                    {viewingContact.created_at
                      ? new Date(viewingContact.created_at).toLocaleString()
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-600">Last Updated</Label>
                  <div className="text-xs text-gray-500">
                    {viewingContact.updated_at
                      ? new Date(viewingContact.updated_at).toLocaleString()
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={handleEditFromView}
                disabled={!viewingContact}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteFromView}
                disabled={!viewingContact || deletingContactId === viewingContact?.id}
              >
                {deletingContactId === viewingContact?.id ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === 'edit' ? 'Edit contact' : 'Add contact'}
            </DialogTitle>
            <DialogDescription>
              Provide at least one of first name, last name, email, or phone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name fields in a grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-first-name" className="text-xs font-semibold">First Name</Label>
                <Input
                  id="contact-first-name"
                  placeholder="Ada"
                  value={formValues.firstName}
                  onChange={(event) => handleFormChange('firstName', event.target.value)}
                  disabled={savingContact}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-last-name" className="text-xs font-semibold">Last Name</Label>
                <Input
                  id="contact-last-name"
                  placeholder="Lovelace"
                  value={formValues.lastName}
                  onChange={(event) => handleFormChange('lastName', event.target.value)}
                  disabled={savingContact}
                  className="h-9"
                />
              </div>
            </div>

            {/* Contact info in a grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email" className="text-xs font-semibold">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="ada@example.com"
                  value={formValues.email}
                  onChange={(event) => handleFormChange('email', event.target.value)}
                  disabled={savingContact}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone" className="text-xs font-semibold">Phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="+1 (555) 123-4567"
                  value={formValues.phone}
                  onChange={(event) => handleFormChange('phone', event.target.value)}
                  disabled={savingContact}
                  className="h-9"
                />
              </div>
            </div>

            {/* Social profiles */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-semibold text-gray-600">Social Profiles (Optional)</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-linkedin" className="text-xs text-gray-600">LinkedIn URL</Label>
                  <Input
                    id="contact-linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={formValues.linkedinUrl}
                    onChange={(event) => handleFormChange('linkedinUrl', event.target.value)}
                    disabled={savingContact}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-x" className="text-xs text-gray-600">X.com URL</Label>
                  <Input
                    id="contact-x"
                    type="url"
                    placeholder="https://x.com/username"
                    value={formValues.xUrl}
                    onChange={(event) => handleFormChange('xUrl', event.target.value)}
                    disabled={savingContact}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-github" className="text-xs text-gray-600">GitHub URL</Label>
                  <Input
                    id="contact-github"
                    type="url"
                    placeholder="https://github.com/username"
                    value={formValues.githubUrl}
                    onChange={(event) => handleFormChange('githubUrl', event.target.value)}
                    disabled={savingContact}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="pt-2">
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={savingContact}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitContact} disabled={savingContact}>
              {savingContact
                ? dialogState?.mode === 'edit'
                  ? 'Saving…'
                  : 'Creating…'
                : dialogState?.mode === 'edit'
                  ? 'Save changes'
                  : 'Create contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
