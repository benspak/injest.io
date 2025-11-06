// DOM elements
const form = document.getElementById('settingsForm');
const apiUrlInput = document.getElementById('apiUrl');
const authTokenInput = document.getElementById('authToken');
const testBtn = document.getElementById('testBtn');
const messageDiv = document.getElementById('message');

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.sync.get(['apiUrl', 'authToken']);
  if (result.apiUrl) {
    apiUrlInput.value = result.apiUrl;
  }
  if (result.authToken) {
    authTokenInput.value = result.authToken;
  }
}

// Save settings
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const apiUrl = apiUrlInput.value.trim();
  const authToken = authTokenInput.value.trim();
  
  if (!apiUrl || !authToken) {
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
      apiUrl: normalizedUrl,
      authToken: authToken
    });
    
    showMessage('Settings saved successfully!', 'success');
  } catch (error) {
    showMessage('Failed to save settings: ' + error.message, 'error');
  }
});

// Test connection
testBtn.addEventListener('click', async () => {
  const apiUrl = apiUrlInput.value.trim();
  const authToken = authTokenInput.value.trim();
  
  if (!apiUrl || !authToken) {
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
    const response = await fetch(`${normalizedUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }
    
    const data = await response.json();
    showMessage('Connection successful! You are authenticated as: ' + (data.user?.email || 'Unknown'), 'success');
    
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
}

function clearMessage() {
  messageDiv.textContent = '';
  messageDiv.className = 'message';
  messageDiv.style.display = 'none';
}

// Load settings on page load
loadSettings();

