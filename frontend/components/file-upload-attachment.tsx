'use client';

import { useCallback, useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, File, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export interface UploadedAttachment {
  itemId: string;
  attachmentFilename: string;
  displayName: string;
  mimetype?: string;
  size?: number;
  previewUrl?: string; // For images, local object URL
}

interface FileUploadAttachmentProps {
  value: UploadedAttachment[];
  onChange: (attachments: UploadedAttachment[]) => void;
  label?: string;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function FileUploadAttachment({
  value,
  onChange,
  label = 'Attachments',
  disabled = false,
}: FileUploadAttachmentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPreviewUrl = useCallback((file: File): string | undefined => {
    if (isImageFile(file)) {
      return URL.createObjectURL(file);
    }
    return undefined;
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || disabled || uploading) return;

      setUploading(true);

      try {
        const newAttachments: UploadedAttachment[] = [];

        // Upload each file as a separate item
        for (const file of files) {
          const formData = new FormData();
          formData.append('title', file.name);
          formData.append('attachments', file);

          const response = await apiClient.createItem(formData);

          // Handle both immediate response and queued response
          if ('id' in response && response.id) {
            // Immediate response with item ID
            if (response.attachments && response.attachments.length > 0) {
              const attachment = response.attachments[0];
              const previewUrl = createPreviewUrl(file);

              newAttachments.push({
                itemId: response.id,
                attachmentFilename: attachment.filename,
                displayName: file.name,
                mimetype: file.type,
                size: file.size,
                previewUrl,
              });
            } else {
              // Item created but no attachments yet (shouldn't happen, but handle gracefully)
              toast.warning(`File "${file.name}" was uploaded but no attachment found.`);
            }
          } else if ('queued' in response && response.queued && response.files && response.files.length > 0) {
            // Queued response - files are being processed
            // We can't attach these yet as the item doesn't exist
            // But we can show a message
            const uploadedFile = response.files.find((f) => f.filename === file.name);
            if (uploadedFile) {
              toast.info(
                `File "${file.name}" is being processed. Please wait for processing to complete before attaching.`
              );
            }
          } else {
            toast.warning(`File "${file.name}" upload response was unexpected.`);
          }
        }

        if (newAttachments.length > 0) {
          onChange([...value, ...newAttachments]);
          toast.success(`Uploaded ${newAttachments.length} file(s)`);
        }
      } catch (error) {
        console.error('Failed to upload files:', error);
        toast.error('Failed to upload files. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [value, onChange, disabled, uploading, createPreviewUrl]
  );

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadFiles(files);
      }
    },
    [disabled, uploadFiles]
  );

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        uploadFiles(files);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadFiles]
  );

  const removeAttachment = useCallback(
    (index: number) => {
      const attachment = value[index];
      // Clean up preview URL if it exists
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {/* Drag and drop area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-md p-6 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className={`h-8 w-8 mb-2 ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
          <p className="text-sm text-gray-600 mb-1">
            {isDragging ? 'Drop files here' : 'Drag and drop files here, or click to select'}
          </p>
          <p className="text-xs text-gray-500">Files will be saved to your knowledge base</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? 'Uploading...' : 'Select Files'}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          className="hidden"
        />
      </div>

      {/* Uploaded files list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((attachment, index) => {
            const isImage = attachment.mimetype?.startsWith('image/');
            return (
              <div
                key={`${attachment.itemId}-${attachment.attachmentFilename}-${index}`}
                className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3"
              >
                {isImage && attachment.previewUrl ? (
                  <div className="w-16 h-16 rounded border border-gray-200 overflow-hidden shrink-0">
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded border border-gray-200 flex items-center justify-center shrink-0 bg-gray-50">
                    {isImage ? (
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    ) : (
                      <File className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{attachment.displayName}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    {attachment.mimetype && <span>{attachment.mimetype.split('/')[1]}</span>}
                    {attachment.size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(attachment.size)}</span>
                      </>
                    )}
                  </div>
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
