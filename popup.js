// TranscriptPro - Ultimate YouTube Transcript Tool
// ================================================

let currentTranscript = null;
let videoInfo = null;
let currentTab = null;
let currentVideoUrl = null;
let searchMatches = [];
let currentSearchIndex = -1;
let liveSyncInterval = null;
let selectedQuoteText = '';

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async () => {
  await initializeExtension();
  
  // Listen for tab updates (URL changes)
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  
  // Re-check when popup regains focus
  window.addEventListener('focus', checkForVideoChange);
});

async function initializeExtension() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentVideoUrl = tab.url;
  
  // Stop any live sync
  if (liveSyncInterval) {
    clearInterval(liveSyncInterval);
    liveSyncInterval = null;
  }
  
  // Reset state
  currentTranscript = null;
  videoInfo = null;
  searchMatches = [];
  currentSearchIndex = -1;
  selectedQuoteText = '';
  
  // Clear UI elements
  const transcriptContent = document.getElementById('transcriptContent');
  if (transcriptContent) transcriptContent.innerHTML = '';
  
  const wordCloud = document.getElementById('wordCloud');
  if (wordCloud) wordCloud.innerHTML = '';
  
  const previewContent = document.getElementById('previewContent');
  if (previewContent) previewContent.textContent = '';
  
  const liveSyncContent = document.getElementById('liveSyncContent');
  if (liveSyncContent) liveSyncContent.innerHTML = '';
  
  const liveSyncOverlay = document.getElementById('liveSyncOverlay');
  if (liveSyncOverlay) liveSyncOverlay.classList.add('hidden');
  
  const quotePreview = document.getElementById('quotePreview');
  if (quotePreview) quotePreview.classList.add('hidden');
  
  // Hide all sections first
  document.getElementById('notYoutube').classList.add('hidden');
  document.getElementById('playlistMode').classList.add('hidden');
  document.getElementById('mainContent').classList.add('hidden');
  
  if (!tab.url || !tab.url.includes('youtube.com/watch')) {
    document.getElementById('notYoutube').classList.remove('hidden');
    
    // Check for playlist
    if (tab.url && tab.url.includes('youtube.com/playlist')) {
      document.getElementById('notYoutube').classList.add('hidden');
      document.getElementById('playlistMode').classList.remove('hidden');
    }
    return;
  }

  document.getElementById('mainContent').classList.remove('hidden');
  
  await loadTranscript(tab);
  setupEventListeners();
  setupTabNavigation();
}

function handleTabUpdate(tabId, changeInfo, tab) {
  // Only care about URL changes in our active tab
  if (currentTab && tabId === currentTab.id && changeInfo.url) {
    if (changeInfo.url !== currentVideoUrl && changeInfo.url.includes('youtube.com/watch')) {
      currentVideoUrl = changeInfo.url;
      currentTab = tab;
      reloadTranscript();
    }
  }
}

async function checkForVideoChange() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.url !== currentVideoUrl) {
    currentVideoUrl = tab.url;
    currentTab = tab;
    await initializeExtension();
  }
}

async function reloadTranscript() {
  // Stop live sync if running
  if (liveSyncInterval) {
    clearInterval(liveSyncInterval);
    liveSyncInterval = null;
  }
  document.getElementById('liveSyncOverlay').classList.add('hidden');
  
  // Clear old data
  currentTranscript = null;
  videoInfo = null;
  searchMatches = [];
  currentSearchIndex = -1;
  selectedQuoteText = '';
  
  // Clear ALL UI elements
  document.getElementById('transcriptContent').innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Loading...</div>';
  document.getElementById('wordCloud').innerHTML = '<span style="color: #666;">Loading...</span>';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchCount').textContent = '';
  document.getElementById('quotePreview').classList.add('hidden');
  document.getElementById('liveSyncContent').innerHTML = '';
  
  // Clear preview
  document.getElementById('previewContent').textContent = 'Loading...';
  document.getElementById('transcriptPreview').classList.add('hidden');
  
  // Reset stats
  document.getElementById('wordCount').textContent = '0 words';
  document.getElementById('readTime').textContent = '0 min read';
  document.getElementById('statWords').textContent = '0';
  document.getElementById('statSentences').textContent = '0';
  document.getElementById('statDuration').textContent = '0:00';
  document.getElementById('statPace').textContent = '0';
  
  // Reset video info display
  document.getElementById('videoTitle').textContent = 'Loading...';
  document.getElementById('videoChannel').textContent = '';
  
  // Reload
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentVideoUrl = tab.url;
  
  if (tab.url && tab.url.includes('youtube.com/watch')) {
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('notYoutube').classList.add('hidden');
    await loadTranscript(tab);
  } else {
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('notYoutube').classList.remove('hidden');
  }
}

// ========== TRANSCRIPT LOADING ==========

async function loadTranscript(tab) {
  showStatus('Loading transcript...', 'loading');
  
  try {
    // Get video info
    const [infoResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVideoInfo
    });

    if (!infoResult || !infoResult.result) {
      throw new Error('Could not extract video information');
    }

    videoInfo = infoResult.result;
    document.getElementById('videoTitle').textContent = videoInfo.title;
    document.getElementById('videoChannel').textContent = videoInfo.channel;

    // Get transcript
    const [transcriptResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fetchTranscriptFromPage
    });

    if (!transcriptResult || !transcriptResult.result) {
      throw new Error('Failed to fetch transcript');
    }

    const { transcript, error, language } = transcriptResult.result;
    
    if (error) {
      throw new Error(error);
    }

    currentTranscript = transcript;
    
    if (!currentTranscript || currentTranscript.length === 0) {
      throw new Error('No transcript available for this video');
    }
    
    // Update language display
    const langDisplay = document.getElementById('transcriptLang');
    if (langDisplay && language) {
      langDisplay.textContent = language;
    }

    // Update stats
    updateStatistics();
    
    // Generate word cloud
    generateWordCloud();
    
    // Render transcript viewer
    renderTranscriptViewer();
    
    showStatus('Transcript loaded!', 'success');
    showPreview();
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
    disableButtons();
  }
}

