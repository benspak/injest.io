// DOM elements
const form = document.getElementById('settingsForm');
const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const testBtn = document.getElementById('testBtn');
const messageDiv = document.getElementById('message');

const DEFAULT_EXTERNAL_API_URL = 'https://injest-api.onrender.com/api/external';
const LEGACY_EXTERNAL_API_URL = 'https://api.injest.io/api/external';

// Load saved settings
async function loadSettings() {
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

  apiUrlInput.value = externalApiUrl || '';
  apiKeyInput.value = apiKey || '';
}

// Save settings
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!apiUrl || !apiKey) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  // Normalize API URL
  let normalizedUrl = apiUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.replace(/\/+$/, ''); // Remove trailing slashes

  try {
    await chrome.storage.sync.set({
      externalApiUrl: normalizedUrl,
      apiKey: apiKey
    });

    showMessage('Settings saved successfully!', 'success');
  } catch (error) {
    showMessage('Failed to save settings: ' + error.message, 'error');
  }
});

// Test connection
testBtn.addEventListener('click', async () => {
  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!apiUrl || !apiKey) {
    showMessage('Please fill in all fields first', 'error');
    return;
  }

  // Normalize API URL
  let normalizedUrl = apiUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.replace(/\/+$/, '');

  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  clearMessage();

  try {
    const response = await fetch(`${normalizedUrl}/items?limit=1`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }
    const data = await response.json().catch(() => ({}));
    const totalCount = Array.isArray(data.items) ? data.items.length : 'unknown';
    showMessage(`Connection successful! Retrieved ${totalCount} item(s).`, 'success');

  } catch (error) {
    let errorMessage = 'Connection failed';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Failed to connect to API. Please check the URL.';
    }
    showMessage(errorMessage, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
});

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
}

function clearMessage() {
  messageDiv.textContent = '';
  messageDiv.className = 'message';
  messageDiv.style.display = 'none';
}

// Load settings on page load
loadSettings();
