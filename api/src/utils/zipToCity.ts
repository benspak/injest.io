/**
 * Convert a zip code to a city name using Zippopotam.us API
 * This is a free service that doesn't require an API key
 */
interface ZippopotamResponse {
  places?: Array<{
    'place name'?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export async function zipCodeToCity(zipCode: string): Promise<string | null> {
  if (!zipCode || zipCode.trim().length === 0) {
    return null;
  }

  // Extract just the numbers from the zip code (handle formats like "12345" or "12345-6789")
  const zipDigits = zipCode.trim().split('-')[0];

  // Only process US zip codes (5 digits)
  if (!/^\d{5}$/.test(zipDigits)) {
    // For non-US zip codes, we could extend this to support other countries
    // For now, return null for non-US formats
    return null;
  }

  try {
    // Use Zippopotam.us API (free, no API key required)
    const response = await fetch(`https://api.zippopotam.us/us/${zipDigits}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch city for zip code ${zipDigits}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as ZippopotamResponse;

    // Extract city name from the response
    // The API returns places array, we'll take the first one
    if (data.places && data.places.length > 0) {
      const city = data.places[0]?.['place name'];
      return city || null;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching city for zip code ${zipDigits}:`, error);
    return null;
  }
}
