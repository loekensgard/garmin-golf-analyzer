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
  const saveTokenBtn = document.getElementById('save-token-btn');
  
  // Load saved token on startup
  chrome.storage.local.get(['bearerToken'], function(result) {
    if (result.bearerToken) {
      bearerTokenInput.value = result.bearerToken;
    }
  });
  
  // Save token when button is clicked
  saveTokenBtn.addEventListener('click', function() {
    const token = bearerTokenInput.value.trim();
    if (token) {
      chrome.storage.local.set({ bearerToken: token }, function() {
        saveTokenBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveTokenBtn.textContent = 'Save Token';
        }, 2000);
      });
    } else {
      alert('Please enter a bearer token');
    }
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
    return date.toLocaleDateString('en-US', { 
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
          const linkText = `${data.courseName || 'Unknown Course'} - ${shot.clubName}`;
          const shotUrl = `https://connect.garmin.com/modern/golf-shots/12345678-abcd-1234-5678-123456789abc/scorecard/${shot.scorecardId}/hole/${shot.holeNumber}`;
          
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
    } else {
      alert(`Error: ${message}`);
    }
  }
  
  // Handle scan button click
  scanBtn.addEventListener('click', function() {
    // Reset UI
    scanBtn.disabled = true;
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
  });
});