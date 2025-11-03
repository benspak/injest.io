'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api';

const CONNECTOR_TYPES = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'rest_api', label: 'REST API' },
  { value: 'google_analytics', label: 'Google Analytics' },
];

export default function NewConnectorPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    type: 'postgresql',
    name: '',
    config: {} as Record<string, any>,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getConfigFields = () => {
    switch (formData.type) {
      case 'postgresql':
      case 'mysql':
        return [
          { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
          { key: 'port', label: 'Port', type: 'number', placeholder: '5432' },
          { key: 'database', label: 'Database', type: 'text' },
          { key: 'user', label: 'Username', type: 'text' },
          { key: 'password', label: 'Password', type: 'password' },
          { key: 'schema', label: 'Schema (optional)', type: 'text', placeholder: 'public' },
        ];
      case 'rest_api':
        return [
          { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com' },
          { key: 'apiKey', label: 'API Key', type: 'password' },
          { key: 'headers', label: 'Additional Headers (JSON)', type: 'textarea', placeholder: '{"X-Custom-Header": "value"}' },
        ];
      case 'google_analytics':
        return [
          { key: 'propertyId', label: 'Property ID', type: 'text', placeholder: '123456789' },
          { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'OAuth access token' },
        ];
      default:
        return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Parse JSON fields
      const config = { ...formData.config };
      if (formData.type === 'rest_api' && config.headers && typeof config.headers === 'string') {
        try {
          config.headers = JSON.parse(config.headers);
        } catch {
          config.headers = {};
        }
      }

      const response = await apiClient.post('/connectors', {
        type: formData.type,
        name: formData.name,
        config,
      });

      if (response.data.success) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create connector');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="text-primary hover:text-primary-hover mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold mb-2">Add New Connector</h1>
          <p className="text-secondary">Connect a new data source</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-destructive/20 border border-destructive rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="type" className="block text-sm font-medium mb-2">
                Connector Type
              </label>
              <select
                id="type"
                className="input"
                value={formData.type}
                onChange={(e) => {
                  setFormData({ ...formData, type: e.target.value, config: {} });
                }}
                required
              >
                {CONNECTOR_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Connector Name
              </label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Production Database"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Connection Settings</h3>
              <div className="space-y-4">
                {getConfigFields().map((field) => (
                  <div key={field.key}>
                    <label htmlFor={field.key} className="block text-sm font-medium mb-2">
                      {field.label}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.key}
                        className="input min-h-[100px] font-mono text-sm"
                        placeholder={field.placeholder}
                        value={formData.config[field.key] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            config: { ...formData.config, [field.key]: e.target.value },
                          })
                        }
                      />
                    ) : (
                      <input
                        id={field.key}
                        type={field.type}
                        className="input"
                        placeholder={field.placeholder}
                        value={formData.config[field.key] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            config: {
                              ...formData.config,
                              [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                            },
                          })
                        }
                        required={field.key !== 'schema' && field.key !== 'headers'}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Link href="/dashboard" className="btn btn-secondary flex-1">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Connector'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