// ========== TAB NAVIGATION ==========

function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update button states
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', reloadTranscript);
  
  // Options
  document.getElementById('includeTimestamps').addEventListener('change', showPreview);
  document.getElementById('cleanFormatting').addEventListener('change', showPreview);
  document.getElementById('removeFiller').addEventListener('change', showPreview);
  document.getElementById('smartParagraphs').addEventListener('change', showPreview);
  document.getElementById('detectSpeakers').addEventListener('change', () => {
    renderTranscriptViewer();
    showPreview();
  });

  // Export buttons
  document.getElementById('downloadTxt').addEventListener('click', () => downloadTranscript('txt'));
  document.getElementById('downloadMd').addEventListener('click', () => downloadTranscript('md'));
  document.getElementById('downloadSrt').addEventListener('click', () => downloadTranscript('srt'));
  document.getElementById('downloadVtt').addEventListener('click', () => downloadTranscript('vtt'));
  document.getElementById('downloadJson').addEventListener('click', () => downloadTranscript('json'));
  document.getElementById('downloadPdf').addEventListener('click', () => downloadTranscript('pdf'));
  document.getElementById('copyClipboard').addEventListener('click', copyToClipboard);

  // Live sync
  document.getElementById('liveSync').addEventListener('click', startLiveSync);
  document.getElementById('closeLiveSync').addEventListener('click', stopLiveSync);

  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', debounce(performSearch, 150));
  document.getElementById('searchPrev').addEventListener('click', () => navigateSearch(-1));
  document.getElementById('searchNext').addEventListener('click', () => navigateSearch(1));
  
  // Keyboard shortcuts for search
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigateSearch(e.shiftKey ? -1 : 1);
    }
  });

  // Quote generator
  document.getElementById('copyQuote').addEventListener('click', copyQuote);
  document.getElementById('downloadQuote').addEventListener('click', downloadQuote);

  // Batch download
  document.getElementById('batchDownload')?.addEventListener('click', startBatchDownload);
  document.getElementById('cancelBatch')?.addEventListener('click', cancelBatchDownload);

  // Text selection for quotes
  document.getElementById('transcriptContent').addEventListener('mouseup', handleTextSelection);
}

// ========== TRANSCRIPT VIEWER ==========

function renderTranscriptViewer() {
  if (!currentTranscript) return;
  
  const container = document.getElementById('transcriptContent');
  const detectSpeakers = document.getElementById('detectSpeakers').checked;
  
  // Process transcript with speaker detection if enabled
  let processedTranscript = [...currentTranscript];
  
  if (detectSpeakers) {
    processedTranscript = detectSpeakersInTranscript(processedTranscript);
  }
  
  container.innerHTML = processedTranscript.map((entry, index) => {
    const speakerLabel = entry.speaker 
      ? `<span class="speaker-label">${entry.speaker}</span>` 
      : '';
    
    return `
      <div class="transcript-entry" data-index="${index}" data-time="${entry.start}">
        <span class="entry-time" title="Click to seek">${entry.timestamp}</span>
        <span class="entry-text">${speakerLabel}${escapeHtml(entry.text)}</span>
      </div>
    `;
  }).join('');
  
  // Add click-to-seek handlers
  container.querySelectorAll('.entry-time').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const time = parseFloat(el.closest('.transcript-entry').dataset.time);
      seekToTime(time);
    });
  });
}

// ========== CLICK-TO-SEEK ==========

async function seekToTime(seconds) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: (time) => {
        const video = document.querySelector('video');
        if (video) {
          video.currentTime = time;
          video.play();
        }
      },
      args: [seconds]
    });
    
    // Highlight the entry
    document.querySelectorAll('.transcript-entry').forEach(el => {
      el.classList.remove('active');
      if (parseFloat(el.dataset.time) === seconds) {
        el.classList.add('active');
      }
    });
    
    showStatus(`Jumped to ${formatTimestamp(seconds)}`, 'success');
  } catch (error) {
    console.error('Failed to seek:', error);
  }
}

// ========== SEARCH FUNCTIONALITY ==========

function performSearch() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const container = document.getElementById('transcriptContent');
  const countEl = document.getElementById('searchCount');
  
  // Clear previous highlights
  container.querySelectorAll('.transcript-entry').forEach(el => {
    el.classList.remove('highlight', 'current');
    const textEl = el.querySelector('.entry-text');
    const originalText = textEl.textContent;
    textEl.innerHTML = escapeHtml(originalText);
  });
  
  searchMatches = [];
  currentSearchIndex = -1;
  
  if (!query) {
    countEl.textContent = '';
    document.getElementById('searchPrev').disabled = true;
    document.getElementById('searchNext').disabled = true;
    return;
  }
  
  // Find matches
  container.querySelectorAll('.transcript-entry').forEach((el, index) => {
    const textEl = el.querySelector('.entry-text');
    const text = textEl.textContent.toLowerCase();
    
    if (text.includes(query)) {
      searchMatches.push(el);
      el.classList.add('highlight');
      
      // Highlight the matched text
      const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
      textEl.innerHTML = textEl.textContent.replace(regex, '<mark>$1</mark>');
    }
  });
  
  countEl.textContent = searchMatches.length > 0 
    ? `${searchMatches.length} found` 
    : 'No results';
  
  document.getElementById('searchPrev').disabled = searchMatches.length === 0;
  document.getElementById('searchNext').disabled = searchMatches.length === 0;
  
  // Auto-navigate to first match
  if (searchMatches.length > 0) {
    navigateSearch(1);
  }
}

function navigateSearch(direction) {
  if (searchMatches.length === 0) return;
  
  // Remove current highlight
  if (currentSearchIndex >= 0) {
    searchMatches[currentSearchIndex].classList.remove('current');
  }
  
  // Calculate new index
  currentSearchIndex += direction;
  if (currentSearchIndex < 0) currentSearchIndex = searchMatches.length - 1;
  if (currentSearchIndex >= searchMatches.length) currentSearchIndex = 0;
  
  // Add current highlight
  const currentMatch = searchMatches[currentSearchIndex];
  currentMatch.classList.add('current');
  
  // Scroll into view
  currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Update count
  document.getElementById('searchCount').textContent = 
    `${currentSearchIndex + 1} / ${searchMatches.length}`;
}

