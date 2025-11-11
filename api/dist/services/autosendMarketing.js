import dotenv from 'dotenv';
dotenv.config();
const DEFAULT_AUTOSEND_API_BASE = 'https://api.autosend.com/v1';
const USER_AGENT = 'Injest AutoSend Marketing Service (+https://injest.io)';
class AutoSendMarketingService {
    apiKey;
    apiBase;
    defaultSenderId;
    defaultListId;
    constructor() {
        this.apiKey = process.env.AUTOSEND_API_KEY ?? '';
        if (!this.apiKey) {
            throw new Error('[AutoSendMarketingService] AUTOSEND_API_KEY is not configured');
        }
        const baseFromEnv = process.env.AUTOSEND_API_BASE_URL?.replace(/\/+$/, '');
        this.apiBase = baseFromEnv ? `${baseFromEnv}/v1` : DEFAULT_AUTOSEND_API_BASE;
        this.defaultSenderId = process.env.AUTOSEND_MARKETING_SENDER_ID || undefined;
        this.defaultListId = process.env.AUTOSEND_MARKETING_LIST_ID || undefined;
    }
    getPreferredSenderId() {
        return this.defaultSenderId;
    }
    getPreferredListId() {
        return this.defaultListId;
    }
    async request(path, options = {}) {
        const { method = 'GET', body, headers = {}, query } = options;
        const url = new URL(path, this.apiBase);
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value === undefined || value === null) {
                    return;
                }
                url.searchParams.set(key, String(value));
            });
        }
        const fetchOptions = {
            method,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT,
                ...headers,
            },
        };
        if (body !== undefined && body !== null) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        const response = await fetch(url.toString(), fetchOptions);
        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            }
            catch {
                errorDetails = await response.text();
            }
            const message = typeof errorDetails === 'object' && errorDetails !== null && 'error' in errorDetails
                ? String(errorDetails.error)
                : response.statusText;
            throw new Error(`[AutoSendMarketingService] Request failed (${response.status} ${response.statusText}) - ${message}`);
        }
        if (response.status === 204) {
            return undefined;
        }
        return await response.json();
    }
    async listSenders() {
        return await this.request('/marketing/senders');
    }
    async createSender(payload) {
        return await this.request('/marketing/senders', {
            method: 'POST',
            body: {
                name: payload.name,
                email: payload.email,
                reply_to: payload.replyTo,
                preview_text: payload.previewText,
            },
        });
    }
    async listContacts(params) {
        return await this.request('/marketing/contacts', {
            query: {
                limit: params?.limit,
                cursor: params?.cursor,
                list_id: params?.listId ?? this.defaultListId,
            },
        });
    }
    async upsertContact(input) {
        const listId = input.listId ?? this.defaultListId;
        const body = {
            email: input.email,
            first_name: input.firstName,
            last_name: input.lastName,
            tags: input.tags,
            custom_fields: input.customFields,
            status: input.subscribed === false ? 'suppressed' : 'subscribed',
        };
        if (listId) {
            body.list_id = listId;
        }
        const result = await this.request('/marketing/contacts/upsert', {
            method: 'POST',
            body,
        });
        if (result && typeof result === 'object' && 'contact' in result) {
            return result.contact;
        }
        return result;
    }
    async listCampaigns(params) {
        return await this.request('/marketing/campaigns', {
            query: {
                limit: params?.limit,
                cursor: params?.cursor,
                status: params?.status,
            },
        });
    }
    async createCampaign(payload) {
        const body = {
            name: payload.name,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            sender_id: payload.senderId ?? this.defaultSenderId,
            audience_id: payload.audienceId ?? payload.listId ?? this.defaultListId,
            preview_text: payload.previewText,
            send_at: payload.sendAt,
        };
        return await this.request('/marketing/campaigns', {
            method: 'POST',
            body,
        });
    }
    async scheduleCampaign(campaignId, sendAt) {
        return await this.request(`/marketing/campaigns/${campaignId}/schedule`, {
            method: 'POST',
            body: { send_at: sendAt },
        });
    }
    async sendCampaignNow(campaignId) {
        return await this.request(`/marketing/campaigns/${campaignId}/send`, {
            method: 'POST',
        });
    }
    async cancelCampaign(campaignId) {
        return await this.request(`/marketing/campaigns/${campaignId}/cancel`, {
            method: 'POST',
        });
    }
}
export const autosendMarketingService = new AutoSendMarketingService();
//# sourceMappingURL=autosendMarketing.js.map