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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          redirect: 'follow',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
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
        // If it's the last attempt or a non-retryable error, return basic metadata
        if (attempt === retries || error.name === 'AbortError') {
          console.error(`Error fetching link metadata for ${url} (attempt ${attempt}/${retries}):`, error.message);
          // Return basic metadata with the URL
          return {
            url: url,
            title: url,
          };
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.warn(`Retrying metadata fetch for ${url} in ${waitTime}ms (attempt ${attempt}/${retries})`);
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
