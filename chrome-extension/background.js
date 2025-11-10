// Background service worker for clipboard monitoring

const DEFAULT_EXTERNAL_API_URL = 'https://injest-api.onrender.com/api/external';
const LEGACY_EXTERNAL_API_URL = 'https://api.injest.io/api/external';

// Listen for commands (Cmd+Shift+V / Ctrl+Shift+V)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-clipboard') {
    handleClipboardCapture();
  }
});

// Handle clipboard capture
async function handleClipboardCapture() {
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      console.error('No active tab found');
      return;
    }

    // Get clipboard content
    const clipboardText = await getClipboardText();

    if (!clipboardText) {
      console.log('No text in clipboard');
      return;
    }

    // Check if configured
    const config = await loadConfig();
    if (!config) {
      // Open options page if not configured
      chrome.runtime.openOptionsPage();
      return;
    }

    // Try to detect if clipboard contains a URL
    const urlPattern = /^https?:\/\/.+/i;
    const isUrl = urlPattern.test(clipboardText.trim());

    // Create item from clipboard
    await createItemFromClipboard(clipboardText, isUrl, config);

  } catch (error) {
    console.error('Error capturing clipboard:', error);
  }
}

// Get clipboard text
async function getClipboardText() {
  try {
    // Service workers don't have direct clipboard access
    // We need to inject a script into the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      console.error('No active tab found');
      return null;
    }

    // Inject script to read clipboard from the page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          // Try to read from clipboard API (requires HTTPS or localhost)
          if (navigator.clipboard && navigator.clipboard.readText) {
            return await navigator.clipboard.readText();
          }
        } catch (e) {
          console.log('Clipboard API not available:', e);
        }

        // Fallback: return empty string (user will need to paste manually)
        return '';
      }
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }

    return null;
  } catch (error) {
    console.error('Error reading clipboard:', error);
    // If clipboard access fails, we'll create an item with a prompt
    return null;
  }
}

async function loadConfig() {
  const result = await chrome.storage.sync.get(['externalApiUrl', 'apiKey', 'apiUrl']);
  const updates = {};

  let externalApiUrl = (result.externalApiUrl || '').replace(/\/+$/, '');
  const apiKey = result.apiKey || '';

  if (!externalApiUrl && result.apiUrl) {
    const normalizedLegacyUrl = result.apiUrl.replace(/\/+$/, '');
    if (normalizedLegacyUrl) {
      externalApiUrl = `${normalizedLegacyUrl}/api/external`;
      updates.externalApiUrl = externalApiUrl;
    }
  }

  if (externalApiUrl === LEGACY_EXTERNAL_API_URL) {
    externalApiUrl = DEFAULT_EXTERNAL_API_URL;
    updates.externalApiUrl = externalApiUrl;
  }

  if (!externalApiUrl) {
    externalApiUrl = DEFAULT_EXTERNAL_API_URL;
    updates.externalApiUrl = externalApiUrl;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.sync.set(updates);
  }

  if (!externalApiUrl || !apiKey) {
    return null;
  }

  return { externalApiUrl, apiKey };
}

// Create item from clipboard content
async function createItemFromClipboard(text, isUrl, config) {
  try {
    if (!text || text.trim() === '') {
      // If no text, we can't open popup from service worker
      // Just show a notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Injest Capture',
        message: 'No clipboard content found. Open the extension to manually capture.'
      });
      return;
    }

    const formData = new FormData();

    if (isUrl) {
      formData.append('url', text.trim());
    } else {
      formData.append('description', text);
    }

    // Set source to indicate it came from extension
    formData.append('source', 'chrome-extension');

    const response = await fetch(`${config.externalApiUrl}/items`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.details || errorData.error || 'Failed to create item');
    }

    const item = await response.json();

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Injest Capture',
      message: isUrl ? 'URL captured successfully!' : 'Text captured successfully!'
    });

    console.log('Item created:', item);

  } catch (error) {
    console.error('Error creating item:', error);

    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Injest Capture Error',
      message: error.message || 'Failed to capture item'
    });
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureClipboard') {
    handleClipboardCapture().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Will respond asynchronously
  }
});
