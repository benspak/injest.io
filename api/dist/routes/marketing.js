import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { autosendMarketingService, } from '../services/autosendMarketing.js';
const router = express.Router();
const adminEmailList = (process.env.MARKETING_ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
const marketingAdmins = new Set(adminEmailList);
function userIsMarketingAdmin(email) {
    if (marketingAdmins.size === 0) {
        // Allow all authenticated users in non-production environments when no list is configured.
        if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
            return true;
        }
        return false;
    }
    return marketingAdmins.has(email.toLowerCase());
}
router.use(authMiddleware);
router.use((req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!userIsMarketingAdmin(req.user.email)) {
        return res.status(403).json({ error: 'Access to marketing tools is restricted' });
    }
    next();
});
router.get('/senders', async (_req, res) => {
    try {
        const response = await autosendMarketingService.listSenders();
        res.json(response);
    }
    catch (error) {
        console.error('[Marketing] Failed to list senders', error);
        res.status(502).json({ error: 'Failed to fetch senders from AutoSend' });
    }
});
router.post('/senders', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload?.name || !payload.email) {
            return res.status(400).json({ error: 'Sender name and email are required' });
        }
        const sender = await autosendMarketingService.createSender({
            name: payload.name,
            email: payload.email,
            replyTo: payload.replyTo,
            previewText: payload.previewText,
        });
        res.status(201).json({ sender });
    }
    catch (error) {
        console.error('[Marketing] Failed to create sender', error);
        res.status(502).json({ error: 'Failed to create sender in AutoSend' });
    }
});
router.get('/contacts', async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const listId = req.query.listId ? String(req.query.listId) : undefined;
        const response = await autosendMarketingService.listContacts({ limit, cursor, listId });
        res.json(response);
    }
    catch (error) {
        console.error('[Marketing] Failed to list contacts', error);
        res.status(502).json({ error: 'Failed to fetch contacts from AutoSend' });
    }
});
router.post('/contacts', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload?.email) {
            return res.status(400).json({ error: 'Contact email is required' });
        }
        const contact = await autosendMarketingService.upsertContact({
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            tags: payload.tags,
            customFields: payload.customFields,
            subscribed: payload.subscribed ?? true,
            listId: payload.listId,
        });
        res.status(201).json({ contact });
    }
    catch (error) {
        console.error('[Marketing] Failed to upsert contact', error);
        res.status(502).json({ error: 'Failed to upsert contact in AutoSend' });
    }
});
router.get('/campaigns', async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const status = req.query.status ? String(req.query.status) : undefined;
        const response = await autosendMarketingService.listCampaigns({ limit, cursor, status });
        res.json(response);
    }
    catch (error) {
        console.error('[Marketing] Failed to list campaigns', error);
        res.status(502).json({ error: 'Failed to fetch campaigns from AutoSend' });
    }
});
router.post('/campaigns', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload?.name || !payload.subject || !payload.html) {
            return res.status(400).json({ error: 'Campaign name, subject, and HTML content are required' });
        }
        const campaign = await autosendMarketingService.createCampaign({
            name: payload.name,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            senderId: payload.senderId,
            audienceId: payload.audienceId,
            previewText: payload.previewText,
            sendAt: payload.sendAt ?? null,
            listId: payload.listId,
        });
        if (payload.sendNow) {
            await autosendMarketingService.sendCampaignNow(campaign.id);
        }
        else if (payload.sendAt) {
            await autosendMarketingService.scheduleCampaign(campaign.id, payload.sendAt);
        }
        res.status(201).json({ campaign });
    }
    catch (error) {
        console.error('[Marketing] Failed to create campaign', error);
        res.status(502).json({ error: 'Failed to create campaign in AutoSend' });
    }
});
router.post('/campaigns/:campaignId/schedule', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const { sendAt } = req.body;
        if (!sendAt) {
            return res.status(400).json({ error: 'sendAt is required to schedule a campaign' });
        }
        const campaign = await autosendMarketingService.scheduleCampaign(campaignId, sendAt);
        res.json({ campaign });
    }
    catch (error) {
        console.error('[Marketing] Failed to schedule campaign', error);
        res.status(502).json({ error: 'Failed to schedule campaign in AutoSend' });
    }
});
router.post('/campaigns/:campaignId/send', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const response = await autosendMarketingService.sendCampaignNow(campaignId);
        res.json(response);
    }
    catch (error) {
        console.error('[Marketing] Failed to send campaign immediately', error);
        res.status(502).json({ error: 'Failed to trigger campaign send in AutoSend' });
    }
});
router.post('/campaigns/:campaignId/cancel', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const response = await autosendMarketingService.cancelCampaign(campaignId);
        res.json(response);
    }
    catch (error) {
        console.error('[Marketing] Failed to cancel campaign', error);
        res.status(502).json({ error: 'Failed to cancel campaign in AutoSend' });
    }
});
export default router;
//# sourceMappingURL=marketing.js.map