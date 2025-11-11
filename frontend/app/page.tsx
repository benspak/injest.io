import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Code,
  Database,
  Download,
  FileText,
  Image as ImageIcon,
  Palette,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";
import {
  PAID_PLAN_ORDER,
  SUBSCRIPTION_PLANS,
  formatPlanPrice,
  type SubscriptionTier,
} from "@/lib/subscriptionPlans";

export default function Home() {
  const coreValueProps = [
    {
      id: "extract",
      icon: ImageIcon,
      title: "Extract every word inside your images",
      description: "Upload screenshots, scanned docs, slides, or memes and get high-accuracy OCR in seconds.",
    },
    {
      id: "label",
      icon: Tag,
      title: "Label, structure, and enrich automatically",
      description: "Injest.io applies AI-generated titles, tags, captions, and metadata so every image becomes searchable.",
    },
    {
      id: "deliver",
      icon: Database,
      title: "Deliver the data anywhere",
      description: "Access your structured results from the dashboard, export CSVs, or hit the REST API for JSON instantly.",
    },
  ];

  const personaHighlights = [
    {
      id: "developers",
      icon: Code,
      title: "For Developers & Indie Hackers",
      subtitle: "Drop-in OCR & labeling API",
      bullets: [
        "Send an image URL or upload a file—receive JSON with extracted text, labels, and embeddings.",
        "Pipe structured image data into internal tools, AI agents, or analytics workflows without building OCR yourself.",
        "Trigger downstream jobs with background processing and manage keys, usage, and logs from the dashboard.",
      ],
    },
    {
      id: "creators",
      icon: Palette,
      title: "For Content Creators & Researchers",
      subtitle: "Organize visual libraries in minutes",
      bullets: [
        "Bulk upload moodboards, screenshot folders, and inspiration images to auto-tag what's inside.",
        "Search by quotes, captions, or on-image text to instantly find the right asset for your next project.",
        "Export collections as CSV or plug directly into planning tools with structured metadata.",
      ],
    },
  ];

  const workflowSteps = [
    {
      step: "1",
      title: "Upload any image source",
      description: "Drag photos, drop folders, or hit the API with URLs and files—no manual setup required.",
    },
    {
      step: "2",
      title: "We extract & label automatically",
      description: "OCR, captioning, entity detection, similar image grouping, and tagging happen in the background.",
    },
    {
      step: "3",
      title: "Search or ship the results",
      description: "Use the dashboard, API, or CSV exports to power search, automations, or creative workflows.",
    },
  ];

  const deliveryOptions = [
    {
      id: "api",
      icon: Database,
      title: "REST API",
      description: "Integrate with a straightforward JSON API optimized for asynchronous processing.",
    },
    {
      id: "dashboard",
      icon: Search,
      title: "Searchable Dashboard",
      description: "Filter by text, tags, detected entities, or upload source to keep visual libraries organized.",
    },
    {
      id: "exports",
      icon: Download,
      title: "CSV & Bulk Exports",
      description: "Pull structured datasets for spreadsheets, CMS imports, or data science notebooks.",
    },
  ];

  const planDisplayOrder: SubscriptionTier[] = ["free", ...PAID_PLAN_ORDER];

  const planCopy: Record<
    SubscriptionTier,
    {
      badge?: string;
      priceNote: string;
      features: string[];
    }
  > = {
    free: {
      priceNote: "forever",
      features: [
        "Dashboard",
        "OCR with auto-tagging",
      ],
    },
    plus: {
      badge: "Most popular",
      priceNote: "per month",
      features: [
        "Everything in Free",
        "API access",
        "CSV exports",
        "JSON exports",
      ],
    },
    power: {
      priceNote: "per month",
      features: [
        "Everything in Plus",
        "Priority processing queue",
      ],
    },
    pro: {
      priceNote: "per month",
      features: [
        "Everything in Power User",
        "Dedicated onboarding & support",
      ],
    },
  };

  const pricingPlans = planDisplayOrder.map((tier) => {
    const plan = SUBSCRIPTION_PLANS[tier];
    const copy = planCopy[tier];
    return {
      id: plan.id,
      name: plan.name,
      badge: copy.badge,
      priceDisplay: plan.monthlyPriceCents === 0 ? "$0" : formatPlanPrice(plan.monthlyPriceCents),
      priceNote: copy.priceNote,
      limit: `Up to ${plan.maxIndexedItems.toLocaleString()} indexed items`,
      description: plan.description,
      features: copy.features,
    };
  });

  const developerUseCases = [
    "Enrich product screenshots and UI datasets for AI training.",
    "Pipe scanned documents into tooling that needs structured JSON.",
    "Spin up automation that recognizes and tags memes, assets, or receipts.",
  ];

  const creatorUseCases = [
    "Build searchable archives of inspiration boards, research, and references.",
    "Extract captions and on-image text for social media planners or CMS publishing.",
    "Tag and group media so the right asset is always a search away.",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="grid gap-12 md:grid-cols-2 md:items-center mb-24">
          <div className="text-center md:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 mb-6">
              <Sparkles className="w-4 h-4" />
              Extract, label, and organize text from images — instantly.
            </p>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
              The easiest way to turn images into structured data
            </h1>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Injest.io helps developers and creators capture screenshots, scans, and visual research—then returns clean text, labels, and metadata through a dashboard, CSV exports, or a drop-in API.
            </p>
            <p className="text-lg text-blue-600 font-semibold mb-8 max-w-2xl md:max-w-lg mx-auto md:mx-0">
              Upload any image. We give you the text, labels, and structured data instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8">
                  Start for free
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Explore the dashboard
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative aspect-[4/3] rounded-3xl border-2 border-white/60 shadow-2xl overflow-hidden">
              <Image
                src="/hero-image.png"
                alt="Injest.io dashboard preview showing image extraction results"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 42rem, 100vw"
              />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-black/5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Why builders and creators choose Injest.io
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {coreValueProps.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.id} className="h-full border-2 border-gray-200 shadow-lg transition hover:-translate-y-1 hover:shadow-xl">
                  <CardHeader className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{item.title}</CardTitle>
                    <CardDescription className="text-base text-gray-600">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Persona Highlights */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Built for two core personas
          </h2>
          <div className="grid gap-10 md:grid-cols-2">
            {personaHighlights.map((persona) => {
              const Icon = persona.icon;
              return (
                <Card key={persona.id} className="border-2 border-gray-200 shadow-lg">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl text-gray-900">{persona.title}</CardTitle>
                        <CardDescription className="text-base text-indigo-600">
                          {persona.subtitle}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4 text-gray-600">
                      {persona.bullets.map((bullet) => (
                        <li key={bullet} className="text-base leading-relaxed">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            From upload to structured data in three steps
          </h2>
          <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-3">
            {workflowSteps.map((step) => (
              <Card key={step.step} className="border-2 border-gray-200 shadow-lg h-full text-center">
                <CardHeader className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
                    {step.step}
                  </div>
                  <CardTitle className="text-xl text-gray-900">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* API Example */}
        <div className="mb-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Drop in a single API call and get JSON back
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                No model training, no DevOps. Injest.io handles the heavy lifting so you can focus on your product. Authenticate with your API key, send an image, and receive text, labels, entities, and embeddable vectors.
              </p>
              <ul className="space-y-3 text-gray-600">
                <li>✓ 99.9% uptime with background processing</li>
                <li>✓ Async job support for batch pipelines</li>
                <li>✓ SDKs and Postman collections to get started fast</li>
              </ul>
            </div>
            <Card className="border-2 border-gray-200 shadow-xl bg-gray-950 text-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-mono text-gray-200">POST /v1/images/extract</CardTitle>
                <CardDescription className="text-sm text-gray-400">
                  Example request returning structured metadata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm leading-6 font-mono overflow-x-auto bg-gray-900 rounded-lg p-6 border border-gray-800">
{`curl -X POST https://api.injest.io/v1/images/extract \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cdn.example.com/screenshots/v1.png"
  }'`}
                </pre>
                <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Response preview</p>
                  <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
{`{
  "id": "img_86h2",
  "text": "Settings • Upload screenshots, control access...",
  "labels": ["ui", "product", "settings"],
  "entities": [{"type": "app_feature", "value": "upload"}],
  "summary": "Dashboard page explaining upload and access controls.",
  "vectors": "... truncated ..."
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delivery Options */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Turn extracted text into action
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {deliveryOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card key={option.id} className="border-2 border-gray-200 shadow-lg h-full">
                  <CardHeader className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{option.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{option.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Go from messy image folders to searchable datasets
          </h2>
          <div className="grid gap-10 md:grid-cols-2">
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-900">Developer playbook</CardTitle>
                <CardDescription className="text-base text-blue-600">
                  JSON in, JSON out—ready for any stack
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 text-gray-600">
                  {developerUseCases.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-blue-500 mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-900">Creator workflows</CardTitle>
                <CardDescription className="text-base text-blue-600">
                  Organize, search, and publish with confidence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 text-gray-600">
                  {creatorUseCases.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-blue-500 mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-6 text-gray-900">
            Pricing that scales with your library
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Start free, then unlock higher throughput when you're ready. Every plan includes API access, dashboard tools, and exports.
          </p>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative h-full shadow-lg border-2 transition hover:-translate-y-1 hover:shadow-xl ${
                  plan.badge ? "border-blue-500" : "border-gray-200"
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

        {/* CTA Section */}
        <div className="text-center py-16 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl text-white">
          <Sparkles className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-4xl font-bold mb-4">Ready to search every image you capture?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join developers and creators who organize their visual knowledge base with Injest.io.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Create your free account
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
            <span className="hidden sm:inline">•</span>
            <Link href="/developers" className="hover:text-blue-600 transition-colors">
              Developer Docs
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
