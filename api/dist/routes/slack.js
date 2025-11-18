import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { slackService } from '../services/slack.js';
import { slackWebhookService } from '../services/slackWebhooks.js';
import { slackCommandsService } from '../services/slackCommands.js';
import { slackIngestionService } from '../services/slackIngestion.js';
import { FRONTEND_URL } from '../config/auth.js';
import { SlackOAuthTokenModel } from '../models/SlackOAuthToken.js';
import { SlackWorkspaceModel } from '../models/SlackWorkspace.js';
const router = express.Router();
/**
 * Initiate Slack OAuth flow
 */
router.post('/oauth/initiate', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { authUrl, state } = await slackService.initiateOAuth(req.user.id);
        res.json({ authUrl, state });
    }
    catch (error) {
        console.error('[Slack] Failed to initiate OAuth:', error);
        res.status(500).json({ error: 'Failed to initiate Slack OAuth flow' });
    }
});
/**
 * Handle Slack OAuth callback
 */
router.get('/oauth/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        if (error) {
            console.error('[Slack] OAuth error:', error);
            return res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_denied`);
        }
        if (!code || !state) {
            return res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_invalid`);
        }
        try {
            const { userId, workspaceId, workspaceName, botUserId } = await slackService.handleCallback(code, state);
            // Store workspace info
            await SlackWorkspaceModel.createOrUpdate({
                workspaceId,
                userId,
                workspaceName,
            });
            res.redirect(`${FRONTEND_URL}/settings?slack_connected=true&workspace=${encodeURIComponent(workspaceName)}`);
        }
        catch (error) {
            console.error('[Slack] Failed to handle OAuth callback:', error);
            if (error.message?.includes('expired')) {
                return res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_expired`);
            }
            return res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_failed`);
        }
    }
    catch (error) {
        console.error('[Slack] Error in OAuth callback:', error);
        res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_failed`);
    }
});
/**
 * Handle Slack Events API webhook
 */
router.post('/events', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-slack-signature'];
        const timestamp = req.headers['x-slack-request-timestamp'];
        if (!signature || !timestamp) {
            return res.status(401).json({ error: 'Missing signature or timestamp' });
        }
        const body = req.body.toString();
        // Verify signature
        if (!slackWebhookService.verifyRequest(timestamp, signature, body)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        const payload = JSON.parse(body);
        // Handle URL verification challenge
        if (payload.type === 'url_verification') {
            return res.json({ challenge: payload.challenge });
        }
        // Handle event callback
        if (payload.type === 'event_callback' && payload.event) {
            // Acknowledge immediately
            res.status(200).send('OK');
            // Process event asynchronously
            setImmediate(async () => {
                try {
                    await slackWebhookService.processEvent(payload.event, payload.team_id);
                }
                catch (error) {
                    console.error('[Slack] Error processing event:', error);
                }
            });
            return;
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('[Slack] Error handling webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Handle Slack slash commands
 */
router.post('/commands', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const payload = req.body;
        // Verify request (Slack sends commands with a token)
        // In production, verify the token matches your Slack app's verification token
        const response = await slackCommandsService.handleCommand(payload);
        res.json(response);
    }
    catch (error) {
        console.error('[Slack] Error handling command:', error);
        res.json({
            response_type: 'ephemeral',
            text: 'An error occurred processing your command. Please try again later.',
        });
    }
});
/**
 * Handle Slack interactions (button clicks, etc.)
 */
router.post('/interactions', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const payload = JSON.parse(req.body.payload);
        // Verify request signature
        const signature = req.headers['x-slack-signature'];
        const timestamp = req.headers['x-slack-request-timestamp'];
        if (signature && timestamp) {
            const body = req.body.toString();
            if (!slackWebhookService.verifyRequest(timestamp, signature, body)) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }
        // Handle different interaction types
        switch (payload.type) {
            case 'button_click':
                // Handle button clicks
                res.json({ text: 'Button clicked!' });
                break;
            default:
                res.status(200).send('OK');
        }
    }
    catch (error) {
        console.error('[Slack] Error handling interaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Get Slack connection status
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const status = await slackService.getConnectionStatus(req.user.id);
        res.json(status);
    }
    catch (error) {
        console.error('[Slack] Error getting status:', error);
        res.status(500).json({ error: 'Failed to get Slack connection status' });
    }
});
/**
 * Disconnect Slack account
 */
router.delete('/disconnect', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await slackService.disconnect(req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Slack] Error disconnecting:', error);
        res.status(500).json({ error: 'Failed to disconnect Slack account' });
    }
});
/**
 * Trigger workspace ingestion
 */
router.post('/ingest', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { workspaceId } = req.body;
        if (!workspaceId) {
            return res.status(400).json({ error: 'workspaceId is required' });
        }
        // Verify user has access to this workspace
        const token = await SlackOAuthTokenModel.findByUserIdAndWorkspace(req.user.id, workspaceId);
        if (!token) {
            return res.status(403).json({ error: 'Workspace not connected' });
        }
        // Start ingestion in background
        setImmediate(async () => {
            try {
                const result = await slackIngestionService.ingestWorkspace(workspaceId, req.user.id);
                console.log(`[Slack] Ingestion complete for workspace ${workspaceId}:`, result);
            }
            catch (error) {
                console.error(`[Slack] Error ingesting workspace ${workspaceId}:`, error);
            }
        });
        res.json({ message: 'Ingestion started' });
    }
    catch (error) {
        console.error('[Slack] Error starting ingestion:', error);
        res.status(500).json({ error: 'Failed to start ingestion' });
    }
});
export default router;
//# sourceMappingURL=slack.js.map