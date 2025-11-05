import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Injest.io
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your AI-powered knowledge recall system
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">Dashboard</Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Email Capture</CardTitle>
              <CardDescription>
                Send emails to input@injest.io to automatically capture content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Forward emails with attachments, links, and notes. Everything is automatically indexed and searchable.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Search</CardTitle>
              <CardDescription>
                Find exactly what you need with semantic search
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Search through your knowledge base using natural language. Our AI understands context and meaning.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Organization</CardTitle>
              <CardDescription>
                Automatic tagging, categorization, and summarization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Content is automatically tagged, categorized, and summarized to help you find what matters.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <div className="max-w-3xl mx-auto space-y-4 text-left">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold">Connect Your Email</h3>
                <p className="text-gray-600">Verify your email address to get started</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold">Send to Input</h3>
                <p className="text-gray-600">Forward emails to input@injest.io from your verified address</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold">Search & Discover</h3>
                <p className="text-gray-600">Use natural language to search through all your captured content</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
