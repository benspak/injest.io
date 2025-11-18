/**
 * Converts Markdown to email-compatible HTML with inline styles.
 * All styles are inline to ensure maximum email client compatibility.
 */
export declare function markdownToEmailHtml(markdown: string): string;
/**
 * Converts HTML to plain text for email fallback.
 */
export declare function htmlToEmailText(html: string): string;
/**
 * Alias for htmlToEmailText for backward compatibility.
 */
export declare const htmlToPlainText: typeof htmlToEmailText;
/**
 * Converts Markdown directly to plain text for email fallback.
 */
export declare function markdownToEmailText(markdown: string): string;
//# sourceMappingURL=markdownToEmail.d.ts.map