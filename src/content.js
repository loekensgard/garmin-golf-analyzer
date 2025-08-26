// Content script that runs in the context of Garmin Connect pages
// This has access to the page's cookies and can make API calls

const GARMIN_API_BASE = 'https://connect.garmin.com';

// Function to get the Bearer token from storage
async function getBearerToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bearerToken'], function(result) {
      if (result.bearerToken) {
        resolve(result.bearerToken);
      } else {
        resolve(null);
      }
    });
  });
}

// Club type mapping now done dynamically via fetchClubTypes()

// Hardcoded limits for detecting suspicious shots (in meters)
const SHOT_LIMITS_BY_ID = {
  1: { max: 350 },   // Driver
  2: { max: 280 },   // 3 Wood
  3: { max: 260 },   // 5 Wood
  4: { max: 250 },   // 7 Wood
  5: { max: 240 },   // 9 Wood
  6: { max: 240 },   // 2 Hybrid
  7: { max: 230 },   // 3 Hybrid
  8: { max: 220 },   // 4 Hybrid
  9: { max: 210 },   // 5 Hybrid
  10: { max: 200 },  // 6 Hybrid
  11: { max: 240 },  // 2 Iron
  12: { max: 230 },  // 3 Iron
  13: { max: 220 },  // 4 Iron
  14: { max: 210 },  // 5 Iron
  15: { max: 200 },  // 6 Iron
  16: { max: 190 },  // 7 Iron
  17: { max: 180 },  // 8 Iron
  18: { max: 170 },  // 9 Iron
  19: { max: 150 },  // PW
  20: { max: 140 },  // AW
  21: { max: 130 },  // SW
  22: { max: 120 },  // LW
  23: { max: 20 },   // Putter
  24: { max: 150 },  // GW
  'default': { min: 5, max: 300 }
};

