// Browser API compatibility
const browserAPI = (() => {
  if (typeof browser !== 'undefined') {
    return browser;
  } else if (typeof chrome !== 'undefined') {
    return chrome;
  }
  return null;
})();

// Debug logging
console.log('Archive page loaded, browserAPI:', browserAPI);

let allHistory = [];
let currentTypeFilter = localStorage.getItem('preferredTypeFilter') || 'all';
let currentStatusFilter = localStorage.getItem('preferredStatusFilter') || 'all';
let currentSearchQuery = '';
let currentView = localStorage.getItem('preferredView') || 'expanded';
let currentEditingIndex = null;

// Service icon mapping
const serviceIcons = {
  'VirusTotal': '🧬',
  'AbuseIPDB': '🚫',
  'URLScan': '🔍',
  'Shodan': '🌐',
  'Censys': '🔎',
  'AlienVault OTX': '👽',
  'ThreatCrowd': '👥',
  'IBM X-Force Exchange': '💼',
  'MalwareBazaar': '🦠',
  'GreyNoise': '📡',
  'Spur': '🎯'
};

// Status emoji mapping
const statusEmojis = {
  'unknown': '❔',
  'benign': '✅',
  'suspicious': '⚠️',
  'malicious': '🚨',
  'review': '📝'
};

// Migrate old history to new format with notes and status
function migrateHistoryData(history) {
  return history.map(item => {
    if (!item.notes) item.notes = '';
    if (!item.status) item.status = 'unknown';
    if (!item.toolsUsed) {
      // Convert single tool to array format
      item.toolsUsed = item.tool ? [item.tool] : [];
    }
    
    // Fix custom combinations that have wrong toolsUsed
    // If toolsUsed contains only the combination name, try to get actual tools
    if (item.toolsUsed.length === 1 && item.toolsUsed[0] === item.tool) {
      // Check if this looks like a custom combination (not in standard services)
      const standardServices = [
        "VirusTotal", "AbuseIPDB", "URLScan", "Shodan", "Censys",
        "AlienVault OTX", "ThreatCrowd", "IBM X-Force Exchange",
        "MalwareBazaar", "GreyNoise", "Spur"
      ];
      
      if (!standardServices.includes(item.tool)) {
        // This is likely a custom combination, but we can't recover the actual tools
        // Keep it as is but mark it for user awareness
        console.log(`Note: Custom combination "${item.tool}" found without actual tools list`);
      }
    }
    
    return item;
  });
}

// Load and display full history
function loadHistory() {
  console.log('Archive: Loading history...');
  
  if (!browserAPI) {
    console.error('Archive: Browser API not available');
    const container = document.getElementById('history-container');
    if (container) {
      container.innerHTML = '<div class="empty-state">Error: Browser API not available. This page must be opened from the extension.</div>';
    }
    return;
  }
  
  // Handle both Chrome (callback) and Firefox (promise) APIs
  try {
    const getMethod = browserAPI.storage.sync.get;
    
    if (getMethod.length > 1) {
      // Chrome-style callback API
      browserAPI.storage.sync.get('iocHistory', function(data) {
        console.log('Archive Chrome API - Raw data received:', data);
        allHistory = migrateHistoryData(data.iocHistory || []);
        console.log('Archive Chrome API - allHistory length:', allHistory.length);
        displayStats();
        displayHistory();
      });
    } else {
      // Firefox-style promise API
      browserAPI.storage.sync.get('iocHistory').then(function(data) {
        console.log('Archive Firefox API - Raw data received:', data);
        allHistory = migrateHistoryData(data.iocHistory || []);
        console.log('Archive Firefox API - allHistory length:', allHistory.length);
        displayStats();
        displayHistory();
      }).catch(error => {
        console.error("Archive: Error loading history:", error);
        const container = document.getElementById('history-container');
        if (container) {
          container.innerHTML = '<div class="empty-state">Error loading history: ' + error.message + '</div>';
        }
      });
    }
  } catch (error) {
    console.error('Archive: Exception in loadHistory:', error);
    const container = document.getElementById('history-container');
    if (container) {
      container.innerHTML = '<div class="empty-state">Exception: ' + error.message + '</div>';
    }
  }
}

