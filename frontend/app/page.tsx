import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HomepagePricingPlans } from "@/components/homepage-pricing-plans";

export default function Home() {
  const pricingPlans = [
    {
      tier: 'free' as const,
      name: "Free",
      priceDisplay: "$0",
      priceNote: "",
      limit: "Up to 250 items",
      description: "Get started with up to 250 indexed items.",
      features: [
        "Text extraction from images",
        "Smart search",
        "Basic tagging",
      ],
    },
    {
      tier: 'plus' as const,
      name: "Plus",
      priceDisplay: "$5",
      priceNote: "/mo",
      limit: "Up to 2,500 items",
      description: "Perfect for growing libraries.",
      features: [
        "Everything in Free",
        "Advanced search filters",
        "Email forwarding",
        "Priority support",
      ],
    },
    {
      tier: 'pro' as const,
      name: "Pro",
      priceDisplay: "$25",
      priceNote: "/mo",
      limit: "Up to 25,000 items",
      description: "Scale to enterprise needs.",
      features: [
        "Everything in Plus",
        "Dedicated support",
        "Custom workflows",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Never lose track of your files, notes, and ideas again.
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-10 leading-relaxed">
            Whether you're saving research, organizing receipts, or collecting inspiration — Injest makes every image, document, and message instantly searchable and ready to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/login">Start Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6">
              <Link href="/dashboard">Explore the Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            You save everything — but can't find anything.
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
            You save receipts, screenshots, research notes, and important documents — but when you need them, they're lost in folders, buried in email threads, or forgotten in your downloads. Teams share files and links that disappear when they're needed most. Injest solves this by making every captured file, email, or bookmark instantly searchable, shareable, and ready to use.
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 text-center">
            One workspace for all your data
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-12 text-center leading-relaxed">
            Upload images, forward emails, or save links — all flow into a single searchable workspace. Each item is automatically organized with text extraction, smart tagging, and contact detection so it shows up the moment you need it.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Extract text from images</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Read text from photos, screenshots, and PDFs automatically
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Search by meaning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Find what you're looking for even if you don't remember the exact words
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Smart organization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Filter by type, tags, source, and date to find anything quickly
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Search smarter, not harder
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
            Search by keywords or describe what you're looking for — Injest finds notes, documents, and contacts even when you don't remember the exact words. Filter by type, tags, source, or date to narrow down results instantly.
          </p>
        </div>
      </section>

      {/* Action Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 text-center">
            Act on what you find
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-12 text-center leading-relaxed">
            Injest isn't just storage — it's where actions happen.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate send plans or follow-up drafts</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Email contacts with tracked attachments</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Convert items into tasks</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Export your data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Download your organized information in spreadsheets or structured formats
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
              Perfect for Your Workflow
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Research & Reference</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Save articles, screenshots, and notes. Find them instantly with smart search, even months later.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Receipts & Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Capture receipts, invoices, and important papers. Extract text automatically and organize by date or category.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Team Collaboration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Share items securely with teammates, track who accessed what, and keep everything organized in one place.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Project Planning</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Collect inspiration, save reference materials, and convert items into actionable tasks for your projects.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
              From Capture to Action in Three Steps
            </h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Capture or forward content
                  </h3>
                  <p className="text-gray-600">
                    Upload attachments, send email, or save browser tabs.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Injest organizes automatically
                  </h3>
                  <p className="text-gray-600">
                    Text extraction, smart tagging, and contact detection happen in the background.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Search, share, and follow up
                  </h3>
                  <p className="text-gray-600">
                    Find what you need and take action instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ingestion Methods Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
            Ways to Bring Data In
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>File Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Upload files up to 25 MB each. Text is extracted automatically, and duplicates are skipped.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Forwarded Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Send to input@injest.io. Attachments and threads are preserved and indexed.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Bookmarks Extension</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Save tabs from Chrome with one click or import HTML files in bulk.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Automation Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
              Automation Tools Built In
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Draft follow-up emails</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Generate email drafts from your saved items
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Send tracked emails</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Email contacts directly with tracked attachments
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Share and export</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Share items with others or export your collections
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Turn items into tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Convert any saved item into an actionable task
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
            Collaboration and Access
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Invite teammates via email</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Access checks on shared items</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Real-time updates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  See new items appear as they're processed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Full context preserved</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  In exports
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
              Pricing That Scales With Your Library
            </h2>
            <HomepagePricingPlans plans={pricingPlans} />
          </div>
        </div>
      </section>

      {/* Advantage Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
            The Injest Advantage
          </h2>
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  You're drowning in screenshots and files.
                </h3>
              </div>
              <div className="flex-1">
                <p className="text-gray-600 text-lg">
                  Injest captures and organizes them automatically.
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  You can't remember where that one quote, receipt, or contact was.
                </h3>
              </div>
              <div className="flex-1">
                <p className="text-gray-600 text-lg">
                  Injest makes it searchable by text, label, or date.
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  You're switching between tools to take action.
                </h3>
              </div>
              <div className="flex-1">
                <p className="text-gray-600 text-lg">
                  Injest keeps search, sharing, and sending in one place.
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  You waste time switching between apps.
                </h3>
              </div>
              <div className="flex-1">
                <p className="text-gray-600 text-lg">
                  Injest keeps everything in one place — search, organize, share, and take action without leaving your workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Ready to make every file, screenshot, and email searchable?
            </h2>
            <p className="text-xl mb-10 text-blue-100">
              Knowledge workers, researchers, and teams use Injest to capture, search, and act — without juggling extra tools.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Link href="/login">Start Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 bg-transparent border-white text-white hover:bg-white hover:text-blue-600">
                <Link href="/dashboard">Explore the Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/terms" className="hover:text-blue-600 transition-colors">
              Terms of Service
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/developers" className="hover:text-blue-600 transition-colors">
              Developer Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