// ========== SPEAKER DETECTION ==========

function detectSpeakersInTranscript(transcript) {
  // Simple speaker detection based on timing gaps and patterns
  const LONG_PAUSE_THRESHOLD = 2.0; // seconds
  const speakers = ['Speaker 1', 'Speaker 2', 'Speaker 3'];
  let currentSpeaker = 0;
  
  return transcript.map((entry, index) => {
    // Check for speaker change indicators
    const prevEntry = transcript[index - 1];
    let newSpeaker = currentSpeaker;
    
    if (prevEntry) {
      const gap = entry.start - (prevEntry.start + (prevEntry.duration || 3));
      
      // Long pause might indicate speaker change
      if (gap > LONG_PAUSE_THRESHOLD) {
        newSpeaker = (currentSpeaker + 1) % speakers.length;
      }
      
      // Question followed by response pattern
      if (prevEntry.text.trim().endsWith('?')) {
        newSpeaker = (currentSpeaker + 1) % speakers.length;
      }
    }
    
    currentSpeaker = newSpeaker;
    
    return {
      ...entry,
      speaker: speakers[currentSpeaker]
    };
  });
}

// ========== WORD CLOUD (TF-IDF) ==========

function generateWordCloud() {
  if (!currentTranscript) return;
  
  const container = document.getElementById('wordCloud');
  
  // Get all text
  const fullText = currentTranscript.map(e => e.text).join(' ').toLowerCase();
  
  // Tokenize and count
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
    'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him',
    'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which',
    'who', 'whom', 'gonna', 'wanna', 'gotta', 'like', 'know', 'think', 'well',
    'okay', 'ok', 'oh', 'um', 'uh', 'yeah', 'yes', 'right', 'really', 'actually',
    'basically', 'going', 'get', 'got', 'thing', 'things', 'dont', 'youre', 'thats'
  ]);
  
  const wordCount = {};
  const words = fullText.replace(/[^a-z\s]/g, '').split(/\s+/);
  
  for (const word of words) {
    if (word.length > 3 && !stopWords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }
  
  // Get top words
  const topWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  if (topWords.length === 0) {
    container.innerHTML = '<span class="tool-hint">No keywords found</span>';
    return;
  }
  
  // Calculate size tiers
  const maxCount = topWords[0][1];
  const minCount = topWords[topWords.length - 1][1];
  const range = maxCount - minCount || 1;
  
  container.innerHTML = topWords.map(([word, count]) => {
    const normalized = (count - minCount) / range;
    const size = Math.ceil(normalized * 4) + 1; // 1-5
    return `<span class="word-tag size-${size}" title="${count} occurrences">${word}</span>`;
  }).join('');
}

// ========== STATISTICS ==========

function updateStatistics() {
  if (!currentTranscript) return;
  
  const fullText = currentTranscript.map(e => e.text).join(' ');
  const words = fullText.split(/\s+/).filter(w => w.length > 0);
  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Get duration
  const lastEntry = currentTranscript[currentTranscript.length - 1];
  const duration = lastEntry ? lastEntry.start : 0;
  
  // Calculate pace
  const pace = duration > 0 ? Math.round((words.length / duration) * 60) : 0;
  
  // Update UI
  document.getElementById('wordCount').textContent = `${words.length} words`;
  document.getElementById('readTime').textContent = `${Math.ceil(words.length / 200)} min read`;
  document.getElementById('statWords').textContent = words.length.toLocaleString();
  document.getElementById('statSentences').textContent = sentences.length.toLocaleString();
  document.getElementById('statDuration').textContent = formatTimestamp(duration);
  document.getElementById('statPace').textContent = pace;
}

// ========== QUOTE GENERATOR ==========

function handleTextSelection() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text.length > 10 && text.length < 500) {
    selectedQuoteText = text;
    updateQuotePreview(text);
  }
}

function updateQuotePreview(text) {
  document.getElementById('quoteText').textContent = `"${text}"`;
  document.getElementById('quoteVideo').textContent = videoInfo?.title || 'YouTube Video';
  document.getElementById('quoteChannel').textContent = `— ${videoInfo?.channel || 'Unknown Channel'}`;
  document.getElementById('quotePreview').classList.remove('hidden');
  
  // Hide the hint
  document.querySelector('.tool-hint').style.display = 'none';
}

async function copyQuote() {
  if (!selectedQuoteText) return;
  
  const quoteText = `"${selectedQuoteText}"\n\n— ${videoInfo?.title}\n   ${videoInfo?.channel}`;
  
  try {
    await navigator.clipboard.writeText(quoteText);
    showStatus('Quote copied!', 'success');
  } catch (error) {
    showStatus('Failed to copy quote', 'error');
  }
}

