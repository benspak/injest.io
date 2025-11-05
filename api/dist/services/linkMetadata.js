import * as cheerio from 'cheerio';
export class LinkMetadataService {
    async fetchMetadata(url) {
        try {
            // Ensure URL has protocol
            let fetchUrl = url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                fetchUrl = `https://${url}`;
            }
            const response = await fetch(fetchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
                redirect: 'follow',
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            const finalUrl = response.url || fetchUrl;
            // Extract metadata with priority: Open Graph > Twitter Cards > Standard meta tags
            const metadata = {
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
                }
                catch {
                    // If URL construction fails, try prepending the origin
                    const urlObj = new URL(finalUrl);
                    metadata.image = `${urlObj.origin}${metadata.image.startsWith('/') ? '' : '/'}${metadata.image}`;
                }
            }
            return metadata;
        }
        catch (error) {
            console.error('Error fetching link metadata:', error);
            // Return basic metadata with the URL
            return {
                url: url,
                title: url,
            };
        }
    }
}
export const linkMetadataService = new LinkMetadataService();
//# sourceMappingURL=linkMetadata.js.map