# Injest Capture Chrome Extension

A Chrome extension that replicates the Injest capture form and allows you to quickly capture items from your clipboard using Command+V (Mac) or Ctrl+V (Windows/Linux).

## Features

- **Form Interface**: Replicates the exact form from the web app with all fields:
  - Title (optional)
  - Description (optional)
  - URL (optional)
  - File attachments (optional)
  - Notes (optional)
- **Clipboard Capture**: Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux) to quickly capture clipboard content
- **External API Integration**: Uses your personal Injest external API key for secure access
- **Settings Page**: Configure your external API URL and API key

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` directory
5. The extension will be installed

## Setup

1. Click the extension icon in your Chrome toolbar
2. Click "Settings" at the bottom of the popup
3. Enter your External API URL (default: `https://api.injest.io/api/external`)
4. Enter your API key (see instructions below)
5. Click "Test Connection" to verify your settings
6. Click "Save Settings"

### Getting Your API Key

1. Log in to your Injest web app
2. Open the dashboard and navigate to the **External API Access** card
3. Generate a new API key (or copy your existing key)
4. Paste the API key into the extension settings

## Usage

### Using the Form

1. Click the extension icon in your Chrome toolbar
2. Fill in any of the optional fields (Title, Description, URL, Files, Notes)
3. Click "Create Item"
4. The item will be created in your Injest account

### Using Clipboard Capture

1. Copy any text or URL to your clipboard
2. Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)
3. The extension will automatically detect if it's a URL or plain text
4. A notification will confirm the item was created

**Note**:
- Chrome extensions cannot intercept the standard `Cmd+V` / `Ctrl+V` paste shortcut due to browser security restrictions. The extension uses `Cmd+Shift+V` / `Ctrl+Shift+V` instead.
- The keyboard shortcut can be customized in Chrome's extension keyboard shortcuts settings:
  - Go to `chrome://extensions/shortcuts`
  - Find "Injest Capture"
  - Customize the "Capture clipboard content to Injest" command
- Clipboard access requires the page to be served over HTTPS (or localhost). If clipboard reading fails, the extension will open the popup form where you can manually paste.

## Icons

The extension requires icon files. You'll need to add:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

### Generating Icons

A simple icon generator is included:
1. Open `create-icons.html` in your browser
2. Click "Generate Icons" to create placeholder icons
3. Click the download buttons to save each icon file
4. Place the downloaded files in the `chrome-extension` directory

Alternatively, you can create your own icons representing the Injest brand or a capture/plus icon.

## Development

The extension uses:
- Manifest V3
- Chrome Storage API for settings
- Chrome Clipboard API for reading clipboard content
- Chrome Commands API for keyboard shortcuts
- Chrome Notifications API for user feedback

## File Structure

```
chrome-extension/
├── manifest.json       # Extension manifest
├── popup.html          # Main form interface
├── popup.css           # Form styling
├── popup.js            # Form logic and API calls
├── background.js       # Background service worker for clipboard monitoring
├── options.html        # Settings page
├── options.css         # Settings page styling
├── options.js          # Settings page logic
├── icon16.png          # Extension icon (16x16)
├── icon48.png          # Extension icon (48x48)
├── icon128.png         # Extension icon (128x128)
└── README.md           # This file
```

## API Integration

The extension makes POST requests to your external API endpoint (`/api/external/items`) with:
- `x-api-key: <your-api-key>` header
- FormData body with fields: `title`, `description`, `url`, `notes`, `attachments`
- Additional metadata captured from clipboard interactions (`source: chrome-extension`)

This matches the exact API interface used by the web application.
