import * as cheerio from 'cheerio';

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export class LinkMetadataService {
  async fetchMetadata(url: string, retries = 3, timeout = 10000): Promise<LinkMetadata> {
    // Ensure URL has protocol
    let fetchUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fetchUrl = `https://${url}`;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.google.com/',
          },
          redirect: 'follow',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // 403 errors are typically permanent (blocked by site) - don't retry
          if (response.status === 403) {
            throw new Error(`HTTP 403 Forbidden - site blocked request`);
          }
          // 404 errors are also permanent - don't retry
          if (response.status === 404) {
            throw new Error(`HTTP 404 Not Found`);
          }
          // 429 errors are rate limiting - retry with longer backoff
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null;
            throw new Error(`HTTP 429 Too Many Requests${retryAfterSeconds ? ` - retry after ${retryAfterSeconds}s` : ''}`);
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const finalUrl = response.url || fetchUrl;

      // Extract metadata with priority: Open Graph > Twitter Cards > Standard meta tags
      const metadata: LinkMetadata = {
        url: finalUrl,
      };

      // Try Open Graph first
      metadata.title = $('meta[property="og:title"]').attr('content') ||
                       $('meta[name="og:title"]').attr('content');

      metadata.description = $('meta[property="og:description"]').attr('content') ||
                            $('meta[name="og:description"]').attr('content');

      metadata.image = $('meta[property="og:image"]').attr('content') ||
                      $('meta[name="og:image"]').attr('content');

      // Fallback to Twitter Cards
      if (!metadata.title) {
        metadata.title = $('meta[name="twitter:title"]').attr('content');
      }
      if (!metadata.description) {
        metadata.description = $('meta[name="twitter:description"]').attr('content');
      }
      if (!metadata.image) {
        metadata.image = $('meta[name="twitter:image"]').attr('content') ||
                        $('meta[name="twitter:image:src"]').attr('content');
      }

      // Fallback to standard meta tags
      if (!metadata.title) {
        metadata.title = $('title').text() || $('meta[name="title"]').attr('content');
      }
      if (!metadata.description) {
        metadata.description = $('meta[name="description"]').attr('content');
      }

      // Make image URL absolute if it's relative
      if (metadata.image && !metadata.image.startsWith('http')) {
        try {
          const baseUrl = new URL(finalUrl);
          metadata.image = new URL(metadata.image, baseUrl.origin).href;
        } catch {
          // If URL construction fails, try prepending the origin
          const urlObj = new URL(finalUrl);
          metadata.image = `${urlObj.origin}${metadata.image.startsWith('/') ? '' : '/'}${metadata.image}`;
        }
      }

        return metadata;
      } catch (error: any) {
        // Check if error indicates we shouldn't retry (403, 404, AbortError)
        const isNonRetryable =
          error.name === 'AbortError' ||
          (error.message && error.message.includes('403')) ||
          (error.message && error.message.includes('404')) ||
          (error.message && error.message.includes('Forbidden')) ||
          (error.message && error.message.includes('Not Found'));

        // Check if it's a 429 rate limit error (retryable but needs longer backoff)
        const isRateLimit = error.message && error.message.includes('429');

        // If it's the last attempt or a non-retryable error, return basic metadata
        if (attempt === retries || isNonRetryable) {
          if (isNonRetryable && attempt < retries) {
            console.warn(`Non-retryable error fetching link metadata for ${url}: ${error.message}`);
          } else {
            console.error(`Error fetching link metadata for ${url} (attempt ${attempt}/${retries}):`, error.message);
          }
          // Return basic metadata with the URL
          return {
            url: url,
            title: url,
          };
        }

        // Calculate wait time based on error type
        let waitTime: number;
        if (isRateLimit) {
          // For 429 errors, check if Retry-After header was provided
          const retryAfterMatch = error.message.match(/retry after (\d+)s/);
          if (retryAfterMatch) {
            waitTime = parseInt(retryAfterMatch[1], 10) * 1000; // Convert seconds to ms
          } else {
            // Longer exponential backoff for rate limits: 5s, 10s, 20s
            waitTime = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
          }
          console.warn(`Rate limited. Waiting ${waitTime}ms before retrying metadata fetch for ${url} (attempt ${attempt}/${retries})`);
        } else {
          // Standard exponential backoff for other retryable errors
          waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.warn(`Retrying metadata fetch for ${url} in ${waitTime}ms (attempt ${attempt}/${retries})`);
        }

        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Fallback if all retries failed
    return {
      url: url,
      title: url,
    };
  }
}

export const linkMetadataService = new LinkMetadataService();
