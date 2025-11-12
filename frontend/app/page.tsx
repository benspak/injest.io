import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Database,
  FileText,
  Image as ImageIcon,
  Inbox,
  Link2,
  Search,
  Send,
  Sparkles,
  Users,
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
      id: "search",
      icon: Search,
      title: "Search across every format",
      description:
        "Hybrid semantic + keyword search brings back slides, screenshots, contracts, and contacts in a single query—with context-aware highlights.",
    },
    {
      id: "send",
      icon: Send,
      title: "Send with one click",
      description:
        "Launch AI-assisted follow-ups, share packets, and trigger workflows directly from search results—no more copying links into other tools.",
    },
    {
      id: "structure",
      icon: Database,
      title: "Everything stays organized",
      description:
        "Automatic enrichment turns every upload or sync into structured entities, contacts, and tags so your workspace never decays.",
    },
  ];

  const connectedSurfaces = [
    {
      id: "assets",
      icon: ImageIcon,
      title: "Images, files & documents",
      subtitle: "Chrome, email, and drive ingestion",
      bullets: [
        "Clip tabs and screenshots, forward attachments, and drag in large archives without rate limits.",
        "OCR, transcription, and entity extraction run automatically so content is searchable minutes later.",
        "Version history and dedupe keep the best copy without losing source attribution.",
      ],
    },
    {
      id: "people",
      icon: Users,
      title: "Contacts & conversations",
      subtitle: "Inbox sync & living profiles",
      bullets: [
        "Auto-link emails, notes, and files to the right people for instant relationship context.",
        "Surface recent interactions inside search so you can reference the right thread every time.",
        "Two-way send tracking shows who received what, without breaking your email tools.",
      ],
    },
    {
      id: "links",
      icon: Link2,
      title: "Links, docs & internal knowledge",
      subtitle: "Bookmarks, wikis, and embeds",
      bullets: [
        "Centralize shared drives, Notion docs, Sheets, and product URLs alongside files and contact notes.",
        "Saved searches keep launch kits, onboarding packets, and campaign assets one search away.",
        "Embed results anywhere with instant share links powered by access controls.",
      ],
    },
  ];

  const workflowSteps = [
    {
      step: "1",
      title: "Connect your sources",
      description:
        "Forward inboxes, sync cloud storage, and import archives. Chrome, email, and API connectors take minutes to activate.",
    },
    {
      step: "2",
      title: "Everything gets structured automatically",
      description:
        "Injest extracts text, contacts, entities, and summaries—building embeddings so mixed media stays searchable forever.",
    },
    {
      step: "3",
      title: "Search & send in one motion",
      description:
        "Filter by people, teams, or intent, then launch AI-assisted outreach, exports, or automations with the right context attached.",
    },
  ];

  const actionOptions = [
    {
      id: "inbox",
      icon: Inbox,
      title: "Inbox-ready follow-ups",
      description:
        "Generate drafts, assemble attachments, and send from your existing email stack while tracking activity inside Injest.",
    },
    {
      id: "share",
      icon: Sparkles,
      title: "AI-assisted share packs",
      description:
        "Create ready-to-send briefs, project updates, or enablement kits directly from search results—with AI filling in the narrative.",
    },
    {
      id: "records",
      icon: FileText,
      title: "Structured exports",
      description:
        "Hand curated datasets to CRM, support, or analytics tools with a clean JSON or CSV export that preserves context.",
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
        "Unified dashboard & search",
        "Automatic OCR & enrichment",
      ],
    },
    plus: {
      badge: "Most popular",
      priceNote: "per month",
      features: [
        "Everything in Free",
        "API & webhook access",
        "Send plan templates",
        "CSV and JSON exports",
      ],
    },
    power: {
      priceNote: "per month",
      features: [
        "Everything in Plus",
        "Priority processing & support",
        "Advanced governance policies",
      ],
    },
    pro: {
      priceNote: "per month",
      features: [
        "Everything in Power",
        "Dedicated success architect",
        "Custom integrations",
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
      id: "revenue",
      title: "Revenue & success",
      subtitle: "Personalized follow-ups, instantly",
      bullets: [
        "Pull the latest decks, notes, and transcripts in one search before every call.",
        "Send AI-personalized recaps with attachments and next steps that stay tracked.",
        "Surface expansion signals by combining email sentiment with linked assets.",
      ],
    },
    {
      id: "ops",
      title: "Operations & enablement",
      subtitle: "Launch kits without digging through drives",
      bullets: [
        "Bundle policies, forms, and walkthroughs into share packs for any team.",
        "Keep onboarding and rollout libraries in sync with automated updates.",
        "Export structured datasets to BI tools with provenance intact.",
      ],
    },
    {
      id: "product",
      title: "Product & research",
      subtitle: "Research-ready archives that stay fresh",
      bullets: [
        "Search across interviews, support threads, and screenshots in seconds.",
        "Connect insights to the right personas and feature areas automatically.",
        "Share highlight reels and briefs with stakeholders straight from search.",
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
              Search once. Send everywhere.
            </p>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
              Search & send, images, contacts, files, documents, and links — all in one place.
            </h1>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl md:max-w-xl mx-auto md:mx-0">
              Injest pulls every screenshot, deck, email thread, and contact update into a single workspace. Search once, spin up the right packet, and send it without switching tools.
            </p>
            <p className="text-lg text-blue-600 font-semibold mb-8 max-w-2xl md:max-w-lg mx-auto md:mx-0">
              One command center for go-to-market, ops, and product teams that need answers—and the ability to act on them—right now.
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
            Everything you need to search, package, and send in one workspace
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
            All your sources stay linked, synced, and ready to ship
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
            From capture to send in three steps
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
                Trigger search & send flows from a single API call
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                No model training, no DevOps. Injest handles enrichment, storage, and recall so you can trigger follow-ups programmatically. Authenticate with your API key, send content, and receive structured metadata ready to search—or to ship downstream.
              </p>
              <ul className="space-y-3 text-gray-600">
                <li>✓ 99.9% uptime across ingestion, search, and send webhooks</li>
                <li>✓ Async jobs for large archives and automated outreach campaigns</li>
                <li>✓ SDKs, Postman collections, and Zapier connectors to launch quickly</li>
              </ul>
            </div>
            <Card className="border-2 border-gray-200 shadow-xl bg-gray-950 text-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-mono text-gray-200">POST /v1/items/ingest</CardTitle>
                <CardDescription className="text-sm text-gray-400">
                  Example request returning structured metadata & send-ready context
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-sm leading-6 font-mono overflow-x-auto bg-gray-900 rounded-lg p-6 border border-gray-800">
{`curl -X POST https://api.injest.io/v1/items/ingest \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cdn.example.com/assets/handbook.pdf",
    "send_plan": {
      "audience": ["contact_42", "contact_61"],
      "intent": "customer_update"
    }
  }'`}
                </pre>
                <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Response preview</p>
                  <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
{`{
  "id": "item_9sd1",
  "text": "Q3 Launch Update...",
  "labels": ["product", "customer-update"],
  "entities": [{"type": "contact", "value": "Jordan Patel"}],
  "summary": "Executive summary with next release milestones.",
  "vectors": "... truncated ...",
  "send_plan": {
    "status": "ready",
    "recommended_subject": "Q3 launch updates + action items",
    "attachments": ["item_9sd1"],
    "next_step_webhook": "https://hooks.zapier.com/.../search-to-send"
  }
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
            Search results that send themselves
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
            Turn every search into a packaged send for the teams that move your business
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
          <h2 className="text-4xl font-bold mb-4">Ready to search and send from one command center?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join teams who keep images, contacts, docs, and links searchable—and send-ready—without juggling apps.
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
