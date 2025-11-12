// DOM elements
const form = document.getElementById('captureForm');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const urlInput = document.getElementById('url');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');
const optionsLink = document.getElementById('optionsLink');

const DEFAULT_EXTERNAL_API_URL = 'https://injest-api.onrender.com/api/external';
const LEGACY_EXTERNAL_API_URL = 'https://api.injest.io/api/external';

// Load configuration
let externalApiUrl = '';
let apiKey = '';

async function loadConfig() {
  const result = await chrome.storage.sync.get(['externalApiUrl', 'apiKey', 'apiUrl']);

  const updates = {};

  externalApiUrl = (result.externalApiUrl || '').replace(/\/+$/, '');
  apiKey = result.apiKey || '';

  // Backward compatibility: migrate legacy apiUrl if present
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

  // Check if configured
  if (!externalApiUrl || !apiKey) {
    showMessage('Please configure the External API URL and API key in settings', 'error');
    submitBtn.disabled = true;
    optionsLink.style.display = 'inline';
    return false;
  }

  submitBtn.disabled = false;
  return true;
}

// Update file name display
fileInput.addEventListener('change', (e) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    if (files.length === 1) {
      fileNameDisplay.textContent = files[0].name;
    } else {
      fileNameDisplay.textContent = `${files.length} file(s) selected`;
    }
  } else {
    fileNameDisplay.textContent = 'No file chosen';
  }
});

// Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!await loadConfig()) {
    return;
  }

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const url = urlInput.value.trim();
  const notes = notesInput.value.trim();
  const files = fileInput.files;

  // Validate that at least one field is provided
  if (!title && !description && !url && (!files || files.length === 0)) {
    showMessage('Please provide at least a title, description, URL, or attachment', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';
  clearMessage();

  try {
    const formData = new FormData();

    if (title) formData.append('title', title);
    if (description) formData.append('description', description);
    if (url) formData.append('url', url);
    if (notes) formData.append('notes', notes);
    formData.append('source', 'chrome-extension');

    // Add file attachments
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        formData.append('attachments', files[i]);
      }
    }

    const response = await fetch(`${externalApiUrl}/items`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.details || errorData.error || `Request failed: ${response.status}`);
    }

    const item = await response.json();
    showMessage('Item created successfully!', 'success');

    // Reset form
    form.reset();
    fileNameDisplay.textContent = 'No file chosen';

    // Clear form after a short delay
    setTimeout(() => {
      clearMessage();
    }, 2000);

  } catch (error) {
    let errorMessage = 'Failed to create item';

    if (error.message) {
      errorMessage = error.message;

      // Provide user-friendly messages
      if (errorMessage.includes('File too large') || errorMessage.includes('LIMIT_FILE_SIZE')) {
        errorMessage = 'File too large. Maximum file size is 25MB.';
      } else if (errorMessage.includes('Too many files') || errorMessage.includes('LIMIT_FILE_COUNT')) {
        errorMessage = 'Too many files. Maximum 10 files at once.';
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid token') || errorMessage.includes('API key')) {
        errorMessage = 'Authentication failed. Please check your API key in settings.';
      }
    }

    showMessage(errorMessage, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Item';
  }
});

// Options link
optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
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

// Load config on popup open
loadConfig();

// Auto-paste from clipboard when popup opens (if available)
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Try to read clipboard and auto-fill if empty
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText && clipboardText.trim()) {
        // Check if it's a URL
        const urlPattern = /^https?:\/\/.+/i;
        if (urlPattern.test(clipboardText.trim())) {
          // Only fill URL if it's empty
          if (!urlInput.value) {
            urlInput.value = clipboardText.trim();
          }
        } else {
          // Only fill description if it's empty
          if (!descriptionInput.value) {
            descriptionInput.value = clipboardText.trim();
          }
        }
      }
    }
  } catch (error) {
    // Clipboard access may not be available, silently fail
    console.log('Clipboard access not available:', error);
  }
});
