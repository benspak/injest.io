'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api';

interface Connector {
  id: string;
  type: string;
  name: string;
  status: string;
  lastSyncAt?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadConnectors();
  }, [router]);

  const loadConnectors = async () => {
    try {
      const response = await apiClient.get('/connectors');
      if (response.data.success) {
        setConnectors(response.data.data || []);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/login');
      } else {
        setError(err.response?.data?.error || 'Failed to load connectors');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-primary';
      case 'syncing':
        return 'text-yellow-400';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-secondary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-secondary">Manage your data connections</p>
          </div>
          <div className="flex gap-4">
            <Link href="/query" className="btn btn-secondary">
              Query Builder
            </Link>
            <Link href="/connectors/new" className="btn btn-primary">
              Add Connector
            </Link>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/20 border border-destructive rounded-lg text-destructive">
            {error}
          </div>
        )}

        {connectors.length === 0 ? (
          <div className="card text-center">
            <h2 className="text-2xl font-semibold mb-4">No connectors yet</h2>
            <p className="text-secondary mb-6">
              Connect your first data source to get started
            </p>
            <Link href="/connectors/new" className="btn btn-primary inline-block">
              Add Your First Connector
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connectors.map((connector) => (
              <div key={connector.id} className="card hover:bg-card-hover transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{connector.name}</h3>
                    <p className="text-secondary text-sm">{connector.type}</p>
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(connector.status)}`}>
                    {connector.status}
                  </span>
                </div>

                {connector.lastSyncAt && (
                  <p className="text-secondary text-sm mb-4">
                    Last sync: {new Date(connector.lastSyncAt).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2">
                  <Link
                    href={`/connectors/${connector.id}`}
                    className="btn btn-secondary flex-1 text-center"
                  >
                    View
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        await apiClient.post(`/connectors/${connector.id}/sync`);
                        loadConnectors();
                      } catch (err) {
                        console.error('Sync failed', err);
                      }
                    }}
                    className="btn btn-primary flex-1"
                  >
                    Sync
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
