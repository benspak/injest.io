'use client';

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HomepagePricingPlans } from "@/components/homepage-pricing-plans";
import { CountdownTimer } from "@/components/countdown-timer";
import { getAnnualPlanDiscount, SALE_END_DATE, shouldShowSaleBanner } from "@/lib/saleConfig";

export default function Home() {
  const showBanner = useMemo(() => shouldShowSaleBanner(), []);
  const discount = useMemo(() => getAnnualPlanDiscount(), []);
  const annualPrice = "$72"; // Always 80% off: $30 * 12 * 0.2 = $72

  const pricingPlans = useMemo(() => [
    {
      tier: 'free' as const,
      name: "Free",
      priceDisplay: "$0",
      priceNote: "",
      limit: "Up to 25GB of space, free",
      description: "Get started with up to 25GB of space and pro-grade capture features.",
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
      priceDisplay: annualPrice,
      priceNote: `/year (${discount}% off)`,
      limit: "Unlimited items",
      description: `Cyber Week Sale: ${discount}% off annual billing with dedicated onboarding.`,
      features: [
        "Everything in Pro",
        "Dedicated onboarding support",
        `${discount}% discount (Cyber Week Sale)`,
      ],
      badge: "Cyber Week Sale",
    },
  ], [discount, annualPrice]);

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
            <div className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-6">
              Beta Release
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Your data, your control, your privacy
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-6 leading-relaxed">
              Store your emails and files securely with end-to-end encryption. Forward emails to your personal{' '}
              <span className="font-mono">username@injest.io</span> address or upload files directly. Your data is encrypted, never sold, and always yours.
            </p>
            <div className="flex flex-wrap gap-3 mb-6 justify-center lg:justify-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                <span>🔐</span> Encrypted Storage
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                <span>🛡️</span> No Data Selling
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                <span>🔒</span> You Own Your Data
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/login">Get Started Securely</Link>
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

      {/* Privacy & Security Section - Prominent */}
      <section className="bg-linear-to-br from-green-50 via-blue-50 to-indigo-50 py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-6">
              Privacy & Security First
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Your privacy is not negotiable
            </h2>
            <p className="text-xl text-gray-600 mb-12 leading-relaxed">
              We built Injest with privacy and security at its core. Your data is encrypted, never sold, and you have complete control over your information.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-green-200 bg-white/80">
              <CardHeader>
                <div className="text-4xl mb-4">🔐</div>
                <CardTitle>End-to-End Encryption</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Your data is encrypted in transit and at rest. We use industry-standard encryption to protect your emails, files, and personal information.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-white/80">
              <CardHeader>
                <div className="text-4xl mb-4">🚫</div>
                <CardTitle>We Never Sell Your Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Your personal information is never sold to third parties. We don't use your data for advertising or share it with marketers. Period.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-white/80">
              <CardHeader>
                <div className="text-4xl mb-4">👤</div>
                <CardTitle>You Own Your Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Export your data anytime. Delete your account and all associated data whenever you want. Complete control is in your hands.
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-blue-200 bg-white/80">
              <CardHeader>
                <div className="text-4xl mb-4">🛡️</div>
                <CardTitle>Continuous Security Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Our codebase is continuously scanned using Snyk and Red Hat Dependency Analysis. Automated security audits run every 30 days to identify and fix vulnerabilities before they become threats.
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-white/80">
              <CardHeader>
                <div className="text-4xl mb-4">🔍</div>
                <CardTitle>Transparent Privacy Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  We're transparent about how we handle your data. Read our{' '}
                  <Link href="/privacy" className="text-blue-600 hover:underline font-semibold">
                    Privacy Policy
                  </Link>{' '}
                  to understand exactly what we collect and how we protect it.
                </p>
              </CardContent>
            </Card>
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
            Store and organize your emails and files securely in one private, encrypted place.
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
            Powerful features, private by design
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-12 text-center leading-relaxed">
            Store your emails and files securely, then find them quickly with privacy-preserving search. All processing happens securely on encrypted data.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>Private search</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Find your emails and files quickly with powerful search. Your search queries and content remain private and encrypted.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>Secure text extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Text is automatically extracted from images and PDFs securely, making everything searchable while maintaining your privacy.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>Private organization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Keep your emails and files organized and easy to find. Your organizational structure stays private to you.
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
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 text-center">
              How it works
            </h2>
            <p className="text-lg text-gray-600 mb-12 text-center leading-relaxed">
              Secure, private, and simple. Your data is protected every step of the way.
            </p>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Store securely with encryption
                  </h3>
                  <p className="text-gray-600">
                    Forward emails to your personal inbox address or upload files directly. Everything is encrypted immediately upon receipt.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Private processing and indexing
                  </h3>
                  <p className="text-gray-600">
                    Text is extracted automatically in a secure environment. Your content is processed privately and never used to train public AI models.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Search privately and securely
                  </h3>
                  <p className="text-gray-600">
                    Search and find your emails and files instantly. Your search queries and results remain private and encrypted.
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
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 text-center">
            Secure storage methods
          </h2>
          <p className="text-lg text-gray-600 mb-12 text-center leading-relaxed">
            Multiple ways to securely store your content. All methods use encrypted connections and encrypted storage.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>🔒 Secure Email Forwarding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Forward emails to your personal Injest address (for example,{' '}
                  <span className="font-mono">username@injest.io</span>). Attachments and conversations are encrypted, preserved, and made searchable privately.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>🔒 Encrypted File Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Upload files directly through encrypted connections. Text is extracted automatically in a secure environment, making everything searchable while maintaining privacy.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>🔒 Private Slack Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Connect your Slack workspace securely to save messages, files, and conversations directly to your encrypted inbox. Everything from Slack becomes searchable privately in Injest.
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-100">
              <CardHeader>
                <CardTitle>🔒 Secure Chrome Extension</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Capture links, files, and screenshots straight from your browser with our Chrome extension. All content is transmitted securely and stored encrypted.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-linear-to-br from-gray-50 via-blue-50 to-indigo-50 py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
                Enterprise-Grade Security
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Security you can trust
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed">
                We take security seriously. Your data is protected with multiple layers of security, continuous monitoring, and automated threat detection.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="border-blue-200 bg-white">
                <CardHeader>
                  <div className="text-3xl mb-3">🔍</div>
                  <CardTitle>Continuous Code Scanning</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    We use <strong>Snyk</strong> and <strong>Red Hat Dependency Analysis</strong> to continuously scan our codebase for vulnerabilities and security issues. Threats are identified and patched before they can affect you.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-white">
                <CardHeader>
                  <div className="text-3xl mb-3">🤖</div>
                  <CardTitle>Automated Security Audits</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Our agentic security audit and patching process runs automatically every 30 days to identify and remediate security vulnerabilities. Your data stays protected around the clock.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-white">
                <CardHeader>
                  <div className="text-3xl mb-3">🔐</div>
                  <CardTitle>Encryption Everywhere</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    All data is encrypted in transit using TLS and encrypted at rest. We use industry-standard encryption protocols to ensure your information remains secure.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-white">
                <CardHeader>
                  <div className="text-3xl mb-3">🚫</div>
                  <CardTitle>No Third-Party Data Sharing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    We don't sell your data. We don't share it with advertisers. We only use service providers essential to delivering our service, and they're bound by strict data protection agreements.
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="text-center mt-8">
              <p className="text-gray-600 mb-4">
                Want to know more about how we protect your privacy?
              </p>
              <Button asChild variant="outline" size="lg">
                <Link href="/privacy">Read Our Privacy Policy</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-6xl mx-auto">
            {/* Sales Banner */}
            {showBanner && (
              <div className="mb-8 rounded-2xl bg-linear-to-r from-red-500 via-orange-500 to-yellow-500 p-1 shadow-xl">
                <div className="rounded-xl bg-white p-6 text-center">
                  <div className="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-bold mb-3">
                    🎉 CYBER WEEK SALE
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    {discount}% Off Annual Plan
                  </h3>
                  <p className="text-lg text-gray-600 mb-1">
                    Get Pro Annual for just <span className="font-bold text-red-600">{annualPrice}/year</span> (normally $360/year)
                  </p>
                  <p className="text-sm text-gray-500 font-semibold mb-2">
                    ⏰ Offer expires December 2nd at 12:00 AM MST
                  </p>
                  <CountdownTimer targetDate={SALE_END_DATE} />
                </div>
              </div>
            )}
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
      <section className="bg-linear-to-r from-green-600 via-blue-600 to-indigo-600 py-20">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="max-w-3xl mx-auto text-center text-white">
            <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold mb-6">
              🔒 Privacy-First Storage
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Start storing securely today
            </h2>
            <p className="text-xl mb-6 text-blue-100">
              Join users who trust Injest to keep their data private, secure, and under their control.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-medium">
                <span>🔐</span> Encrypted
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-medium">
                <span>🛡️</span> Private
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-medium">
                <span>✅</span> Yours
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Link href="/login">Get Started Securely</Link>
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
            <Link href="/bug-bounty" className="hover:text-blue-600 transition-colors">
              Bug Bounty
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