async function downloadQuote() {
  if (!selectedQuoteText) return;
  
  // Create a canvas for the quote image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = 800;
  canvas.height = 450;
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#1e293b');
  gradient.addColorStop(1, '#334155');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Quote mark
  ctx.font = 'bold 120px Georgia';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillText('"', 30, 120);
  
  // Quote text
  ctx.font = 'italic 24px Georgia';
  ctx.fillStyle = 'white';
  
  const lines = wrapText(ctx, selectedQuoteText, canvas.width - 100);
  let y = 180;
  for (const line of lines.slice(0, 6)) {
    ctx.fillText(line, 50, y);
    y += 35;
  }
  
  // Source
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(videoInfo?.title || 'YouTube Video', 50, canvas.height - 60);
  ctx.fillText(`— ${videoInfo?.channel || 'Unknown'}`, 50, canvas.height - 35);
  
  // Download
  const link = document.createElement('a');
  link.download = 'quote.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  
  showStatus('Quote image saved!', 'success');
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

// ========== LIVE SYNC MODE ==========

function startLiveSync() {
  document.getElementById('liveSyncOverlay').classList.remove('hidden');
  
  // Initial render
  updateLiveSync();
  
  // Start polling
  liveSyncInterval = setInterval(updateLiveSync, 500);
}

function stopLiveSync() {
  document.getElementById('liveSyncOverlay').classList.add('hidden');
  
  if (liveSyncInterval) {
    clearInterval(liveSyncInterval);
    liveSyncInterval = null;
  }
}

async function updateLiveSync() {
  if (!currentTranscript) return;
  
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const video = document.querySelector('video');
        return video ? video.currentTime : 0;
      }
    });
    
    const currentTime = result?.result || 0;
    
    // Find current and surrounding entries
    const currentIndex = currentTranscript.findIndex((entry, i) => {
      const nextEntry = currentTranscript[i + 1];
      return currentTime >= entry.start && (!nextEntry || currentTime < nextEntry.start);
    });
    
    if (currentIndex === -1) return;
    
    // Get context (2 before, current, 2 after)
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(currentTranscript.length, currentIndex + 3);
    const context = currentTranscript.slice(start, end);
    
    const container = document.getElementById('liveSyncContent');
    container.innerHTML = context.map((entry, i) => {
      const absoluteIndex = start + i;
      let className = 'live-line';
      
      if (absoluteIndex === currentIndex) {
        className += ' current';
      } else if (absoluteIndex < currentIndex) {
        className += ' past';
      }
      
      return `<div class="${className}">${entry.text}</div>`;
    }).join('');
    
  } catch (error) {
    console.error('Live sync error:', error);
  }
}

// ========== BATCH DOWNLOAD ==========

let batchCancelled = false;

async function startBatchDownload() {
  const modal = document.getElementById('batchModal');
  modal.classList.remove('hidden');
  batchCancelled = false;
  
  try {
    // Get playlist videos
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const videos = document.querySelectorAll('ytd-playlist-video-renderer');
        return Array.from(videos).map(v => {
          const link = v.querySelector('a#video-title');
          return {
            title: link?.textContent?.trim() || 'Unknown',
            url: link?.href || ''
          };
        });
      }
    });
    
    const videos = result?.result || [];
    if (videos.length === 0) {
      showStatus('No videos found in playlist', 'error');
      modal.classList.add('hidden');
      return;
    }
    
    const transcripts = [];
    
    for (let i = 0; i < videos.length; i++) {
      if (batchCancelled) break;
      
      document.getElementById('batchStatus').textContent = `${i + 1} / ${videos.length} videos`;
      document.getElementById('batchProgress').style.width = `${((i + 1) / videos.length) * 100}%`;
      
      // TODO: Fetch each video's transcript
      // This would require navigating or using YouTube API
      transcripts.push({
        title: videos[i].title,
        content: 'Transcript would be fetched here...'
      });
    }
    
    if (!batchCancelled) {
      // Create zip file or combined download
      const combined = transcripts.map(t => 
        `# ${t.title}\n\n${t.content}\n\n---\n`
      ).join('\n');
      
      downloadFile('playlist_transcripts.txt', combined);
      showStatus(`Downloaded ${transcripts.length} transcripts!`, 'success');
    }
    
  } catch (error) {
    showStatus('Batch download failed', 'error');
  }
  
  modal.classList.add('hidden');
}

function cancelBatchDownload() {
  batchCancelled = true;
  document.getElementById('batchModal').classList.add('hidden');
}

// ========== EXPORT FUNCTIONS ==========

function downloadTranscript(format) {
  if (!currentTranscript) return;
  
  const includeTimestamps = document.getElementById('includeTimestamps').checked;
  const cleanFormat = document.getElementById('cleanFormatting').checked;
  const removeFiller = document.getElementById('removeFiller').checked;
  const smartParagraphs = document.getElementById('smartParagraphs').checked;
  const detectSpeakers = document.getElementById('detectSpeakers').checked;
  
  let content = '';
  let filename = '';
  let mimeType = 'text/plain';
  
  // Process transcript
  let processed = [...currentTranscript];
  
  if (detectSpeakers) {
    processed = detectSpeakersInTranscript(processed);
  }
  
  switch (format) {
    case 'txt':
      content = formatAsText(processed, { includeTimestamps, cleanFormat, removeFiller, smartParagraphs, detectSpeakers });
      filename = `${sanitizeFilename(videoInfo.title)}_transcript.txt`;
      break;
      
    case 'md':
      content = formatAsMarkdown(processed, { includeTimestamps, cleanFormat, removeFiller, smartParagraphs, detectSpeakers });
      filename = `${sanitizeFilename(videoInfo.title)}_transcript.md`;
      break;
      
    case 'srt':
      content = formatAsSRT(processed);
      filename = `${sanitizeFilename(videoInfo.title)}.srt`;
      break;
      
    case 'vtt':
      content = formatAsVTT(processed);
      filename = `${sanitizeFilename(videoInfo.title)}.vtt`;
      break;
      
    case 'json':
      content = formatAsJSON(processed);
      filename = `${sanitizeFilename(videoInfo.title)}_transcript.json`;
      mimeType = 'application/json';
      break;
      
    case 'pdf':
      generatePDF(processed, { includeTimestamps, cleanFormat, removeFiller, smartParagraphs, detectSpeakers });
      return; // PDF handled separately
  }
  
  downloadFile(filename, content, mimeType);
  showStatus(`Downloaded ${format.toUpperCase()}!`, 'success');
}

