export interface SearchFilters {
  types?: string[];
  tags?: string[];
  uploadedBy?: 'me' | 'shared' | 'all';
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
  sources?: string[];
}
