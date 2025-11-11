'use client';

import Link from 'next/link';
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

const CONTACTS_PAGE_SIZE = 25;

export default function ContactsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
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

  const loadContacts = useCallback(async (offset: number = 0, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await apiClient.getContacts(CONTACTS_PAGE_SIZE, offset);
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
      } else {
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      await loadContacts(0, true);
    };

    void initialize();
  }, [loadContacts, router]);

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
          let next: Contact[];
          if (existingIndex >= 0) {
            next = prev.map((existing, index) => (index === existingIndex ? contact : existing));
          } else {
            next = [contact, ...prev];
          }

          return next
            .slice()
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
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
      } catch (error) {
        console.error('Failed to handle contact deletion event:', error);
      }
    };

    eventSource.addEventListener('contact-upserted', handleUpserted);
    eventSource.addEventListener('contact-deleted', handleDeleted);

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
      eventSource.close();
      if (contactStreamRef.current === eventSource) {
        contactStreamRef.current = null;
      }
    };
  }, [authLoading, contactStreamRetry]);

  const currentUser = auth.getUser();

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const element = document.createElement('a');
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadJson = useCallback(() => {
    if (contacts.length === 0) {
      return;
    }

    const payload = contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      source_item_id: contact.source_item_id,
      metadata: contact.metadata,
      created_at: contact.created_at,
      updated_at: contact.updated_at,
    }));

    downloadFile(JSON.stringify(payload, null, 2), 'contacts.json', 'application/json');
  }, [contacts, downloadFile]);

  const handleDownloadCsv = useCallback(() => {
    if (contacts.length === 0) {
      return;
    }

    const headers = [
      'id',
      'name',
      'email',
      'phone',
      'source_item_id',
      'created_at',
      'updated_at',
    ] as const;

    const escapeCsv = (value: unknown): string => {
      if (value == null) {
        return '';
      }
      const stringValue =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = contacts.map((contact) =>
      headers
        .map((header) => escapeCsv((contact as Record<(typeof headers)[number], unknown>)[header]))
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadFile(csvContent, 'contacts.csv', 'text/csv');
  }, [contacts, downloadFile]);

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
      await loadContacts(0, true);
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
  }, [dialogState, formValues, loadContacts, resetDialog]);

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
        await loadContacts(0, true);
      } catch (deleteError) {
        console.error('Failed to delete contact:', deleteError);
        setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete contact');
      } finally {
        setDeletingContactId(null);
      }
    },
    [loadContacts]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) {
      return;
    }

    const offset = nextOffset ?? contacts.length;
    void loadContacts(offset, false);
  }, [contacts.length, hasMore, loadContacts, loadingMore, nextOffset]);

  if (authLoading && contacts.length === 0) {
    return <div className="container mx-auto px-3 sm:px-4 md:px-6 py-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold">Contacts</h1>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCsv}
                  disabled={contacts.length === 0}
                >
                  Download CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJson}
                  disabled={contacts.length === 0}
                >
                  Download JSON
                </Button>
              </div>
            </div>
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
              No contacts detected yet. Upload files that include names, emails, or phone numbers to see them here.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
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
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">
                      Source Item
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-700">
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

                    return (
                      <tr key={contact.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          {displayName}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-blue-600 hover:underline break-all"
                            >
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {updatedAt ? (
                            <span>{updatedAt}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {contact.source_item_id ? (
                            <Link
                              href={`/items/${contact.source_item_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              View item
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Not available</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-3">
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
            </div>
          )}

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more contacts'}
              </Button>
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