function formatAsText(transcript, options) {
  let text = '';
  let currentSpeaker = null;
  
  const groupedTranscript = options.smartParagraphs 
    ? groupIntoParagraphs(transcript) 
    : transcript.map(e => [e]);
  
  for (const group of groupedTranscript) {
    let paragraphText = '';
    
    for (const entry of group) {
      let entryText = processEntryText(entry.text, options);
      if (!entryText) continue;
      
      if (options.detectSpeakers && entry.speaker && entry.speaker !== currentSpeaker) {
        currentSpeaker = entry.speaker;
        paragraphText += `\n[${currentSpeaker}]\n`;
      }
      
      if (options.includeTimestamps && group.indexOf(entry) === 0) {
        paragraphText += `[${entry.timestamp}] `;
      }
      
      paragraphText += entryText + ' ';
    }
    
    if (paragraphText.trim()) {
      text += paragraphText.trim() + '\n\n';
    }
  }
  
  return text.trim();
}

function formatAsMarkdown(transcript, options) {
  let md = `# ${videoInfo.title}\n\n`;
  md += `**Channel:** ${videoInfo.channel}\n\n`;
  md += `**Video ID:** ${videoInfo.videoId}\n\n`;
  md += `---\n\n`;
  md += `## Transcript\n\n`;
  
  const groupedTranscript = options.smartParagraphs 
    ? groupIntoParagraphs(transcript) 
    : transcript.map(e => [e]);
  
  let currentSpeaker = null;
  
  for (const group of groupedTranscript) {
    let paragraphText = '';
    
    for (const entry of group) {
      let entryText = processEntryText(entry.text, options);
      if (!entryText) continue;
      
      if (options.detectSpeakers && entry.speaker && entry.speaker !== currentSpeaker) {
        currentSpeaker = entry.speaker;
        paragraphText += `\n**${currentSpeaker}:**\n`;
      }
      
      if (options.includeTimestamps && group.indexOf(entry) === 0) {
        paragraphText += `\`${entry.timestamp}\` `;
      }
      
      paragraphText += entryText + ' ';
    }
    
    if (paragraphText.trim()) {
      md += paragraphText.trim() + '\n\n';
    }
  }
  
  return md;
}

function formatAsSRT(transcript) {
  let srt = '';
  
  transcript.forEach((entry, index) => {
    const startTime = formatSRTTime(entry.start);
    const endTime = formatSRTTime(entry.start + (entry.duration || 3));
    
    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${entry.text}\n\n`;
  });
  
  return srt;
}

function formatAsVTT(transcript) {
  let vtt = 'WEBVTT\n\n';
  
  transcript.forEach((entry, index) => {
    const startTime = formatVTTTime(entry.start);
    const endTime = formatVTTTime(entry.start + (entry.duration || 3));
    
    vtt += `${index + 1}\n`;
    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${entry.text}\n\n`;
  });
  
  return vtt;
}

function formatAsJSON(transcript) {
  return JSON.stringify({
    video: {
      id: videoInfo.videoId,
      title: videoInfo.title,
      channel: videoInfo.channel
    },
    transcript: transcript.map(entry => ({
      start: entry.start,
      timestamp: entry.timestamp,
      text: entry.text,
      speaker: entry.speaker || null
    }))
  }, null, 2);
}

