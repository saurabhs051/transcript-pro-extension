// TranscriptPro - Content Script
// This script runs on YouTube pages

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoInfo') {
    const videoInfo = extractVideoInfo();
    sendResponse(videoInfo);
  }
  return true;
});

function extractVideoInfo() {
  const videoId = new URLSearchParams(window.location.search).get('v');
  
  // Try multiple selectors for title
  let title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
  if (!title) title = document.querySelector('h1.title')?.textContent?.trim();
  if (!title) title = document.title.replace(' - YouTube', '');
  
  // Try multiple selectors for channel
  let channel = document.querySelector('ytd-channel-name a')?.textContent?.trim();
  if (!channel) channel = document.querySelector('#channel-name')?.textContent?.trim();
  if (!channel) channel = 'Unknown Channel';
  
  return {
    videoId,
    title: title || 'Unknown Title',
    channel: channel,
    url: window.location.href
  };
}

// Notify that content script is ready
console.log('TranscriptPro: Content script loaded');

