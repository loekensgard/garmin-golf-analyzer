# Garmin Golf Shot Analyzer - Chrome Extension

## Project Overview
A Chrome extension that analyzes golf shots in Garmin Connect to identify miscalculated shots, such as:
- Putter shots recorded at 60+ meters
- Pitching wedge (PW) shots recorded at 160+ meters  
- Other unrealistic club/distance combinations

## Architecture
- **Chrome Extension** with manifest v3
- **Content Script** (`content.js`) - Runs on connect.garmin.com pages, makes API calls
- **Background Script** (`background.js`) - Relays messages between popup and content script, manages scan state
- **Popup** (`popup.js` + `popup.html`) - User interface for triggering scans and configuring settings

## Current Status
✅ **Fully Working**:
- Extension loads and functions correctly
- Bearer token authentication with user input
- User ID configuration for shot links
- Golf clubs API integration with full club mapping
- Scorecard scanning and shot analysis
- Custom club distance range configuration
- Background scan state management (survives popup close/reopen)
- Results display with direct links to Garmin Connect
- Token expiration handling with auto-clear
- Club customization UI with personal distance settings

## Features Implemented

### 🔍 Core Scanning
- Scans all user scorecards for suspicious shots
- Progress tracking with real-time updates
- Cancellation support for multiple scan prevention
- Background processing (popup can be closed during scan)

### ⚙️ Configuration Options  
- **Bearer Token**: User-provided authentication token
- **User ID**: Configurable for correct shot detail links
- **Custom Club Ranges**: Personal maximum distances for each club
- **Auto-clear expired tokens**: Removes invalid tokens on 401/403 errors

### 🎯 Smart Detection
- Uses default hardcoded limits or user-customized ranges
- Focuses on most problematic shots (especially putter GPS errors)
- Club-specific thresholds based on realistic distances

### 📊 Results Display
- Groups suspicious shots by scorecard/course
- Shows hole number, club used, and recorded distance
- Direct links to edit shots in Garmin Connect (opens in background tabs)
- Preserves popup state when clicking links

## API Endpoints (Garmin Connect)

### Base URL
```
https://connect.garmin.com
```

### Authentication
Uses Bearer token from user's session (user-provided):
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
1. **Club Types**: `GET /gcs-golfcommunity/api/v2/club/types?maxClubTypeId=42`
2. **Golf Clubs**: `GET /gcs-golfcommunity/api/v2/club/player?per-page=1000&include-stats=true&maxClubTypeId=42`
3. **Scorecards**: `GET /gcs-golfcommunity/api/v2/scorecard/summary?user-locale=en&per-page=10000`
4. **Shot Details**: `GET /gcs-golfcommunity/api/v2/shot/scorecard/{scorecardId}/hole?image-size=IMG_730X730`

## Shot Analysis Logic

### Default Club Distance Limits (meters)
```javascript
const SHOT_LIMITS_BY_ID = {
  1: { max: 350 },   // Driver
  2: { max: 280 },   // 3 Wood
  19: { max: 150 },  // PW (Pitching Wedge)
  20: { max: 140 },  // AW (Approach Wedge)
  21: { max: 130 },  // SW (Sand Wedge)
  22: { max: 120 },  // LW (Lob Wedge)
  23: { max: 20 },   // Putter
  // ... full mapping in content.js
}
```

### Custom Range Override
- Users can fetch their clubs and set personal maximum distances
- Custom ranges are stored in Chrome local storage
- Detection logic prioritizes custom ranges over defaults
- Allows for personalized detection based on individual ability

### Detection Rules
- **Putter**: Any shot > 20m (or custom) is suspicious
- **Wedges**: Shots significantly over typical max distances
- **Irons/Woods**: Unrealistic distances for club type
- **Custom clubs**: Uses user-defined thresholds

## File Structure
```
garmin-club-fix/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker, scan state management
├── content.js             # Main logic, API calls, shot analysis
├── popup.html             # Extension popup UI
├── popup.js               # Popup interaction logic
├── style.css              # Popup styling
├── README.md              # User documentation
├── structure.md           # Technical documentation
└── CLAUDE.md              # This development documentation
```

## State Management

### Scan State Persistence
- Scans continue even if popup is closed
- Reopening popup shows current progress
- Unique scan IDs prevent conflicts
- Automatic cancellation when starting new scan

### Data Storage (Chrome Local Storage)
- `bearerToken`: User's authentication token
- `userId`: User's Garmin user ID for shot links
- `customClubRanges`: User's custom distance settings per club
- `scanInProgress`: Current scan state
- `lastScanResults`: Most recent scan results

## User Interface

### Main Controls
- **Bearer Token**: Textarea for authentication token
- **User ID**: Input field for user identification
- **Save Settings**: Stores token and user ID
- **Fetch My Clubs**: Retrieves user's clubs for customization
- **Scan for Bad Shots**: Starts analysis process

### Club Customization
- Displays all user clubs with current statistics
- Shows average distance and lifetime max for each club
- Allows adjustment of maximum distance thresholds
- Saves custom ranges for future scans

### Results Display
- Groups by scorecard (course/date)
- Lists suspicious shots with hole, club, distance
- Provides direct links to Garmin Connect for editing
- Links open in background tabs to preserve popup

## Development Status

### ✅ Completed Features
- Full API integration with all required endpoints
- User authentication and configuration
- Complete shot analysis with custom ranges
- State management and persistence
- Comprehensive UI with club customization
- Error handling and token management
- Background scanning capabilities
- Results display with navigation

### 🚀 Ready for Production
- All core functionality implemented and tested
- Clean, production-ready code
- Comprehensive documentation
- User-friendly interface
- Robust error handling

## Common Issues & Solutions

### Token Expiration
- Tokens typically expire after 24-48 hours
- Extension auto-detects 401/403 errors and clears token
- User needs to get fresh token from dev tools

### No Suspicious Shots
- May indicate good GPS tracking or conservative distance ranges  
- Users can adjust custom club ranges to be more sensitive
- Some golfers may genuinely have few tracking errors

### API Rate Limiting
- Built-in delays prevent most rate limit issues
- Large scan datasets (100+ rounds) may take several minutes
- Background processing allows continued browsing

This extension is now feature-complete and production-ready for helping golfers identify and fix GPS tracking errors in their Garmin Connect data.