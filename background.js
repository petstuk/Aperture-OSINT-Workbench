// Universal browser API compatibility
// Works for both Chrome and Firefox
const browserAPI = (() => {
  if (typeof browser !== 'undefined') {
    return browser; // Firefox
  } else if (typeof chrome !== 'undefined') {
    return chrome;  // Chrome
  } else {
    throw new Error('No browser API available');
  }
})();

// Use universal API for all operations
let enabledServices = {};

// Default services that will be enabled on first install
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

// Service URLs for searching
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

// Initialize the extension
function initializeExtension() {
  console.log("Initializing unified OSINT extension");
  
  // Use promise-based API for Firefox, callback for Chrome
  if (browserAPI.storage.sync.get.length > 1) {
    // Chrome-style callback API
    browserAPI.storage.sync.get('enabledServices', (data) => {
      if (!data.enabledServices) {
        console.log("Setting default enabled services");
        browserAPI.storage.sync.set({ 'enabledServices': defaultServices }, () => {
          enabledServices = defaultServices;
          createContextMenus();
        });
      } else {
        console.log("Merging existing enabled services with new defaults");
        // Merge existing settings with new defaults (adds any new services)
        enabledServices = { ...defaultServices, ...data.enabledServices };
        browserAPI.storage.sync.set({ 'enabledServices': enabledServices }, () => {
          createContextMenus();
        });
      }
    });
  } else {
    // Firefox-style promise API
    browserAPI.storage.sync.get('enabledServices').then((data) => {
      if (!data.enabledServices) {
        console.log("Setting default enabled services");
        browserAPI.storage.sync.set({ 'enabledServices': defaultServices }).then(() => {
          enabledServices = defaultServices;
          createContextMenus();
        });
      } else {
        console.log("Merging existing enabled services with new defaults");
        // Merge existing settings with new defaults (adds any new services)
        enabledServices = { ...defaultServices, ...data.enabledServices };
        browserAPI.storage.sync.set({ 'enabledServices': enabledServices }).then(() => {
          createContextMenus();
        });
      }
    }).catch(error => {
      console.error("Error loading enabled services:", error);
      enabledServices = defaultServices;
      createContextMenus();
    });
  }
}

// Run on startup
initializeExtension();

// Also run on installed
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated");
  initializeExtension();
});

// Listen for changes to enabled services and custom combinations
browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabledServices) {
      console.log("Enabled services changed, updating context menus");
      enabledServices = changes.enabledServices.newValue;
      
      // Recreate context menus when settings change
      browserAPI.contextMenus.removeAll(() => {
        createContextMenus();
      });
    }
    
    if (changes.customCombinations) {
      console.log("Custom combinations changed, updating context menus");
      
      // Recreate context menus when combinations change
      browserAPI.contextMenus.removeAll(() => {
        createContextMenus();
      });
    }
  }
});

// Create context menu items
async function createContextMenus() {
  try {
    // First remove all existing context menus
    browserAPI.contextMenus.removeAll(async () => {
      console.log("Removed existing context menus");
      
      // Create parent context menu
      browserAPI.contextMenus.create({
        id: "soc-osint-parent",
        title: "SOC OSINT Search",
        contexts: ["selection"]
      });
      
      // Get custom combinations
      let customCombinations = [];
      try {
        if (browserAPI.storage.sync.get.length > 1) {
          // Chrome-style callback API
          browserAPI.storage.sync.get('customCombinations', function(data) {
            customCombinations = data.customCombinations || [];
            createMenuItems(customCombinations);
          });
        } else {
          // Firefox-style promise API
          const data = await browserAPI.storage.sync.get('customCombinations');
          customCombinations = data.customCombinations || [];
          createMenuItems(customCombinations);
        }
      } catch (error) {
        console.error("Error loading custom combinations:", error);
        createMenuItems([]);
      }
    });
  } catch (error) {
    console.error("Error in createContextMenus:", error);
  }
}

function createMenuItems(customCombinations) {
  // Create custom combinations first (if any)
  if (customCombinations && customCombinations.length > 0) {
    customCombinations.forEach((combo, index) => {
      browserAPI.contextMenus.create({
        id: `combo-${index}`,
        parentId: "soc-osint-parent",
        title: `⚡ ${combo.name}`,
        contexts: ["selection"]
      });
    });
    
    // Add separator
    browserAPI.contextMenus.create({
      id: "separator-1",
      parentId: "soc-osint-parent",
      type: "separator",
      contexts: ["selection"]
    });
  }
  
  // Create individual menu items for each enabled OSINT service
  for (const [service, enabled] of Object.entries(enabledServices)) {
    if (enabled) {
      browserAPI.contextMenus.create({
        id: `search-${service}`,
        parentId: "soc-osint-parent",
        title: service,
        contexts: ["selection"]
      });
    }
  }
  console.log("Context menus created successfully");
}

