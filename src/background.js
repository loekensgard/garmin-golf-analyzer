// Background script to relay messages between popup and content script

// Track current scan state
let currentScanId = null;
let scanResults = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScan') {
    // Generate new scan ID to track this scan session
    const newScanId = Date.now().toString();
    currentScanId = newScanId;
    scanResults = null;
    
    // Store scan state
    chrome.storage.local.set({ 
      scanInProgress: true, 
      scanId: newScanId,
      scanStartTime: Date.now() 
    });
    
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('connect.garmin.com')) {
        // Inject content script if needed and send scan message
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'scanShots', scanId: newScanId }, (response) => {
            // Only process if this is still the current scan
            if (currentScanId === newScanId) {
              scanResults = response;
              // Clear scan state when complete
              chrome.storage.local.set({ 
                scanInProgress: false,
                lastScanResults: response,
                lastScanTime: Date.now()
              });
              sendResponse(response);
            }
          });
        });
      } else {
        chrome.storage.local.set({ scanInProgress: false });
        sendResponse({ success: false, error: 'Please navigate to connect.garmin.com first' });
      }
    });
    
    return true; // Indicates async response
  }
  
  // Handle scan status check
  if (request.action === 'getScanStatus') {
    chrome.storage.local.get(['scanInProgress', 'scanId', 'lastScanResults'], (data) => {
      sendResponse({
        inProgress: data.scanInProgress || false,
        scanId: data.scanId,
        lastResults: data.lastScanResults
      });
    });
    return true;
  }
  
  // Handle cancel scan
  if (request.action === 'cancelScan') {
    currentScanId = null;
    chrome.storage.local.set({ scanInProgress: false });
    // Notify content script to cancel
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelScan' });
      }
    });
    sendResponse({ success: true });
  }
  
  // Forward progress updates to all popup instances
  if (request.action === 'scanProgress' && sender.tab) {
    // Only forward if from current scan
    chrome.storage.local.get(['scanId'], (data) => {
      if (data.scanId === request.scanId) {
        // Send to any open popups
        chrome.runtime.sendMessage({ action: 'scanProgress', data: request.data });
      }
    });
  }
  
  // Handle fetch clubs request
  if (request.action === 'fetchClubs') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('connect.garmin.com')) {
        // Inject content script if needed and send fetch clubs message
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'fetchUserClubs' }, (response) => {
            sendResponse(response);
          });
        });
      } else {
        sendResponse({ success: false, error: 'Please navigate to connect.garmin.com first' });
      }
    });
    
    return true; // Indicates async response
  }
});