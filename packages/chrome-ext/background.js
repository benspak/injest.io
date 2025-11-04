const API_URL = 'http://localhost:3001'; // Change to production URL in production

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveToBrain',
    title: 'Save to Brain',
    contexts: ['selection', 'page', 'link'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveToBrain') {
    let text = '';
    
    if (info.selectionText) {
      text = info.selectionText;
    } else if (info.linkUrl) {
      text = info.linkUrl;
    } else if (tab.url) {
      text = tab.url;
    }

    if (text) {
      await saveToBrain(text, info.linkUrl || tab.url);
    }
  }
});

// Save content to API
async function saveToBrain(text, source) {
  try {
    const { token } = await chrome.storage.sync.get(['token']);
    
    if (!token) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Injest.io',
        message: 'Please sign in to use this extension',
      });
      return;
    }

    const type = source ? 'link' : 'note';
    
    const response = await fetch(`${API_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        raw: text,
        source: source || undefined,
      }),
    });

    if (response.ok) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Injest.io',
        message: 'Saved to your brain!',
      });
    } else {
      throw new Error('Failed to save');
    }
  } catch (error) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Injest.io',
      message: 'Failed to save content',
    });
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save') {
    saveToBrain(request.text, request.source).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
});
