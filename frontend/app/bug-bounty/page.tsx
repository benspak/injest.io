import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FeedbackDialog } from '@/components/feedback-dialog';

export const metadata = {
  title: 'Bug Bounty Program - Injest.io',
  description: 'Report security vulnerabilities and earn rewards - Bug Bounty Program for Injest.io',
};

export default function BugBountyPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              ← Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bug Bounty Program
          </h1>
          <p className="text-gray-600 mb-2">
            Help us keep Injest.io secure and earn rewards
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6 space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Program Overview</h2>
              <p className="mb-4">
                At Injest.io, we take security seriously. We believe in working with the security community to identify and fix vulnerabilities before they can be exploited. Our Bug Bounty Program rewards security researchers who help us improve the security of our platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rewards</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Major Vulnerabilities</h3>
                <p className="text-lg font-semibold text-green-700 mb-2">
                  🎁 1 Year of Pro Service
                </p>
                <p className="text-gray-700">
                  For any major security vulnerability that you discover and responsibly disclose, we'll reward you with <strong>1 year of Pro service</strong> (valued at $360/year). This includes unlimited storage, priority support, and all Pro features.
                </p>
              </div>
              <p className="text-gray-600 text-sm">
                * Rewards are determined based on the severity and impact of the vulnerability. We reserve the right to determine what constitutes a "major" vulnerability.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What We're Looking For</h2>
              <p className="mb-4">We're particularly interested in vulnerabilities that could impact:</p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Authentication & Authorization:</strong> Bypassing authentication, privilege escalation, or unauthorized access to user data</li>
                <li><strong>Data Security:</strong> Unauthorized access to encrypted data, encryption bypasses, or data leakage</li>
                <li><strong>API Security:</strong> API vulnerabilities, injection attacks, or unauthorized API access</li>
                <li><strong>Cross-Site Scripting (XSS):</strong> Stored, reflected, or DOM-based XSS vulnerabilities</li>
                <li><strong>Cross-Site Request Forgery (CSRF):</strong> CSRF vulnerabilities that could lead to unauthorized actions</li>
                <li><strong>Server-Side Request Forgery (SSRF):</strong> SSRF vulnerabilities that could expose internal systems</li>
                <li><strong>Remote Code Execution (RCE):</strong> Any vulnerability that could lead to remote code execution</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Out of Scope</h2>
              <p className="mb-4">The following are not eligible for rewards:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Social engineering attacks</li>
                <li>Physical security issues</li>
                <li>Denial of Service (DoS) attacks</li>
                <li>Spam or phishing attacks</li>
                <li>Issues requiring physical access to a user's device</li>
                <li>Vulnerabilities in third-party services or dependencies</li>
                <li>Issues that don't have a security impact (e.g., UI bugs, typos)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How to Report</h2>
              <p className="mb-4">
                If you've discovered a security vulnerability, please report it to us responsibly using the form below:
              </p>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <FeedbackDialog
                    buttonText="Report Security Vulnerability"
                    buttonVariant="default"
                    buttonSize="lg"
                  />
                </div>
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> You must be logged in to submit a bug report. If you don't have an account, please create one first.
                </p>
              </div>
              <p className="mb-4">When reporting, please include:</p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Clear description:</strong> A detailed explanation of the vulnerability</li>
                <li><strong>Steps to reproduce:</strong> Step-by-step instructions to demonstrate the issue</li>
                <li><strong>Potential impact:</strong> How this vulnerability could be exploited</li>
                <li><strong>Proof-of-concept:</strong> Screenshots, code snippets, or other evidence (you can attach images using the form)</li>
              </ul>
              <p className="text-sm text-gray-600 mb-4">
                We'll acknowledge your report within 48 hours and provide updates on our progress. Please give us reasonable time to fix the issue before disclosing it publicly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Responsible Disclosure</h2>
              <p className="mb-4">
                We ask that you follow responsible disclosure practices:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Do not access or modify data that doesn't belong to you</li>
                <li>Do not perform any actions that could harm our users or services</li>
                <li>Do not publicly disclose the vulnerability until we've had a chance to fix it</li>
                <li>Do not violate any laws or breach any agreements</li>
                <li>Act in good faith and in the best interests of our users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Recognition</h2>
              <p className="mb-4">
                With your permission, we'd love to recognize your contribution to our security. We can:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Add your name (or handle) to our security acknowledgments page</li>
                <li>Thank you publicly for your responsible disclosure</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Questions?</h2>
              <p className="mb-4">
                If you have any questions about our Bug Bounty Program, please use the feedback form above to contact us.
              </p>
            </section>

            <section className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Thank you for helping us keep Injest.io secure! 🔒
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
