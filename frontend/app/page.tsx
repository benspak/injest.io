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
        "Collections & organization",
        "API keys",
        "Public profiles & sharing",
        "Slack integration",
        "Chrome extension",
      ],
    },
    {
      tier: 'pro' as const,
      name: "Pro",
      priceDisplay: "$30",
      priceNote: "/mo",
      limit: "Unlimited items",
      description: "Unlimited indexed items with priority ingestion and support.",
      features: [
        "Everything in Free",
        "Unlimited storage & automation",
        "Priority tagging",
        "Priority support",
      ],
    },
    {
      tier: 'pro_annual' as const,
      name: "Pro Annual",
      priceDisplay: "$288",
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

  const interfaceScreens = [
    {
      src: "/inbox-screenshot.png",
      title: "Your inbox",
      description: "View all your stored emails and files in one place.",
    },
    {
      src: "/contacts-screenshot.png",
      title: "Contacts",
      description: "Organize your emails and files by contact.",
    },
    {
      src: "/imports-screenshot.png",
      title: "Upload files",
      description: "Upload files directly or import from other sources.",
    },
    {
      src: "/send-screenshot.png",
      title: "Send emails",
      description: "Send emails with attachments from your stored files.",
    },
    {
      src: "/email-summary-screenshot.png",
      title: "Email summaries",
      description: "View summaries of your stored email conversations.",
    },
    {
      src: "/item-detail-screenshot.png",
      title: "File details",
      description: "View details and extracted text from your stored files.",
    },
    {
      src: "/collections-screenshot.png",
      title: "Organize with collections",
      description: "Group related emails and files into collections.",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 overflow-x-hidden">
      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
              Beta
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Simple email and file storage
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-10 leading-relaxed">
              Store your emails and files in one place. Forward emails to your personal{' '}
              <span className="font-mono">username@injest.io</span> address or upload files directly. Everything is searchable and organized.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/login">Get Started</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-[40px] bg-linear-to-r from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70" />
            <div className="relative rounded-[32px] border border-white/60 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
              <Image
                src="/dashboard-screenshot.png"
                alt="Injest dashboard with unified workspace overview"
                width={1600}
                height={1030}
                className="w-full h-auto object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Screens Section */}
      <section className="container mx-auto px-4 sm:px-6 pb-10 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mt-3 mb-4">
            See how it works
          </h2>
          <p className="text-lg text-gray-600">
            Store and organize your emails and files in one simple place.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          {interfaceScreens.map((screen) => (
            <div
              key={screen.src}
              className="group relative rounded-[28px] border border-gray-100 bg-white shadow-lg shadow-blue-100/40 overflow-hidden"
            >
              <div className="relative bg-slate-900/5">
                <Image
                  src={screen.src}
                  alt={screen.title}
                  width={1600}
                  height={1000}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width: 1024px) 100vw, 48vw"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-white to-transparent pointer-events-none" />
              </div>
              <div className="p-8 space-y-3">
                <h3 className="text-2xl font-semibold text-gray-900">{screen.title}</h3>
                <p className="text-gray-600 text-lg">{screen.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Simple Features Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 text-center">
            Simple and organized
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-12 text-center leading-relaxed">
            Store your emails and files, then find them quickly with search.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Search everything</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Find your emails and files quickly with powerful search.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Text extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Text is automatically extracted from images and PDFs, making everything searchable.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Stay organized</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Keep your emails and files organized and easy to find.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
              How it works
            </h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Store your emails and files
                  </h3>
                  <p className="text-gray-600">
                    Forward emails to your personal inbox address or upload files directly.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Everything is searchable
                  </h3>
                  <p className="text-gray-600">
                    Text is extracted automatically, so you can search through all your content.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Find what you need
                  </h3>
                  <p className="text-gray-600">
                    Search and find your emails and files instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Storage Methods Section */}
      <section className="container mx-auto px-4 sm:px-6 py-20 max-w-7xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-12 text-center">
            Store emails and files
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Forwarded Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Forward emails to your personal Injest address (for example,{' '}
                  <span className="font-mono">username@injest.io</span>). Attachments and conversations are preserved and made searchable.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>File Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Upload files directly. Text is extracted automatically, making everything searchable.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Slack Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Connect your Slack workspace to save messages, files, and conversations directly to your inbox. Everything from Slack becomes searchable in Injest.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Chrome Extension</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Capture links, files, and screenshots straight from your browser with our Chrome extension. Quickly save content without leaving the page you're on.
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
              Pricing
            </h2>
            <HomepagePricingPlans plans={pricingPlans} />
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
                <div className="relative rounded-3xl bg-linear-to-br from-blue-600 via-indigo-500 to-purple-500 p-1 shadow-xl">
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
      <section className="bg-linear-to-r from-blue-600 to-indigo-600 py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Get started today
            </h2>
            <p className="text-xl mb-10 text-blue-100">
              Start storing your emails and files in one simple, searchable place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Link href="/login">Get Started</Link>
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
          </div>
        </div>
      </footer>
    </div>
  );
}
