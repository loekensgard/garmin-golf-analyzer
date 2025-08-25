// Background script to relay messages between popup and content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScan') {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('connect.garmin.com')) {
        // Inject content script if needed and send scan message
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'scanShots' }, (response) => {
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