// Save history to storage
function saveHistory() {
  if (browserAPI.storage.sync.set.length > 1) {
    // Chrome-style callback API
    browserAPI.storage.sync.set({ 'iocHistory': allHistory }, function() {
      console.log('History saved successfully');
    });
  } else {
    // Firefox-style promise API
    browserAPI.storage.sync.set({ 'iocHistory': allHistory }).then(() => {
      console.log('History saved successfully');
    }).catch(error => {
      console.error('Error saving history:', error);
    });
  }
}

// Display statistics
function displayStats() {
  const statsContainer = document.getElementById('stats-container');
  const totalAnalyses = allHistory.length;
  
  if (totalAnalyses === 0) {
    statsContainer.innerHTML = `
      <div class="stat-item">
        <div class="stat-number">0</div>
        <div class="stat-label">Total Analyses</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">0</div>
        <div class="stat-label">Unique IoCs</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">0</div>
        <div class="stat-label">Malicious</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">0</div>
        <div class="stat-label">Under Review</div>
      </div>
    `;
    return;
  }
  
  const uniqueIocs = new Set(allHistory.map(item => item.ioc)).size;
  const maliciousCount = allHistory.filter(item => item.status === 'malicious').length;
  const reviewCount = allHistory.filter(item => item.status === 'review').length;
  
  statsContainer.innerHTML = `
    <div class="stat-item">
      <div class="stat-number">${totalAnalyses}</div>
      <div class="stat-label">Total Analyses</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${uniqueIocs}</div>
      <div class="stat-label">Unique IoCs</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${maliciousCount}</div>
      <div class="stat-label">Malicious</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${reviewCount}</div>
      <div class="stat-label">Under Review</div>
    </div>
  `;
}

// Filter and search history
function getFilteredHistory() {
  let filtered = allHistory;
  
  // Apply type filter
  if (currentTypeFilter !== 'all') {
    filtered = filtered.filter(item => item.type === currentTypeFilter);
  }
  
  // Apply status filter
  if (currentStatusFilter !== 'all') {
    filtered = filtered.filter(item => item.status === currentStatusFilter);
  }
  
  // Apply search query
  if (currentSearchQuery.trim()) {
    const query = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(item => 
      item.ioc.toLowerCase().includes(query) ||
      (item.notes && item.notes.toLowerCase().includes(query))
    );
  }
  
  return filtered;
}