function generatePDF(transcript, options) {
  // Create a simple HTML-based PDF
  const printWindow = window.open('', '_blank');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${videoInfo.title} - Transcript</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .meta { color: #666; margin-bottom: 30px; }
        .timestamp { color: #6366f1; font-family: monospace; font-size: 12px; }
        .speaker { font-weight: bold; color: #333; margin-top: 20px; }
        p { margin-bottom: 16px; text-align: justify; }
        hr { margin: 30px 0; border: none; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(videoInfo.title)}</h1>
      <div class="meta">
        <strong>Channel:</strong> ${escapeHtml(videoInfo.channel)}<br>
        <strong>Video ID:</strong> ${videoInfo.videoId}
      </div>
      <hr>
      ${formatAsText(transcript, options).split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
  
  showStatus('PDF opened for printing!', 'success');
}

// ========== TEXT PROCESSING ==========

function processEntryText(text, options) {
  if (options.cleanFormat) {
    text = text
      .replace(/\[Music\]/gi, '')
      .replace(/\[Applause\]/gi, '')
      .replace(/\[Laughter\]/gi, '')
      .replace(/\[Silence\]/gi, '');
  }
  
  if (options.removeFiller) {
    text = text
      .replace(/\b(um|uh|er|ah|like|you know|i mean|basically|actually|literally|honestly|right|okay|so)\b/gi, '')
      .replace(/\s{2,}/g, ' ');
  }
  
  return text.trim();
}

function groupIntoParagraphs(transcript) {
  const PAUSE_THRESHOLD = 2.0; // seconds
  const groups = [];
  let currentGroup = [];
  
  for (let i = 0; i < transcript.length; i++) {
    const entry = transcript[i];
    const prevEntry = transcript[i - 1];
    
    // Start new paragraph on long pause
    if (prevEntry) {
      const gap = entry.start - prevEntry.start;
      if (gap > PAUSE_THRESHOLD || currentGroup.length >= 5) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [];
      }
    }
    
    currentGroup.push(entry);
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

// ========== HELPER FUNCTIONS ==========

function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

function pad(num, size = 2) {
  return String(num).padStart(size, '0');
}

function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function downloadFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 50);
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
  
  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

function showPreview() {
  const preview = document.getElementById('transcriptPreview');
  const content = document.getElementById('previewContent');
  
  if (!currentTranscript) return;
  
  const options = {
    includeTimestamps: document.getElementById('includeTimestamps').checked,
    cleanFormat: document.getElementById('cleanFormatting').checked,
    removeFiller: document.getElementById('removeFiller').checked,
    smartParagraphs: document.getElementById('smartParagraphs').checked,
    detectSpeakers: document.getElementById('detectSpeakers').checked
  };
  
  const previewTranscript = currentTranscript.slice(0, 10);
  const previewText = formatAsText(previewTranscript, options);
  
  content.textContent = previewText + '\n\n... (preview of first 10 entries)';
  preview.classList.remove('hidden');
}

function disableButtons() {
  const buttons = ['downloadTxt', 'downloadMd', 'downloadSrt', 'downloadVtt', 'downloadJson', 'downloadPdf', 'copyClipboard', 'liveSync'];
  buttons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
}

async function copyToClipboard() {
  if (!currentTranscript) return;
  
  const options = {
    includeTimestamps: document.getElementById('includeTimestamps').checked,
    cleanFormat: document.getElementById('cleanFormatting').checked,
    removeFiller: document.getElementById('removeFiller').checked,
    smartParagraphs: document.getElementById('smartParagraphs').checked,
    detectSpeakers: document.getElementById('detectSpeakers').checked
  };
  
  const text = formatAsText(currentTranscript, options);
  
  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied to clipboard!', 'success');
  } catch (error) {
    showStatus('Failed to copy', 'error');
  }
}

// ========== PAGE INJECTION FUNCTIONS ==========

function extractVideoInfo() {
  const videoId = new URLSearchParams(window.location.search).get('v');
  const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() ||
                document.querySelector('h1.title')?.textContent?.trim() ||
                document.title.replace(' - YouTube', '');
  const channel = document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
                  document.querySelector('#channel-name')?.textContent?.trim() ||
                  'Unknown Channel';
  
  return { videoId, title, channel };
}

function fetchTranscriptFromPage() {
  return new Promise(async (resolve) => {
    try {
      console.log('fetchTranscriptFromPage: Starting...');
      
      // First, try to get transcript directly from ytInitialData
      const directTranscript = tryGetTranscriptFromInitialData();
      if (directTranscript && directTranscript.length > 0) {
        console.log('Got transcript directly from ytInitialData:', directTranscript.length, 'entries');
        resolve({ transcript: directTranscript, error: null });
        return;
      }
      
      function tryGetTranscriptFromInitialData() {
        try {
          const ytInitialData = window.ytInitialData;
          if (!ytInitialData) return null;
          
          const panels = ytInitialData?.engagementPanels || [];
          for (const panel of panels) {
            const content = panel?.engagementPanelSectionListRenderer?.content;
            const transcriptRenderer = content?.transcriptRenderer;
            if (transcriptRenderer) {
              const body = transcriptRenderer?.body?.transcriptBodyRenderer;
              if (body?.cueGroups) {
                return parseCueGroups(body.cueGroups);
              }
            }
            
            const sectionList = content?.sectionListRenderer?.contents;
            if (sectionList) {
              for (const section of sectionList) {
                const transcriptBody = section?.transcriptSectionHeaderRenderer?.content?.transcriptBodyRenderer;
                if (transcriptBody?.cueGroups) {
                  return parseCueGroups(transcriptBody.cueGroups);
                }
              }
            }
          }
          
          return null;
        } catch (e) {
          console.warn('Failed to get transcript from ytInitialData:', e);
          return null;
        }
      }
      
      function parseCueGroups(cueGroups) {
        const transcript = [];
        for (const group of cueGroups) {
          const cues = group?.transcriptCueGroupRenderer?.cues || [];
          for (const cue of cues) {
            const cueRenderer = cue?.transcriptCueRenderer;
            if (cueRenderer) {
              const startMs = parseInt(cueRenderer.startOffsetMs || '0', 10);
              const start = startMs / 1000;
              const text = cueRenderer.cue?.simpleText || 
                          cueRenderer.cue?.runs?.map(r => r.text).join('') || '';
              
              if (text.trim()) {
                const hours = Math.floor(start / 3600);
                const minutes = Math.floor((start % 3600) / 60);
                const secs = Math.floor(start % 60);
                const timestamp = hours > 0 
                  ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                  : `${minutes}:${secs.toString().padStart(2, '0')}`;
                
                transcript.push({ start, timestamp, text: text.trim() });
              }
            }
          }
        }
        return transcript.length > 0 ? transcript : null;
      }
      
      // Try YouTube internal API first - most reliable method
      console.log('Trying YouTube internal API first...');
      const apiTranscript = await tryYoutubeInternalAPI();
      if (apiTranscript && apiTranscript.length > 0) {
        console.log('Got transcript from internal API:', apiTranscript.length, 'entries');
        resolve({ transcript: apiTranscript, error: null });
        return;
      }
      
      // Try DOM scraping as backup
      console.log('API failed, trying DOM scrape...');
      const domTranscript = await tryGetTranscriptFromDOM();
      if (domTranscript && domTranscript.length > 0) {
        console.log('Got transcript from DOM:', domTranscript.length, 'entries');
        resolve({ transcript: domTranscript, error: null });
        return;
      }
      
      // Try caption tracks as last resort
      console.log('Trying caption tracks...');
      let captionTracks = null;
      
      // Method 1: Global variable
      if (typeof ytInitialPlayerResponse !== 'undefined' && ytInitialPlayerResponse) {
        captionTracks = ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        console.log('Method 1 - Global variable:', captionTracks?.length || 0, 'tracks');
      }
      
      // Method 2: Parse from scripts
      if (!captionTracks || captionTracks.length === 0) {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || '';
          if (content.includes('captionTracks')) {
            // Try multiple regex patterns
            const patterns = [
              /ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*var\s|\s*<\/script>)/s,
              /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s,
              /var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});/s
            ];
            
            for (const pattern of patterns) {
              const match = content.match(pattern);
              if (match) {
                try {
                  const playerResponse = JSON.parse(match[1]);
                  captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                  if (captionTracks && captionTracks.length > 0) {
                    console.log('Method 2 - Script parsing:', captionTracks.length, 'tracks');
                    break;
                  }
                } catch (e) {}
              }
            }
            if (captionTracks && captionTracks.length > 0) break;
          }
        }
      }
      
      // Method 3: Regex on full page HTML
      if (!captionTracks || captionTracks.length === 0) {
        const pageHtml = document.documentElement.innerHTML;
        
        // Try multiple patterns
        const patterns = [
          /"captionTracks":\s*(\[[\s\S]*?\])(?=\s*,\s*")/,
          /"captionTracks":\s*(\[.*?\])/,
          /captionTracks\\?":\s*(\[[\s\S]*?\])/
        ];
        
        for (const pattern of patterns) {
          const captionMatch = pageHtml.match(pattern);
          if (captionMatch) {
            try {
              let jsonStr = captionMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              captionTracks = JSON.parse(jsonStr);
              if (captionTracks && captionTracks.length > 0) {
                console.log('Method 3 - HTML regex:', captionTracks.length, 'tracks');
                break;
              }
            } catch (e) {}
          }
        }
      }
      
      if (!captionTracks || captionTracks.length === 0) {
        resolve({ transcript: null, error: 'No captions available for this video' });
        return;
      }
      
      // Select best track - prefer English, then manual over auto, then any available
      let selectedTrack = captionTracks.find(track => 
        track.languageCode === 'en' || track.vssId?.includes('.en')
      );
      
      if (!selectedTrack) {
        // Try any non-auto-generated track
        selectedTrack = captionTracks.find(track => track.kind !== 'asr');
      }
      
      if (!selectedTrack) {
        // Fall back to any available track
        selectedTrack = captionTracks[0];
      }
      
      const trackLanguage = selectedTrack?.name?.simpleText || selectedTrack?.languageCode || 'Unknown';
      console.log('Selected track:', trackLanguage, selectedTrack?.languageCode, selectedTrack?.kind);
      
      if (!selectedTrack?.baseUrl) {
        resolve({ transcript: null, error: 'Caption URL not found' });
        return;
      }
      
      let baseUrl = selectedTrack.baseUrl.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
      
      const urlsToTry = [
        { label: 'srv1', url: baseUrl + '&fmt=srv1' },
        { label: 'original', url: baseUrl },
        { label: 'json3', url: baseUrl + '&fmt=json3' },
      ];
      
      let transcriptData = null;
      
      for (const urlOption of urlsToTry) {
        try {
          console.log('Trying format:', urlOption.label);
          const response = await fetch(urlOption.url, { credentials: 'include' });
          if (response.ok) {
            const text = await response.text();
            if (text && text.length > 50) {
              transcriptData = text;
              console.log('Success with format:', urlOption.label);
              break;
            }
          }
        } catch (e) {
          console.log('Failed:', urlOption.label, e.message);
        }
      }
      
      if (!transcriptData) {
        resolve({ transcript: null, error: 'Could not fetch transcript data' });
        return;
      }
      
      // Helper function to scrape transcript from YouTube's DOM
      async function tryGetTranscriptFromDOM() {
        try {
          // Try to open transcript panel
          const moreButton = document.querySelector('button[aria-label="More actions"]') ||
                            document.querySelector('ytd-menu-renderer button');
          if (moreButton) {
            moreButton.click();
            await new Promise(r => setTimeout(r, 300));
            
            // Look for transcript option
            const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
            for (const item of menuItems) {
              if (item.textContent.toLowerCase().includes('transcript')) {
                item.click();
                await new Promise(r => setTimeout(r, 1000));
                break;
              }
            }
          }
          
          // Try to get transcript segments
          const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
          if (segments.length === 0) return null;
          
          const transcript = [];
          for (const seg of segments) {
            const timeEl = seg.querySelector('.segment-timestamp');
            const textEl = seg.querySelector('.segment-text');
            
            if (timeEl && textEl) {
              const timeText = timeEl.textContent.trim();
              const text = textEl.textContent.trim();
              
              const timeParts = timeText.split(':').reverse();
              let seconds = 0;
              if (timeParts[0]) seconds += parseFloat(timeParts[0]);
              if (timeParts[1]) seconds += parseInt(timeParts[1]) * 60;
              if (timeParts[2]) seconds += parseInt(timeParts[2]) * 3600;
              
              if (text) {
                transcript.push({ start: seconds, timestamp: timeText, text });
              }
            }
          }
          
          return transcript.length > 0 ? transcript : null;
        } catch (e) {
          console.log('DOM scrape failed:', e.message);
          return null;
        }
      }
      
      async function tryYoutubeInternalAPI() {
        try {
          const videoId = new URLSearchParams(window.location.search).get('v');
          if (!videoId) return null;
          
          const ytcfg = window.ytcfg?.data_ || {};
          const apiKey = ytcfg.INNERTUBE_API_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
          const clientName = ytcfg.INNERTUBE_CLIENT_NAME || 'WEB';
          const clientVersion = ytcfg.INNERTUBE_CLIENT_VERSION || '2.20241121';
          
          let transcriptParams = null;
          const pageData = window.ytInitialData;
          
          // Method 1: Look in engagement panels
          if (pageData) {
            const engagementPanels = pageData?.engagementPanels || [];
            for (const panel of engagementPanels) {
              const content = panel?.engagementPanelSectionListRenderer?.content;
              
              // Try continuationItemRenderer path
              const transcriptRenderer = content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint;
              if (transcriptRenderer?.params) {
                transcriptParams = transcriptRenderer.params;
                console.log('Found params via continuationItemRenderer');
                break;
              }
              
              // Try structuredDescriptionContentRenderer path
              const structuredDesc = content?.structuredDescriptionContentRenderer?.items;
              if (structuredDesc) {
                for (const item of structuredDesc) {
                  const endpoint = item?.videoDescriptionTranscriptSectionRenderer?.onTapEndpoint?.getTranscriptEndpoint;
                  if (endpoint?.params) {
                    transcriptParams = endpoint.params;
                    console.log('Found params via structuredDescriptionContentRenderer');
                    break;
                  }
                }
              }
              if (transcriptParams) break;
            }
          }
          
          // Method 2: Look in playerOverlays
          if (!transcriptParams && pageData?.playerOverlays) {
            const decoratedPlayer = pageData.playerOverlays?.playerOverlayRenderer?.decoratedPlayerBarRenderer;
            const buttons = decoratedPlayer?.decoratedPlayerBarRenderer?.playerBar?.multiMarkersPlayerBarRenderer?.buttons || [];
            for (const btn of buttons) {
              const endpoint = btn?.buttonRenderer?.command?.getTranscriptEndpoint;
              if (endpoint?.params) {
                transcriptParams = endpoint.params;
                console.log('Found params via playerOverlays');
                break;
              }
            }
          }
          
          // Method 3: Search in page HTML with multiple patterns
          if (!transcriptParams) {
            const pageHtml = document.documentElement.innerHTML;
            const patterns = [
              /"getTranscriptEndpoint":\s*\{\s*"params":\s*"([^"]+)"/,
              /getTranscriptEndpoint.*?"params":\s*"([^"]+)"/,
              /"params":\s*"(Cg[A-Za-z0-9_\-=%]+)"/  // Transcript params - include URL encoding chars
            ];
            
            for (const pattern of patterns) {
              const match = pageHtml.match(pattern);
              if (match && match[1]) {
                // URL decode the params if needed
                transcriptParams = match[1].replace(/%3D/g, '=').replace(/%26/g, '&');
                console.log('Found params via HTML regex');
                break;
              }
            }
          }
          
          // Method 4: Try ytInitialData engagementPanels more thoroughly
          if (!transcriptParams && pageData) {
            const searchInObject = (obj, depth = 0) => {
              if (depth > 10 || !obj || typeof obj !== 'object') return null;
              
              if (obj.getTranscriptEndpoint?.params) {
                return obj.getTranscriptEndpoint.params;
              }
              
              for (const key of Object.keys(obj)) {
                const result = searchInObject(obj[key], depth + 1);
                if (result) return result;
              }
              return null;
            };
            
            transcriptParams = searchInObject(pageData);
            if (transcriptParams) {
              console.log('Found params via deep search');
            }
          }
          
          if (!transcriptParams) {
            console.log('No transcript params found');
            return null;
          }
          
          console.log('Calling transcript API...');
          
          const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: { 
                client: { 
                  clientName, 
                  clientVersion,
                  hl: 'en',
                  gl: 'US'
                } 
              },
              params: transcriptParams
            }),
            credentials: 'include'
          });
          
          if (!response.ok) {
            console.log('Transcript API returned:', response.status);
            return null;
          }
          
          const data = await response.json();
          console.log('API response received');
          
          // Try multiple paths to find transcript segments
          let segments = null;
          
          // Path 1: Standard path
          const transcriptContent = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content;
          const segmentList = transcriptContent?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer;
          if (segmentList?.initialSegments) {
            segments = segmentList.initialSegments;
            console.log('Found segments via standard path');
          }
          
          // Path 2: Alternative path
          if (!segments) {
            const altContent = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer;
            if (altContent?.cueGroups) {
              console.log('Found cueGroups via alternative path');
              return parseCueGroups(altContent.cueGroups);
            }
          }
          
          // Path 3: Direct transcript body
          if (!segments) {
            const directBody = data?.transcript?.body?.transcriptBodyRenderer?.cueGroups;
            if (directBody) {
              console.log('Found cueGroups via direct path');
              return parseCueGroups(directBody);
            }
          }
          
          if (!segments || segments.length === 0) {
            console.log('No segments found in API response');
            return null;
          }
          
          const transcript = [];
          
          for (const segment of segments) {
            // Handle transcriptSegmentRenderer (actual transcript text)
            const segRenderer = segment?.transcriptSegmentRenderer;
            if (segRenderer) {
              const startMs = parseInt(segRenderer.startMs || '0', 10);
              const start = startMs / 1000;
              
              let text = '';
              if (segRenderer.snippet?.runs) {
                text = segRenderer.snippet.runs.map(r => r.text || '').join('');
              } else if (segRenderer.snippet?.simpleText) {
                text = segRenderer.snippet.simpleText;
              }
              
              text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
              
              if (text) {
                const timestamp = segRenderer.startTimeText?.simpleText || formatTimestampLocal(start);
                transcript.push({ start, timestamp, text });
              }
            }
            // Skip transcriptSectionHeaderRenderer (these are section dividers, not transcript)
          }
          
          function formatTimestampLocal(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return hours > 0 
              ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
              : `${minutes}:${secs.toString().padStart(2, '0')}`;
          }
          
          console.log('Parsed', transcript.length, 'entries from API');
          return transcript.length > 0 ? transcript : null;
        } catch (e) {
          console.log('Internal API error:', e.message);
          return null;
        }
      }
      
      // Parse transcript data
      const transcript = [];
      
      const formatTS = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return hours > 0 
          ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${minutes}:${secs.toString().padStart(2, '0')}`;
      };
      
      const cleanText = (text) => (text || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (transcriptData.includes('<text') || transcriptData.includes('<?xml')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(transcriptData, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('text');
        
        for (let i = 0; i < textNodes.length; i++) {
          const node = textNodes[i];
          const start = parseFloat(node.getAttribute('start'));
          const dur = parseFloat(node.getAttribute('dur') || '3');
          const text = cleanText(node.textContent);
          
          if (text && !isNaN(start)) {
            transcript.push({ start, timestamp: formatTS(start), text, duration: dur });
          }
        }
      }
      
      if (transcript.length === 0 && (transcriptData.startsWith('{') || transcriptData.startsWith('['))) {
        try {
          const data = JSON.parse(transcriptData);
          const events = data.events || data.actions || [];
          
          for (const event of events) {
            if (!event) continue;
            
            let text = '';
            let startMs = event.tStartMs;
            
            if (Array.isArray(event.segs)) {
              text = event.segs.map(seg => seg.utf8 || '').join('');
            } else if (event.utf8) {
              text = event.utf8;
            }
            
            text = cleanText(text);
            if (text && startMs !== undefined) {
              const start = startMs / 1000;
              transcript.push({ start, timestamp: formatTS(start), text });
            }
          }
        } catch (e) {}
      }
      
      if (transcript.length === 0) {
        resolve({ transcript: null, error: 'Could not parse transcript data' });
        return;
      }
      
      // Include language info in the result
      const transcriptLanguage = selectedTrack?.name?.simpleText || selectedTrack?.languageCode || 'Unknown';
      resolve({ transcript, error: null, language: transcriptLanguage });
      
    } catch (error) {
      resolve({ transcript: null, error: error.message });
    }
  });
}

