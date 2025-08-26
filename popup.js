// Simplified popup that sends scan request to content script via background

document.addEventListener('DOMContentLoaded', function() {
  const scanBtn = document.getElementById('scan-btn');
  const progressDiv = document.getElementById('progress');
  const progressText = document.querySelector('.progress-text');
  const progressFill = document.querySelector('.progress-fill');
  const resultsDiv = document.getElementById('results');
  const resultsCount = document.getElementById('results-count');
  const resultsList = document.getElementById('results-list');
  const noResultsDiv = document.getElementById('no-results');
  const loginWarning = document.getElementById('login-warning');
  const bearerTokenInput = document.getElementById('bearer-token');
  const userIdInput = document.getElementById('user-id');
  const saveTokenBtn = document.getElementById('save-token-btn');
  const fetchClubsBtn = document.getElementById('fetch-clubs-btn');
  const clubsSection = document.getElementById('clubs-section');
  const clubsList = document.getElementById('clubs-list');
  const saveClubsBtn = document.getElementById('save-clubs-btn');
  
  // Check for ongoing scan when popup opens
  chrome.runtime.sendMessage({ action: 'getScanStatus' }, (status) => {
    if (status && status.inProgress) {
      // Show progress UI for ongoing scan
      progressDiv.style.display = 'block';
      progressText.textContent = 'Scan in progress...';
      scanBtn.disabled = true;
      scanBtn.textContent = 'Scanning...';
    } else if (status && status.lastResults && !status.inProgress) {
      // Show last results if available
      const timeSinceLastScan = Date.now() - (status.lastScanTime || 0);
      if (timeSinceLastScan < 60000) { // Show results if less than 1 minute old
        displayResults(status.lastResults.data || []);
      }
    }
  });
  
  // Load saved token, user ID, and custom club ranges on startup
  chrome.storage.local.get(['bearerToken', 'userId', 'customClubRanges'], function(result) {
    if (result.bearerToken) {
      bearerTokenInput.value = result.bearerToken;
    }
    if (result.userId) {
      userIdInput.value = result.userId;
      window.savedUserId = result.userId;
    }
    // Store custom ranges globally for later use
    window.customClubRanges = result.customClubRanges || {};
  });
  
  // Save token and user ID when button is clicked
  saveTokenBtn.addEventListener('click', function() {
    const token = bearerTokenInput.value.trim();
    const userId = userIdInput.value.trim();
    
    if (!token) {
      alert('Please enter a bearer token');
      return;
    }
    
    const dataToSave = { bearerToken: token };
    if (userId) {
      dataToSave.userId = userId;
      window.savedUserId = userId;
    }
    
    chrome.storage.local.set(dataToSave, function() {
      saveTokenBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveTokenBtn.textContent = 'Save Settings';
      }, 2000);
    });
  });
  
  // Listen for progress updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'scanProgress') {
      updateProgress(message.data);
    }
  });
  
  function updateProgress(data) {
    progressText.textContent = data.status;
    progressFill.style.width = `${data.percent}%`;
  }
  
  function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  function displayResults(shots) {
    progressDiv.style.display = 'none';
    
    if (shots.length === 0) {
      noResultsDiv.style.display = 'block';
      resultsDiv.style.display = 'none';
    } else {
      noResultsDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      
      resultsCount.textContent = `Found ${shots.length} suspicious shot${shots.length !== 1 ? 's' : ''}`;
      
      // Group shots by scorecard
      const groupedShots = {};
      shots.forEach(shot => {
        const key = `${shot.scorecardId}`;
        if (!groupedShots[key]) {
          groupedShots[key] = {
            date: shot.scorecardDate,
            courseName: shot.courseName,
            shots: []
          };
        }
        groupedShots[key].shots.push(shot);
      });
      
      // Build HTML
      let html = '';
      for (const [scorecardId, data] of Object.entries(groupedShots)) {
        html += `
          <div class="scorecard-group">
            <div class="scorecard-header">
              <strong>${data.courseName || 'Unknown Course'}</strong>
              <span class="date">${formatDate(data.date)}</span>
            </div>
            <div class="shots-list">
        `;
        
        data.shots.forEach(shot => {
          const distanceDisplay = shot.distance != null ? `${Math.round(shot.distance)}m` : 'N/A';
          // Get saved user ID from storage, or use default
          const userId = window.savedUserId || '12345678-abcd-1234-5678-123456789abc';
          const shotUrl = `https://connect.garmin.com/modern/golf-shots/${userId}/scorecard/${shot.scorecardId}/hole/${shot.holeNumber}`;
          
          html += `
            <div class="shot-item">
              <span class="hole">Hole ${shot.holeNumber}</span>
              <span class="club">
                <a href="${shotUrl}" target="_blank" class="shot-link" title="Open shot details in new tab">
                  ${shot.clubName}
                </a>
              </span>
              <span class="distance ${shot.distance > 200 ? 'extreme' : ''}">${distanceDisplay}</span>
            </div>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      }
      
      resultsList.innerHTML = html;
      
      // Add click handlers to all links to prevent popup from closing
      const links = resultsList.querySelectorAll('a.shot-link');
      links.forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          // Open in background tab to keep popup open
          chrome.tabs.create({ 
            url: this.href,
            active: false  // Don't switch to the new tab
          });
        });
      });
    }
    
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan Again';
  }
  
  function showError(message) {
    progressDiv.style.display = 'none';
    scanBtn.disabled = false;
    
    if (message.includes('navigate to connect.garmin.com')) {
      loginWarning.textContent = message;
      loginWarning.style.display = 'block';
    } else if (message.includes('401') || message.includes('403')) {
      loginWarning.textContent = 'Please login to connect.garmin.com first';
      loginWarning.style.display = 'block';
      // Clear expired/invalid token from input and storage
      bearerTokenInput.value = '';
      chrome.storage.local.remove(['bearerToken']);
    } else {
      alert(`Error: ${message}`);
    }
  }
  
  // Handle scan button click
  scanBtn.addEventListener('click', function() {
    // First check if there's an ongoing scan and cancel it
    chrome.runtime.sendMessage({ action: 'getScanStatus' }, (status) => {
      if (status && status.inProgress) {
        // Cancel ongoing scan first
        chrome.runtime.sendMessage({ action: 'cancelScan' }, () => {
          // Small delay to ensure cancellation completes
          setTimeout(() => startNewScan(), 100);
        });
      } else {
        startNewScan();
      }
    });
  });
  
  function startNewScan() {
    // Reset UI
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
    resultsDiv.style.display = 'none';
    noResultsDiv.style.display = 'none';
    loginWarning.style.display = 'none';
    progressDiv.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting scan...';
    
    // Send scan request to background script
    chrome.runtime.sendMessage({ action: 'startScan' }, (response) => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success) {
        displayResults(response.data);
      } else if (response && response.error) {
        showError(response.error);
      } else {
        showError('Unknown error occurred');
      }
    });
  }
  
  // Handle fetch clubs button click
  fetchClubsBtn.addEventListener('click', function() {
    fetchClubsBtn.disabled = true;
    fetchClubsBtn.textContent = 'Fetching...';
    loginWarning.style.display = 'none';
    
    chrome.runtime.sendMessage({ action: 'fetchClubs' }, (response) => {
      fetchClubsBtn.disabled = false;
      fetchClubsBtn.textContent = 'Fetch My Clubs';
      
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success) {
        displayClubs(response.data);
        clubsSection.style.display = 'block';
      } else if (response && response.error) {
        showError(response.error);
      } else {
        showError('Failed to fetch clubs');
      }
    });
  });
  
  function displayClubs(clubs) {
    // Get default limits from content.js hardcoded values
    const defaultLimits = {
      1: 350,   // Driver
      2: 280,   // 3 Wood
      3: 260,   // 5 Wood
      4: 250,   // 7 Wood
      5: 240,   // 9 Wood
      6: 240,   // 2 Hybrid
      7: 230,   // 3 Hybrid
      8: 220,   // 4 Hybrid
      9: 210,   // 5 Hybrid
      10: 200,  // 6 Hybrid
      11: 240,  // 2 Iron
      12: 230,  // 3 Iron
      13: 220,  // 4 Iron
      14: 210,  // 5 Iron
      15: 200,  // 6 Iron
      16: 190,  // 7 Iron
      17: 180,  // 8 Iron
      18: 170,  // 9 Iron
      19: 150,  // PW
      20: 140,  // AW
      21: 130,  // SW
      22: 120,  // LW
      23: 20,   // Putter
      24: 150   // GW
    };
    
    let html = '<div class="clubs-container">';
    
    // Sort clubs by type ID for consistent ordering
    clubs.sort((a, b) => a.clubTypeId - b.clubTypeId);
    
    clubs.forEach(club => {
      // Get saved custom range or use default
      const savedRange = window.customClubRanges?.[club.id];
      const maxDistance = savedRange?.max || defaultLimits[club.clubTypeId] || 200;
      
      html += `
        <div class="club-item" data-club-id="${club.id}" data-club-type-id="${club.clubTypeId}">
          <div class="club-info">
            <strong>${club.clubName}</strong>
            <span class="club-stats">Avg: ${Math.round(club.averageDistance)}m | Max: ${Math.round(club.maxDistance)}m</span>
          </div>
          <div class="club-range">
            <label>Max Distance (m):</label>
            <input type="number" class="club-max-input" value="${maxDistance}" min="0" max="500" step="5">
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    clubsList.innerHTML = html;
  }
  
  // Handle save clubs settings button
  saveClubsBtn.addEventListener('click', function() {
    const customRanges = {};
    
    // Collect all custom ranges
    document.querySelectorAll('.club-item').forEach(item => {
      const clubId = item.getAttribute('data-club-id');
      const maxInput = item.querySelector('.club-max-input');
      const maxValue = parseInt(maxInput.value);
      
      if (clubId && !isNaN(maxValue)) {
        customRanges[clubId] = { 
          max: maxValue,
          clubTypeId: parseInt(item.getAttribute('data-club-type-id'))
        };
      }
    });
    
    // Save to storage
    chrome.storage.local.set({ customClubRanges: customRanges }, function() {
      window.customClubRanges = customRanges;
      saveClubsBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveClubsBtn.textContent = 'Save Club Settings';
      }, 2000);
    });
  });
});