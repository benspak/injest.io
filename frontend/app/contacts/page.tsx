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
  const [formValues, setFormValues] = useState<{ name: string; email: string; phone: string }>({
    name: '',
    email: '',
    phone: '',
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
    setFormValues({ name: '', email: '', phone: '' });
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
    setFormValues({ name: '', email: '', phone: '' });
    setFormError(null);
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((contact: Contact) => {
    setDialogState({ mode: 'edit', contact });
    setFormValues({
      name: contact.name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  }, []);

  const handleFormChange = useCallback((field: 'name' | 'email' | 'phone', value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSubmitContact = useCallback(async () => {
    if (!dialogState) {
      return;
    }

    const trimmedName = formValues.name.trim();
    const trimmedEmail = formValues.email.trim();
    const trimmedPhone = formValues.phone.trim();

    if (!trimmedName && !trimmedEmail && !trimmedPhone) {
      setFormError('Provide at least one of name, email, or phone.');
      return;
    }

    setFormError(null);
    setSavingContact(true);

    const payload = {
      name: trimmedName || null,
      email: trimmedEmail || null,
      phone: trimmedPhone || null,
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
              className="h-12 w-full rounded-full border-2 border-gray-300 px-5 text-base font-medium shadow-sm transition-all focus-visible:border-blue-500 focus-visible:ring-blue-500 sm:h-14 sm:px-6 sm:text-lg"
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
                  <col className="w-auto md:w-[1.5%]" />
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
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700 md:text-right">
                      Actions
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
                      <tr key={contact.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 align-middle">
                          <span className="block truncate" title={nameLabel}>
                            {displayName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 align-middle">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-blue-600 break-words hover:underline"
                              title={contact.email}
                            >
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 align-middle break-words">
                          {updatedAt ? (
                            <span>{updatedAt}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left md:text-right align-middle">
                          <div className="flex flex-col items-start gap-2 md:flex-row md:justify-end md:items-center md:gap-3">
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0"
                              onClick={() => openEditDialog(contact)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0 text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteContact(contact)}
                              disabled={deletingContactId === contact.id}
                            >
                              {deletingContactId === contact.id ? 'Deleting…' : 'Delete'}
                            </Button>
                          </div>
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === 'edit' ? 'Edit contact' : 'Add contact'}
            </DialogTitle>
            <DialogDescription>
              Provide at least one of name, email, or phone. Email is required for mailto links.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                placeholder="Ada Lovelace"
                value={formValues.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
                disabled={savingContact}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="ada@example.com"
                value={formValues.email}
                onChange={(event) => handleFormChange('email', event.target.value)}
                disabled={savingContact}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                placeholder="+1 (555) 123-4567"
                value={formValues.phone}
                onChange={(event) => handleFormChange('phone', event.target.value)}
                disabled={savingContact}
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
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
