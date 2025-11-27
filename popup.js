// TranscriptPro - Popup Script
let currentTranscript = null;
let videoInfo = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're on a YouTube page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url || !tab.url.includes('youtube.com/watch')) {
    document.getElementById('notYoutube').classList.remove('hidden');
    return;
  }

  // Show main content
  document.getElementById('mainContent').classList.remove('hidden');
  
  // Get video info and transcript
  await loadTranscript(tab);

  // Setup event listeners
  setupEventListeners();
});

async function loadTranscript(tab) {
  showStatus('Loading transcript...', 'loading');
  
  try {
    // Inject content script and get video info
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVideoInfo
    });

    if (!result || !result.result) {
      throw new Error('Could not extract video information');
    }

    videoInfo = result.result;
    document.getElementById('videoTitle').textContent = videoInfo.title;
    document.getElementById('videoChannel').textContent = videoInfo.channel;

    // Fetch transcript
    currentTranscript = await fetchTranscript(videoInfo.videoId);
    
    if (!currentTranscript || currentTranscript.length === 0) {
      throw new Error('No transcript available for this video');
    }

    showStatus('✓ Transcript loaded successfully!', 'success');
    showPreview();
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
    disableButtons();
  }
}

function extractVideoInfo() {
  // This function runs in the YouTube page context
  const videoId = new URLSearchParams(window.location.search).get('v');
  const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() ||
                document.querySelector('h1.title')?.textContent?.trim() ||
                document.title.replace(' - YouTube', '');
  const channel = document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
                  document.querySelector('#channel-name')?.textContent?.trim() ||
                  'Unknown Channel';
  
  return { videoId, title, channel };
}

async function fetchTranscript(videoId) {
  try {
    // Method 1: Try to get transcript from YouTube's timedtext API
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    // Extract caption tracks from page HTML
    const captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/);
    
    if (!captionTracksMatch) {
      throw new Error('No captions available');
    }
    
    const captionTracks = JSON.parse(captionTracksMatch[1]);
    
    if (captionTracks.length === 0) {
      throw new Error('No captions available');
    }
    
    // Get the first available caption track (usually auto-generated or English)
    const captionUrl = captionTracks[0].baseUrl;
    
    // Fetch the actual transcript
    const transcriptResponse = await fetch(captionUrl);
    const transcriptXml = await transcriptResponse.text();
    
    // Parse XML transcript
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(transcriptXml, 'text/xml');
    const textNodes = xmlDoc.getElementsByTagName('text');
    
    const transcript = [];
    for (let node of textNodes) {
      const start = parseFloat(node.getAttribute('start'));
      const text = node.textContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      transcript.push({
        start: start,
        timestamp: formatTimestamp(start),
        text: text.trim()
      });
    }
    
    return transcript;
    
  } catch (error) {
    console.error('Transcript fetch error:', error);
    throw new Error('Could not fetch transcript. Make sure captions are enabled for this video.');
  }
}

function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
  
  const includeTimestamps = document.getElementById('includeTimestamps').checked;
  const previewText = formatTranscript(currentTranscript.slice(0, 10), includeTimestamps, true);
  
  content.textContent = previewText + '\n\n... (preview of first 10 lines)';
  preview.classList.remove('hidden');
}

