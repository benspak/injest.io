'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Collection } from '@/lib/api';

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { title: string; description?: string; color?: string; icon?: string }) => Promise<void>;
  collection?: Collection | null;
}

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

const PRESET_ICONS = [
  '📁', '📂', '🗂️', '📋', '📝', '📄', '📑', '📊',
  '📈', '📉', '💼', '🎯', '⭐', '🔥', '💡', '🚀',
];

export function CollectionDialog({ open, onOpenChange, onSave, collection }: CollectionDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('📁');
  const [customColor, setCustomColor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (collection) {
        setTitle(collection.title || '');
        setDescription(collection.description || '');
        setColor(collection.color || '#6366f1');
        setIcon(collection.icon || '📁');
        setCustomColor('');
      } else {
        setTitle('');
        setDescription('');
        setColor('#6366f1');
        setIcon('📁');
        setCustomColor('');
      }
    }
  }, [open, collection]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const finalColor = customColor.trim() || color;
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        color: finalColor || undefined,
        icon: icon || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving collection:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSaving) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{collection ? 'Edit Collection' : 'Create Collection'}</DialogTitle>
            <DialogDescription>
              {collection
                ? 'Update your collection details'
                : 'Create a new collection to organize your items'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection-title">Title *</Label>
              <Input
                id="collection-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Collection"
                required
                disabled={isSaving}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection-description">Description</Label>
              <Textarea
                id="collection-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                disabled={isSaving}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => {
                        setColor(presetColor);
                        setCustomColor('');
                      }}
                      className={`w-8 h-8 rounded-md border-2 transition-all ${
                        color === presetColor && !customColor
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: presetColor }}
                      disabled={isSaving}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={customColor || color}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setColor(e.target.value);
                    }}
                    className="w-16 h-8 p-1 cursor-pointer"
                    disabled={isSaving}
                  />
                  <Input
                    type="text"
                    value={customColor || color}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(value) || value === '') {
                        setCustomColor(value);
                        if (value) {
                          setColor(value);
                        }
                      }
                    }}
                    placeholder="#6366f1"
                    className="flex-1"
                    disabled={isSaving}
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_ICONS.map((presetIcon) => (
                  <button
                    key={presetIcon}
                    type="button"
                    onClick={() => setIcon(presetIcon)}
                    className={`w-10 h-10 rounded-md border-2 text-xl flex items-center justify-center transition-all ${
                      icon === presetIcon
                        ? 'border-gray-900 bg-gray-100 scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    disabled={isSaving}
                  >
                    {presetIcon}
                  </button>
                ))}
              </div>
              <Input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📁"
                className="mt-2"
                disabled={isSaving}
                maxLength={10}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving ? 'Saving...' : collection ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
