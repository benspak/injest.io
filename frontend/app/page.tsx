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
  Sparkles
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      {/* Hero Section */}
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-full">
        <div className="text-center mb-20">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Injest.io
          </h1>
          <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
            Your AI-powered knowledge recall system
          </p>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            Capture, enrich, and search through all your information effortlessly
          </p>
          <div className="flex gap-4 justify-center">
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
                    <div className="font-semibold text-sm mb-1">Nvidia CEO Jensen Huang touted the company's latest advancements...</div>
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
                      <div>• The concept of a fundraising 'round' is becoming obsolete...</div>
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
                      <div>2025-03-18,"No title","linkedin.com/news/story/..."</div>
                      <div>2025-03-18,"Google to acquire Wiz for $32B","linkedin.com/news/story/..."</div>
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
      </div>
    </div>
  );
}
