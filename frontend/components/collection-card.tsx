'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Collection } from '@/lib/api';

interface CollectionCardProps {
  collection: Collection;
  onDelete?: (id: string) => void;
}

export function CollectionCard({ collection, onDelete }: CollectionCardProps) {
  const collectionColor = collection.color || '#6366f1';
  const collectionIcon = collection.icon || '📁';
  const itemCount = collection.item_count ?? 0;

  return (
    <Link href={`/collections/${collection.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-semibold flex-shrink-0"
              style={{ backgroundColor: collectionColor }}
            >
              {collectionIcon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate mb-1">
                {collection.title}
              </h3>
              {collection.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {collection.description}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