function formatTranscript(transcript, includeTimestamps, cleanFormat) {
  let text = '';
  
  for (let entry of transcript) {
    let line = '';
    
    if (includeTimestamps) {
      line += `[${entry.timestamp}] `;
    }
    
    let entryText = entry.text;
    
    if (cleanFormat) {
      // Remove common noise
      entryText = entryText
        .replace(/\[Music\]/gi, '')
        .replace(/\[Applause\]/gi, '')
        .replace(/\[Laughter\]/gi, '')
        .replace(/\[Silence\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    if (entryText) {
      line += entryText;
      text += line + '\n';
    }
  }
  
  return text.trim();
}

function setupEventListeners() {
  document.getElementById('includeTimestamps').addEventListener('change', showPreview);
  document.getElementById('cleanFormatting').addEventListener('change', showPreview);
  
  document.getElementById('downloadTxt').addEventListener('click', () => downloadTranscript('txt'));
  document.getElementById('downloadMd').addEventListener('click', () => downloadTranscript('md'));
  document.getElementById('copyClipboard').addEventListener('click', copyToClipboard);
  document.getElementById('generateSummary').addEventListener('click', generateSummary);
}

function downloadTranscript(format) {
  if (!currentTranscript) return;
  
  const includeTimestamps = document.getElementById('includeTimestamps').checked;
  const cleanFormat = document.getElementById('cleanFormatting').checked;
  
  let content = '';
  let filename = '';
  
  if (format === 'txt') {
    content = formatTranscript(currentTranscript, includeTimestamps, cleanFormat);
    filename = `${sanitizeFilename(videoInfo.title)}_transcript.txt`;
  } else if (format === 'md') {
    content = `# ${videoInfo.title}\n\n`;
    content += `**Channel:** ${videoInfo.channel}\n\n`;
    content += `**Video ID:** ${videoInfo.videoId}\n\n`;
    content += `---\n\n`;
    content += `## Transcript\n\n`;
    content += formatTranscript(currentTranscript, includeTimestamps, cleanFormat);
    filename = `${sanitizeFilename(videoInfo.title)}_transcript.md`;
  }
  
  // Create download
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('✓ Downloaded successfully!', 'success');
}

async function copyToClipboard() {
  if (!currentTranscript) return;
  
  const includeTimestamps = document.getElementById('includeTimestamps').checked;
  const cleanFormat = document.getElementById('cleanFormatting').checked;
  const text = formatTranscript(currentTranscript, includeTimestamps, cleanFormat);
  
  try {
    await navigator.clipboard.writeText(text);
    showStatus('✓ Copied to clipboard!', 'success');
  } catch (error) {
    showStatus('Failed to copy to clipboard', 'error');
  }
}

async function generateSummary() {
  const btn = document.getElementById('generateSummary');
  const summaryDiv = document.getElementById('summaryContent');
  
  btn.disabled = true;
  btn.textContent = '⏳ Generating summary...';
  
  try {
    // Get full transcript text
    const transcriptText = formatTranscript(currentTranscript, false, true);
    
    // Simple extractive summary (first 5 sentences and key points)
    // In a real implementation, you'd call an AI API here
    const summary = generateSimpleSummary(transcriptText);
    
    summaryDiv.innerHTML = `<strong>Summary:</strong><br><br>${summary}`;
    summaryDiv.classList.remove('hidden');
    
    btn.textContent = '✓ Summary Generated';
    
  } catch (error) {
    showStatus('Failed to generate summary', 'error');
    btn.textContent = '🤖 Generate AI Summary';
    btn.disabled = false;
  }
}

function generateSimpleSummary(text) {
  // Simple extractive summary
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  if (sentences.length === 0) {
    return 'No summary available.';
  }
  
  // Take first 3 sentences and last 1 sentence
  const summary = [];
  
  if (sentences.length > 3) {
    summary.push(sentences[0].trim());
    summary.push(sentences[Math.floor(sentences.length / 2)].trim());
    summary.push(sentences[sentences.length - 1].trim());
  } else {
    summary.push(...sentences.map(s => s.trim()));
  }
  
  let result = '<p><strong>Key Points:</strong></p><ul>';
  summary.forEach(sentence => {
    if (sentence) {
      result += `<li>${sentence}</li>`;
    }
  });
  result += '</ul>';
  
  result += `<p style="margin-top: 10px; font-size: 11px; color: #666;">💡 This is a basic summary. Upgrade to Pro for AI-powered summaries with key insights and action items.</p>`;
  
  return result;
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 50);
}

function disableButtons() {
  document.getElementById('downloadTxt').disabled = true;
  document.getElementById('downloadMd').disabled = true;
  document.getElementById('copyClipboard').disabled = true;
  document.getElementById('generateSummary').disabled = true;
}