function detectIOCType(text) {
  return IOCUtils.detectIOCType(text);
}

function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    if (browserAPI.storage.sync.get.length > 1) {
      browserAPI.storage.sync.get(keys, (data) => {
        if (browserAPI.runtime.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
          return;
        }
        resolve(data);
      });
    } else {
      browserAPI.storage.sync.get(keys).then(resolve).catch(reject);
    }
  });
}

function searchService(ioc, serviceName) {
  if (!serviceUrls[serviceName]) return;
  const url = serviceUrls[serviceName].replace('[QUERY]', encodeURIComponent(ioc));
  browserAPI.tabs.create({ url });
  const iocType = detectIOCType(ioc);
  addToHistory(ioc, serviceName, iocType, [serviceName]);
}

// Add IoC to history with automatic rotation when storage limit is reached
async function addToHistory(ioc, tool, iocType, actualTools = null) {
  console.log('Adding to history:', ioc, tool, iocType, 'actualTools:', actualTools);
  
  const historyEntry = {
    ioc: ioc,
    tool: tool,
    toolsUsed: actualTools || (Array.isArray(tool) ? tool : [tool]),
    type: iocType,
    timestamp: Date.now(),
    date: new Date().toLocaleString(),
    notes: '',
    status: 'unknown'
  };
  
  console.log('History entry created:', historyEntry);
  
  // Get existing history
  if (browserAPI.storage.sync.get.length > 1) {
    // Chrome callback API
    browserAPI.storage.sync.get('iocHistory', (data) => {
      console.log('Chrome API - Current history length:', (data.iocHistory || []).length);
      const history = data.iocHistory || [];
      
      // Add new entry to the beginning
      history.unshift(historyEntry);
      
      // Try to save, and rotate out old entries if quota is exceeded
      attemptSaveWithRotation(history, 0);
    });
  } else {
    // Firefox promise API
    try {
      const data = await browserAPI.storage.sync.get('iocHistory');
      console.log('Firefox API - Current history length:', (data.iocHistory || []).length);
      const history = data.iocHistory || [];
      
      // Add new entry to the beginning
      history.unshift(historyEntry);
      
      // Try to save, and rotate out old entries if quota is exceeded
      await attemptSaveWithRotationPromise(history);
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }
}

// Attempt to save history, removing oldest entries if quota exceeded (Chrome callback version)
function attemptSaveWithRotation(history, attempt) {
  console.log(`Attempt ${attempt + 1} - Trying to save ${history.length} entries`);
  
  browserAPI.storage.sync.set({ 'iocHistory': history }, () => {
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError.message;
      console.warn('Save failed:', error);
      
      // Check if it's a quota error
      if (error.includes('QUOTA_BYTES') || error.includes('quota') || error.includes('Quota')) {
        console.log('Storage quota exceeded, removing oldest entries...');
        
        // Remove 10% of entries from the end (oldest entries)
        const removeCount = Math.max(1, Math.floor(history.length * 0.1));
        history.splice(-removeCount);
        
        console.log(`Removed ${removeCount} oldest entries, now have ${history.length} entries`);
        
        // Prevent infinite recursion - stop after 20 attempts
        if (attempt < 20 && history.length > 0) {
          attemptSaveWithRotation(history, attempt + 1);
        } else {
          console.error('Failed to save history after multiple attempts or history is empty');
        }
      } else {
        console.error('Non-quota error occurred:', error);
      }
    } else {
      console.log(`Chrome API - History saved successfully with ${history.length} entries`);
    }
  });
}

// Attempt to save history, removing oldest entries if quota exceeded (Firefox promise version)
async function attemptSaveWithRotationPromise(history, attempt = 0) {
  console.log(`Attempt ${attempt + 1} - Trying to save ${history.length} entries`);
  
  try {
    await browserAPI.storage.sync.set({ 'iocHistory': history });
    console.log(`Firefox API - History saved successfully with ${history.length} entries`);
  } catch (error) {
    console.warn('Save failed:', error.message);
    
    // Check if it's a quota error
    if (error.message.includes('QUOTA_BYTES') || error.message.includes('quota') || 
        error.message.includes('Quota') || error.message.includes('exceeded')) {
      console.log('Storage quota exceeded, removing oldest entries...');
      
      // Remove 10% of entries from the end (oldest entries)
      const removeCount = Math.max(1, Math.floor(history.length * 0.1));
      history.splice(-removeCount);
      
      console.log(`Removed ${removeCount} oldest entries, now have ${history.length} entries`);
      
      // Prevent infinite recursion - stop after 20 attempts
      if (attempt < 20 && history.length > 0) {
        await attemptSaveWithRotationPromise(history, attempt + 1);
      } else {
        console.error('Failed to save history after multiple attempts or history is empty');
        throw new Error('Unable to save history - storage quota persistently exceeded');
      }
    } else {
      console.error('Non-quota error occurred:', error.message);
      throw error;
    }
  }
}

