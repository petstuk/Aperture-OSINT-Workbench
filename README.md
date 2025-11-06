# SOC OSINT Search Extension

A modern, unified browser extension that allows security professionals to quickly search for indicators of compromise (IoCs) across popular OSINT (Open Source Intelligence) tools with a sleek cyber aesthetic.

## 🚀 Features

### **Core Functionality**
- **Right-click Context Menu Integration** - Select any IoC and search across multiple OSINT tools
- **Unified Extension** - Single codebase that works on both Chrome and Firefox
- **Modern Cyber UI** - Dark-themed interface with gradient accents and smooth animations
- **Cross-Browser Compatible** - Works seamlessly on both Chrome/Chromium and Firefox

### **🎯 Custom Combinations**
Create your own multi-tool searches for one-click analysis:
- Combine 2+ tools into custom shortcuts (e.g., "IP Investigator")
- Appears at the top of context menu with ⚡ icon
- Opens all selected tools simultaneously
- Perfect for SOC analysts with favorite tool combinations

### **📊 Enhanced Analysis Archive Dashboard**
- **Recent Analysis** - Last 5 IoCs displayed in popup for quick access
- **Full Archive** - Beautiful triage dashboard with all historical searches
- **Multi-Filter System** - Filter by IoC type (IP, Domain, Hash, URL) AND status
- **Status Tagging** - Mark entries as Unknown, Benign, Suspicious, Malicious, or Under Review
- **Notes & Annotations** - Add multi-line notes to any IoC with persistent storage
- **Smart Search** - Search across IoCs and notes in real-time
- **View Modes** - Toggle between expanded and compact views
- **Service Icons** - Visual indicators showing which tools were used
- **Re-analyze** - Quickly re-run searches with all original tools
- **Export Functionality** - Download archives as JSON or CSV
- **Statistics Dashboard** - Track total analyses, unique IoCs, malicious findings, and items under review

### **🛠️ Supported OSINT Services**
- VirusTotal
- AbuseIPDB
- URLScan
- Shodan
- Censys
- AlienVault OTX
- ThreatCrowd
- IBM X-Force Exchange
- MalwareBazaar
- GreyNoise
- Spur

### **🔍 Intelligent IoC Detection**
Automatically detects and analyzes:
- IPv4 and IPv6 addresses
- Domain names
- MD5, SHA1, SHA256 hashes
- URLs

## 📦 Installation

### Firefox

#### Method 1: Temporary Installation (Development/Testing)
1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the sidebar
3. Click "Load Temporary Add-on"
4. Navigate to the extension directory and select `manifest.json`

#### Method 2: Official Add-on Store (Coming Soon)
Will be available on the Firefox Browser Add-ons Store

### Chrome

#### Temporary Installation (Development/Testing)
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension directory

## 🎨 User Interface

### **Popup**
- **Dark cyber-themed** interface with gradient accents
- **Recent Analysis** section showing last 5 searches
- **Service Toggles** - Enable/disable individual OSINT tools
- **Custom Combinations** - Create and manage multi-tool shortcuts
- **Smooth scrolling** with custom styled scrollbar

### **Archive Page**
- **Animated grid background** for cyber aesthetic
- **Statistics cards** showing analysis metrics
- **Filter buttons** for IoC types
- **Professional table** with hover effects
- **Glassmorphism design** with backdrop blur

## 💡 Usage

### Basic Search
1. **Select text** on any webpage (IP address, domain, hash, URL)
2. **Right-click** to open the context menu
3. **Navigate to "SOC OSINT Search"**
4. **Select your preferred OSINT service**
5. A new tab will open with the search results

### Custom Combinations
1. **Open the extension popup**
2. **Scroll to "Custom Combinations"**
3. **Click "+ New Combination"**
4. **Enter a name** (e.g., "IP Investigator")
5. **Select 2 or more tools** (e.g., AbuseIPDB + VirusTotal)
6. **Click "Save"**
7. Your custom combination now appears in the context menu with a ⚡ icon

### View & Manage History
1. **Open the extension popup**
2. **View recent analyses** in the "Recent Analysis" section
3. **Click "View Full Archive"** to see all historical searches
4. **Filter by IoC type** using the Type filter buttons
5. **Filter by Status** using the Status filter buttons
6. **Search** using the search bar to find specific IoCs or notes
7. **Click status badges** to change verdict (Unknown/Benign/Suspicious/Malicious/Review)
8. **Add/Edit Notes** by clicking the note button on any entry
9. **Toggle View** between expanded and compact modes
10. **Click "Re-analyze"** to quickly re-run any search with all original tools
11. **Export data** as JSON or CSV for reporting or backup

### Check Storage Health
1. **Navigate to** `chrome-extension://[YOUR-EXTENSION-ID]/check-storage.html` (Chrome)
   - Or `moz-extension://[YOUR-EXTENSION-ID]/check-storage.html` (Firefox)
