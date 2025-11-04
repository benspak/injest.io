const API_URL = 'http://localhost:3001'; // Change to production URL in production

document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const saveButton = document.getElementById('saveButton');
  const status = document.getElementById('status');

  // Get current page context
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab.url) {
      // Pre-fill with page URL
      textInput.placeholder = `Currently on: ${new URL(tab.url).hostname}`;
    }
  });

  saveButton.addEventListener('click', async () => {
    const text = textInput.value.trim();

    if (!text) {
      showStatus('Please enter some text', 'error');
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      const { token } = await chrome.storage.sync.get(['token']);

      if (!token) {
        showStatus('Please sign in first', 'error');
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
        return;
      }

      const response = await fetch(`${API_URL}/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'note',
          raw: text,
        }),
      });

      if (response.ok) {
        showStatus('Saved successfully!', 'success');
        textInput.value = '';
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      showStatus('Failed to save. Please try again.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
});