// Fetch club types to build dynamic mapping
async function fetchClubTypes() {
  const token = await getBearerToken();
  if (!token) {
    throw new Error('Bearer token not found. Please enter a valid token in the extension popup.');
  }
  
  const response = await fetch(`${GARMIN_API_BASE}/gcs-golfcommunity/api/v2/club/types?maxClubTypeId=42`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${token}`,
      'NK': 'NT',
      'X-App-Ver': '5.16.0.31',
      'X-Lang': 'en-US',
      'di-backend': 'golf.garmin.com'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch club types: ${response.status}`);
  }
  
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Fetch all clubs for the user
async function fetchClubs() {
  const token = await getBearerToken();
  if (!token) {
    throw new Error('Bearer token not found. Please enter a valid token in the extension popup.');
  }
  
  
  const response = await fetch(`${GARMIN_API_BASE}/gcs-golfcommunity/api/v2/club/player?per-page=1000&include-stats=true&maxClubTypeId=42`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${token}`,
      'NK': 'NT',
      'X-App-Ver': '5.16.0.31',
      'X-Lang': 'en-US',
      'di-backend': 'golf.garmin.com'
    }
  });
  
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Club fetch failed:', response.status, text);
    throw new Error(`Failed to fetch clubs: ${response.status}`);
  }
  
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Fetch all scorecards
async function fetchScorecards() {
  const token = await getBearerToken();
  if (!token) {
    throw new Error('Bearer token not found. Please enter a valid token in the extension popup.');
  }
  
  const response = await fetch(`${GARMIN_API_BASE}/gcs-golfcommunity/api/v2/scorecard/summary?user-locale=en&per-page=10000`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${token}`,
      'NK': 'NT',
      'X-App-Ver': '5.16.0.31',
      'X-Lang': 'en-US',
      'di-backend': 'golf.garmin.com'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch scorecards: ${response.status}`);
  }
  
  const data = await response.json();
  return data.scorecardSummaries || [];
}

// Fetch shots for a specific scorecard
async function fetchShots(scorecardId) {
  const token = await getBearerToken();
  if (!token) {
    throw new Error('Bearer token not found. Please enter a valid token in the extension popup.');
  }
  
  const response = await fetch(`${GARMIN_API_BASE}/gcs-golfcommunity/api/v2/shot/scorecard/${scorecardId}/hole?image-size=IMG_730X730`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Authorization': `Bearer ${token}`,
      'NK': 'NT',
      'X-App-Ver': '5.16.0.31',
      'X-Lang': 'en-US',
      'di-backend': 'golf.garmin.com'
    }
  });
  
  if (!response.ok) {
    console.error(`Failed to fetch shots for scorecard ${scorecardId}: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data;
}

// Check if a shot is suspicious based on clubTypeId and distance
async function isShotSuspicious(clubId, clubTypeId, distanceMeters, customRanges) {
  if (distanceMeters == null) return false;
  
  // Check if there's a custom range for this specific club
  if (customRanges && customRanges[clubId]) {
    return distanceMeters > customRanges[clubId].max;
  }
  
  // Fall back to default limits
  let limits = SHOT_LIMITS_BY_ID[clubTypeId] || SHOT_LIMITS_BY_ID.default;
  
  // Special case for putter (clubTypeId 23) - only check max
  if (clubTypeId === 23) {
    return distanceMeters > limits.max;
  }
  
  // For other clubs, check both min and max
  if (limits.min !== undefined && distanceMeters < limits.min) {
    return true;
  }
  
  if (limits.max !== undefined && distanceMeters > limits.max) {
    return true;
  }
  
  return false;
}

// Main scan function
async function scanForBadShots(sendProgress) {
  const suspiciousShots = [];
  
  try {
    // Load custom club ranges from storage
    const customRanges = await new Promise((resolve) => {
      chrome.storage.local.get(['customClubRanges'], function(result) {
        resolve(result.customClubRanges || {});
      });
    });
    
    // Fetch club types first to build dynamic mapping
    sendProgress({ status: 'Fetching club types...', percent: 2 });
    const clubTypes = await fetchClubTypes();
    const clubTypeMap = {};
    clubTypes.forEach(clubType => {
      clubTypeMap[clubType.value] = clubType.name;
    });
    
    // Fetch clubs to build user's club map
    sendProgress({ status: 'Fetching clubs...', percent: 5 });
    const clubs = await fetchClubs();
    const clubMap = {};
    const clubToTypeMap = {};
    clubs.forEach(club => {
      const clubName = clubTypeMap[club.clubTypeId] || `Club Type ${club.clubTypeId}`;
      clubMap[club.id] = clubName;
      clubToTypeMap[club.id] = club.clubTypeId;
    });
    
    // Fetch all scorecards
    sendProgress({ status: 'Fetching scorecards...', percent: 10 });
    const scorecards = await fetchScorecards();
    
    if (scorecards.length === 0) {
      sendProgress({ status: 'No scorecards found', percent: 100 });
      return suspiciousShots;
    }
    
    // Process each scorecard
    const totalScorecards = scorecards.length;
    for (let i = 0; i < totalScorecards; i++) {
      const scorecard = scorecards[i];
      const progress = 10 + (i / totalScorecards) * 85;
      const shouldContinue = sendProgress({ 
        status: `Processing scorecard ${i + 1}/${totalScorecards}...`, 
        percent: progress 
      });
      
      // Check if scan was cancelled
      if (shouldContinue === false) {
        return suspiciousShots;
      }
      
      // Fetch shots for this scorecard
      const shotData = await fetchShots(scorecard.id);
      
      if (!shotData || !shotData.holeShots) continue;
      
      // Check each hole
      for (const hole of shotData.holeShots) {
        if (!hole.shots) continue;
        
        // Check each shot
        for (const shot of hole.shots) {
          const clubName = clubMap[shot.clubId] || 'Unknown';
          const clubTypeId = clubToTypeMap[shot.clubId];
          const distance = shot.meters;
          
          if (clubTypeId && await isShotSuspicious(shot.clubId, clubTypeId, distance, customRanges)) {
            suspiciousShots.push({
              scorecardId: scorecard.id,
              scorecardDate: scorecard.startDate,
              courseName: scorecard.courseName,
              holeNumber: hole.holeNumber,
              clubName: clubName,
              distance: distance,
              shotNumber: shot.shotOrder,
              playerProfileId: shot.playerProfileId
            });
          }
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    sendProgress({ status: 'Scan complete!', percent: 100 });
    return suspiciousShots;
    
  } catch (error) {
    console.error('Error during scan:', error);
    throw error;
  }
}

// Track current scan to allow cancellation
let currentScanId = null;
let cancelCurrentScan = false;

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanShots') {
    // Set new scan ID and reset cancel flag
    currentScanId = request.scanId;
    cancelCurrentScan = false;
    
    scanForBadShots((progress) => {
      // Check if scan was cancelled
      if (cancelCurrentScan || currentScanId !== request.scanId) {
        return false; // Stop scanning
      }
      // Send progress updates back with scan ID
      chrome.runtime.sendMessage({ 
        action: 'scanProgress', 
        data: progress,
        scanId: request.scanId 
      });
      return true; // Continue scanning
    }).then(results => {
      // Only send results if not cancelled
      if (!cancelCurrentScan && currentScanId === request.scanId) {
        sendResponse({ success: true, data: results });
      }
    }).catch(error => {
      if (!cancelCurrentScan && currentScanId === request.scanId) {
        sendResponse({ success: false, error: error.message });
      }
    });
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === 'cancelScan') {
    cancelCurrentScan = true;
    currentScanId = null;
    sendResponse({ success: true });
  }
  
  if (request.action === 'fetchUserClubs') {
    // Fetch both club types and user's clubs
    Promise.all([fetchClubTypes(), fetchClubs()])
      .then(([clubTypes, userClubs]) => {
        // Create a map of club type ID to name
        const clubTypeMap = {};
        clubTypes.forEach(clubType => {
          clubTypeMap[clubType.value] = clubType.name;
        });
        
        // Enhance user clubs with type names
        const enhancedClubs = userClubs.map(club => ({
          id: club.id,
          clubTypeId: club.clubTypeId,
          clubName: clubTypeMap[club.clubTypeId] || `Club Type ${club.clubTypeId}`,
          averageDistance: club.clubStats?.averageDistance || 0,
          maxDistance: club.clubStats?.maxLifetimeDistance || 0,
          shotsCount: club.clubStats?.shotsCount || 0
        }));
        
        sendResponse({ success: true, data: enhancedClubs });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Will respond asynchronously
  }
});