2. **View storage quota usage** and percentage
3. **Check entry counts** and average sizes
4. **Test write operations** to verify storage is working
5. **Export full data** for backup if needed
6. The page will warn you if storage is over 75% full

## 🏗️ Technical Details

### Architecture
- **Manifest v2** for cross-browser compatibility
- **Background Script** - Handles context menus and storage
- **Popup Script** - Manages UI and user interactions
- **Archive Script** - Handles history display and filtering
- **External Scripts** - All JavaScript is in separate files (CSP compliant)

### Storage
- **browser.storage.sync** for cross-device synchronization (100KB quota limit)
- **Automatic Storage Rotation** - When storage quota is reached, oldest entries are automatically removed
- Stores:
  - Enabled services configuration
  - Custom combinations
  - Analysis history (dynamically sized based on storage quota)
  - IoC status verdicts (Unknown, Benign, Suspicious, Malicious, Review)
  - User notes and annotations per IoC
  - Tools used per analysis for accurate re-runs

### Browser API Compatibility
- **Polyfill layer** handles Chrome/Firefox API differences
- Automatic detection of callback vs promise-based APIs
- Graceful fallbacks for unsupported features

## 🎯 Browser Compatibility

- **Chrome/Chromium**: Version 88 or higher
- **Firefox**: Version 78.0 or higher
- **Edge**: Chromium-based versions

## 🛠️ Development

### Setup
```bash
git clone https://github.com/petstuk/OSINTExtension.git
cd OSINTExtension
```

### File Structure
```
├── manifest.json          # Extension manifest (Manifest v2)
├── background.js          # Background script
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── archive.html           # History archive page
├── archive.js             # Archive page logic
├── icon512.png            # Extension icon
└── README.md              # This file
```

### Testing
1. Load the extension in Firefox using `about:debugging`
2. Open `test-history.html` in a browser tab
3. Right-click on various IoCs to test functionality
4. Check browser console for debug logs

### Debug Tools
- **check-storage.html** - Comprehensive storage diagnostics tool
  - Shows real-time storage quota usage
  - Displays entry counts and average sizes
  - Tests write operations for quota issues
  - Exports full data for backup
- **debug-storage.html** - Tool for inspecting extension storage
- Console logging throughout for troubleshooting
- All API calls include error handling and logging

## 🎨 Design Philosophy

- **Cyber Aesthetic** - Dark themes, gradient accents, smooth animations
- **Professional** - Clean, modern interface suitable for SOC environments
- **Efficient** - Minimal clicks to perform common tasks
- **Customizable** - Users can create their own workflows
- **Responsive** - Works well at different screen sizes

## 📝 Changelog

### Latest Version (v2.2 - Smart Storage Management)
- ✅ **Automatic Storage Rotation** - Intelligently removes oldest entries when quota limit is reached
- ✅ **Smart Quota Detection** - Detects and handles Chrome storage quota errors gracefully
- ✅ **Storage Diagnostics Tool** - New check-storage.html page for monitoring storage health
- ✅ **Improved Error Handling** - Better logging and error recovery for storage operations
- ✅ **No Hard Limits** - Removed arbitrary 100-entry limit; now dynamically adapts to storage

### Previous Version (v2.1 - Archive Dashboard Enhancement)
- ✅ **Status Tagging System** - 5-state verdict system (Unknown/Benign/Suspicious/Malicious/Review)
- ✅ **Notes & Annotations** - Multi-line, timestamped notes per IoC
- ✅ **Multi-Dimensional Filtering** - Filter by both Type AND Status simultaneously
- ✅ **Real-Time Search** - Search across IoCs and notes instantly
- ✅ **Service Icons** - Visual indicators for tools used in each analysis
- ✅ **View Modes** - Compact and Expanded view options
- ✅ **Export Functionality** - Download as JSON or CSV for reporting
- ✅ **Enhanced Re-analyze** - Re-runs with exact subset of services originally used
- ✅ **Enhanced Statistics** - Added Unique IoCs, Malicious count, Under Review count
- ✅ **Data Migration** - Automatic backward-compatible upgrade of history format

### Previous Versions
- ✅ Unified Chrome/Firefox extension
- ✅ Modern cyber-themed UI
- ✅ Custom combinations feature
- ✅ Full history tracking with archive
- ✅ IoC type detection (IPv4, IPv6, hashes, domains, URLs)
- ✅ Statistics dashboard
- ✅ Custom styled confirmation modals
- ✅ Smooth animations and transitions

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test in both Chrome and Firefox
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature-name`
7. Open a Pull Request

## 📄 License

[MIT License](LICENSE)

## ⚠️ Disclaimer

This tool is meant for legitimate security research and incident response. Always ensure you are complying with:
- Terms of service for each OSINT platform
- Your organization's security policies
- Applicable laws and regulations

## 🙏 Acknowledgments

- Inspired by the needs of SOC analysts and security researchers
- UI design influenced by modern cyber security platforms
- Built with security professionals in mind

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Include browser version and console logs when reporting bugs

---

**Made with ❤️ for the security community**
