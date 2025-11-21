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
import { auth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { Copy, Check, X, Globe, Loader2 } from 'lucide-react';

interface CustomDomain {
  id: string;
  user_id: string;
  domain: string;
  verification_token: string;
  verified: boolean;
  verified_at: string | null;
  cname_target: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function CustomDomainsPageContent() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCustomDomains();
      setDomains(response.domains);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load custom domains';
      toast.error(message);
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

      const user = auth.getUser();
      const isPro = user?.is_premium || (user?.subscription_tier && user.subscription_tier !== 'free');

      if (!isPro) {
        toast.error('Pro subscription required for custom domains');
        router.push('/settings');
        return;
      }

      setAuthReady(true);
      await loadDomains();
    };

    void init();
  }, [router, loadDomains]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDomain.trim()) {
      toast.error('Please enter a domain');
      return;
    }

    try {
      setAddingDomain(true);
      const response = await apiClient.createCustomDomain(newDomain.trim());
      toast.success('Domain added! Please configure DNS records.');
      setNewDomain('');
      await loadDomains();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add domain';
      toast.error(message);
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    try {
      setVerifyingId(domainId);
      const response = await apiClient.verifyCustomDomain(domainId);

      if (response.verified) {
        toast.success('Domain verified successfully!');
      } else {
        toast.error(response.message || 'Verification failed. Please check your DNS records.');
      }

      await loadDomains();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify domain';
      toast.error(message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (domainId: string, domain: string) => {
    if (!confirm(`Are you sure you want to delete ${domain}?`)) {
      return;
    }

    try {
      await apiClient.deleteCustomDomain(domainId);
      toast.success('Domain deleted');
      await loadDomains();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete domain';
      toast.error(message);
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      toast.success('Verification token copied to clipboard');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      toast.error('Failed to copy token');
    }
  };

  const handleToggleActive = async (domain: CustomDomain) => {
    if (!domain.verified) {
      toast.error('Domain must be verified before it can be activated');
      return;
    }

    try {
      await apiClient.updateCustomDomain(domain.id, { is_active: !domain.is_active });
      toast.success(`Domain ${!domain.is_active ? 'activated' : 'deactivated'}`);
      await loadDomains();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update domain';
      toast.error(message);
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
          <h1 className="text-xl sm:text-2xl font-bold">Custom Domains</h1>
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

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com or app.example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  disabled={addingDomain}
                />
                <p className="text-sm text-muted-foreground">
                  Enter your domain (subdomain or root domain)
                </p>
              </div>
              <Button type="submit" disabled={addingDomain || !newDomain.trim()}>
                {addingDomain ? 'Adding...' : 'Add Domain'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Domains</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : domains.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No custom domains configured. Add one above to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {domains.map((domain) => (
                  <div
                    key={domain.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-gray-400" />
                        <div>
                          <h3 className="font-semibold">{domain.domain}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {domain.verified ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <Check className="h-3 w-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                                <X className="h-3 w-3" />
                                Pending Verification
                              </span>
                            )}
                            {domain.is_active && domain.verified && (
                              <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                                <Check className="h-3 w-3" />
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {domain.verified && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(domain)}
                          >
                            {domain.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(domain.id, domain.domain)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {!domain.verified && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 space-y-2">
                        <p className="text-sm font-semibold text-yellow-800">
                          DNS Configuration Required
                        </p>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-yellow-700 font-medium">1. Add TXT Record:</p>
                            <div className="bg-white rounded p-2 mt-1 font-mono text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">Name:</span>
                                <span className="font-semibold">_injest-verify.{domain.domain}</span>
                                <button
                                  onClick={() => handleCopyToken(`_injest-verify.${domain.domain}`)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  {copiedToken === `_injest-verify.${domain.domain}` ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">Type:</span>
                                <span className="font-semibold">TXT</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">Value:</span>
                                <span className="font-semibold break-all">{domain.verification_token}</span>
                                <button
                                  onClick={() => handleCopyToken(domain.verification_token)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  {copiedToken === domain.verification_token ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                          {domain.cname_target && (
                            <div>
                              <p className="text-yellow-700 font-medium">2. Add CNAME Record:</p>
                              <div className="bg-white rounded p-2 mt-1 font-mono text-xs space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">Name:</span>
                                  <span className="font-semibold">{domain.domain}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">Type:</span>
                                  <span className="font-semibold">CNAME</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">Value:</span>
                                  <span className="font-semibold">{domain.cname_target}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerify(domain.id)}
                              disabled={verifyingId === domain.id}
                            >
                              {verifyingId === domain.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Verifying...
                                </>
                              ) : (
                                'Verify Domain'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {domain.verified && domain.verified_at && (
                      <p className="text-xs text-muted-foreground">
                        Verified on {new Date(domain.verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CustomDomainsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12">
          Loading custom domains...
        </div>
      }
    >
      <CustomDomainsPageContent />
    </Suspense>
  );
}
