# 📝 TranscriptPro - YouTube Transcript Downloader

> Download YouTube transcripts instantly with powerful features. Search, export, analyze - all locally in your browser.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/saurabhs051/transcript-pro-extension?style=social)](https://github.com/saurabhs051/transcript-pro-extension/stargazers)

🌐 **[Website](https://saurabhs051.github.io/transcript-pro-extension/)** • 
📥 **[Install Extension](#installation)** • 
🐛 **[Report Bug](https://github.com/saurabhs051/transcript-pro-extension/issues)** • 
✨ **[Request Feature](https://github.com/saurabhs051/transcript-pro-extension/issues)**

---

## ✨ Features

### 📥 **Multiple Export Formats**
- Plain Text (TXT) - Clean, readable format
- Markdown (MD) - Perfect for note-taking
- Subtitles (SRT, VTT) - For video editing
- JSON - For developers and data analysis
- PDF - Print-ready documents

### 🔍 **Smart Search**
- Real-time search with highlighting
- Navigate through matches with keyboard shortcuts (Enter/Shift+Enter)
- Instant result counting

### ▶️ **Video Integration**
- **Click-to-Seek**: Click any timestamp to jump directly to that moment
- **Live Sync Mode**: Karaoke-style real-time tracking as the video plays
- Auto-refresh when navigating to new videos

### 🛠️ **Intelligent Tools**
- **Smart paragraph grouping** - Automatically formats transcript into readable paragraphs
- **Remove filler words** - Cleans up "um", "uh", "like", etc.
- **Clean formatting** - Removes [Music], [Applause], and other tags
- **Speaker detection** - Experimental feature to identify different speakers
- **Word cloud** - Visualize key topics using TF-IDF algorithm
- **Statistics** - Word count, reading time, video duration, speaking pace

### 🌍 **Multi-Language Support**
- Works with ANY language captions
- Auto-detects available transcripts
- Supports both auto-generated and manual captions
- Handles non-English videos (Hindi, Spanish, French, etc.)

### 🔒 **Privacy First**
- **No data collection** - Zero tracking or analytics
- **No external servers** - Everything runs locally
- **Open source** - Audit the code yourself
- **No ads** - 100% free forever

---

## 📸 Screenshots

<div align="center">

### Download Tab - Multiple Export Formats
![Download Tab](store-assets/store-screenshot-1-download-tab.png)

### Search Tab - Find Anything Instantly
![Search Tab](store-assets/store-screenshot-2-search-tab.png)

### Tools Tab - Analytics & Word Cloud
![Tools Tab](store-assets/store-screenshot-3-tools-tab.png)

</div>

---

## 🚀 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) *(Coming Soon)*
2. Click "Add to Chrome"
3. Done! The extension is ready to use

### From Source (For Developers)
```bash
# Clone the repository
git clone https://github.com/saurabhs051/transcript-pro-extension.git

# Navigate to chrome://extensions/ in Chrome
# Enable "Developer mode" (top right)
# Click "Load unpacked"
# Select the cloned folder
```

---

## 📖 How to Use

1. **Open any YouTube video** with available captions
2. **Click the TranscriptPro extension icon** in your browser toolbar
3. **The transcript loads automatically**
4. **Choose your action:**
   - 📥 Export in your preferred format
   - 🔍 Search for specific content
   - 🛠️ Analyze with word cloud and statistics
   - ▶️ Click timestamps to navigate the video
   - 🎯 Enable Live Sync for karaoke-style tracking

---

## 🎯 Perfect For

- 📚 **Students** - Take notes from lectures and educational videos
- 🎬 **Content Creators** - Repurpose video content into blog posts, social media
- 🔬 **Researchers** - Analyze video content and extract insights
- ♿ **Accessibility** - Make video content more accessible
- 🌐 **Translators** - Extract text for translation work
- 📝 **SEO** - Optimize video content for search engines
- 📖 **Writers** - Create articles from video interviews

---

## 🏗️ Tech Stack

- **Manifest V3** - Latest Chrome extension standard
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **Chrome APIs** - tabs, scripting, storage
- **YouTube Internal APIs** - For reliable transcript fetching
- **TF-IDF Algorithm** - For intelligent word cloud generation

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Development Setup

```bash
# Clone the repo
git clone https://github.com/saurabhs051/transcript-pro-extension.git
cd transcript-pro-extension

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this directory
```

### Code Structure

```
transcript-pro-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Main logic (transcript fetching, processing)
├── background.js         # Background service worker
├── content.js            # Content script for YouTube pages
├── icons/                # Extension icons
└── store-assets/         # Chrome Web Store assets
```

---

## 🐛 Bug Reports & Feature Requests

Found a bug or have an idea? [Open an issue](https://github.com/saurabhs051/transcript-pro-extension/issues)!

**When reporting bugs, please include:**
- Chrome version
- Extension version
- YouTube video URL (if applicable)
- Steps to reproduce
- Expected vs actual behavior

---

## 📋 Roadmap

- [x] Multiple export formats
- [x] Real-time search
- [x] Click-to-seek functionality
- [x] Live sync mode
- [x] Word cloud generation
- [x] Speaker detection
- [x] Multi-language support
- [ ] Batch playlist download
- [ ] Custom export templates
- [ ] Browser storage for transcripts
- [ ] Firefox support
- [ ] Edge support
- [ ] Translation integration

---

## 🔐 Privacy Policy

TranscriptPro respects your privacy:

- ❌ **No data collection** - We don't collect, store, or transmit any personal data
- ❌ **No tracking** - No analytics, cookies, or identifiers
- ❌ **No external servers** - All processing happens locally in your browser
- ✅ **Open source** - Audit the code yourself

The only data stored is your formatting preferences (timestamps on/off, etc.) in your browser's local storage.

Read our full [Privacy Policy](PRIVACY.md).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💖 Support

If you find this extension helpful:

- ⭐ **Star this repository**
- 🐦 **Share on Twitter**
- 🔗 **Tell your friends**
- 🐛 **Report bugs**
- 💡 **Suggest features**

---

## 👨‍💻 Author

**Saurabh Kumar Singh** ([@saurabhs051](https://github.com/saurabhs051))

---

## 🙏 Acknowledgments

- YouTube for providing transcript APIs
- The Chrome Extensions community
- All contributors and users

---

<div align="center">

**[⬆ back to top](#-transcriptpro---youtube-transcript-downloader)**

Made with ❤️ for creators & learners

</div>

