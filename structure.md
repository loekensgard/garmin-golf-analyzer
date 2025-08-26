# Garmin Golf Shot Analyzer - Technical Documentation

## Overview
This Chrome extension analyzes golf shots from Garmin Connect to identify miscalculated or erroneous shot distances that can corrupt your club statistics. It works by fetching your golf data directly from Garmin's API and comparing each shot against realistic distance ranges for each club type.

## How It Works

### Step 1: Fetch Club Types
First, we retrieve all available club types from Garmin to understand the club mapping.

**Endpoint:** `https://connect.garmin.com/gcs-golfcommunity/api/v2/club/types?maxClubTypeId=42`

**Response Example:**
```json
[
    {
        "value": 1,        // Club type ID (used for mapping)
        "name": "Driver",  // Display name
        // ...other properties (loft, lie, etc.)
    },
    {
        "value": 2,
        "name": "3 Wood",
        // ...other properties
    }
]
```

### Step 2: Fetch User's Clubs
We get the user's actual golf clubs to map club IDs to club types and names.

**Endpoint:** `https://connect.garmin.com/gcs-golfcommunity/api/v2/club/player?per-page=1000&include-stats=true&maxClubTypeId=42`

**Response Example:**
```json
[
    {
        "id": 727631679,       // Unique club ID (used in shot data)
        "clubTypeId": 7,       // Maps to club type
        "clubStats": {
            "averageDistance": 186.1,     // User's actual average
            "maxLifetimeDistance": 334.43 // Lifetime max (often erroneous)
            // ...other stats (fairway %, green %, etc.)
        }
        // ...other properties (shaft, flex, etc.)
    }
]
```

### Step 3: Define Distance Ranges
We use either hardcoded defaults or user-customized maximum distances for each club type.

**Default Ranges (meters):**
```javascript
{
    1: { max: 350 },   // Driver
    2: { max: 280 },   // 3 Wood
    19: { max: 150 },  // Pitching Wedge
    20: { max: 140 },  // Approach Wedge
    21: { max: 130 },  // Sand Wedge
    22: { max: 120 },  // Lob Wedge
    23: { max: 20 },   // Putter 
    // ... etc
}
```

**Why These Matter:**
- **Putter at 20m max**: Catches common GPS errors where putts show as 60+ meters
- **Wedges at 120-150m**: Identifies chip shots marked as full swings
- **Driver at 350m**: Reasonable max even for long hitters

### Step 4: Fetch All Scorecards
We retrieve all the user's scorecards to get their scorecard IDs.

**Endpoint:** `https://connect.garmin.com/gcs-golfcommunity/api/v2/scorecard/summary?user-locale=en&per-page=10000`

**What We Extract:**
- `scorecardSummaries[].id` - The scorecard ID needed to fetch shot details
- `scorecardSummaries[].startDate` - When the round was played
- `scorecardSummaries[].courseName` - Which course was played

### Step 5: Analyze Each Scorecard's Shots
For each scorecard, we fetch detailed shot data and check for suspicious distances.

**Endpoint:** `https://connect.garmin.com/gcs-golfcommunity/api/v2/shot/scorecard/{scorecardId}/hole?image-size=IMG_730X730`

**Response Structure:**
```json
{
  "holeShots": [
    {
      "holeNumber": 1,
      "shots": [
        {
          "id": 7887548426,
          "clubId": 727631027,    // Maps to user's club
          "holeNumber": 1,
          "meters": 126.287,      // THE KEY VALUE WE CHECK!
          "shotOrder": 1
          // ...other properties (locations, times, etc.)
        }
      ]
      // ...other properties (pin position, hole image, etc.)
    }
  ]
}
```

### Step 6: Detection Logic
For each shot, we:
1. Get the `clubId` from the shot data
2. Map it to the club type using our user's clubs data
3. Check if `meters` exceeds the maximum for that club type
4. If suspicious, add to results with all relevant info

**Detection Example:**
```javascript
// Shot with clubId: 727631023 (Putter, clubTypeId: 23)
// Distance: 65.5 meters
// Max allowed for putter: 20 meters
// Result: SUSPICIOUS! Add to results
```

### Step 7: Display Results
We group suspicious shots by scorecard and display them with:
- Course name and date
- Hole number
- Club used
- Recorded distance
- Direct link to view/edit in Garmin Connect 

## Authentication

The extension requires a Bearer token from an active Garmin Connect session:

**Required Headers:**
```javascript
{
  'Accept': 'application/json, text/plain, */*',
  'Authorization': `Bearer ${token}`,  // User must provide this
  'NK': 'NT',
  'X-App-Ver': '5.16.0.31',
  'X-Lang': 'en-US',
  'di-backend': 'golf.garmin.com'
}
```