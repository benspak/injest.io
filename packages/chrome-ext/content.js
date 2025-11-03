// Content script - can be used for right-click context menu or page scraping
// For MVP, we'll keep it simple and use the popup

console.log('Brain AI content script loaded');

// Example: Add a keyboard shortcut to save current selection
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+B to save selection
  if (e.ctrlKey && e.shiftKey && e.key === 'B') {
    const selection = window.getSelection().toString();
    if (selection) {
      chrome.runtime.sendMessage({
        action: 'saveSelection',
        text: selection,
        url: window.location.href,
        title: document.title,
      });
    }
  }
});
