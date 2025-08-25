# Garmin Golf Shot Analyzer - Chrome Extension

## Project Overview
A Chrome extension that analyzes golf shots in Garmin Connect to identify miscalculated shots, such as:
- Putter shots recorded at 60+ meters
- Pitching wedge (PW) shots recorded at 160+ meters  
- Other unrealistic club/distance combinations

## Architecture
- **Chrome Extension** with manifest v3
- **Content Script** (`content.js`) - Runs on connect.garmin.com pages, makes API calls
- **Background Script** (`background.js`) - Relays messages between popup and content script
- **Popup** (`popup.js` + `popup.html`) - User interface for triggering scans

## Current Status
✅ **Working**:
- Extension loads correctly
- Bearer token authentication working
- Golf clubs API call successful (`/gcs-golfcommunity/api/v2/club/player`)
- Club mapping and suspicious shot detection logic implemented

❌ **Issues**:
- Scorecards API not returning `scorecardId` field needed for fetching shot details
- Need to investigate correct scorecard data structure

## API Endpoints (Garmin Connect)

### Base URL
```
https://connect.garmin.com
```

### Authentication
Uses Bearer token from user's session:
```javascript
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIs...
```

### Required Headers
```javascript
{
  'Accept': 'application/json, text/plain, */*',
  'Authorization': `Bearer ${token}`,
  'NK': 'NT',
  'X-App-Ver': '5.16.0.31',
  'X-Lang': 'en-US',
  'di-backend': 'golf.garmin.com'
}
```

### Endpoints
1. **Golf Clubs**: `GET /gcs-golfcommunity/api/v2/club/player?per-page=1000&include-stats=true&maxClubTypeId=42`
2. **Scorecards**: `GET /gcs-golfcommunity/api/v2/scorecard/summary?user-locale=en&per-page=10000`
3. **Shot Details**: `GET /gcs-golfcommunity/api/v2/shot/scorecard/{scorecardId}/hole?image-size=IMG_730X730`

## Shot Analysis Logic

### Club Distance Limits (meters)
```javascript
const SHOT_LIMITS_BY_ID = {
  1: { max: 350 },   // Driver
  2: { max: 280 },   // 3 Wood
  19: { max: 150 },  // PW (Pitching Wedge)
  20: { max: 140 },  // AW (Approach Wedge)
  21: { max: 130 },  // SW (Sand Wedge)
  22: { max: 120 },  // LW (Lob Wedge)
  23: { max: 20 },   // Putter ⚠️ Most important for detection
  // ... full mapping in content.js
}
```

### Detection Rules
- **Putter**: Any shot > 20m is suspicious
- **Wedges**: Shots significantly over typical max distances
- **Irons/Woods**: Unrealistic distances for club type

## File Structure
```
garmin-club-fix/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker
├── content.js            # Main logic, API calls
├── popup.html            # Extension popup UI
├── popup.js              # Popup interaction logic
├── style.css             # Popup styling
└── CLAUDE.md            # This documentation
```

## Development Notes

### Current Token
```javascript
// Hard-coded in content.js getBearerToken() function
Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIs...
```

### Next Steps
1. **Debug scorecard data structure** - Investigate what fields are actually returned
2. **Fix scorecard ID extraction** - Ensure proper field mapping
3. **Test shot analysis** - Verify detection logic works with real data
4. **Error handling** - Improve user feedback for API failures

### Installation
1. Load extension in Chrome Developer Mode
2. Navigate to `connect.garmin.com`
3. Click extension icon to trigger scan
4. View results in popup showing suspicious shots by scorecard

## Testing
- **Test clubs API**: ✅ Working - returns club data with proper mapping
- **Test scorecards API**: ❌ Need to fix scorecard ID field extraction  
- **Test shot analysis**: ⏳ Pending scorecard fix
- **Test UI**: ✅ Working - displays results grouped by scorecard/course

## Known Issues
1. **Scorecard IDs missing** - API response structure different than expected
2. **Rate limiting** - May need delays between API calls for large datasets
3. **Token expiration** - Currently hard-coded, may need refresh logic

## Usage Instructions
1. Open Garmin Connect in Chrome
2. Go to any page (extension works site-wide on connect.garmin.com)
3. Click the extension icon 
4. Click "Scan Again" to analyze golf shots
5. View suspicious shots grouped by course and date
6. Look for obvious errors like "Putter - 60m" indicating GPS/tracking issues