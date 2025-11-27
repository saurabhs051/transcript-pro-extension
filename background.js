// TranscriptPro - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('TranscriptPro installed successfully!');
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchTranscript') {
    // Handle transcript fetching if needed
    sendResponse({ success: true });
  }
  return true;
});

