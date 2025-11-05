export interface Bookmark {
    url: string;
    title: string;
    addDate?: number;
    folder?: string;
}
export declare class BookmarkParserService {
    /**
     * Parse a Netscape-style HTML bookmark file
     * Supports standard browser export format
     */
    parseBookmarkFile(filePath: string): Promise<Bookmark[]>;
    /**
     * Parse bookmark HTML content
     */
    parseBookmarkHTML(html: string): Bookmark[];
    /**
     * Parse nested bookmark structure (folders with subfolders)
     */
    private parseNestedBookmarks;
    /**
     * Remove duplicate bookmarks by URL
     */
    private removeDuplicates;
}
export declare const bookmarkParserService: BookmarkParserService;
//# sourceMappingURL=bookmarkParser.d.ts.map