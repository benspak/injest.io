const API_URL = 'http://localhost:3001';

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-brain',
    title: 'Save to Brain',
    contexts: ['selection'],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-brain' && info.selectionText) {
    const token = await new Promise((resolve) => {
      chrome.storage.local.get(['auth_token'], (result) => {
        resolve(result.auth_token || null);
      });
    });

    if (!token) {
      chrome.tabs.create({ url: `${API_URL}/api/auth/google` });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'note',
          raw: info.selectionText,
          source: {
            app: 'chrome',
            url: tab.url,
          },
        }),
      });

      if (response.ok) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Injest.io',
          message: 'Saved to brain!',
        });
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  }
});

// Handle OAuth callback
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    if (url.searchParams.has('token')) {
      const token = url.searchParams.get('token');
      chrome.storage.local.set({ auth_token: token }, () => {
        chrome.tabs.remove(tabId);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Injest.io',
          message: 'Signed in successfully!',
        });
      });
    }
  }
});
