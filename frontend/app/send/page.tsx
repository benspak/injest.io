'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownEditor } from '@/components/markdown-editor';
import { EmailRecipientInput } from '@/components/email-recipient-input';
import { FileUploadAttachment, type UploadedAttachment } from '@/components/file-upload-attachment';
import {
  apiClient,
  type ExecuteSendRequest,
  type SendPlanContact,
  type SendPlanResponse,
} from '@/lib/api';
import { auth } from '@/lib/auth';

interface AttachmentOption {
  key: string;
  itemId: string;
  filename: string;
  displayName: string;
  itemTitle?: string | null;
  mimetype?: string;
}

export default function SendPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const [promptValue, setPromptValue] = useState('');
  const [plan, setPlan] = useState<SendPlanResponse | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [sending, setSending] = useState(false);

  // Recipients - multiple emails
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);

  // Attachments
  const [manualAttachments, setManualAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedPlanAttachments, setSelectedPlanAttachments] = useState<string[]>([]);

  // Plan suggestions
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showPlanSection, setShowPlanSection] = useState(false);

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

    init();
  }, [router]);

  const currentUser = auth.getUser();

  const attachmentOptions: AttachmentOption[] = useMemo(() => {
    if (!plan) {
      return [];
    }

    const options: AttachmentOption[] = [];
    for (const item of plan.items) {
      if (!Array.isArray(item.attachments)) {
        continue;
      }

      for (const attachment of item.attachments) {
        if (!attachment?.filename) {
          continue;
        }
        options.push({
          key: `${item.id}::${attachment.filename}`,
          itemId: item.id,
          filename: attachment.filename,
          displayName: attachment.originalname || attachment.filename,
          itemTitle: item.title,
          mimetype: attachment.mimetype,
        });
      }
    }
    return options;
  }, [plan]);

  const handleGeneratePlan = useCallback(async () => {
    if (!promptValue.trim()) {
      toast.error('Describe what you want to send before generating a plan.');
      return;
    }

    setLoadingPlan(true);
    try {
      const response = await apiClient.planSend(promptValue.trim());
      setPlan(response);

      // Populate subject and body if empty
      if (!subject.trim()) {
        setSubject(response.recommendation.subject);
      }
      if (!body.trim()) {
        setBody(response.recommendation.body);
      }

      // Add recommended contacts to recipients
      const recommendedContactId = response.recommendation.recommendedContactId;
      const emailsToAdd: string[] = [];
      const contactIdsToSelect = new Set<string>();

      if (
        recommendedContactId &&
        response.contacts.some((contact) => contact.id === recommendedContactId)
      ) {
        const contact = response.contacts.find((c) => c.id === recommendedContactId);
        if (contact?.email) {
          emailsToAdd.push(contact.email);
          contactIdsToSelect.add(recommendedContactId);
        }
      } else if (response.recommendation.recommendedContactEmail) {
        emailsToAdd.push(response.recommendation.recommendedContactEmail);
      } else if (response.contacts.length > 0) {
        const firstContact = response.contacts[0];
        if (firstContact.email) {
          emailsToAdd.push(firstContact.email);
          contactIdsToSelect.add(firstContact.id);
        }
      }

      // Add emails that aren't already in the list
      setToEmails((prev) => {
        const newEmails = emailsToAdd.filter((email) => !prev.includes(email.toLowerCase()));
        return [...prev, ...newEmails];
      });
      setSelectedContactIds(contactIdsToSelect);

      // Select recommended attachments
      const recommendedAttachmentKeys = new Set(
        response.recommendation.attachments
          .map((attachment) =>
            attachment.attachmentFilename
              ? `${attachment.itemId}::${attachment.attachmentFilename}`
              : `${attachment.itemId}`
          )
      );

      const defaults: string[] = [];
      for (const option of attachmentOptions) {
        if (
          recommendedAttachmentKeys.has(option.key) ||
          recommendedAttachmentKeys.has(option.itemId)
        ) {
          defaults.push(option.key);
        }
      }

      setSelectedPlanAttachments(defaults);
      setShowPlanSection(true);
      toast.success('Plan generated. Review suggestions below.');
    } catch (error) {
      console.error('Failed to generate send plan:', error);
      toast.error('Unable to generate plan right now. Please try again in a moment.');
    } finally {
      setLoadingPlan(false);
    }
  }, [attachmentOptions, promptValue, subject, body]);

  const togglePlanAttachment = useCallback((key: string) => {
    setSelectedPlanAttachments((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]
    );
  }, []);

  const toggleContactSelection = useCallback((contactId: string, email: string | null) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
        // Remove email from recipients if it was from this contact
        if (email) {
          setToEmails((emails) => emails.filter((e) => e !== email.toLowerCase()));
        }
      } else {
        next.add(contactId);
        // Add email to recipients
        if (email && !toEmails.includes(email.toLowerCase())) {
          setToEmails((emails) => [...emails, email.toLowerCase()]);
        }
      }
      return next;
    });
  }, [toEmails]);

  const handleSend = useCallback(async () => {
    if (toEmails.length === 0) {
      toast.error('Please add at least one recipient.');
      return;
    }

    if (!subject.trim()) {
      toast.error('Subject cannot be empty.');
      return;
    }

    if (!body.trim()) {
      toast.error('Email body cannot be empty.');
      return;
    }

    // Combine manual attachments and plan attachments
    const allAttachments: Array<{ itemId: string; attachmentFilename?: string }> = [];

    // Add manual attachments
    for (const attachment of manualAttachments) {
      allAttachments.push({
        itemId: attachment.itemId,
        attachmentFilename: attachment.attachmentFilename,
      });
    }

    // Add plan attachments
    for (const key of selectedPlanAttachments) {
      const [itemId, filename] = key.split('::');
      allAttachments.push({
        itemId,
        attachmentFilename: filename || undefined,
      });
    }

    const payload: ExecuteSendRequest = {
      platforms: ['email'],
      subject,
      body,
      toEmail: toEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      bcc: bccEmails.length > 0 ? bccEmails : undefined,
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
      prompt: plan?.prompt || promptValue || undefined,
      recommendation: plan?.recommendation,
      analysis: plan?.analysis,
    };

    setSending(true);
    try {
      const response = await apiClient.executeSend(payload);

      if (response.results?.email?.success) {
        toast.success('Email sent successfully.');

        // Reset form
        setToEmails([]);
        setCcEmails([]);
        setBccEmails([]);
        setSubject('');
        setBody('');
        setManualAttachments([]);
        setSelectedPlanAttachments([]);
        setSelectedContactIds(new Set());
        setPlan(null);
        setPromptValue('');
      } else {
        toast.error('Failed to send email.');
      }

      if (response.results?.email?.error) {
        toast.error(`Email failed: ${response.results.email.error}`);
      }
    } catch (error) {
      console.error('Failed to send:', error);
      toast.error('Unable to send. Please try again.');
    } finally {
      setSending(false);
    }
  }, [
    toEmails,
    ccEmails,
    bccEmails,
    subject,
    body,
    manualAttachments,
    selectedPlanAttachments,
    plan,
    promptValue,
  ]);

  if (authLoading) {
    return <div className="container mx-auto px-4 py-12">Loading...</div>;
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold">Send</h1>
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

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-5xl space-y-6">
        {/* AI Plan Generation (Optional Enrichment) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>AI Suggestions (Optional)</CardTitle>
                <CardDescription>
                  Generate AI-powered suggestions for contacts, attachments, and content.
                </CardDescription>
              </div>
              {plan && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlanSection(!showPlanSection)}
                >
                  {showPlanSection ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-prompt">Describe your outreach</Label>
              <Textarea
                id="send-prompt"
                rows={4}
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder="e.g. Craft a message to the HR contact at bytedance.com. Include relevant UI images of my past work."
                disabled={loadingPlan || sending}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleGeneratePlan} disabled={loadingPlan || sending || !authReady}>
                {loadingPlan ? 'Generating...' : 'Generate Suggestions'}
              </Button>
              {plan && (
                <Button
                  variant="outline"
                  onClick={handleGeneratePlan}
                  disabled={loadingPlan || sending}
                >
                  Regenerate
                </Button>
              )}
            </div>

            {/* Plan Suggestions */}
            {plan && showPlanSection && (
              <div className="space-y-6 pt-4 border-t">
                {/* Summary */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Summary</h3>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>
                      <span className="font-medium">Intent:</span> {plan.analysis.intent}
                    </p>
                    {plan.analysis.targetCompany && (
                      <p>
                        <span className="font-medium">Target Company:</span> {plan.analysis.targetCompany}
                      </p>
                    )}
                    {plan.analysis.targetPersona && (
                      <p>
                        <span className="font-medium">Persona:</span> {plan.analysis.targetPersona}
                      </p>
                    )}
                  </div>
                  {plan.analysis.keyFacts.length > 0 && (
                    <ul className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {plan.analysis.keyFacts.map((fact) => (
                        <li key={fact} className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                          {fact}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Suggested Contacts */}
                {plan.contacts.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Suggested Contacts
                    </h3>
                    <div className="space-y-2">
                      {plan.contacts.map((contact) => {
                        const isRecommended = plan.recommendation.recommendedContactId === contact.id;
                        const isSelected = selectedContactIds.has(contact.id);
                        return (
                          <label
                            key={contact.id}
                            className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {contact.name || contact.email || 'Unknown contact'}
                              </span>
                              <span className="text-xs text-gray-600">
                                {contact.email || 'No email on record'}
                                {contact.company ? ` • ${contact.company}` : ''}
                              </span>
                              {isRecommended && plan.recommendation.contactReason && (
                                <span className="mt-1 text-xs text-blue-700">
                                  Recommended: {plan.recommendation.contactReason}
                                </span>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleContactSelection(contact.id, contact.email ?? null)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Suggested Attachments */}
                {attachmentOptions.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Suggested Attachments
                    </h3>
                    <div className="space-y-2">
                      {attachmentOptions.map((attachment) => (
                        <label
                          key={attachment.key}
                          className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-blue-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedPlanAttachments.includes(attachment.key)}
                            onChange={() => togglePlanAttachment(attachment.key)}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{attachment.displayName}</span>
                            {attachment.itemTitle && (
                              <span className="text-xs text-gray-600">Source: {attachment.itemTitle}</span>
                            )}
                            {attachment.mimetype && (
                              <span className="text-xs text-gray-500">{attachment.mimetype}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Email Composer */}
        <Card>
          <CardHeader>
            <CardTitle>Compose Email</CardTitle>
            <CardDescription>
              Write and send an email. Use AI suggestions above to enrich your message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recipients */}
            <section className="space-y-4">
              <EmailRecipientInput
                value={toEmails}
                onChange={setToEmails}
                label="To"
                placeholder="Enter recipient email addresses..."
                disabled={sending}
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <EmailRecipientInput
                    value={ccEmails}
                    onChange={setCcEmails}
                    label="CC"
                    placeholder="Optional..."
                    disabled={sending}
                  />
                </div>
                <div className="flex-1">
                  <EmailRecipientInput
                    value={bccEmails}
                    onChange={setBccEmails}
                    label="BCC"
                    placeholder="Optional..."
                    disabled={sending}
                  />
                </div>
              </div>
            </section>

            {/* Attachments */}
            <section className="space-y-3">
              <FileUploadAttachment
                value={manualAttachments}
                onChange={setManualAttachments}
                label="Attachments"
                disabled={sending}
              />
            </section>

            {/* Subject */}
            <section className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Email subject"
                disabled={sending}
              />
            </section>

            {/* Body */}
            <section className="space-y-2">
              <Label htmlFor="email-body">Email Body</Label>
              <MarkdownEditor
                id="email-body"
                rows={12}
                value={body}
                onChange={(value) => setBody(value)}
                placeholder="Write your email message..."
                disabled={sending}
              />
              {plan && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!plan) {
                        return;
                      }
                      setSubject(plan.recommendation.subject);
                      setBody(plan.recommendation.body);
                      toast.info('Email draft reset to AI suggestion.');
                    }}
                    disabled={sending}
                  >
                    Reset to AI Suggestion
                  </Button>
                </div>
              )}
            </section>

            {/* Send Button */}
            <section className="flex flex-wrap items-center gap-3 pt-4 border-t">
              <Button onClick={handleSend} disabled={sending}>
                {sending ? 'Sending...' : 'Send Email'}
              </Button>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
