import { marked } from 'marked';
import { convert } from 'html-to-text';
/**
 * Converts Markdown to email-compatible HTML with inline styles.
 * All styles are inline to ensure maximum email client compatibility.
 */
export function markdownToEmailHtml(markdown) {
    if (!markdown || !markdown.trim()) {
        return '<p></p>';
    }
    // Configure marked to use GitHub Flavored Markdown
    marked.setOptions({
        gfm: true,
        breaks: true,
    });
    // Convert markdown to HTML
    const html = marked.parse(markdown);
    // Process the HTML to add inline styles for email compatibility
    // We'll use a simple approach: wrap content and apply styles via regex replacements
    // For production, consider using a proper HTML parser like cheerio
    let styledHtml = html
        // Headers
        .replace(/<h1>/g, '<h1 style="font-size: 24px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; line-height: 1.4; color: #111827;">')
        .replace(/<h2>/g, '<h2 style="font-size: 20px; font-weight: bold; margin-top: 14px; margin-bottom: 6px; line-height: 1.4; color: #111827;">')
        .replace(/<h3>/g, '<h3 style="font-size: 18px; font-weight: bold; margin-top: 12px; margin-bottom: 6px; line-height: 1.4; color: #111827;">')
        .replace(/<h4>/g, '<h4 style="font-size: 16px; font-weight: bold; margin-top: 10px; margin-bottom: 6px; line-height: 1.4; color: #111827;">')
        .replace(/<h5>/g, '<h5 style="font-size: 14px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; line-height: 1.4; color: #111827;">')
        .replace(/<h6>/g, '<h6 style="font-size: 12px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; line-height: 1.4; color: #111827;">')
        // Paragraphs
        .replace(/<p>/g, '<p style="margin-top: 8px; margin-bottom: 8px; line-height: 1.6; color: #374151;">')
        // Lists
        .replace(/<ul>/g, '<ul style="margin-top: 8px; margin-bottom: 8px; padding-left: 24px; color: #374151;">')
        .replace(/<ol>/g, '<ol style="margin-top: 8px; margin-bottom: 8px; padding-left: 24px; color: #374151;">')
        .replace(/<li>/g, '<li style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;">')
        // Links
        .replace(/<a href="([^"]+)">/g, '<a href="$1" style="color: #2563eb; text-decoration: underline;">')
        // Code blocks
        .replace(/<pre>/g, '<pre style="background-color: #f3f4f6; padding: 12px; border-radius: 4px; overflow: auto; margin-top: 8px; margin-bottom: 8px; font-family: monospace; font-size: 0.9em; line-height: 1.5;">')
        .replace(/<code>/g, '<code style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">')
        // Blockquotes
        .replace(/<blockquote>/g, '<blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin-top: 8px; margin-bottom: 8px; color: #6b7280; font-style: italic;">')
        // Tables
        .replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%; margin-top: 8px; margin-bottom: 8px;">')
        .replace(/<th>/g, '<th style="border: 1px solid #e5e7eb; padding: 8px; background-color: #f9fafb; font-weight: bold; text-align: left;">')
        .replace(/<td>/g, '<td style="border: 1px solid #e5e7eb; padding: 8px;">')
        // Strong and emphasis
        .replace(/<strong>/g, '<strong style="font-weight: bold;">')
        .replace(/<em>/g, '<em style="font-style: italic;">')
        // Horizontal rules
        .replace(/<hr>/g, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">');
    return styledHtml;
}
/**
 * Converts HTML to plain text for email fallback.
 */
export function htmlToEmailText(html) {
    return convert(html, {
        wordwrap: 80,
        preserveNewlines: true,
    });
}
/**
 * Alias for htmlToEmailText for backward compatibility.
 */
export const htmlToPlainText = htmlToEmailText;
/**
 * Converts Markdown directly to plain text for email fallback.
 */
export function markdownToEmailText(markdown) {
    const html = markdownToEmailHtml(markdown);
    return htmlToEmailText(html);
}
//# sourceMappingURL=markdownToEmail.js.map