// Display history table
function displayHistory() {
  console.log('Archive: Displaying history');
  const container = document.getElementById('history-container');
  
  if (!container) {
    console.error('Archive: history-container element not found!');
    return;
  }
  
  if (allHistory.length === 0) {
    console.log('Archive: No history to display');
    container.innerHTML = '<div class="empty-state">No analysis history found</div>';
    return;
  }
  
  const filteredHistory = getFilteredHistory();
  
  if (filteredHistory.length === 0) {
    container.innerHTML = '<div class="empty-state">No items match the current filters</div>';
    return;
  }
  
  const viewClass = currentView === 'compact' ? 'compact-view' : '';
  
  // Different headers for compact vs expanded view
  const headers = currentView === 'compact' 
    ? `<tr>
        <th>IoC</th>
        <th>Type</th>
        <th>Tools</th>
        <th>Date</th>
        <th>Actions</th>
      </tr>`
    : `<tr>
        <th>IoC</th>
        <th>Type</th>
        <th>Status</th>
        <th>Tools Used</th>
        <th>Notes</th>
        <th>Date</th>
        <th>Actions</th>
      </tr>`;
  
  let tableHTML = `
    <table class="history-table ${viewClass}">
      <thead>
        ${headers}
      </thead>
      <tbody>
  `;
  
  filteredHistory.forEach((item, originalIndex) => {
    const typeColor = getTypeColor(item.type);
    const safeIoc = escapeHtml(item.ioc);
    const actualIndex = allHistory.indexOf(item);
    
    // Generate tools icons/badges
    const toolsHtml = generateToolsDisplay(item);
    
    // Generate status badge (only in expanded view)
    const statusHtml = currentView === 'expanded'
      ? `<td>${generateStatusBadge(item.status, actualIndex)}</td>`
      : '';
    
    // Generate notes display (only in expanded view)
    const notesHtml = currentView === 'expanded' 
      ? `<td class="notes-cell">${generateNotesDisplay(item.notes, actualIndex)}</td>`
      : '';
    
    tableHTML += `
      <tr data-index="${actualIndex}">
        <td class="ioc-cell" title="${safeIoc}">${safeIoc}</td>
        <td><span class="type-badge" style="background: ${typeColor};">${item.type}</span></td>
        ${statusHtml}
        <td>${toolsHtml}</td>
        ${notesHtml}
        <td class="date-cell">${item.date}</td>
        <td>
          <button class="action-btn reanalyze-btn" data-index="${actualIndex}" title="Re-analyze this IoC">
            Re-analyze
          </button>
        </td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  container.innerHTML = tableHTML;
  
  // Add event listeners
  attachEventListeners();
}

// Generate tools display with icons
function generateToolsDisplay(item) {
  const tools = item.toolsUsed || [item.tool];
  if (!tools || tools.length === 0) return '<span class="tool-cell">-</span>';
  
  return `
    <div class="service-icons">
      ${tools.map(tool => {
        const icon = serviceIcons[tool] || '🔧';
        return `<span class="service-icon" title="${escapeHtml(tool)}">${icon}</span>`;
      }).join('')}
    </div>
  `;
}


// Generate status badge with dropdown
function generateStatusBadge(status, index) {
  const emoji = statusEmojis[status] || '❔';
  return `
    <div class="status-dropdown">
      <span class="status-badge status-${status}" data-index="${index}">
        ${emoji} ${status}
      </span>
    </div>
  `;
}

// Generate notes display
function generateNotesDisplay(notes, index) {
  if (!notes || notes.trim() === '') {
    return `
      <div>
        <div class="notes-empty">No notes</div>
        <button class="notes-edit-btn" data-index="${index}">Add Note</button>
      </div>
    `;
  }
  
  return `
    <div>
      <div class="notes-content" title="${escapeHtml(notes)}">${escapeHtml(notes)}</div>
      <button class="notes-edit-btn" data-index="${index}">Edit</button>
    </div>
  `;
}

// Attach event listeners to dynamic elements
function attachEventListeners() {
  // Status badge click handlers
  document.querySelectorAll('.status-badge').forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const index = this.getAttribute('data-index');
      toggleStatusDropdown(index);
    });
  });
  
  // Status option click handlers
  document.querySelectorAll('.status-option').forEach(option => {
    option.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      const status = this.getAttribute('data-status');
      updateStatus(index, status);
    });
  });
  
  // Notes edit button handlers
  document.querySelectorAll('.notes-edit-btn').forEach(button => {
    button.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      openNotesModal(index);
    });
  });
  
  // Re-analyze button handlers
  document.querySelectorAll('.reanalyze-btn').forEach(button => {
    button.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      reanalyzeIoc(index);
    });
  });
}

// Toggle status dropdown
function toggleStatusDropdown(index) {
  const badge = document.querySelector(`.status-badge[data-index="${index}"]`);
  const dropdown = badge ? badge.closest('.status-dropdown') : null;
  const row = badge ? badge.closest('tr') : null;
  
  if (!badge) return;
  
  // Check if dropdown menu already exists
  let menu = document.getElementById(`status-menu-${index}`);
  const isCurrentlyOpen = menu && menu.classList.contains('show');
  
  // Close all other dropdowns and remove active classes
  document.querySelectorAll('.status-dropdown-menu').forEach(m => {
    m.remove(); // Remove instead of just hiding
  });
  document.querySelectorAll('.status-dropdown').forEach(dd => {
    dd.classList.remove('active');
  });
  document.querySelectorAll('.history-table tbody tr').forEach(tr => {
    tr.classList.remove('dropdown-active');
  });
  
  // If it wasn't open, create and open it now
  if (!isCurrentlyOpen) {
    // Create the dropdown menu
    menu = document.createElement('div');
    menu.className = 'status-dropdown-menu';
    menu.id = `status-menu-${index}`;
    menu.innerHTML = `
      <div class="status-option" data-status="unknown" data-index="${index}">❔ Unknown</div>
      <div class="status-option" data-status="benign" data-index="${index}">✅ Benign</div>
      <div class="status-option" data-status="suspicious" data-index="${index}">⚠️ Suspicious</div>
      <div class="status-option" data-status="malicious" data-index="${index}">🚨 Malicious</div>
      <div class="status-option" data-status="review" data-index="${index}">📝 Review</div>
    `;
    
    // Add event listeners to the new options
    menu.querySelectorAll('.status-option').forEach(option => {
      option.addEventListener('click', function() {
        const idx = parseInt(this.getAttribute('data-index'));
        const status = this.getAttribute('data-status');
        updateStatus(idx, status);
      });
    });
    
    // Append to body for fixed positioning
    document.body.appendChild(menu);
    
    // Get badge position relative to viewport
    const rect = badge.getBoundingClientRect();
    
    // Position the menu directly below the badge
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    
    // Show menu and add active classes
    setTimeout(() => menu.classList.add('show'), 10); // Small delay for animation
    if (dropdown) dropdown.classList.add('active');
    if (row) row.classList.add('dropdown-active');
  }
}

// Close all dropdowns when clicking outside
document.addEventListener('click', function(e) {
  // Close status dropdowns
  if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-dropdown-menu')) {
    document.querySelectorAll('.status-dropdown-menu').forEach(menu => {
      menu.remove();
    });
    document.querySelectorAll('.status-dropdown').forEach(dd => {
      dd.classList.remove('active');
    });
    document.querySelectorAll('.history-table tbody tr').forEach(tr => {
      tr.classList.remove('dropdown-active');
    });
  }
  
  // Close filter dropdowns
  if (!e.target.closest('.filter-dropdown')) {
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
      dropdown.classList.remove('open');
      const menu = dropdown.querySelector('.filter-dropdown-menu');
      if (menu) menu.classList.remove('show');
    });
  }
});

// Update status
function updateStatus(index, newStatus) {
  if (allHistory[index]) {
    allHistory[index].status = newStatus;
    
    // Close all dropdowns
    document.querySelectorAll('.status-dropdown-menu').forEach(menu => {
      menu.remove();
    });
    document.querySelectorAll('.status-dropdown').forEach(dd => {
      dd.classList.remove('active');
    });
    document.querySelectorAll('.history-table tbody tr').forEach(tr => {
      tr.classList.remove('dropdown-active');
    });
    
    saveHistory();
    displayStats();
    displayHistory();
  }
}

// Open notes modal
function openNotesModal(index) {
  currentEditingIndex = index;
  const modal = document.getElementById('notes-modal');
  const textarea = document.getElementById('notes-textarea');
  
  if (allHistory[index]) {
    textarea.value = allHistory[index].notes || '';
  }
  
  modal.classList.add('show');
  textarea.focus();
}

// Close notes modal
function closeNotesModal() {
  const modal = document.getElementById('notes-modal');
  modal.classList.remove('show');
  currentEditingIndex = null;
}

// Save notes
function saveNotes() {
  if (currentEditingIndex !== null && allHistory[currentEditingIndex]) {
    const textarea = document.getElementById('notes-textarea');
    allHistory[currentEditingIndex].notes = textarea.value;
    saveHistory();
    displayHistory();
    closeNotesModal();
  }
}

// Re-analyze IoC
function reanalyzeIoc(index) {
  const item = allHistory[index];
  if (!item) return;
  
  const ioc = item.ioc;
  let tools = item.toolsUsed || [item.tool];
  
  console.log('Reanalyzing IoC:', ioc, 'with tools:', tools);
  
  const serviceUrls = {
    "VirusTotal": "https://www.virustotal.com/gui/search/[QUERY]",
    "AbuseIPDB": "https://www.abuseipdb.com/check/[QUERY]",
    "URLScan": "https://urlscan.io/search/#[QUERY]",
    "Shodan": "https://www.shodan.io/search?query=[QUERY]",
    "Censys": "https://search.censys.io/search?q=[QUERY]",
    "AlienVault OTX": "https://otx.alienvault.com/browse/pulses?q=[QUERY]",
    "ThreatCrowd": "https://threatcrowd.org/ip.php?ip=[QUERY]",
    "IBM X-Force Exchange": "https://exchange.xforce.ibmcloud.com/search/[QUERY]",
    "MalwareBazaar": "https://bazaar.abuse.ch/browse.php?search=[QUERY]",
    "GreyNoise": "https://viz.greynoise.io/query/?gnql=[QUERY]",
    "Spur": "https://app.spur.us/search?q=[QUERY]"
  };
  
  // Check if tools array contains only a custom combination name
  if (tools.length === 1 && !serviceUrls[tools[0]]) {
    // This might be a custom combination that wasn't stored properly
    // Try to load the actual combination
    if (browserAPI.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browserAPI.storage.sync.get('customCombinations', function(data) {
        const combinations = data.customCombinations || [];
        const combo = combinations.find(c => c.name === tools[0]);
        
        if (combo && combo.tools) {
          // Use the actual tools from the combination
          combo.tools.forEach(tool => {
            if (serviceUrls[tool]) {
              const url = serviceUrls[tool].replace("[QUERY]", encodeURIComponent(ioc));
              browserAPI.tabs.create({ url: url });
            }
          });
        } else {
          // Fallback: open each tool that exists
          tools.forEach(tool => {
            if (serviceUrls[tool]) {
              const url = serviceUrls[tool].replace("[QUERY]", encodeURIComponent(ioc));
              browserAPI.tabs.create({ url: url });
            }
          });
        }
      });
    } else {
      // Firefox-style promise API
      browserAPI.storage.sync.get('customCombinations').then(function(data) {
        const combinations = data.customCombinations || [];
        const combo = combinations.find(c => c.name === tools[0]);
        
        if (combo && combo.tools) {
          // Use the actual tools from the combination
          combo.tools.forEach(tool => {
            if (serviceUrls[tool]) {
              const url = serviceUrls[tool].replace("[QUERY]", encodeURIComponent(ioc));
              browserAPI.tabs.create({ url: url });
            }
          });
        } else {
          // Fallback: open each tool that exists
          tools.forEach(tool => {
            if (serviceUrls[tool]) {
              const url = serviceUrls[tool].replace("[QUERY]", encodeURIComponent(ioc));
              browserAPI.tabs.create({ url: url });
            }
          });
        }
      });
    }
  } else {
    // Normal case: open tabs for each tool
    tools.forEach(tool => {
      if (serviceUrls[tool]) {
        const url = serviceUrls[tool].replace("[QUERY]", encodeURIComponent(ioc));
        
        if (browserAPI.tabs.create.length > 1) {
          // Chrome-style callback API
          browserAPI.tabs.create({ url: url });
        } else {
          // Firefox-style promise API
          browserAPI.tabs.create({ url: url });
        }
      }
    });
  }
}

// Filter by type
function filterByType(type, optionElement) {
  currentTypeFilter = type;
  
  // Save preference to localStorage
  localStorage.setItem('preferredTypeFilter', type);
  
  // Update selected option
  document.querySelectorAll('#type-filter-menu .filter-option').forEach(opt => opt.classList.remove('selected'));
  if (optionElement) {
    optionElement.classList.add('selected');
  }
  
  // Update button label
  const label = document.getElementById('type-filter-label');
  if (label) {
    label.textContent = optionElement ? optionElement.textContent : 'All Types';
  }
  
  // Close dropdown
  closeFilterDropdown('type-filter-dropdown');
  
  displayHistory();
}

// Filter by status
function filterByStatus(status, optionElement) {
  currentStatusFilter = status;
  
  // Save preference to localStorage
  localStorage.setItem('preferredStatusFilter', status);
  
  // Update selected option
  document.querySelectorAll('#status-filter-menu .filter-option').forEach(opt => opt.classList.remove('selected'));
  if (optionElement) {
    optionElement.classList.add('selected');
  }
  
  // Update button label
  const label = document.getElementById('status-filter-label');
  if (label) {
    label.textContent = optionElement ? optionElement.textContent : 'All Statuses';
  }
  
  // Close dropdown
  closeFilterDropdown('status-filter-dropdown');
  
  displayHistory();
}

// Toggle filter dropdown
function toggleFilterDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  const menu = dropdown.querySelector('.filter-dropdown-menu');
  
  // Close all other dropdowns
  document.querySelectorAll('.filter-dropdown').forEach(dd => {
    if (dd.id !== dropdownId) {
      dd.classList.remove('open');
      const otherMenu = dd.querySelector('.filter-dropdown-menu');
      if (otherMenu) otherMenu.classList.remove('show');
    }
  });
  
  // Close all status dropdowns and remove active classes
  document.querySelectorAll('.status-dropdown-menu').forEach(menu => {
    menu.remove();
  });
  document.querySelectorAll('.status-dropdown').forEach(dd => {
    dd.classList.remove('active');
  });
  document.querySelectorAll('.history-table tbody tr').forEach(tr => {
    tr.classList.remove('dropdown-active');
  });
  
  // Toggle current dropdown
  dropdown.classList.toggle('open');
  menu.classList.toggle('show');
}

// Close filter dropdown
function closeFilterDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.classList.remove('open');
    const menu = dropdown.querySelector('.filter-dropdown-menu');
    if (menu) menu.classList.remove('show');
  }
}

// Handle search
function handleSearch() {
  const searchInput = document.getElementById('search-input');
  currentSearchQuery = searchInput.value;
  
  // Close any open status dropdowns
  document.querySelectorAll('.status-dropdown-menu').forEach(menu => {
    menu.remove();
  });
  document.querySelectorAll('.status-dropdown').forEach(dd => {
    dd.classList.remove('active');
  });
  document.querySelectorAll('.history-table tbody tr').forEach(tr => {
    tr.classList.remove('dropdown-active');
  });
  
  displayHistory();
}

// Toggle view mode
function toggleViewMode(mode) {
  currentView = mode;
  
  // Save preference to localStorage
  localStorage.setItem('preferredView', mode);
  
  // Update active button
  document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.classList.remove('active'));
  if (mode === 'expanded') {
    document.getElementById('view-expanded').classList.add('active');
  } else {
    document.getElementById('view-compact').classList.add('active');
  }
  
  // Close any open status dropdowns
  document.querySelectorAll('.status-dropdown-menu').forEach(menu => {
    menu.remove();
  });
  document.querySelectorAll('.status-dropdown').forEach(dd => {
    dd.classList.remove('active');
  });
  document.querySelectorAll('.history-table tbody tr').forEach(tr => {
    tr.classList.remove('dropdown-active');
  });
  
  displayHistory();
}

// Get type color
function getTypeColor(type) {
  const colors = {
    'ip': '#dc3545',
    'hash': '#6f42c1', 
    'domain': '#007bff',
    'url': '#28a745',
    'unknown': '#6c757d'
  };
  return colors[type] || colors.unknown;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export to JSON
function exportToJSON() {
  const dataStr = JSON.stringify(allHistory, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `osint-archive-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to CSV
function exportToCSV() {
  const headers = ['IoC', 'Type', 'Status', 'Tools Used', 'Notes', 'Date', 'Timestamp'];
  const rows = allHistory.map(item => [
    `"${(item.ioc || '').replace(/"/g, '""')}"`,
    `"${(item.type || '').replace(/"/g, '""')}"`,
    `"${(item.status || 'unknown').replace(/"/g, '""')}"`,
    `"${((item.toolsUsed || [item.tool]).join(', ')).replace(/"/g, '""')}"`,
    `"${(item.notes || '').replace(/"/g, '""')}"`,
    `"${(item.date || '').replace(/"/g, '""')}"`,
    item.timestamp || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `osint-archive-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Clear all history
function clearHistory() {
  if (confirm('Are you sure you want to clear all analysis history? This cannot be undone.')) {
    if (browserAPI.storage.sync.set.length > 1) {
      // Chrome-style callback API
      browserAPI.storage.sync.set({ 'iocHistory': [] }, function() {
        allHistory = [];
        displayStats();
        displayHistory();
      });
    } else {
      // Firefox-style promise API
      browserAPI.storage.sync.set({ 'iocHistory': [] }).then(() => {
        allHistory = [];
        displayStats();
        displayHistory();
      });
    }
  }
}

// Close status dropdowns on scroll
window.addEventListener('scroll', function() {
  document.querySelectorAll('.status-dropdown-menu').forEach(menu => {
    menu.remove();
  });
  document.querySelectorAll('.status-dropdown').forEach(dd => {
    dd.classList.remove('active');
  });
  document.querySelectorAll('.history-table tbody tr').forEach(tr => {
    tr.classList.remove('dropdown-active');
  });
}, true);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Archive: DOMContentLoaded event fired');
  
  // Clear history button
  const clearBtn = document.getElementById('clear-history-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearHistory);
  }
  
  // Export buttons
  const exportJsonBtn = document.getElementById('export-json-btn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', exportToJSON);
  }
  
  const exportCsvBtn = document.getElementById('export-csv-btn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportToCSV);
  }
  
  // Type filter dropdown
  const typeFilterBtn = document.getElementById('type-filter-btn');
  if (typeFilterBtn) {
    typeFilterBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFilterDropdown('type-filter-dropdown');
    });
  }
  
  // Type filter options
  document.querySelectorAll('#type-filter-menu .filter-option').forEach(option => {
    option.addEventListener('click', function() {
      const filterType = this.getAttribute('data-filter');
      filterByType(filterType, this);
    });
    
    // Set initial selected state based on saved preference
    if (option.getAttribute('data-filter') === currentTypeFilter) {
      option.classList.add('selected');
      const label = document.getElementById('type-filter-label');
      if (label) {
        label.textContent = option.textContent;
      }
    }
  });
  
  // Status filter dropdown
  const statusFilterBtn = document.getElementById('status-filter-btn');
  if (statusFilterBtn) {
    statusFilterBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFilterDropdown('status-filter-dropdown');
    });
  }
  
  // Status filter options
  document.querySelectorAll('#status-filter-menu .filter-option').forEach(option => {
    option.addEventListener('click', function() {
      const filterStatus = this.getAttribute('data-filter');
      filterByStatus(filterStatus, this);
    });
    
    // Set initial selected state based on saved preference
    if (option.getAttribute('data-filter') === currentStatusFilter) {
      option.classList.add('selected');
      const label = document.getElementById('status-filter-label');
      if (label) {
        label.textContent = option.textContent;
      }
    }
  });
  
  // View toggle buttons
  const viewExpandedBtn = document.getElementById('view-expanded');
  const viewCompactBtn = document.getElementById('view-compact');
  
  // Set initial active state based on saved preference
  if (currentView === 'compact') {
    viewExpandedBtn?.classList.remove('active');
    viewCompactBtn?.classList.add('active');
  } else {
    viewExpandedBtn?.classList.add('active');
    viewCompactBtn?.classList.remove('active');
  }
  
  if (viewExpandedBtn) {
    viewExpandedBtn.addEventListener('click', () => toggleViewMode('expanded'));
  }
  
  if (viewCompactBtn) {
    viewCompactBtn.addEventListener('click', () => toggleViewMode('compact'));
  }
  
  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  // Notes modal buttons
  const notesModalClose = document.getElementById('notes-modal-close');
  if (notesModalClose) {
    notesModalClose.addEventListener('click', closeNotesModal);
  }
  
  const notesCancelBtn = document.getElementById('notes-cancel-btn');
  if (notesCancelBtn) {
    notesCancelBtn.addEventListener('click', closeNotesModal);
  }
  
  const notesSaveBtn = document.getElementById('notes-save-btn');
  if (notesSaveBtn) {
    notesSaveBtn.addEventListener('click', saveNotes);
  }
  
  // Close modal on outside click
  const notesModal = document.getElementById('notes-modal');
  if (notesModal) {
    notesModal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeNotesModal();
      }
    });
  }
  
  // Load history data
  loadHistory();
});

