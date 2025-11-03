# Brain AI Chrome Extension

Chrome extension for capturing content to your Brain AI.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `packages/chrome-ext` directory

## Usage

1. Click the extension icon to open the popup
2. The current page URL and title are automatically captured
3. Add a note (optional) and click "Save to Brain"
4. Or use keyboard shortcut: Select text and press `Ctrl+Shift+B` (coming soon)

## Configuration

Make sure your API URL is set correctly in `popup.js` (defaults to `http://localhost:3001`).
