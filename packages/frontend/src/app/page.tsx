'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-16">
          <div>
            <h1 className="text-5xl font-bold mb-4">Brain</h1>
            <p className="text-secondary text-xl mb-8">
              AI-powered data aggregation platform
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="btn btn-secondary">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="card hover:bg-card-hover transition-colors">
            <h2 className="text-xl font-semibold mb-2">Connect</h2>
            <p className="text-secondary">
              Connect to multiple data sources in one place - databases, APIs, analytics platforms, and more.
            </p>
          </div>

          <div className="card hover:bg-card-hover transition-colors">
            <h2 className="text-xl font-semibold mb-2">Analyze</h2>
            <p className="text-secondary">
              AI-powered insights and natural language queries. Ask questions in plain English.
            </p>
          </div>

          <div className="card hover:bg-card-hover transition-colors">
            <h2 className="text-xl font-semibold mb-2">Visualize</h2>
            <p className="text-secondary">
              Beautiful dashboards and data visualizations. Export and share insights.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-semibold mb-4">Supported Connectors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-card-hover rounded-lg">
              <div className="font-semibold mb-1">PostgreSQL</div>
              <div className="text-secondary text-sm">Database</div>
            </div>
            <div className="text-center p-4 bg-card-hover rounded-lg">
              <div className="font-semibold mb-1">MySQL</div>
              <div className="text-secondary text-sm">Database</div>
            </div>
            <div className="text-center p-4 bg-card-hover rounded-lg">
              <div className="font-semibold mb-1">Google Analytics</div>
              <div className="text-secondary text-sm">Analytics</div>
            </div>
            <div className="text-center p-4 bg-card-hover rounded-lg">
              <div className="font-semibold mb-1">REST API</div>
              <div className="text-secondary text-sm">Generic API</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
