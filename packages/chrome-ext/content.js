(function() {
  'use strict';

  const API_URL = 'http://localhost:3001';
  let saveButton = null;

  function getToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['auth_token'], (result) => {
        resolve(result.auth_token || null);
      });
    });
  }

  function createSaveButton() {
    if (saveButton) return saveButton;

    const button = document.createElement('button');
    button.textContent = 'Save to Brain';
    button.className = 'injest-save-button';
    button.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 10000;
      background: #000;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: none;
    `;

    button.addEventListener('click', async () => {
      const selectedText = window.getSelection().toString().trim();
      if (!selectedText) {
        alert('Please select some text first');
        return;
      }

      const token = await getToken();
      if (!token) {
        alert('Please sign in first. Open the extension popup to authenticate.');
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
            raw: selectedText,
            source: {
              app: 'chrome',
              url: window.location.href,
            },
          }),
        });

        if (response.ok) {
          button.textContent = 'Saved!';
          button.style.background = '#10b981';
          setTimeout(() => {
            button.textContent = 'Save to Brain';
            button.style.background = '#000';
            button.style.display = 'none';
          }, 2000);
        } else {
          throw new Error('Failed to save');
        }
      } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save to brain');
      }
    });

    document.body.appendChild(button);
    saveButton = button;
    return button;
  }

  function showSaveButton() {
    const button = createSaveButton();
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
      button.style.display = 'block';
    } else {
      button.style.display = 'none';
    }
  }

  document.addEventListener('mouseup', showSaveButton);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      showSaveButton();
    }
  });

  // Context menu handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveSelection') {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        getToken().then(token => {
          if (token) {
            fetch(`${API_URL}/api/items`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                type: 'note',
                raw: selectedText,
                source: {
                  app: 'chrome',
                  url: window.location.href,
                },
              }),
            }).then(() => {
              sendResponse({ success: true });
            }).catch(() => {
              sendResponse({ success: false });
            });
          } else {
            sendResponse({ success: false, error: 'Not authenticated' });
          }
        });
        return true;
      }
    }
  });
})();
