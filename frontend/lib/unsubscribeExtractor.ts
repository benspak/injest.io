/**
 * Utility functions to extract unsubscribe links from email content
 */

export interface UnsubscribeLink {
  url: string;
  text: string;
  emailId: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string;
}

/**
 * Extracts unsubscribe links from HTML content
 */
function extractFromHtml(html: string): string[] {
  const links: string[] = [];

  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // Fallback to regex-based extraction for server-side or environments without DOMParser
    return extractFromHtmlRegex(html);
  }

  try {
    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find all anchor tags
    const anchors = doc.querySelectorAll('a[href]');

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      const text = anchor.textContent?.toLowerCase() || '';
      const hrefLower = href?.toLowerCase() || '';

      // Check if link text or href contains unsubscribe-related keywords
      if (
        href &&
        (text.includes('unsubscribe') ||
         text.includes('opt-out') ||
         text.includes('opt out') ||
         text.includes('remove me') ||
         text.includes('manage preferences') ||
         text.includes('email preferences') ||
         text.includes('update preferences') ||
         hrefLower.includes('unsubscribe') ||
         hrefLower.includes('opt-out') ||
         hrefLower.includes('optout') ||
         hrefLower.includes('remove') ||
         hrefLower.includes('preferences') ||
         hrefLower.includes('unsub'))
      ) {
        // Resolve relative URLs (basic handling)
        let fullUrl = href.trim();
        if (href.startsWith('/')) {
          // Relative URL - we can't resolve it without the original email domain
          // Just keep it as is, user will need to check the email
          fullUrl = href;
        } else if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
          // Relative URL without leading slash
          fullUrl = href;
        }

        if (fullUrl && !links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });
  } catch (error) {
    // If DOM parsing fails, fall back to regex
    console.warn('Failed to parse HTML with DOMParser, falling back to regex:', error);
    return extractFromHtmlRegex(html);
  }

  return links;
}

/**
 * Fallback regex-based extraction for HTML content
 */
function extractFromHtmlRegex(html: string): string[] {
  const links: string[] = [];

  // Regex to find anchor tags with href
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].toLowerCase();
    const hrefLower = href.toLowerCase();

    // Check if link text or href contains unsubscribe-related keywords
    if (
      href &&
      (text.includes('unsubscribe') ||
       text.includes('opt-out') ||
       text.includes('opt out') ||
       text.includes('remove me') ||
       text.includes('manage preferences') ||
       text.includes('email preferences') ||
       text.includes('update preferences') ||
       hrefLower.includes('unsubscribe') ||
       hrefLower.includes('opt-out') ||
       hrefLower.includes('optout') ||
       hrefLower.includes('remove') ||
       hrefLower.includes('preferences') ||
       hrefLower.includes('unsub'))
    ) {
      const fullUrl = href.trim();
      if (fullUrl && !links.includes(fullUrl)) {
        links.push(fullUrl);
      }
    }
  }

  return links;
}

/**
 * Extracts unsubscribe links from plain text content
 */
function extractFromText(text: string): string[] {
  const links: string[] = [];

  // Regex to find URLs (more comprehensive pattern)
  const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
  const matches = text.match(urlRegex) || [];

  matches.forEach((url) => {
    const urlLower = url.toLowerCase();
    const urlIndex = text.toLowerCase().indexOf(urlLower);
    const context = text.substring(
      Math.max(0, urlIndex - 100),
      Math.min(text.length, urlIndex + url.length + 100)
    ).toLowerCase();

    // Check if URL or surrounding context contains unsubscribe-related keywords
    if (
      urlLower.includes('unsubscribe') ||
      urlLower.includes('opt-out') ||
      urlLower.includes('optout') ||
      urlLower.includes('remove') ||
      urlLower.includes('preferences') ||
      urlLower.includes('unsub') ||
      context.includes('unsubscribe') ||
      context.includes('opt-out') ||
      context.includes('opt out') ||
      context.includes('remove me') ||
      context.includes('email preferences') ||
      context.includes('update preferences') ||
      context.includes('manage preferences')
    ) {
      // Normalize URL - remove trailing punctuation
      let normalizedUrl = url.trim().replace(/[.,;:!?]+$/, '');
      if (normalizedUrl.startsWith('www.')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      if (normalizedUrl && !links.includes(normalizedUrl)) {
        links.push(normalizedUrl);
      }
    }
  });

  return links;
}

/**
 * Extracts unsubscribe links from email item
 */
export function extractUnsubscribeLinks(item: {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  raw?: string;
  source?: string;
  created_at: string;
}): UnsubscribeLink[] {
  const links: UnsubscribeLink[] = [];

  // Only process email items
  if (item.type !== 'email') {
    return links;
  }

  // Try to get email content from various sources
  let htmlContent = '';
  let textContent = '';

  // Try to parse raw field for email data
  if (item.raw) {
    try {
      const rawData = JSON.parse(item.raw);
      htmlContent = rawData.html || '';
      textContent = rawData.text || rawData.body || '';
    } catch {
      // If raw parsing fails, continue
    }
  }

  // Fallback to description
  if (!htmlContent && !textContent) {
    textContent = item.description || '';
  }

  // Extract email metadata
  let emailFrom = '';
  if (item.source) {
    const sourceMatch = item.source.match(/email:(.+)/);
    if (sourceMatch) {
      emailFrom = sourceMatch[1];
    }
  }

  // Try to get from field from raw data
  if (!emailFrom && item.raw) {
    try {
      const rawData = JSON.parse(item.raw);
      emailFrom = rawData.from || '';
    } catch {
      // Ignore parse errors
    }
  }

  // Extract unsubscribe links from HTML
  if (htmlContent) {
    const htmlLinks = extractFromHtml(htmlContent);
    htmlLinks.forEach((url) => {
      links.push({
        url,
        text: 'Unsubscribe',
        emailId: item.id,
        emailSubject: item.title || 'No subject',
        emailFrom,
        emailDate: item.created_at,
      });
    });
  }

  // Extract unsubscribe links from text
  if (textContent) {
    const textLinks = extractFromText(textContent);
    textLinks.forEach((url) => {
      // Avoid duplicates
      if (!links.some((link) => link.url === url)) {
        links.push({
          url,
          text: 'Unsubscribe',
          emailId: item.id,
          emailSubject: item.title || 'No subject',
          emailFrom,
          emailDate: item.created_at,
        });
      }
    });
  }

  return links;
}
