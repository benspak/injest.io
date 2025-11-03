// Background service worker for Chrome extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Brain AI extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToBrain') {
    // Open popup or save directly
    chrome.action.openPopup();
  }
});
