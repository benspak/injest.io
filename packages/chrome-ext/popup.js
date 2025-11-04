const API_URL = 'http://localhost:3001';

async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['auth_token'], (result) => {
      resolve(result.auth_token || null);
    });
  });
}

async function setToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ auth_token: token }, resolve);
  });
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  setTimeout(() => {
    statusDiv.textContent = '';
    statusDiv.className = '';
  }, 3000);
}

async function checkAuth() {
  const token = await getToken();
  if (token) {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('capture-section').style.display = 'block';
        return true;
      } else {
        await setToken(null);
      }
    } catch (error) {
      await setToken(null);
    }
  }
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('capture-section').style.display = 'none';
  return false;
}

async function saveItem(type, raw, source = {}) {
  const token = await getToken();
  if (!token) {
    showStatus('Please sign in first', 'error');
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
        type,
        raw,
        source: {
          app: 'chrome',
          ...source,
        },
      }),
    });

    if (response.ok) {
      showStatus('Saved to brain!', 'success');
      document.getElementById('url-input').value = '';
      document.getElementById('note-input').value = '';
    } else {
      throw new Error('Failed to save');
    }
  } catch (error) {
    console.error('Save error:', error);
    showStatus('Failed to save', 'error');
  }
}

document.getElementById('signin-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: `${API_URL}/api/auth/google` });
});

document.getElementById('save-url-btn').addEventListener('click', async () => {
  const url = document.getElementById('url-input').value.trim();
  if (!url) {
    showStatus('Please enter a URL or text', 'error');
    return;
  }
  await saveItem('link', url, { url });
});

document.getElementById('save-note-btn').addEventListener('click', async () => {
  const note = document.getElementById('note-input').value.trim();
  if (!note) {
    showStatus('Please enter a note', 'error');
    return;
  }
  await saveItem('note', note);
});

document.getElementById('save-page-btn').addEventListener('click', async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    await saveItem('link', tab.title || tab.url, { url: tab.url });
  });
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await setToken(null);
  await checkAuth();
  showStatus('Signed out', 'success');
});

// Handle OAuth callback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'auth-callback' && request.token) {
    setToken(request.token).then(() => {
      checkAuth();
      showStatus('Signed in!', 'success');
    });
  }
});

// Initialize
checkAuth();
