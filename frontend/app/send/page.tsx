'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const [xcomPost, setXcomPost] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Array<'email' | 'xcom'>>(['email']);
  const [xcomConnected, setXcomConnected] = useState(false);
  const [xcomUsername, setXcomUsername] = useState<string | null>(null);
  const [checkingXcomStatus, setCheckingXcomStatus] = useState(false);
  const [generatingXcomPost, setGeneratingXcomPost] = useState(false);

  useEffect(() => {
    const init = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      setAuthReady(true);

      // Check X.com connection status
      setCheckingXcomStatus(true);
      try {
        const status = await apiClient.getXcomStatus();
        setXcomConnected(status.connected);
        setXcomUsername(status.username);
      } catch (error) {
        console.error('Failed to check X.com status:', error);
        setXcomConnected(false);
      } finally {
        setCheckingXcomStatus(false);
      }
    };

    init();
  }, [router]);

  // Refresh X.com connection status when component becomes visible
  // This helps if user navigates back from OAuth flow
  useEffect(() => {
    if (authReady && !checkingXcomStatus) {
      // Recheck status periodically or when page becomes visible
      const checkStatus = async () => {
        try {
          const status = await apiClient.getXcomStatus();
          setXcomConnected(status.connected);
          setXcomUsername(status.username);
        } catch (error) {
          console.error('Failed to check X.com status:', error);
        }
      };

      // Check immediately
      checkStatus();

      // Also check when page becomes visible (user might have completed OAuth in another tab)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkStatus();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [authReady, checkingXcomStatus]);

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
      setSubject(response.recommendation.subject);
      setBody(response.recommendation.body);

      const recommendedContactId = response.recommendation.recommendedContactId;
      if (
        recommendedContactId &&
        response.contacts.some((contact) => contact.id === recommendedContactId)
      ) {
        setSelectedContactId(recommendedContactId);
        const contact = response.contacts.find((c) => c.id === recommendedContactId);
        setCustomEmail(contact?.email ?? '');
      } else if (response.recommendation.recommendedContactEmail) {
        setSelectedContactId(null);
        setCustomEmail(response.recommendation.recommendedContactEmail);
      } else if (response.contacts.length > 0) {
        setSelectedContactId(response.contacts[0].id);
        setCustomEmail(response.contacts[0].email ?? '');
      } else {
        setSelectedContactId(null);
        setCustomEmail('');
      }

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

      setSelectedAttachments(defaults);
      toast.success('Plan generated. Review the draft before sending.');
    } catch (error) {
      console.error('Failed to generate send plan:', error);
      toast.error('Unable to generate plan right now. Please try again in a moment.');
    } finally {
      setLoadingPlan(false);
    }
  }, [attachmentOptions, promptValue]);

  const toggleAttachment = useCallback((key: string) => {
    setSelectedAttachments((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key]
    );
  }, []);

  const currentContact: SendPlanContact | null = useMemo(() => {
    if (!plan || !selectedContactId) {
      return null;
    }
    return plan.contacts.find((contact) => contact.id === selectedContactId) ?? null;
  }, [plan, selectedContactId]);

  const handleConnectXcom = useCallback(async () => {
    try {
      await apiClient.initiateXcomOAuth();
    } catch (error) {
      console.error('Failed to initiate X.com OAuth:', error);
      toast.error('Failed to connect X.com account. Please try again.');
    }
  }, []);

  const handleGenerateXcomPost = useCallback(async () => {
    if (!plan) {
      toast.error('Generate a plan before generating X.com post.');
      return;
    }

    if (!body.trim() && !subject.trim()) {
      toast.error('Please generate an email draft first.');
      return;
    }

    setGeneratingXcomPost(true);
    try {
      // Generate X.com post using OpenAI generate endpoint
      const prompt = `Generate an engaging X.com (Twitter) post based on this content. Make it concise (max 280 characters), appropriate for X.com, and include relevant hashtags if appropriate. Do not include email signatures or formal closings.

Email Subject: ${subject || 'N/A'}
Email Body: ${body || 'N/A'}

Generate only the X.com post text, nothing else:`;

      const response = await apiClient.generate(prompt, 'general', plan.prompt || promptValue);

      // The generate API returns { type, content, context }
      const content = (response as any)?.content || '';
      if (typeof content === 'string' && content.trim()) {
        // Clean up the response and limit to 280 characters
        const cleaned = content.trim().replace(/\n+/g, ' ').substring(0, 280);
        setXcomPost(cleaned);
        toast.success('X.com post generated.');
      } else {
        // Fallback: create a simple post from the email body
        const simplePost = (subject ? `${subject}. ` : '') + body.substring(0, 250);
        setXcomPost(simplePost.replace(/\n+/g, ' ').substring(0, 280));
        toast.info('X.com post generated from email content.');
      }
    } catch (error) {
      console.error('Failed to generate X.com post:', error);
      // Fallback: create a simple post from the email body
      const simplePost = (subject ? `${subject}. ` : '') + body.substring(0, 250);
      setXcomPost(simplePost.replace(/\n+/g, ' ').substring(0, 280));
      toast.info('X.com post created from email content. You can edit it manually.');
    } finally {
      setGeneratingXcomPost(false);
    }
  }, [body, plan, promptValue, subject]);

  const handleSend = useCallback(async () => {
    if (!plan) {
      toast.error('Generate a plan before sending.');
      return;
    }

    if (platforms.length === 0) {
      toast.error('Please select at least one platform (Email or X.com).');
      return;
    }

    if (platforms.includes('email')) {
      if (!subject.trim()) {
        toast.error('Subject cannot be empty.');
        return;
      }

      if (!body.trim()) {
        toast.error('Email body cannot be empty.');
        return;
      }

      const toEmail = currentContact?.email ?? customEmail.trim();
      if (!toEmail) {
        toast.error('Please select a contact or provide a recipient email.');
        return;
      }
    }

    if (platforms.includes('xcom')) {
      if (!xcomPost.trim()) {
        toast.error('X.com post cannot be empty.');
        return;
      }

      if (xcomPost.length > 280) {
        toast.error('X.com post cannot exceed 280 characters.');
        return;
      }

      if (!xcomConnected) {
        toast.error('Please connect your X.com account first.');
        return;
      }
    }

    const payload: ExecuteSendRequest = {
      platforms,
      subject: platforms.includes('email') ? subject : undefined,
      body: platforms.includes('email') ? body : undefined,
      xcomPost: platforms.includes('xcom') ? xcomPost : undefined,
      contactId: currentContact?.id ?? undefined,
      toEmail: platforms.includes('email') && currentContact ? currentContact.email ?? undefined : customEmail.trim() || undefined,
      attachments: platforms.includes('email')
        ? selectedAttachments.map((key) => {
            const [itemId, filename] = key.split('::');
            return {
              itemId,
              attachmentFilename: filename || undefined,
            };
          })
        : undefined,
      prompt: plan.prompt || promptValue,
      recommendation: plan.recommendation,
      analysis: plan.analysis,
    };

    setSending(true);
    try {
      const response = await apiClient.executeSend(payload);

      // Show success messages for each platform
      const successMessages: string[] = [];
      if (response.results?.email?.success) {
        successMessages.push('Email sent successfully.');
      }
      if (response.results?.xcom?.success) {
        successMessages.push('X.com post published successfully.');
      }

      if (successMessages.length > 0) {
        toast.success(successMessages.join(' '));
      } else {
        toast.error('Failed to send to all platforms.');
      }

      // Show errors for failed platforms
      if (response.results?.email?.error) {
        toast.error(`Email failed: ${response.results.email.error}`);
      }
      if (response.results?.xcom?.error) {
        toast.error(`X.com failed: ${response.results.xcom.error}`);
      }

      // Reset form if all platforms succeeded
      if (response.success) {
        setPlan(null);
        setSubject('');
        setBody('');
        setXcomPost('');
        setSelectedAttachments([]);
        setSelectedContactId(null);
        setCustomEmail('');
        setPlatforms(['email']);
      }
    } catch (error) {
      console.error('Failed to send:', error);
      toast.error('Unable to send. Please try again.');
    } finally {
      setSending(false);
    }
  }, [body, currentContact, customEmail, plan, platforms, promptValue, selectedAttachments, subject, xcomConnected, xcomPost]);

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
        <Card>
          <CardHeader>
            <CardTitle>Describe your outreach</CardTitle>
            <CardDescription>
              Tell the assistant what you want to accomplish. Include goals, recipients, and any context you would like attached. You can send via <strong>Email</strong> or <strong>X.com</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-prompt">Request</Label>
              <Textarea
                id="send-prompt"
                rows={6}
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder="e.g. Craft a message to the HR contact at bytedance.com. Include relevant UI images of my past work."
                disabled={loadingPlan || sending}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleGeneratePlan} disabled={loadingPlan || sending || !authReady}>
                {loadingPlan ? 'Generating...' : 'Generate Plan'}
              </Button>
              {plan ? (
                <Button
                  variant="outline"
                  onClick={handleGeneratePlan}
                  disabled={loadingPlan || sending}
                >
                  Regenerate
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {plan ? (
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>
                Review the suggested contacts, attachments, and message draft. Make any edits before sending.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Platform</h2>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platforms.includes('email')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPlatforms([...platforms.filter((p) => p !== 'email'), 'email']);
                        } else {
                          const newPlatforms = platforms.filter((p) => p !== 'email');
                          if (newPlatforms.length === 0) {
                            toast.error('Please select at least one platform.');
                            return;
                          }
                          setPlatforms(newPlatforms);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platforms.includes('xcom')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (!xcomConnected) {
                            toast.error('Please connect your X.com account first.');
                            return;
                          }
                          setPlatforms([...platforms.filter((p) => p !== 'xcom'), 'xcom']);
                        } else {
                          const newPlatforms = platforms.filter((p) => p !== 'xcom');
                          if (newPlatforms.length === 0) {
                            toast.error('Please select at least one platform.');
                            return;
                          }
                          setPlatforms(newPlatforms);
                        }
                      }}
                      disabled={!xcomConnected}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm font-medium text-gray-700">X.com</span>
                    {xcomConnected ? (
                      <span className="text-xs text-green-600">
                        ({xcomUsername ? `Connected as @${xcomUsername}` : 'Connected'})
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={handleConnectXcom}
                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
                      >
                        Connect X.com
                      </Button>
                    )}
                  </label>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Summary</h2>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Intent:</span> {plan.analysis.intent}
                  </p>
                  {plan.analysis.targetCompany ? (
                    <p>
                      <span className="font-medium">Target Company:</span> {plan.analysis.targetCompany}
                    </p>
                  ) : null}
                  {plan.analysis.targetPersona ? (
                    <p>
                      <span className="font-medium">Persona:</span> {plan.analysis.targetPersona}
                    </p>
                  ) : null}
                </div>
                {plan.analysis.keyFacts.length > 0 ? (
                  <ul className="flex flex-wrap gap-2 text-xs text-gray-600">
                    {plan.analysis.keyFacts.map((fact) => (
                      <li key={fact} className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                        {fact}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {platforms.includes('email') ? (
                <>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contact</h2>
                    <div className="space-y-2">
                      {plan.contacts.length > 0 ? (
                        plan.contacts.map((contact) => {
                          const isRecommended = plan.recommendation.recommendedContactId === contact.id;
                          return (
                            <label
                              key={contact.id}
                              className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                selectedContactId === contact.id
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
                                {isRecommended && plan.recommendation.contactReason ? (
                                  <span className="mt-1 text-xs text-blue-700">
                                    Recommended: {plan.recommendation.contactReason}
                                  </span>
                                ) : null}
                              </div>
                              <input
                                type="radio"
                                name="contact"
                                value={contact.id}
                                checked={selectedContactId === contact.id}
                                onChange={() => {
                                  setSelectedContactId(contact.id);
                                  setCustomEmail(contact.email ?? '');
                                }}
                              />
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-600">
                          No contacts were suggested. Provide an email below to continue.
                        </p>
                      )}
                      <div className="space-y-1">
                        <Label htmlFor="custom-email">Recipient Email</Label>
                        <Input
                          id="custom-email"
                          type="email"
                          value={customEmail}
                          onChange={(event) => setCustomEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="max-w-md"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Attachments</h2>
                    {attachmentOptions.length > 0 ? (
                      <div className="space-y-2">
                        {attachmentOptions.map((attachment) => (
                          <label
                            key={attachment.key}
                            className="flex items-start gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-blue-300"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedAttachments.includes(attachment.key)}
                              onChange={() => toggleAttachment(attachment.key)}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{attachment.displayName}</span>
                              {attachment.itemTitle ? (
                                <span className="text-xs text-gray-600">Source: {attachment.itemTitle}</span>
                              ) : null}
                              {attachment.mimetype ? (
                                <span className="text-xs text-gray-500">{attachment.mimetype}</span>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        No attachments were suggested. Run another plan or add more context to your request.
                      </p>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-subject">Subject</Label>
                      <Input
                        id="email-subject"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        placeholder="Subject line"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email-body">Email Body</Label>
                      <Textarea
                        id="email-body"
                        rows={12}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                      />
                    </div>
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
                        Reset Email Draft
                      </Button>
                    </div>
                  </section>
                </>
              ) : null}

              {platforms.includes('xcom') ? (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="xcom-post">X.com Post</Label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${xcomPost.length > 280 ? 'text-red-600' : 'text-gray-500'}`}>
                        {xcomPost.length}/280
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateXcomPost}
                        disabled={generatingXcomPost || sending || !plan}
                      >
                        {generatingXcomPost ? 'Generating...' : 'Generate Post'}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="xcom-post"
                    rows={6}
                    value={xcomPost}
                    onChange={(event) => setXcomPost(event.target.value.substring(0, 280))}
                    placeholder="Write your X.com post here... (max 280 characters)"
                    className={`font-mono text-sm ${xcomPost.length > 280 ? 'border-red-500' : ''}`}
                  />
                  {xcomPost.length > 280 && (
                    <p className="text-xs text-red-600">
                      Post exceeds 280 characters. Please shorten it before posting.
                    </p>
                  )}
                </section>
              ) : null}

              <section className="flex flex-wrap items-center gap-3 pt-4 border-t">
                <Button onClick={handleSend} disabled={sending}>
                  {sending
                    ? 'Sending...'
                    : platforms.includes('email') && platforms.includes('xcom')
                      ? 'Send to Both'
                      : platforms.includes('email')
                        ? 'Send Email'
                        : 'Post to X.com'}
                </Button>
              </section>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
