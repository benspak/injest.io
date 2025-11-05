import fs from 'fs';
import * as cheerio from 'cheerio';

export interface Bookmark {
  url: string;
  title: string;
  addDate?: number;
  folder?: string;
}

export class BookmarkParserService {
  /**
   * Parse a Netscape-style HTML bookmark file
   * Supports standard browser export format
   */
  async parseBookmarkFile(filePath: string): Promise<Bookmark[]> {
    const html = fs.readFileSync(filePath, 'utf-8');
    return this.parseBookmarkHTML(html);
  }

  /**
   * Parse bookmark HTML content
   */
  parseBookmarkHTML(html: string): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    const $ = cheerio.load(html);

    // Track current folder path as we traverse nested folders
    const folderStack: string[] = [];

    // Find all bookmark links - they can be in various formats
    // Standard: <DT><A HREF="url" ADD_DATE="timestamp">Title</A></DT>
    // Chrome: <DT><A HREF="url" ADD_DATE="timestamp" ICON="...">Title</A></DT>
    $('DT > A').each((index, element) => {
      const $link = $(element);
      const href = $link.attr('HREF') || $link.attr('href');
      const title = $link.text().trim();
      const addDate = $link.attr('ADD_DATE') || $link.attr('add_date');
      const icon = $link.attr('ICON') || $link.attr('icon');

      // Skip if no URL
      if (!href) {
        return;
      }

      // Validate URL format
      try {
        new URL(href);
      } catch {
        // Invalid URL, skip
        return;
      }

      // Determine folder path from parent structure
      let folderPath: string | undefined;
      const $parent = $link.parent().parent(); // Go up from A to DT to DL
      if ($parent.is('DL')) {
        const $folderHeader = $parent.prev('H3');
        if ($folderHeader.length > 0) {
          const folderName = $folderHeader.text().trim();
          folderPath = folderName;
        }
      }

      bookmarks.push({
        url: href,
        title: title || href, // Use URL as title if title is empty
        addDate: addDate ? parseInt(addDate, 10) : undefined,
        folder: folderPath,
      });
    });

    // Alternative parsing: handle nested structure more accurately
    // Some browsers export with nested DL/DH3/DT structures
    this.parseNestedBookmarks($, bookmarks);

    // Remove duplicates (same URL)
    const uniqueBookmarks = this.removeDuplicates(bookmarks);

    return uniqueBookmarks;
  }

  /**
   * Parse nested bookmark structure (folders with subfolders)
   */
  private parseNestedBookmarks($: cheerio.CheerioAPI, bookmarks: Bookmark[]): void {
    const processDL = ($dl: cheerio.Cheerio<cheerio.Element>, folderPath: string[] = []) => {
      $dl.children().each((index, child) => {
        const $child = $(child);

        // If it's a folder header (H3)
        if ($child.is('H3')) {
          const folderName = $child.text().trim();
          const nextDL = $child.next('DL');
          if (nextDL.length > 0) {
            processDL(nextDL, [...folderPath, folderName]);
          }
        }

        // If it's a bookmark (DT > A)
        if ($child.is('DT')) {
          const $link = $child.find('A').first();
          const href = $link.attr('HREF') || $link.attr('href');
          const title = $link.text().trim();
          const addDate = $link.attr('ADD_DATE') || $link.attr('add_date');

          if (href) {
            try {
              new URL(href);
              // Check if bookmark already exists
              const exists = bookmarks.some(b => b.url === href);
              if (!exists) {
                bookmarks.push({
                  url: href,
                  title: title || href,
                  addDate: addDate ? parseInt(addDate, 10) : undefined,
                  folder: folderPath.length > 0 ? folderPath.join(' / ') : undefined,
                });
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      });
    };

    // Start from root DL elements
    $('DL').each((index, element) => {
      const $dl = $(element);
      // Check if this is a root DL (not nested)
      const isRoot = $dl.parent().is('body') || $dl.parent().is('html') || !$dl.parent().is('DL');
      if (isRoot) {
        processDL($dl);
      }
    });
  }

  /**
   * Remove duplicate bookmarks by URL
   */
  private removeDuplicates(bookmarks: Bookmark[]): Bookmark[] {
    const seen = new Set<string>();
    const unique: Bookmark[] = [];

    for (const bookmark of bookmarks) {
      if (!seen.has(bookmark.url)) {
        seen.add(bookmark.url);
        unique.push(bookmark);
      }
    }

    return unique;
  }
}

export const bookmarkParserService = new BookmarkParserService();