// Handle context menu clicks
browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("Context menu clicked:", info.menuItemId);
  const selectedText = info.selectionText.trim();
  
  if (info.menuItemId.startsWith("combo-")) {
    // Handle custom combination
    const comboIndex = parseInt(info.menuItemId.replace("combo-", ""));
    console.log("Running custom combination:", comboIndex);
    
    try {
      let customCombinations = [];
      if (browserAPI.storage.sync.get.length > 1) {
        // Chrome-style callback API
        browserAPI.storage.sync.get('customCombinations', function(data) {
          customCombinations = data.customCombinations || [];
          if (customCombinations[comboIndex]) {
            runCombination(customCombinations[comboIndex], selectedText);
          }
        });
      } else {
        // Firefox-style promise API
        const data = await browserAPI.storage.sync.get('customCombinations');
        customCombinations = data.customCombinations || [];
        if (customCombinations[comboIndex]) {
          runCombination(customCombinations[comboIndex], selectedText);
        }
      }
    } catch (error) {
      console.error("Error running combination:", error);
    }
  } else if (info.menuItemId.startsWith("search-")) {
    // Handle OSINT search
    const serviceName = info.menuItemId.replace("search-", "");
    
    if (serviceUrls[serviceName]) {
      const url = serviceUrls[serviceName].replace("[QUERY]", encodeURIComponent(selectedText));
      browserAPI.tabs.create({ url: url });
      
      // Add to history - for single service, tool and toolsUsed are the same
      const iocType = detectIOCType(selectedText);
      addToHistory(selectedText, serviceName, iocType, [serviceName]);
    }
  }
});

// Run a custom combination of tools
function runCombination(combination, selectedText) {
  console.log("Running combination:", combination.name, "with tools:", combination.tools);
  
  combination.tools.forEach(toolName => {
    if (serviceUrls[toolName]) {
      const url = serviceUrls[toolName].replace("[QUERY]", encodeURIComponent(selectedText));
      browserAPI.tabs.create({ url: url });
    }
  });
  
  // Add to history with enhanced data - using the same rotation logic
  const iocType = detectIOCType(selectedText);
  addToHistory(selectedText, combination.name, iocType, combination.tools);
}

// Listen for messages from popup and content script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateCombinations') {
    console.log("Received request to update combinations");
    createContextMenus();
    return;
  }

  if (message.action === 'getOverlayConfig') {
    getStorageData(['overlayEnabled', 'enabledServices', 'customCombinations'])
      .then((data) => {
        sendResponse({
          overlayEnabled: !!data.overlayEnabled,
          enabledServices: data.enabledServices || enabledServices,
          customCombinations: data.customCombinations || []
        });
      })
      .catch((error) => {
        console.error('Error loading overlay config:', error);
        sendResponse({ overlayEnabled: false, enabledServices: {}, customCombinations: [] });
      });
    return true;
  }

  if (message.action === 'getArchiveEntry') {
    getStorageData('iocHistory')
      .then((data) => {
        const history = data.iocHistory || [];
        const entry = history.find((item) => item.ioc === message.ioc);
        if (entry) {
          sendResponse({
            found: true,
            status: entry.status || 'unknown',
            date: entry.date,
            tool: entry.tool
          });
        } else {
          sendResponse({ found: false });
        }
      })
      .catch((error) => {
        console.error('Error loading archive entry:', error);
        sendResponse({ found: false });
      });
    return true;
  }

  if (message.action === 'searchService') {
    searchService(message.ioc, message.service);
    sendResponse({ success: true });
    return;
  }

  if (message.action === 'runCombinationFromOverlay') {
    getStorageData('customCombinations')
      .then((data) => {
        const combinations = data.customCombinations || [];
        const combo = combinations[message.comboIndex];
        if (combo) {
          runCombination(combo, message.ioc);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Combination not found' });
        }
      })
      .catch((error) => {
        console.error('Error running combination from overlay:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});