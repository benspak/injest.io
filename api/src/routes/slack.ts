import express from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { slackService } from '../services/slack.js';
import { slackWebhookService } from '../services/slackWebhooks.js';
import { slackCommandsService } from '../services/slackCommands.js';
import { slackIngestionService } from '../services/slackIngestion.js';
import { slackSearchService } from '../services/slackSearch.js';
import { FRONTEND_URL } from '../config/auth.js';
import { SlackOAuthTokenModel } from '../models/SlackOAuthToken.js';
import { SlackWorkspaceModel } from '../models/SlackWorkspace.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { SlackChannelModel } from '../models/SlackChannel.js';
import { ItemModel } from '../models/Item.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Initiate Slack OAuth flow
 */
router.post('/oauth/initiate', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { authUrl, state } = await slackService.initiateOAuth(req.user.id);

    res.json({ authUrl, state });
  } catch (error: any) {
    console.error('[Slack] Failed to initiate OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate Slack OAuth flow' });
  }
});

/**
 * Handle Slack OAuth callback
 */
router.get('/oauth/callback', async (req: express.Request, res: express.Response) => {
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
      const { userId, workspaceId, workspaceName, botUserId } = await slackService.handleCallback(
        code as string,
        state as string
      );

      // Store workspace info
      await SlackWorkspaceModel.createOrUpdate({
        workspaceId,
        userId,
        workspaceName,
      });

      res.redirect(`${FRONTEND_URL}/settings?slack_connected=true&workspace=${encodeURIComponent(workspaceName)}`);
    } catch (error: any) {
      console.error('[Slack] Failed to handle OAuth callback:', error);
      if (error.message?.includes('expired')) {
        return res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_expired`);
      }
      return res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_failed`);
    }
  } catch (error: any) {
    console.error('[Slack] Error in OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}/settings?error=slack_oauth_failed`);
  }
});

/**
 * Handle Slack Events API webhook
 */
router.post('/events', express.raw({ type: 'application/json' }), async (req: express.Request, res: express.Response) => {
  try {
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;

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
        } catch (error) {
          console.error('[Slack] Error processing event:', error);
        }
      });

      return;
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Slack] Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle Slack slash commands
 */
router.post('/commands', express.urlencoded({ extended: true }), async (req: express.Request, res: express.Response) => {
  try {
    const payload = req.body;

    // Verify request (Slack sends commands with a token)
    // In production, verify the token matches your Slack app's verification token

    const response = await slackCommandsService.handleCommand(payload);

    res.json(response);
  } catch (error: any) {
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
router.post('/interactions', express.urlencoded({ extended: true }), async (req: express.Request, res: express.Response) => {
  try {
    const payload = JSON.parse(req.body.payload);

    // Verify request signature
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;

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
  } catch (error: any) {
    console.error('[Slack] Error handling interaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get Slack connection status
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await slackService.getConnectionStatus(req.user.id);

    res.json(status);
  } catch (error: any) {
    console.error('[Slack] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get Slack connection status' });
  }
});

/**
 * Disconnect Slack account
 */
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await slackService.disconnect(req.user.id);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Slack] Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack account' });
  }
});

/**
 * Trigger workspace ingestion
 */
router.post('/ingest', authMiddleware, async (req: AuthRequest, res: express.Response) => {
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
        const result = await slackIngestionService.ingestWorkspace(workspaceId, req.user!.id);
        console.log(`[Slack] Ingestion complete for workspace ${workspaceId}:`, result);
      } catch (error) {
        console.error(`[Slack] Error ingesting workspace ${workspaceId}:`, error);
      }
    });

    res.json({ message: 'Ingestion started' });
  } catch (error: any) {
    console.error('[Slack] Error starting ingestion:', error);
    res.status(500).json({ error: 'Failed to start ingestion' });
  }
});

/**
 * Get Slack messages with pagination
 */
router.get('/messages', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workspaceId, channelId, limit = 50, offset = 0 } = req.query;

    // Get user's workspaces
    const allTokens = await SlackOAuthTokenModel.findAllByUserId(req.user.id);
    if (!allTokens || allTokens.length === 0) {
      return res.json({ messages: [], total: 0 });
    }

    // Filter by workspace if specified
    const workspaceIds = workspaceId
      ? [workspaceId as string].filter(wsId => allTokens.some(t => t.workspace_id === wsId))
      : allTokens.map(t => t.workspace_id);
    const messages: any[] = [];
    let total = 0;

    for (const wsId of workspaceIds) {
      let wsMessages: any[];

      if (channelId) {
        wsMessages = await SlackMessageModel.findByChannel(wsId, channelId as string, 1000);
      } else {
        // Get all messages with items for this workspace
        const result = await pool.query(
          `SELECT sm.* FROM slack_messages sm
           JOIN items i ON sm.item_id = i.id
           WHERE sm.workspace_id = $1 AND sm.item_id IS NOT NULL
           ORDER BY sm.message_ts DESC
           LIMIT $2`,
          [wsId, 1000]
        );
        wsMessages = result.rows;
      }

      // Filter and paginate
      const filteredMessages = wsMessages
        .filter(msg => msg.item_id) // Only messages with items
        .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

      for (const msg of filteredMessages) {
        const item = await ItemModel.findById(msg.item_id);
        if (!item) continue;

        const channel = await SlackChannelModel.findByChannelId(wsId, msg.channel_id);
        // Generate permalink: https://slack.com/archives/{channelId}/p{timestamp}
        const timestampStr = msg.message_ts.replace('.', '');
        const permalink = `https://slack.com/archives/${msg.channel_id}/p${timestampStr}`;

        messages.push({
          id: msg.id,
          item: {
            id: item.id,
            title: item.title,
            description: item.description,
            source: item.source,
            tags: item.tags,
            created_at: item.created_at,
            notes: item.notes,
          },
          slackMessage: {
            workspaceId: msg.workspace_id,
            channelId: msg.channel_id,
            messageTs: msg.message_ts,
            threadTs: msg.thread_ts,
            text: msg.text,
          },
          channel: channel ? {
            name: channel.channel_name,
            type: channel.channel_type,
          } : null,
          permalink,
        });
      }

      total += wsMessages.filter(msg => msg.item_id).length;
    }

    res.json({ messages, total });
  } catch (error: any) {
    console.error('[Slack] Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get Slack messages' });
  }
});

/**
 * Get message context (thread)
 */
router.get('/messages/:workspaceId/:channelId/:messageTs/context', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workspaceId, channelId, messageTs } = req.params;

    const context = await slackSearchService.getMessageContext(
      req.user.id,
      workspaceId,
      channelId,
      messageTs
    );

    res.json(context);
  } catch (error: any) {
    console.error('[Slack] Error getting message context:', error);
    res.status(500).json({ error: 'Failed to get message context' });
  }
});

export default router;
