import Link from "next/link";
import Image from "next/image";
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
      limit: "Up to 1,000 items",
      description: "Get started with up to 1,000 indexed items and pro-grade capture features.",
      features: [
        "Text extraction from images",
        "Smart search",
        "Advanced search filters",
        "Email forwarding & automation",
      ],
    },
    {
      tier: 'pro' as const,
      name: "Pro",
      priceDisplay: "$12",
      priceNote: "/mo",
      limit: "Unlimited items",
      description: "Unlimited indexed items with priority ingestion and support.",
      features: [
        "Everything in Free",
        "Unlimited storage & automation",
        "Priority tagging & API keys",
        "Priority support",
      ],
    },
    {
      tier: 'pro_annual' as const,
      name: "Pro Annual",
      priceDisplay: "$115",
      priceNote: "/year (save 20%)",
      limit: "Unlimited items",
      description: "Annual billing with a 20% discount and dedicated onboarding.",
      features: [
        "Everything in Pro",
        "Dedicated onboarding support",
        "Annual billing discount",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Search Your AI Workspace
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-10 leading-relaxed">
            Injest turns everything you capture into one instantly searchable AI workspace.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/login">Start Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6">
              <Link href="/inbox">Explore the Inbox</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Everything you capture, instantly searchable
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
            Capture images, documents, emails, and links — they all flow into your AI workspace. Search by meaning, not just keywords. Find what you need the moment you need it, powered by AI that understands context and content.
          </p>
        </div>
      </section>

      {/* AI Workspace Features Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 text-center">
            Your AI workspace, powered by intelligent search
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-12 text-center leading-relaxed">
            Everything you capture becomes part of your searchable workspace. AI extracts text, understands context, and organizes content so you can find anything instantly.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI-powered search</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Search by meaning, not just keywords. Find content even when you don't remember exact words.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Instant text extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AI reads text from images, PDFs, and screenshots automatically — making everything searchable.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Smart organization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AI tags, categorizes, and structures your content so it's always ready when you need it.
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
            Search your workspace like you think
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
            Describe what you're looking for in natural language. Your AI workspace understands context and meaning, finding the right content even when you don't remember exact words. Filter by type, tags, source, or date to refine results instantly.
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
                    Collect inspiration and save reference materials for your projects.
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
              Your AI workspace in three steps
            </h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Capture everything
                  </h3>
                  <p className="text-gray-600">
                    Upload files, forward emails, or save links — everything flows into your workspace.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    AI makes it searchable
                  </h3>
                  <p className="text-gray-600">
                    AI extracts text, understands context, and organizes content automatically — making everything instantly searchable.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Search and find instantly
                  </h3>
                  <p className="text-gray-600">
                    Search your workspace by meaning, find what you need, and take action — all in one place.
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
            Capture everything into your workspace
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>File Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Upload files up to 25 MB each. AI extracts text automatically, making everything searchable in your workspace.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Forwarded Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Send to input@injest.io. Attachments and threads are preserved, indexed, and made searchable.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Bookmarks Extension</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Save tabs from Chrome with one click. Everything flows into your searchable AI workspace.
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

      {/* Founder Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="order-2 lg:order-1">
              <p className="uppercase tracking-wide text-sm font-semibold text-blue-600 mb-3">
                About the Founder
              </p>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Built by Ben Spak to tame the modern knowledge flood
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Ben Spak is a product-minded engineer who has spent his career helping teams
                capture, search, and act on the information that matters. He founded Injest after
                watching knowledge workers drown in screenshots, inboxes, and files that never
                made it back when they were needed most.
              </p>
              <p className="text-lg text-gray-600 mb-8">
                Today he leads Injest with a builder’s mindset: every feature must save time,
                surface context, and keep ownership of your data squarely in your hands. Ben still
                personally tests new ingestion paths, answers customer feedback, and obsesses over
                search quality so you can trust the workspace that powers your day.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                  <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">
                    Focus
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    Human + AI workflows that feel natural
                  </p>
                </div>
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                  <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">
                    Commitment
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    Privacy, ownership, and fast execution
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="w-full max-w-sm">
                <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-500 p-1 shadow-xl">
                  <div className="rounded-3xl bg-white p-8 h-full flex flex-col items-center text-center gap-4">
                    <div className="w-32 h-32 rounded-full overflow-hidden">
                      <Image
                        src="/ben-spak.jpg"
                        alt="Photo of Ben Spak"
                        width={128}
                        height={128}
                        className="object-cover w-full h-full"
                        priority
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-gray-900">Ben Spak</p>
                      <p className="text-sm uppercase tracking-wide text-gray-500">
                        Founder & Builder
                      </p>
                    </div>
                    <p className="text-gray-600">
                      “Injest exists so you never lose the spark inside a screenshot, email, or doc
                      again. If it enters your world, you should be able to find and act on it
                      instantly.”
                    </p>
                    <Link
                      href="https://x.com/benvspak"
                      target="_blank"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Follow @benvspak ↗
                    </Link>
                  </div>
                </div>
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
              Start searching your AI workspace today
            </h2>
            <p className="text-xl mb-10 text-blue-100">
              Turn everything you capture into one instantly searchable AI workspace. Join knowledge workers, researchers, and teams who use Injest to find what they need, when they need it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Link href="/login">Start Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 bg-transparent border-white text-white hover:bg-white hover:text-blue-600">
                <Link href="/inbox">Explore the Inbox</Link>
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
