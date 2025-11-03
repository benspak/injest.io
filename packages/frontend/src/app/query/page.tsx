'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function QueryPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<'sql' | 'nlq'>('sql');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleExecute = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await apiClient.post('/queries', {
        query,
        queryType,
      });

      if (response.data.success) {
        setResult(response.data.data.result);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const renderVisualization = () => {
    if (!result || !result.rows || result.rows.length === 0) return null;

    // Simple visualization for numeric data
    const hasNumericData = result.columns.some((col: string) => {
      const index = result.columns.indexOf(col);
      return result.rows.some((row: any[]) => typeof row[index] === 'number');
    });

    if (!hasNumericData) {
      // Show as table
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {result.columns.map((col: string) => (
                  <th key={col} className="text-left p-3 text-sm font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 100).map((row: any[], i: number) => (
                <tr key={i} className="border-b border-border hover:bg-card-hover">
                  {row.map((cell, j) => (
                    <td key={j} className="p-3 text-sm">
                      {cell === null || cell === undefined ? '—' : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Try to create chart
    const data = result.rows.slice(0, 50).map((row: any[], i: number) => {
      const obj: any = { index: i };
      result.columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    return (
      <div className="space-y-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey={result.columns[0]} stroke="#b3b3b3" />
            <YAxis stroke="#b3b3b3" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              labelStyle={{ color: '#ffffff' }}
            />
            <Legend />
            {result.columns.slice(1, 5).map((col: string) => {
              const index = result.columns.indexOf(col);
              if (result.rows.some((row: any[]) => typeof row[index] === 'number')) {
                return (
                  <Line
                    key={col}
                    type="monotone"
                    dataKey={col}
                    stroke="#1db954"
                    strokeWidth={2}
                  />
                );
              }
              return null;
            })}
          </LineChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {result.columns.map((col: string) => (
                  <th key={col} className="text-left p-3 text-sm font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 20).map((row: any[], i: number) => (
                <tr key={i} className="border-b border-border hover:bg-card-hover">
                  {row.map((cell, j) => (
                    <td key={j} className="p-3 text-sm">
                      {cell === null || cell === undefined ? '—' : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Query Builder</h1>
            <p className="text-secondary">Query your data sources with SQL or natural language</p>
          </div>
          <Link href="/dashboard" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>

        <div className="card mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setQueryType('sql')}
              className={`btn ${queryType === 'sql' ? 'btn-primary' : 'btn-secondary'}`}
            >
              SQL Query
            </button>
            <button
              onClick={() => setQueryType('nlq')}
              className={`btn ${queryType === 'nlq' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Natural Language
            </button>
          </div>

          <textarea
            className="input min-h-[150px] font-mono text-sm"
            placeholder={
              queryType === 'sql'
                ? 'SELECT * FROM table_name LIMIT 10'
                : 'Show me the sales trends from last month'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button
            onClick={handleExecute}
            className="btn btn-primary mt-4"
            disabled={loading || !query.trim()}
          >
            {loading ? 'Executing...' : 'Execute Query'}
          </button>
        </div>

        {error && (
          <div className="card mb-6 p-4 bg-destructive/20 border border-destructive text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="card">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold mb-1">Results</h2>
                <p className="text-secondary text-sm">
                  {result.rowCount} rows • {result.executionTime}ms
                </p>
              </div>
            </div>

            {renderVisualization()}
          </div>
        )}
      </div>
    </div>
  );
}
