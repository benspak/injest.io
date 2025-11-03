const API_URL = 'http://localhost:3001';

async function getToken() {
  const result = await chrome.storage.sync.get(['brain_token']);
  return result.brain_token;
}

async function saveToBrain(content, note, url, title) {
  const token = await getToken();

  if (!token) {
    throw new Error('Please login at http://localhost:3000');
  }

  const fullContent = note ? `${content}\n\nNote: ${note}` : content;

  const response = await fetch(`${API_URL}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      raw: fullContent,
      type: url ? 'link' : 'note',
      source: {
        app: 'chrome',
        url: url,
        metadata: {
          title: title,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save');
  }

  return response.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  const contentTextarea = document.getElementById('content');
  const noteInput = document.getElementById('note');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Get current page info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;
  const title = tab.title;

  // Pre-fill with page info if no content
  if (!contentTextarea.value) {
    contentTextarea.value = `${title}\n${url}`;
  }

  saveButton.addEventListener('click', async () => {
    const content = contentTextarea.value.trim();
    const note = noteInput.value.trim();

    if (!content) {
      showStatus('Please add content or save the current page', 'error');
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    statusDiv.className = 'status';

    try {
      await saveToBrain(content, note, url, title);
      showStatus('Saved to Brain! 🎉', 'success');
      contentTextarea.value = '';
      noteInput.value = '';
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save to Brain';
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }
});
