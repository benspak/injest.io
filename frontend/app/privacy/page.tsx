import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Privacy Policy - Injest.io',
  description: 'Privacy Policy for Injest.io - Knowledge Recall System',
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-gray-600 mb-2">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="pt-6 space-y-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="mb-4">
                Welcome to Injest.io ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience while using our knowledge recall system. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
              </p>
              <p>
                By accessing or using Injest.io, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">2.1 Information You Provide</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Account Information:</strong> Email address (required for authentication via magic link)</li>
                <li><strong>Content:</strong> Links, bookmarks, emails you forward to us, files you upload (including PDFs, DOCX, JSON, CSV, and HTML files), and notes you create</li>
                <li><strong>Payment Information:</strong> Payment details processed through Stripe (we do not store your full payment card information)</li>
                <li><strong>Communication Data:</strong> Information you provide when contacting us for support or feedback</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">2.2 Automatically Collected Information</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Usage Data:</strong> How you interact with our services, including search queries, features used, and time spent</li>
                <li><strong>Metadata:</strong> Information extracted from your content, such as document titles, URLs, timestamps, and file types</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
                <li><strong>Embeddings:</strong> Vector embeddings generated from your content to enable AI-powered search and organization</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">2.3 Information from Third-Party Services</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Email Services:</strong> Content from emails forwarded to our service</li>
                <li><strong>Payment Processors:</strong> Stripe provides us with payment transaction information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="mb-4">We use the information we collect for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Service Delivery:</strong> To provide, maintain, and improve our knowledge recall system</li>
                <li><strong>Content Processing:</strong> To enrich bookmarks and links with metadata, summarize emails, generate document previews, and create searchable embeddings</li>
                <li><strong>Authentication:</strong> To verify your identity and manage your account access</li>
                <li><strong>Search and Organization:</strong> To enable AI-powered semantic search, categorization, and content organization</li>
                <li><strong>Payment Processing:</strong> To process payments for premium features and import services</li>
                <li><strong>Communication:</strong> To send you service-related notifications, respond to your inquiries, and provide customer support</li>
                <li><strong>Analytics and Improvement:</strong> To analyze usage patterns, troubleshoot issues, and enhance our services</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. AI and Machine Learning</h2>
              <p className="mb-4">
                Our service uses artificial intelligence and machine learning technologies to:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>Generate summaries of email content</li>
                <li>Create vector embeddings for semantic search</li>
                <li>Extract and enrich metadata from your content</li>
                <li>Categorize and organize your information</li>
              </ul>
              <p>
                Your content is processed using AI models to provide these features. We do not use your personal content to train general-purpose AI models that would be shared with other users or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Storage and Security</h2>
              <p className="mb-4">
                We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.
              </p>
              <p>
                Your data is stored on secure servers and is encrypted in transit and at rest. We retain your information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Information Sharing and Disclosure</h2>
              <p className="mb-4">We do not sell your personal information. We may share your information in the following circumstances:</p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.1 Service Providers</h3>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Stripe:</strong> Payment processing services</li>
                <li><strong>Cloud Infrastructure:</strong> Hosting and data storage providers</li>
                <li><strong>AI Services:</strong> Third-party AI services used for content processing (used only to process your content and not to train models)</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.2 Legal Requirements</h3>
              <p className="mb-4">
                We may disclose your information if required by law, court order, or governmental authority, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">6.3 Business Transfers</h3>
              <p>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
              <p className="mb-4">You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Access:</strong> You can access and review your personal information through your account dashboard</li>
                <li><strong>Correction:</strong> You can update or correct your information through your account settings</li>
                <li><strong>Deletion:</strong> You can request deletion of your account and associated data by contacting us</li>
                <li><strong>Export:</strong> You can export your data from your account</li>
                <li><strong>Opt-Out:</strong> You can opt out of non-essential communications</li>
                <li><strong>Account Closure:</strong> You can close your account at any time, which will result in deletion of your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking Technologies</h2>
              <p className="mb-4">
                We use cookies and similar tracking technologies to maintain your session, authenticate your access, and improve our services. You can control cookie preferences through your browser settings, but disabling cookies may affect service functionality.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children's Privacy</h2>
              <p>
                Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you believe we have collected information from a child under 18, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our services, you consent to the transfer of your information to these countries.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Privacy Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically.
              </p>
              <p>
                Your continued use of our services after any changes to this Privacy Policy constitutes acceptance of those changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
              <p className="mb-4">
                If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
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
