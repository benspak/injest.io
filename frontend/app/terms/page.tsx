import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Terms of Service - Injest.io',
  description: 'Terms of Service for Injest.io - Knowledge Recall System',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              ← Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-gray-600 mb-2">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6 space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
              <p className="mb-4">
                By accessing or using Injest.io (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you disagree with any part of these Terms, you may not access or use the Service.
              </p>
              <p>
                These Terms constitute a legally binding agreement between you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and Injest.io (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="mb-4">
                Injest.io is a knowledge recall system that enables users to:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Capture and store content, including links, bookmarks, emails, and files</li>
                <li>Enrich content with metadata and AI-generated summaries</li>
                <li>Search and organize information using AI-powered semantic search</li>
                <li>Import bookmarks</li>
                <li>Access premium features through subscription plans</li>
              </ul>
              <p>
                We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts and Registration</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.1 Account Creation</h3>
              <p className="mb-4">
                To use the Service, you must create an account by providing a valid email address. You will receive a magic link via email to authenticate your account. You are responsible for maintaining the confidentiality of your account credentials.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.2 Account Responsibilities</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>You must be at least 18 years old to create an account</li>
                <li>You are responsible for all activities that occur under your account</li>
                <li>You must provide accurate, current, and complete information</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
                <li>You may not share your account credentials with third parties</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.3 Account Termination</h3>
              <p>
                We reserve the right to suspend or terminate your account at any time for violation of these Terms, fraudulent activity, or any other reason we deem necessary. You may terminate your account at any time by contacting us or through your account settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Acceptable Use</h2>
              <p className="mb-4">You agree not to use the Service to:</p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Upload, post, or transmit any content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
                <li>Upload content that infringes on intellectual property rights, including copyrights, trademarks, or patents</li>
                <li>Transmit viruses, malware, or any other harmful code</li>
                <li>Attempt to gain unauthorized access to the Service or related systems</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Use automated systems (bots, scrapers) to access the Service without permission</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
                <li>Collect or harvest information about other users without their consent</li>
                <li>Use the Service for any commercial purpose not expressly permitted by us</li>
              </ul>
              <p>
                We reserve the right to remove any content that violates these Terms and to suspend or terminate accounts that engage in prohibited activities.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Payment Terms</h2>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.1 Premium Subscriptions</h3>
              <p className="mb-4">
                We offer premium subscription plans that provide additional features and benefits. Subscription fees are billed in advance on a recurring basis (monthly or annually) and are non-refundable except as required by law.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.2 Pay-Per-Use Services</h3>
              <p className="mb-4">
                Certain features, such as importing large numbers of bookmarks, may require payment. Payment is processed through Stripe, and you agree to provide valid payment information. Prices are subject to change with notice.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.3 Payment Processing</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>All payments are processed securely through Stripe</li>
                <li>You authorize us to charge your payment method for all fees associated with your account</li>
                <li>If payment fails, we may suspend or terminate your access to paid features</li>
                <li>Refunds, if applicable, will be processed in accordance with our refund policy</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.4 Cancellation</h3>
              <p>
                You may cancel your subscription at any time. Cancellation will take effect at the end of your current billing period. You will continue to have access to premium features until the end of the billing period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property Rights</h2>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.1 Service Ownership</h3>
              <p className="mb-4">
                The Service, including all software, designs, text, graphics, logos, and other content, is owned by us or our licensors and is protected by copyright, trademark, and other intellectual property laws.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.2 Your Content</h3>
              <p className="mb-4">
                You retain ownership of all content you upload, submit, or create through the Service (&ldquo;Your Content&rdquo;). By using the Service, you grant us a worldwide, non-exclusive, royalty-free license to:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Store, process, and display Your Content as necessary to provide the Service</li>
                <li>Generate embeddings, summaries, and metadata from Your Content</li>
                <li>Perform technical operations required for the Service</li>
              </ul>
              <p>
                You represent and warrant that you have the right to grant this license and that Your Content does not violate any third-party rights.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.3 AI Processing</h3>
              <p>
                We use artificial intelligence to process Your Content. This processing is performed solely to provide you with the Service&apos;s features and is not used to train general-purpose AI models that would benefit other users or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Service Availability and Modifications</h2>
              <p className="mb-4">
                We strive to provide reliable service, but we do not guarantee that the Service will be available at all times or free from errors, interruptions, or security issues. We may:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Perform scheduled or unscheduled maintenance</li>
                <li>Modify, update, or discontinue features</li>
                <li>Change service availability or access methods</li>
                <li>Implement security measures that may temporarily affect access</li>
              </ul>
              <p>
                We are not liable for any loss or damage resulting from service interruptions or modifications.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Third-Party Services</h2>
              <p className="mb-4">
                The Service may integrate with or link to third-party services, including:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Stripe for payment processing</li>
                <li>Email services for receiving forwarded emails</li>
                <li>Cloud infrastructure providers</li>
                <li>AI service providers</li>
              </ul>
              <p>
                Your use of third-party services is subject to their respective terms and conditions. We are not responsible for the availability, accuracy, or practices of third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL WE BE LIABLE FOR:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                <li>Loss of profits, revenue, data, or use</li>
                <li>Business interruption or loss of business opportunities</li>
                <li>Damages resulting from unauthorized access, use, or alteration of your content</li>
              </ul>
              <p>
                Our total liability for any claims arising from or related to the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Disclaimer of Warranties</h2>
              <p className="mb-4">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Warranties of merchantability, fitness for a particular purpose, or non-infringement</li>
                <li>Warranties that the Service will be uninterrupted, secure, or error-free</li>
                <li>Warranties regarding the accuracy, completeness, or reliability of AI-generated content, summaries, or metadata</li>
              </ul>
              <p>
                We do not warrant that the Service will meet your requirements or that any errors will be corrected.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless us and our officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising out of or in connection with: (a) your use of the Service, (b) Your Content, (c) your violation of these Terms, or (d) your violation of any third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Data Retention and Deletion</h2>
              <p className="mb-4">
                We will retain your data for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data at any time. Upon account deletion:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Your account will be permanently deleted</li>
                <li>Your content, including items, embeddings, and files, will be removed</li>
                <li>Some information may be retained as required by law or for legitimate business purposes</li>
              </ul>
              <p>
                We are not responsible for any loss of data resulting from account deletion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law and Dispute Resolution</h2>
              <p className="mb-4">
                These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of [Arbitration Organization], except where prohibited by law. You waive any right to participate in a class-action lawsuit or class-wide arbitration.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Posting the updated Terms on this page</li>
                <li>Updating the &quot;Last Updated&quot; date</li>
                <li>Sending an email notification to your registered email address (for significant changes)</li>
              </ul>
              <p>
                Your continued use of the Service after any changes constitutes acceptance of the modified Terms. If you do not agree to the changes, you must stop using the Service and may terminate your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Severability</h2>
              <p>
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Entire Agreement</h2>
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Service and supersede all prior agreements and understandings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">17. Contact Information</h2>
              <p className="mb-4">
                If you have questions about these Terms, please contact us at:
              </p>
              <p>
                <strong>Email:</strong> support@injest.io<br />
                <strong>Website:</strong> <Link href="/" className="text-blue-600 hover:underline">injest.io</Link>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
