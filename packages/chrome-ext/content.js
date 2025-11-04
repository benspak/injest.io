let saveButton = null;

document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', handleTextSelection);

function handleTextSelection() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  // Remove existing button
  if (saveButton) {
    saveButton.remove();
    saveButton = null;
  }

  if (selectedText && selectedText.length > 10) {
    // Create save button
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    saveButton = document.createElement('div');
    saveButton.className = 'injest-save-button';
    saveButton.textContent = 'Save to Brain';
    saveButton.style.position = 'fixed';
    saveButton.style.top = `${rect.bottom + window.scrollY + 5}px`;
    saveButton.style.left = `${rect.left + window.scrollX}px`;
    saveButton.style.zIndex = '10000';

    saveButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await saveSelection(selectedText, window.location.href);
      saveButton?.remove();
      saveButton = null;
      selection.removeAllRanges();
    });

    document.body.appendChild(saveButton);

    // Remove button after 5 seconds
    setTimeout(() => {
      saveButton?.remove();
      saveButton = null;
    }, 5000);
  }
}

async function saveSelection(text, source) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'save',
      text,
      source,
    });

    if (response?.success) {
      showNotification('Saved to Brain!');
    } else {
      showNotification('Failed to save');
    }
  } catch (error) {
    showNotification('Failed to save');
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'injest-notification';
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '10001';
  notification.style.padding = '12px 24px';
  notification.style.backgroundColor = '#10b981';
  notification.style.color = 'white';
  notification.style.borderRadius = '6px';
  notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
