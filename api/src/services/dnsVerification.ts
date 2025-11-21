import dns from 'dns/promises';

/**
 * Verify that a TXT record exists for the domain with the expected value
 * For root domains, checks _injest-verify subdomain
 * For subdomains, checks _injest-verify.{subdomain}
 */
export async function verifyTxtRecord(domain: string, expectedValue: string): Promise<boolean> {
  try {
    // Determine the verification subdomain
    // For root domain (example.com): check _injest-verify.example.com
    // For subdomain (app.example.com): check _injest-verify.app.example.com
    const parts = domain.split('.');
    let verificationDomain: string;

    if (parts.length === 2) {
      // Root domain (example.com)
      verificationDomain = `_injest-verify.${domain}`;
    } else {
      // Subdomain (app.example.com)
      verificationDomain = `_injest-verify.${domain}`;
    }

    // Resolve TXT records
    const records = await dns.resolveTxt(verificationDomain);

    // Flatten the records (TXT records can be arrays of strings)
    const allValues = records.flat().map((record) => record.trim());

    // Check if any record matches the expected value
    return allValues.includes(expectedValue);
  } catch (error: any) {
    // DNS resolution failed - domain doesn't exist or record not found
    // ENOTFOUND is expected when DNS records haven't been configured yet
    if (error?.code === 'ENOTFOUND') {
      // This is expected - the DNS record simply doesn't exist yet
      // Don't log as an error, just return false
      return false;
    }
    // For other DNS errors, log them for debugging
    console.error(`DNS verification failed for ${domain}:`, error);
    return false;
  }
}

/**
 * Verify that a CNAME record exists pointing to the expected target
 */
export async function verifyCnameRecord(domain: string, expectedTarget: string): Promise<boolean> {
  try {
    const records = await dns.resolveCname(domain);

    // CNAME should point to the expected target
    // Normalize both for comparison (remove trailing dots, lowercase)
    const normalizedExpected = expectedTarget.toLowerCase().replace(/\.$/, '');
    const normalizedRecords = records.map((r) => r.toLowerCase().replace(/\.$/, ''));

    return normalizedRecords.some((record) => record === normalizedExpected || record.endsWith(`.${normalizedExpected}`));
  } catch (error: any) {
    // DNS resolution failed - CNAME not found or points elsewhere
    // ENOTFOUND is expected when DNS records haven't been configured yet
    if (error?.code === 'ENOTFOUND') {
      // This is expected - the DNS record simply doesn't exist yet
      return false;
    }
    // For other DNS errors, log them for debugging
    console.error(`CNAME verification failed for ${domain}:`, error);
    return false;
  }
}

/**
 * Generate the TXT record name for a domain
 */
export function getTxtRecordName(domain: string): string {
  return `_injest-verify.${domain}`;
}

/**
 * Get the CNAME target for a domain (defaults to injest.io)
 */
export function getDefaultCnameTarget(): string {
  return process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'injest.io';
}
