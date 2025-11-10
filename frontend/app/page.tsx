import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Link2,
  Mail,
  FileText,
  Search,
  Tag,
  Filter,
  Sparkles,
  Image as ImageIcon,
  Database,
  Download
} from 'lucide-react';

export default function Home() {
  const keyFeatures = [
    {
      id: 'capture',
      icon: Link2,
      title: 'Capture Everything',
      description: 'Pull in bookmarks, files, and notes from anywhere with browser extensions, bulk uploads, or simple email forwarding.',
    },
    {
      id: 'summaries',
      icon: Mail,
      title: 'AI Email Summaries',
      description: 'Forward any email to input@injest.io and instantly get concise bullet-point summaries that keep you up to speed.',
    },
    {
      id: 'search',
      icon: Search,
      title: 'Semantic Search',
      description: 'Ask questions in natural language and find the exact insight you captured—across documents, images, and messages.',
    },
    {
      id: 'automation',
      icon: Sparkles,
      title: 'Automation Ready',
      description: 'Auto-tag, categorize, and enrich every item with metadata so your knowledge base stays organized without manual effort.',
    },
    {
      id: 'api',
      icon: Database,
      title: 'REST API Access',
      description: 'Integrate Injest.io into your workflows with a developer-friendly API for ingestion, syncing, and programmatic search.',
    },
    {
      id: 'exports',
      icon: Download,
      title: 'Portable Data Exports',
      description: 'Download everything you capture as CSV or JSON whenever you need a backup, audit trail, or deeper analysis.',
    },
  ];

  const pricingPlans = [
    {
      id: 'free',
      name: 'Free',
      priceDisplay: '$0',
      priceNote: 'forever',
      limit: 'Up to 500 indexed items',
      description: 'Organize your knowledge base with core capture and search features.',
      features: ['Text and image OCR', 'Semantic search & tagging', 'Bookmark and email capture'],
    },
    {
      id: 'plus',
      name: 'Plus',
      badge: 'Most Popular',
      priceDisplay: '$5',
      priceNote: 'per month',
      limit: 'Up to 5,000 indexed items',
      description: 'Perfect for individuals who want more room to grow their second brain.',
      features: ['Priority indexing for uploads', 'Unlimited bookmark imports', 'Bulk file capture (1,000 files at once)'],
    },
    {
      id: 'power',
      name: 'Power User',
      priceDisplay: '$15',
      priceNote: 'per month',
      limit: '5,000 – 25,000 indexed items',
      description: 'Built for power users with large research archives and active workflows.',
      features: ['Faster background processing', 'Advanced filtering & saved searches', 'Automation-ready email ingestion'],
    },
    {
      id: 'pro',
      name: 'Pro',
      priceDisplay: '$30',
      priceNote: 'per month',
      limit: '25,000 – 75,000 indexed items',
      description: 'Scale your personal knowledge infrastructure with dedicated capacity.',
      features: ['Largest indexing capacity', 'Priority support & onboarding', 'Early access to new features'],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      {/* Hero Section */}
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 md:items-center mb-20">
          <div className="text-center md:text-left">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
              Keep Every Insight Searchable
            </h1>
            <p className="text-xl text-gray-600 mb-4 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Injest.io is your personal search engine—capture links, emails, images, and documents, then surface the right detail in seconds.
            </p>
            <p className="text-lg font-semibold text-blue-600 mb-3 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Upload up to 1,000 images at once, summarize inbox overload, tap into the API, and unlock insights with semantic search.
            </p>
            <p className="text-base text-gray-600 mb-6 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Start free with up to 500 indexed items. Upgrade to Plus for 5,000 items, priority processing, and on-demand CSV or JSON exports.
            </p>
            <p className="text-lg text-gray-500 mb-8 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Capture, enrich, and search through all your information effortlessly
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8">
                  Get Started
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative aspect-[4/3] rounded-3xl border-2 border-white/60 shadow-2xl overflow-hidden">
              <Image
                src="/hero-image.png"
                alt="Illustration of the Injest.io knowledge dashboard"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 42rem, 100vw"
              />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-black/5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            What Makes Injest.io Different
          </h2>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
            {keyFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.id} className="h-full shadow-lg border-2 border-gray-200 transition hover:-translate-y-1 hover:shadow-xl">
                  <CardHeader className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{feature.title}</CardTitle>
                    <CardDescription className="text-base text-gray-600">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Feature Showcase Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Powerful Features
          </h2>

          <div className="grid md:grid-cols-2 gap-12 max-w-7xl mx-auto mb-16">
            {/* Links & Bookmarks with Metadata Enrichment */}
            <Card className="shadow-lg border-2">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Link2 className="w-6 h-6 text-blue-600" />
                  <CardTitle className="text-2xl">Smart Link & Bookmark Enrichment</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Add links or bookmarks and watch them come alive with rich metadata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  When you add a link or bookmark, Injest.io automatically looks up metadata to enrich the UI with:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Title extraction and preview images</li>
                  <li>Source attribution and timestamps</li>
                  <li>Rich preview cards with descriptions</li>
                  <li>Multiple URL association</li>
                </ul>
                <div className="mt-6 rounded-lg border-2 border-gray-200 p-4 bg-white">
                  <div className="text-xs text-gray-500 mb-2">Example: LinkedIn News Item</div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-sm mb-1">Nvidia CEO Jensen Huang touted the company&apos;s latest advancements...</div>
                    <div className="text-xs text-blue-600 mb-2">linkedin.com/news/story/nvidia...</div>
                    <div className="text-xs text-gray-500">Source: web</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Summarization */}
            <Card className="shadow-lg border-2">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <CardTitle className="text-2xl">Intelligent Email Summarization</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Emails are automatically summarized into three key bullet points
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Forward emails to input@injest.io and receive instant AI-powered summaries:
                </p>
                <div className="mt-6 rounded-lg border-2 border-gray-200 p-4 bg-white">
                  <div className="text-xs text-gray-500 mb-2">Example: Email Summary</div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-sm mb-2">Fwd: Your seed FOMO is costing you</div>
                    <div className="text-xs text-gray-600 mb-2">Nov 5, 2025, 01:38 PM • email</div>
                    <div className="text-xs text-gray-700 space-y-1">
                      <div>• The concept of a fundraising &lsquo;round&rsquo; is becoming obsolete...</div>
                      <div>• Following top-tier VCs into early-stage investments...</div>
                      <div>• Investing alongside prominent VCs in late-stage rounds...</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Previews */}
            <Card className="shadow-lg border-2">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <CardTitle className="text-2xl">Rich File Previews</CardTitle>
                </div>
                <CardDescription className="text-base">
                  .json, .pdf, and .docx files display document previews with auto-generated descriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Upload documents and get intelligent previews:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside mb-4">
                  <li>Top of documents displayed in details view</li>
                  <li>Auto-generated descriptions when available</li>
                  <li>Support for JSON, PDF, and DOCX formats</li>
                  <li>Rich metadata extraction</li>
                </ul>
                <div className="mt-6 rounded-lg border-2 border-gray-200 p-4 bg-white">
                  <div className="text-xs text-gray-500 mb-2">Example: LinkedIn News Data</div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-sm mb-2">LinkedIn News Data</div>
                    <div className="text-xs text-gray-600 mb-2">Nov 4, 2025, 08:57 PM • web</div>
                    <div className="text-xs text-gray-500 mb-2">Attachments: news_data (1).csv (219 KB)</div>
                    <div className="text-xs text-gray-700">
                      <div>date,title,url</div>
                      <div>2025-03-18,&quot;No title&quot;,&quot;linkedin.com/news/story/...&quot;</div>
                      <div>2025-03-18,&quot;Google to acquire Wiz for $32B&quot;,&quot;linkedin.com/news/story/...&quot;</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto Categorization & Search */}
            <Card className="shadow-lg border-2">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Tag className="w-6 h-6 text-blue-600" />
                  <CardTitle className="text-2xl">Auto Categorization & Smart Search</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Items are automatically categorized, tagged, and fully searchable
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Powerful search capabilities across your entire knowledge base:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Search on notes, descriptions, titles, and more</li>
                  <li>Automatic categorization and tagging</li>
                  <li>Semantic search understanding context</li>
                  <li>Filter by file attachments</li>
                </ul>
                <div className="mt-6 rounded-lg border-2 border-gray-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-gray-500" />
                    <div className="text-xs text-gray-500">Search across all your content</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="text-xs text-gray-700">
                      Search notes, descriptions, titles, and content to find exactly what you need
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OCR & Image Auto Titling */}
            <Card className="shadow-lg border-2">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                  <CardTitle className="text-2xl">OCR & Image Auto Titling</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Images are automatically processed with OCR and intelligent title generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Upload images and get automatic text extraction and smart titles:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Bulk upload up to 1,000 images and make them searchable in minutes</li>
                  <li>Optical Character Recognition (OCR) extracts text from images</li>
                  <li>AI-powered auto titling based on image content</li>
                  <li>Searchable text content from images</li>
                  <li>Automatic descriptions for better organization</li>
                </ul>
                <div className="mt-6 rounded-lg border-2 border-gray-200 p-4 bg-white">
                  <div className="text-xs text-gray-500 mb-2">Example: Image with OCR</div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-sm mb-1">Auto-generated title from image content</div>
                    <div className="text-xs text-gray-600 mb-2">Extracted text: &quot;Meeting notes: Q4 planning session...&quot;</div>
                    <div className="text-xs text-gray-500">Source: image • OCR processed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter by Attachments */}
          <Card className="max-w-3xl mx-auto shadow-lg border-2 mb-16">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Filter className="w-6 h-6 text-blue-600" />
                <CardTitle className="text-2xl">Advanced Filtering</CardTitle>
              </div>
              <CardDescription className="text-base">
                Filter items based on file attachments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Quickly find items with or without file attachments. Perfect for organizing your knowledge base and locating documents.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Has Attachments
                </Button>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  No Attachments
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-6 text-gray-900">
            Flexible Pricing That Scales With You
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Whether you&apos;re just getting started or curating a vast knowledge base, pick the plan that matches your workflow.
          </p>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative h-full shadow-lg border-2 transition hover:-translate-y-1 hover:shadow-xl ${
                  plan.badge ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl text-gray-900">{plan.name}</CardTitle>
                    {plan.badge && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">{plan.priceDisplay}</span>
                    <span className="text-sm text-gray-500">{plan.priceNote}</span>
                  </div>
                  <CardDescription className="text-base text-blue-600 font-medium">
                    {plan.limit}
                  </CardDescription>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            How It Works
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-2xl mx-auto mb-4">
                  1
                </div>
                <h3 className="font-semibold text-lg mb-2">Connect Your Email</h3>
                <p className="text-gray-600">Verify your email address to get started with Injest.io</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-2xl mx-auto mb-4">
                  2
                </div>
                <h3 className="font-semibold text-lg mb-2">Capture Content</h3>
                <p className="text-gray-600">Send emails, add links, upload files, or import bookmarks</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-2xl mx-auto mb-4">
                  3
                </div>
                <h3 className="font-semibold text-lg mb-2">Search & Discover</h3>
                <p className="text-gray-600">Use natural language to search through all your enriched content</p>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Showcase - Screenshots Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Platform Showcase
          </h2>
          <div className="max-w-7xl mx-auto space-y-12">
            {/* Dashboard Screenshot */}
            <Card className="shadow-xl border-2 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <CardTitle className="text-2xl">Interactive Dashboard</CardTitle>
                <CardDescription className="text-blue-100">
                  Create items, import bookmarks, and view your enriched content feed
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative w-full aspect-video bg-gray-100">
                  <Image
                    src="/dashboard-screenshot.png"
                    alt="Interactive Dashboard showing two-column layout with create form and enriched content feed"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </CardContent>
            </Card>

            {/* Item Detail Screenshot */}
            <Card className="shadow-xl border-2 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <CardTitle className="text-2xl">Rich Item Details</CardTitle>
                <CardDescription className="text-indigo-100">
                  View detailed information with attachments, summaries, and notes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative w-full aspect-video bg-gray-100">
                  <Image
                    src="/item-detail-screenshot.png"
                    alt="Rich Item Details modal showing LinkedIn News Data with CSV attachment and metadata"
                    fill
                    className="object-contain"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Email Summary Screenshot */}
            <Card className="shadow-xl border-2 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                <CardTitle className="text-2xl">Email Summarization</CardTitle>
                <CardDescription className="text-purple-100">
                  See how emails are automatically summarized into key bullet points
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative w-full aspect-video bg-gray-100">
                  <Image
                    src="/email-summary-screenshot.png"
                    alt="Email Summarization showing forwarded email with three bullet point summary"
                    fill
                    className="object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center py-16 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl text-white">
          <Sparkles className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Knowledge Management?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Start capturing, enriching, and searching through all your information today
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Get Started Free
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-20 py-8 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/terms" className="hover:text-blue-600 transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
