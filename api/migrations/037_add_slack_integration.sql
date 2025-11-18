-- Create slack_oauth_tokens table for storing Slack OAuth tokens
CREATE TABLE IF NOT EXISTS slack_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  bot_user_id TEXT,
  scope TEXT,
  authed_user_id TEXT,
  authed_user_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_slack_oauth_tokens_user_id ON slack_oauth_tokens(user_id);

-- Create index for workspace lookups
CREATE INDEX IF NOT EXISTS idx_slack_oauth_tokens_workspace_id ON slack_oauth_tokens(workspace_id);

-- Create slack_workspaces table for tracking connected workspaces
CREATE TABLE IF NOT EXISTS slack_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL UNIQUE,
  workspace_name TEXT,
  domain TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for workspace lookups
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_workspace_id ON slack_workspaces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_user_id ON slack_workspaces(user_id);

-- Create slack_channels table for channel metadata
CREATE TABLE IF NOT EXISTS slack_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  channel_type TEXT, -- 'channel', 'group', 'im', 'mpim'
  is_private BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, channel_id)
);

-- Create indexes for channel lookups
CREATE INDEX IF NOT EXISTS idx_slack_channels_workspace_id ON slack_channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_channel_id ON slack_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_workspace_channel ON slack_channels(workspace_id, channel_id);

-- Create slack_messages table for storing all ingested messages
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL, -- Slack timestamp (thread_ts for thread parent)
  thread_ts TEXT, -- Parent thread timestamp (null for top-level messages)
  slack_user_id TEXT NOT NULL,
  text TEXT,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, channel_id, message_ts)
);

-- Create indexes for message lookups
CREATE INDEX IF NOT EXISTS idx_slack_messages_workspace_id ON slack_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_channel_id ON slack_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON slack_messages(thread_ts) WHERE thread_ts IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slack_messages_slack_user_id ON slack_messages(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_item_id ON slack_messages(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slack_messages_workspace_channel_ts ON slack_messages(workspace_id, channel_id, message_ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_indexed_at ON slack_messages(indexed_at) WHERE indexed_at IS NOT NULL;

-- Create slack_threads table for tracking thread relationships
CREATE TABLE IF NOT EXISTS slack_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thread_ts TEXT NOT NULL, -- Parent message timestamp
  message_count INTEGER DEFAULT 0,
  last_message_ts TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, channel_id, thread_ts)
);

-- Create indexes for thread lookups
CREATE INDEX IF NOT EXISTS idx_slack_threads_workspace_id ON slack_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_threads_channel_id ON slack_threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_threads_thread_ts ON slack_threads(thread_ts);

-- Create slack_message_reactions table for storing reactions
CREATE TABLE IF NOT EXISTS slack_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES slack_messages(id) ON DELETE CASCADE,
  reaction_name TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, reaction_name, slack_user_id)
);

-- Create indexes for reaction lookups
CREATE INDEX IF NOT EXISTS idx_slack_message_reactions_message_id ON slack_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_slack_message_reactions_slack_user_id ON slack_message_reactions(slack_user_id);

-- Create slack_message_files table for storing file attachments
CREATE TABLE IF NOT EXISTS slack_message_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES slack_messages(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, file_id)
);

-- Create indexes for file lookups
CREATE INDEX IF NOT EXISTS idx_slack_message_files_message_id ON slack_message_files(message_id);
CREATE INDEX IF NOT EXISTS idx_slack_message_files_file_id ON slack_message_files(file_id);

-- Create slack_user_mappings table for mapping Slack users to People entities
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  slack_username TEXT,
  slack_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, slack_user_id)
);

-- Create indexes for user mapping lookups
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_user_id ON slack_user_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_workspace_id ON slack_user_mappings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_slack_user_id ON slack_user_mappings(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_contact_id ON slack_user_mappings(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_workspace_slack_user ON slack_user_mappings(workspace_id, slack_user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_slack_oauth_tokens_updated_at BEFORE UPDATE ON slack_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_workspaces_updated_at BEFORE UPDATE ON slack_workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_channels_updated_at BEFORE UPDATE ON slack_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_messages_updated_at BEFORE UPDATE ON slack_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_threads_updated_at BEFORE UPDATE ON slack_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_user_mappings_updated_at BEFORE UPDATE ON slack_user_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the tables
COMMENT ON TABLE slack_oauth_tokens IS 'Stores Slack OAuth 2.0 tokens for user authentication';
COMMENT ON TABLE slack_workspaces IS 'Tracks connected Slack workspaces';
COMMENT ON TABLE slack_channels IS 'Index of channels per workspace';
COMMENT ON TABLE slack_messages IS 'Stores all ingested Slack messages with links to items';
COMMENT ON TABLE slack_threads IS 'Tracks thread relationships and metadata';
COMMENT ON TABLE slack_message_reactions IS 'Stores reactions on Slack messages';
COMMENT ON TABLE slack_message_files IS 'Stores file attachments for Slack messages';
COMMENT ON TABLE slack_user_mappings IS 'Maps Slack users to People entities (contacts)';
