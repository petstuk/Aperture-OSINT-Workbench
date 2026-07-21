// Firefox compatibility polyfill (simplified version for this extension)
if (typeof browser === 'undefined') {
    var browser = chrome;
  }
  
  // Load and display recent history (last 5 items)
  function loadHistory() {
    console.log('Popup: Loading history...');
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.get('iocHistory', function(data) {
        console.log('Popup Chrome API - History data:', data);
        displayHistoryData(data.iocHistory || []);
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.get('iocHistory').then(function(data) {
        console.log('Popup Firefox API - History data:', data);
        displayHistoryData(data.iocHistory || []);
      }).catch(error => {
        console.error("Error loading history:", error);
      });
    }
  }
  
  function displayHistoryData(history) {
    console.log('Popup: Displaying history data:', history);
    const historyContainer = document.getElementById('history-container');
    
    if (history.length === 0) {
      historyContainer.innerHTML = '<div style="text-align: center; color: #999; font-size: 11px; padding: 10px;">No recent analysis</div>';
      return;
    }
    
    // Show last 5 items
    const recentHistory = history.slice(0, 5);
    historyContainer.innerHTML = '';
    
    recentHistory.forEach(function(item) {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      const timeAgo = getTimeAgo(item.timestamp);
      const typeColor = getTypeColor(item.type);
      
      const safeIoc = item.ioc.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const safeTool = item.tool.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      
      historyItem.innerHTML = `
        <div>
          <div class="history-ioc" title="${safeIoc}">${safeIoc}</div>
          <div class="history-meta">${timeAgo} via ${safeTool}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span class="history-type" style="background: ${typeColor};">${item.type}</span>
          <button class="history-rerun" data-ioc="${safeIoc}" data-tool="${safeTool}" title="Re-analyze">Run</button>
        </div>
      `;
      
      // Add click event listener to the button
      const button = historyItem.querySelector('.history-rerun');
      button.addEventListener('click', function() {
        const ioc = this.getAttribute('data-ioc');
        const tool = this.getAttribute('data-tool');
        rerunAnalysis(ioc, tool);
      });
      
      historyContainer.appendChild(historyItem);
    });
  }
  
  // Helper function to get time ago string
  function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
  
  // Helper function to get type color
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
  
  // Function to re-run analysis
  function rerunAnalysis(ioc, tool) {
    console.log('Popup: Rerunning analysis for:', ioc, 'with tool:', tool);
    
    // Service URLs (same as in background.js)
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
    
    // Check if it's a regular service
    if (serviceUrls[tool]) {
      const url = serviceUrls[tool].replace("[QUERY]", encodeURIComponent(ioc));
      console.log('Popup: Opening URL:', url);
      
      // Handle both Chrome (callback) and Firefox (promise) APIs
      if (browser.tabs.create.length > 1) {
        // Chrome-style callback API
        browser.tabs.create({ url: url }, function(tab) {
          console.log('Popup: Tab created:', tab);
          window.close(); // Close popup after opening analysis
        });
      } else {
        // Firefox-style promise API
        browser.tabs.create({ url: url }).then(tab => {
          console.log('Popup: Tab created:', tab);
          window.close(); // Close popup after opening analysis
        }).catch(error => {
          console.error('Popup: Error creating tab:', error);
        });
      }
    } else {
      // It might be a custom combination - load and check
      console.log('Popup: Not a standard service, checking if it\'s a custom combination');
      
      if (browser.storage.sync.get.length > 1) {
        // Chrome-style callback API
        browser.storage.sync.get('customCombinations', function(data) {
          const combinations = data.customCombinations || [];
          const combo = combinations.find(c => c.name === tool);
          
          if (combo && combo.tools) {
            console.log('Popup: Found custom combination:', combo);
            // Open all tools in the combination
            combo.tools.forEach(serviceName => {
              if (serviceUrls[serviceName]) {
                const url = serviceUrls[serviceName].replace("[QUERY]", encodeURIComponent(ioc));
                browser.tabs.create({ url: url });
              }
            });
            window.close();
          } else {
            console.error('Popup: Unknown tool or combination:', tool);
          }
        });
      } else {
        // Firefox-style promise API
        browser.storage.sync.get('customCombinations').then(function(data) {
          const combinations = data.customCombinations || [];
          const combo = combinations.find(c => c.name === tool);
          
          if (combo && combo.tools) {
            console.log('Popup: Found custom combination:', combo);
            // Open all tools in the combination
            combo.tools.forEach(serviceName => {
              if (serviceUrls[serviceName]) {
                const url = serviceUrls[serviceName].replace("[QUERY]", encodeURIComponent(ioc));
                browser.tabs.create({ url: url });
              }
            });
            window.close();
          } else {
            console.error('Popup: Unknown tool or combination:', tool);
          }
        }).catch(error => {
          console.error('Popup: Error loading combinations:', error);
        });
      }
    }
  }
  
  // Load and display custom combinations
  function loadCombinations() {
    console.log('Popup: Loading custom combinations...');
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.get('customCombinations', function(data) {
        console.log('Popup: Custom combinations data:', data);
        displayCombinations(data.customCombinations || []);
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.get('customCombinations').then(function(data) {
        console.log('Popup: Custom combinations data:', data);
        displayCombinations(data.customCombinations || []);
      }).catch(error => {
        console.error("Error loading combinations:", error);
      });
    }
  }
  
  function displayCombinations(combinations) {
    const combinationsList = document.getElementById('combinations-list');
    
    if (combinations.length === 0) {
      combinationsList.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 11px; padding: 10px;">No custom combinations yet</div>';
      return;
    }
    
    combinationsList.innerHTML = '';
    
    combinations.forEach((combo, index) => {
      const comboItem = document.createElement('div');
      comboItem.className = 'combination-item';
      
      comboItem.innerHTML = `
        <div>
          <div class="combination-name">${combo.name}</div>
          <div class="combination-tools">${combo.tools.join(', ')}</div>
        </div>
        <button class="combination-delete" data-index="${index}">Delete</button>
      `;
      
      // Add delete event listener
      const deleteBtn = comboItem.querySelector('.combination-delete');
      deleteBtn.addEventListener('click', function() {
        showConfirmDelete(index);
      });
      
      combinationsList.appendChild(comboItem);
    });
  }
  
  let pendingDeleteIndex = null;
  
  function showConfirmDelete(index) {
    pendingDeleteIndex = index;
    const confirmModal = document.getElementById('confirm-modal');
    confirmModal.style.display = 'flex';
  }
  
  function hideConfirmDelete() {
    pendingDeleteIndex = null;
    const confirmModal = document.getElementById('confirm-modal');
    confirmModal.style.display = 'none';
  }
  
  function deleteCombination() {
    if (pendingDeleteIndex === null) return;
    
    const index = pendingDeleteIndex;
    hideConfirmDelete();
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.get('customCombinations', function(data) {
        const combinations = data.customCombinations || [];
        combinations.splice(index, 1);
        browser.storage.sync.set({ 'customCombinations': combinations }, function() {
          loadCombinations();
          // Notify background script to update context menus
          browser.runtime.sendMessage({ action: 'updateCombinations' });
        });
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.get('customCombinations').then(function(data) {
        const combinations = data.customCombinations || [];
        combinations.splice(index, 1);
        return browser.storage.sync.set({ 'customCombinations': combinations });
      }).then(() => {
        loadCombinations();
        // Notify background script to update context menus
        browser.runtime.sendMessage({ action: 'updateCombinations' });
      }).catch(error => {
        console.error("Error deleting combination:", error);
      });
    }
  }
  
  function showCombinationModal() {
    const modal = document.getElementById('combination-modal');
    const toolsContainer = document.getElementById('combo-tools-container');
    const nameInput = document.getElementById('combo-name');
    
    // Clear previous input
    nameInput.value = '';
    
    // Populate tools checkboxes
    const availableTools = [
      "VirusTotal",
      "AbuseIPDB",
      "URLScan",
      "Shodan",
      "Censys",
      "AlienVault OTX",
      "ThreatCrowd",
      "IBM X-Force Exchange",
      "MalwareBazaar",
      "GreyNoise",
      "Spur"
    ];
    
    toolsContainer.innerHTML = '';
    availableTools.forEach(tool => {
      const toolItem = document.createElement('div');
      toolItem.className = 'combo-tool-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `combo-tool-${tool}`;
      checkbox.value = tool;
      
      const label = document.createElement('label');
      label.htmlFor = `combo-tool-${tool}`;
      label.textContent = tool;
      label.style.cursor = 'pointer';
      
      toolItem.appendChild(checkbox);
      toolItem.appendChild(label);
      
      // Make the whole item clickable
      toolItem.addEventListener('click', function(e) {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
      });
      
      toolsContainer.appendChild(toolItem);
    });
    
    modal.style.display = 'flex';
  }
  
  function hideCombinationModal() {
    const modal = document.getElementById('combination-modal');
    modal.style.display = 'none';
  }
  
  function saveCombination() {
    const nameInput = document.getElementById('combo-name');
    const name = nameInput.value.trim();
    
    if (!name) {
      alert('Please enter a combination name');
      return;
    }
    
    // Get selected tools
    const checkedBoxes = document.querySelectorAll('#combo-tools-container input[type="checkbox"]:checked');
    const selectedTools = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedTools.length < 2) {
      alert('Please select at least 2 tools');
      return;
    }
    
    const newCombination = {
      name: name,
      tools: selectedTools
    };
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.get('customCombinations', function(data) {
        const combinations = data.customCombinations || [];
        combinations.push(newCombination);
        browser.storage.sync.set({ 'customCombinations': combinations }, function() {
          loadCombinations();
          hideCombinationModal();
          // Notify background script to update context menus
          browser.runtime.sendMessage({ action: 'updateCombinations' });
        });
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.get('customCombinations').then(function(data) {
        const combinations = data.customCombinations || [];
        combinations.push(newCombination);
        return browser.storage.sync.set({ 'customCombinations': combinations });
      }).then(() => {
        loadCombinations();
        hideCombinationModal();
        // Notify background script to update context menus
        browser.runtime.sendMessage({ action: 'updateCombinations' });
      }).catch(error => {
        console.error("Error saving combination:", error);
        alert('Error saving combination: ' + error.message);
      });
    }
  }
  
  // Load and display enabled services as badges
  function loadEnabledServices() {
    console.log('Popup: Loading enabled services...');
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.get('enabledServices', function(data) {
        displayEnabledServices(data.enabledServices || {});
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.get('enabledServices').then(function(data) {
        displayEnabledServices(data.enabledServices || {});
      }).catch(error => {
        console.error("Error loading enabled services:", error);
      });
    }
  }
  
  function displayEnabledServices(enabledServices) {
    const container = document.getElementById('enabled-services-container');
    container.innerHTML = '';
    
    const enabled = Object.entries(enabledServices).filter(([service, isEnabled]) => isEnabled);
    
    if (enabled.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 11px; padding: 10px;">No services enabled</div>';
      return;
    }
    
    enabled.forEach(([service, _]) => {
      const badge = document.createElement('span');
      badge.className = 'enabled-service-badge';
      badge.textContent = service;
      badge.title = service;
      container.appendChild(badge);
    });
  }
  
  function showManageServicesModal() {
    const modal = document.getElementById('manage-services-modal');
    const container = document.getElementById('all-services-container');
    
    // Load current services
    if (browser.storage.sync.get.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.get('enabledServices', function(data) {
        populateServicesModal(data.enabledServices || {});
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.get('enabledServices').then(function(data) {
        populateServicesModal(data.enabledServices || {});
      }).catch(error => {
        console.error("Error loading services for modal:", error);
      });
    }
    
    modal.style.display = 'flex';
  }
  
  function populateServicesModal(enabledServices) {
    const container = document.getElementById('all-services-container');
    container.innerHTML = '';
    
    const allServices = [
      "VirusTotal",
      "AbuseIPDB",
      "URLScan",
      "Shodan",
      "Censys",
      "AlienVault OTX",
      "ThreatCrowd",
      "IBM X-Force Exchange",
      "MalwareBazaar",
      "GreyNoise",
      "Spur"
    ];
    
    allServices.forEach(service => {
      const serviceDiv = document.createElement('div');
      serviceDiv.className = 'service-toggle';
      
      const label = document.createElement('label');
      label.textContent = service;
      label.style.cursor = 'pointer';
      
      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = enabledServices[service] || false;
      checkbox.dataset.service = service;
      
      const slider = document.createElement('span');
      slider.className = 'slider';
      
      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(slider);
      
      serviceDiv.appendChild(label);
      serviceDiv.appendChild(switchLabel);
      
      // Make the whole div clickable (except when clicking directly on switch elements)
      serviceDiv.addEventListener('click', function(e) {
        // Don't toggle if clicking on the checkbox or slider directly
        if (!e.target.closest('.switch')) {
          checkbox.checked = !checkbox.checked;
        }
      });
      
      container.appendChild(serviceDiv);
    });
  }
  
  function hideManageServicesModal() {
    const modal = document.getElementById('manage-services-modal');
    modal.style.display = 'none';
  }
  
  function saveServices() {
    const checkboxes = document.querySelectorAll('#all-services-container input[type="checkbox"]');
    const enabledServices = {};
    
    checkboxes.forEach(checkbox => {
      enabledServices[checkbox.dataset.service] = checkbox.checked;
    });
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.set.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.set({ 'enabledServices': enabledServices }, function() {
        loadEnabledServices();
        hideManageServicesModal();
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.set({ 'enabledServices': enabledServices }).then(() => {
        loadEnabledServices();
        hideManageServicesModal();
      }).catch(error => {
        console.error("Error saving services:", error);
      });
    }
  }
  
  function resetServicesToDefaults() {
    const defaultServices = {
      "VirusTotal": true,
      "AbuseIPDB": true,
      "URLScan": true,
      "Shodan": true,
      "Censys": true,
      "AlienVault OTX": true,
      "ThreatCrowd": true,
      "IBM X-Force Exchange": true,
      "MalwareBazaar": true,
      "GreyNoise": true,
      "Spur": true
    };
    
    // Handle both Chrome (callback) and Firefox (promise) APIs
    if (browser.storage.sync.set.length > 1) {
      // Chrome-style callback API
      browser.storage.sync.set({ 'enabledServices': defaultServices }, function() {
        populateServicesModal(defaultServices);
        loadEnabledServices();
      });
    } else {
      // Firefox-style promise API
      browser.storage.sync.set({ 'enabledServices': defaultServices }).then(() => {
        populateServicesModal(defaultServices);
        loadEnabledServices();
      }).catch(error => {
        console.error("Error resetting services:", error);
      });
    }
  }

  function loadOverlaySetting() {
    const checkbox = document.getElementById('overlay-enabled');
    if (!checkbox) return;

    const apply = (enabled) => {
      checkbox.checked = !!enabled;
    };

    if (browser.storage.sync.get.length > 1) {
      browser.storage.sync.get('overlayEnabled', function(data) {
        apply(data.overlayEnabled);
      });
    } else {
      browser.storage.sync.get('overlayEnabled').then(function(data) {
        apply(data.overlayEnabled);
      }).catch(error => {
        console.error("Error loading overlay setting:", error);
      });
    }
  }

  function saveOverlaySetting(enabled) {
    if (browser.storage.sync.set.length > 1) {
      browser.storage.sync.set({ 'overlayEnabled': enabled }, function() {
        console.log('Overlay setting saved:', enabled);
      });
    } else {
      browser.storage.sync.set({ 'overlayEnabled': enabled }).then(() => {
        console.log('Overlay setting saved:', enabled);
      }).catch(error => {
        console.error("Error saving overlay setting:", error);
      });
    }
  }
  
  document.addEventListener('DOMContentLoaded', function() {
    
    // Service URLs for reference (same as in background.js)
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
    
    // Default services
    const defaultServices = {
      "VirusTotal": true,
      "AbuseIPDB": true,
      "URLScan": true,
      "Shodan": true, 
      "Censys": true,
      "AlienVault OTX": true,
      "ThreatCrowd": true,
      "IBM X-Force Exchange": true,
      "MalwareBazaar": true,
      "GreyNoise": true,
      "Spur": true
    };
    
    // Initial load
    loadEnabledServices();
    loadHistory();
    loadCombinations();
    loadOverlaySetting();

    const overlayCheckbox = document.getElementById('overlay-enabled');
    if (overlayCheckbox) {
      overlayCheckbox.addEventListener('change', function() {
        saveOverlaySetting(this.checked);
      });
    }
    
    // Manage Services modal buttons
    const manageServicesBtn = document.getElementById('manage-services-btn');
    if (manageServicesBtn) {
      manageServicesBtn.addEventListener('click', showManageServicesModal);
    }
    
    const saveServicesBtn = document.getElementById('save-services');
    if (saveServicesBtn) {
      saveServicesBtn.addEventListener('click', saveServices);
    }
    
    const resetServicesBtn = document.getElementById('reset-services');
    if (resetServicesBtn) {
      resetServicesBtn.addEventListener('click', resetServicesToDefaults);
    }
    
    const cancelServicesBtn = document.getElementById('cancel-services');
    if (cancelServicesBtn) {
      cancelServicesBtn.addEventListener('click', hideManageServicesModal);
    }
    
    // Combination modal buttons
    const addCombinationBtn = document.getElementById('add-combination-btn');
    if (addCombinationBtn) {
      addCombinationBtn.addEventListener('click', showCombinationModal);
    }
    
    const saveCombinationBtn = document.getElementById('save-combination');
    if (saveCombinationBtn) {
      saveCombinationBtn.addEventListener('click', saveCombination);
    }
    
    const cancelCombinationBtn = document.getElementById('cancel-combination');
    if (cancelCombinationBtn) {
      cancelCombinationBtn.addEventListener('click', hideCombinationModal);
    }
    
    // Confirm delete modal buttons
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', deleteCombination);
    }
    
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    if (cancelDeleteBtn) {
      cancelDeleteBtn.addEventListener('click', hideConfirmDelete);
    }
    
    // View archive button
    const viewArchiveButton = document.getElementById('view-archive');
    if (viewArchiveButton) {
      viewArchiveButton.addEventListener('click', function() {
        console.log('Popup: Opening archive page');
        // Open archive page
        const archiveUrl = browser.runtime.getURL('archive.html');
        console.log('Popup: Archive URL:', archiveUrl);
        
        // Handle both Chrome (callback) and Firefox (promise) APIs
        if (browser.tabs.create.length > 1) {
          // Chrome-style callback API
          browser.tabs.create({ url: archiveUrl }, function(tab) {
            console.log('Popup: Archive tab created:', tab);
          });
        } else {
          // Firefox-style promise API
          browser.tabs.create({ url: archiveUrl }).then(tab => {
            console.log('Popup: Archive tab created:', tab);
          }).catch(error => {
            console.error('Popup: Error opening archive:', error);
          });
        }
      });
    }
    
    // Clean up any old Quick Find targets data (no longer needed)
    browser.storage.sync.remove('quickFindTargets').catch(error => {
      console.error("Error removing old data:", error);
    });
  });