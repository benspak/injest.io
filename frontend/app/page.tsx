import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Image as ImageIcon,
  Inbox,
  Link2,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  PAID_PLAN_ORDER,
  SUBSCRIPTION_PLANS,
  formatPlanPrice,
  type SubscriptionTier,
} from "@/lib/subscriptionPlans";

export default function Home() {
  const valuePillars = [
    {
      id: "capture",
      icon: Inbox,
      title: "Capture files, email, and bookmarks",
      description:
        "Upload up to 50 MB attachments with checksum dedupe, forward to input@injest.io, and import bookmarks or Chrome captures without hand-tagging.",
    },
    {
      id: "search",
      icon: Search,
      title: "Search items and contacts together",
      description:
        "Semantic and keyword search covers notes, documents, and extracted contacts with filters for type, tags, source, attachments, and date.",
    },
    {
      id: "act",
      icon: Send,
      title: "Act on results immediately",
      description:
        "Generate send plans, email contacts with tracked attachments, convert items into tasks, and export JSON or CSV inside the same workspace.",
    },
  ];

  const connectedSurfaces = [
    {
      id: "uploads",
      icon: ImageIcon,
      title: "File uploads",
      subtitle: "50 MB per file with dedupe",
      bullets: [
        "Drag and drop PDFs, docs, and images; unsupported audio and video are blocked up front.",
        "OCR, text extraction, and entity detection run during background processing.",
        "Checksum matching skips duplicates and links back to the item already on file.",
      ],
    },
    {
      id: "email",
      icon: Inbox,
      title: "Forwarded email",
      subtitle: "input@injest.io webhook",
      bullets: [
        "Verified users can forward through Resend; inbound mail becomes an indexed item automatically.",
        "Attachments are preserved and searchable alongside the message body.",
        "Received threads also show inside the dashboard for review next to other items.",
      ],
    },
    {
      id: "bookmarks",
      icon: Link2,
      title: "Bookmarks & extension",
      subtitle: "Chrome capture plus HTML import",
      bullets: [
        "Use the open-source Chrome extension to save the current tab with one click.",
        "Import browser bookmark HTML files; large batches queue in the background.",
        "Metadata is normalized so saved links surface with notes, tags, and source context.",
      ],
    },
  ];

  const workflowSteps = [
    {
      step: "1",
      title: "Capture or forward content",
      description:
        "Upload attachments, send email to input@injest.io, or capture tabs and bookmarks from the browser.",
    },
    {
      step: "2",
      title: "Injest enriches in the background",
      description:
        "Text extraction, embeddings, tagging, and contact detection run automatically while uploads finish.",
    },
    {
      step: "3",
      title: "Search, share, and follow up",
      description:
        "Run semantic search, build send plans, share items, or convert any record into a task without leaving the dashboard.",
    },
  ];

  const actionOptions = [
    {
      id: "send-plan",
      icon: Sparkles,
      title: "Generate send plan drafts",
      description:
        "Use /api/send/plan to summarise contacts and matching items for any outbound prompt.",
    },
    {
      id: "execute-send",
      icon: Send,
      title: "Send tracked emails",
      description:
        "Compose with attachments and send through Resend via /api/send/execute while updating contact history.",
    },
    {
      id: "export",
      icon: FileText,
      title: "Share or export items",
      description:
        "Create share links, email items to teammates, or download JSON and CSV exports on demand.",
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
        "Up to 500 indexed items",
        "Semantic search with filters",
        "File & bookmark ingestion",
      ],
    },
    plus: {
      badge: "Most popular",
      priceNote: "per month",
      features: [
        "Everything in Free",
        "Up to 5,000 indexed items",
        "Generate API keys for /api/external",
        "Send plan automation endpoints",
      ],
    },
    power: {
      priceNote: "per month",
      features: [
        "Everything in Plus",
        "Up to 25,000 indexed items",
      ],
    },
    pro: {
      priceNote: "per month",
      features: [
        "Everything in Power",
        "Up to 75,000 indexed items",
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

  const teamPlays = [
    {
      id: "contacts",
      title: "Contacts stay in sync",
      subtitle: "Auto-extracted and editable",
      bullets: [
        "Email and file parsing detects contacts automatically and adds them to the workspace.",
        "Manage contacts with search, streaming updates, and manual edits from the contacts page.",
        "Send workflows record last interaction metadata the moment an email is delivered.",
      ],
    },
    {
      id: "tasks",
      title: "Tasks from any item",
      subtitle: "Track follow-ups in place",
      bullets: [
        "Convert items to tasks with /api/tasks/taskify/:itemId and keep them linked to the source content.",
        "Update status, due dates, or descriptions directly from the dashboard or API.",
        "Use prompts on a task to rewrite summaries or next steps without leaving the record.",
      ],
    },
    {
      id: "sharing",
      title: "Sharing and exports",
      subtitle: "Keep context intact",
      bullets: [
        "Share items via email or copy a restricted link with access checks.",
        "Download JSON or CSV exports containing normalized metadata and attachments.",
        "Live item streams refresh the dashboard as enrichment finishes in the background.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="grid gap-12 md:grid-cols-2 md:items-center mb-24">
          <div className="text-center md:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 mb-6">
              <Sparkles className="w-4 h-4" />
              Capture. Search. Act.
            </p>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
              Keep files, email, and contacts searchable and ready to move.
            </h1>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Injest stores uploads, forwarded mail, and saved links in one workspace. Each item is enriched with OCR, embeddings, and detected contacts so it shows up the moment you need it.
            </p>
            <p className="text-lg text-blue-600 font-semibold mb-8 max-w-2xl md:max-w-lg mx-auto md:mx-0">
              Search from the dashboard or API, share items with access checks, generate send plans, and export records without juggling extra tools.
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
                alt="Injest.io workspace showing unified search and send flows"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 42rem, 100vw"
              />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-black/5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Value Pillars */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            What Injest ships today
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {valuePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card
                  key={pillar.id}
                  className="h-full border-2 border-gray-200 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <CardHeader className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">{pillar.title}</CardTitle>
                    <CardDescription className="text-base text-gray-600">
                      {pillar.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Connected Surfaces */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Ways to bring data in
          </h2>
          <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
            {connectedSurfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <Card key={surface.id} className="border-2 border-gray-200 shadow-lg h-full">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl text-gray-900">{surface.title}</CardTitle>
                        <CardDescription className="text-base text-indigo-600">
                          {surface.subtitle}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4 text-gray-600">
                      {surface.bullets.map((bullet) => (
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
            From capture to action in three steps
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
                Use the REST API for ingestion and search
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Plus-tier users can generate API keys and call the `/api/external` endpoints from their own tools. Create items, search with the same filters used in the dashboard, and pull full records when you need to sync downstream.
              </p>
              <ul className="space-y-3 text-gray-600">
                <li>✓ Upload JSON or multipart payloads and let enrichment run asynchronously.</li>
                <li>✓ Duplicate file hashes are skipped automatically with references to the original item.</li>
                <li>✓ Search responses include semantic scores, item metadata, and source details.</li>
              </ul>
            </div>
            <Card className="border-2 border-gray-200 shadow-xl bg-gray-950 text-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-mono text-gray-200">POST /api/external/items</CardTitle>
                <CardDescription className="text-sm text-gray-400">
                  Create an item with attachments using an external API key
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm leading-6 font-mono overflow-x-auto bg-gray-900 rounded-lg p-6 border border-gray-800">
{`curl -X POST https://api.injest.io/api/external/items \\
  -H "x-api-key: injest_sk_live_..." \\
  -F 'title=Launch checklist' \\
  -F 'tags=product,launch' \\
  -F 'attachments=@/path/to/brief.pdf;type=application/pdf'`}
                </pre>
                <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Response preview</p>
                  <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
{`{
  "queued": true,
  "uploadedCount": 1,
  "duplicateCount": 0,
  "message": "Queued 1 file(s) for enrichment. Processing may take a few minutes.",
  "files": [
    {
      "filename": "brief.pdf",
      "storedFilename": "3c8971f4-launch-checklist.pdf",
      "mimetype": "application/pdf",
      "size": 452381
    }
  ]
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Options */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Automation tools built in
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {actionOptions.map((option) => {
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

        {/* Team Plays */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Operations covered out of the box
          </h2>
          <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
            {teamPlays.map((play) => (
              <Card key={play.id} className="border-2 border-gray-200 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="text-2xl text-gray-900">{play.title}</CardTitle>
                  <CardDescription className="text-base text-blue-600">{play.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4 text-gray-600">
                    {play.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-blue-500 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-24">
          <h2 className="text-4xl font-bold text-center mb-6 text-gray-900">
            Pricing that scales with your library
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Start free, then raise the item cap as your archive grows. Every plan keeps OCR, enrichment, contacts, exports, and the dashboard included.
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
          <h2 className="text-4xl font-bold mb-4">Ready to keep every asset searchable and actionable?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Create an account to capture files, mail, and bookmarks in one place, then search, share, and send without switching tools.
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
