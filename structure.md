1. We need to get all the clubtypes to build our clubmatcher (this is where we find the correct clubs and can assign the hardcoded lenghts). 
2. This is done from the club/types endpoint: https://connect.garmin.com/gcs-golfcommunity/api/v2/club/types?maxClubTypeId=42
3. The data from this endpoint looks like this: 
[
    {
        "value": 1,
        "name": "Driver",
        "shaftLength": 45.5,
        "loftAngle": 10.5,
        "lieAngle": 58.5,
        "displayRange": "8°-12°",
        "valid": true
    },
    {
        "value": 2,
        "name": "3 Wood",
        "shaftLength": 43,
        "loftAngle": 15,
        "lieAngle": 56.5,
        "displayRange": "13°-17°",
        "valid": true
    }
]
4. We need to get the users clubs, this is done from this endpoint: https://connect.garmin.com/gcs-golfcommunity/api/v2/club/player?per-page=1000&include-stats=true&maxClubTypeId=42
5. The response from this request looks like this, where the id is the important factor. 
[
    {
        "id": 727631679,
        "clubTypeId": 7,
        "shaftLength": 45.5,
        "flexTypeId": "STIFF",
        "averageDistance": 0,
        "adviceDistance": 0,
        "retired": false,
        "deleted": false,
        "lastModifiedTime": "2025-08-24T19:59:00.000Z",
        "clubStats": {
            "id": 727631679,
            "averageDistance": 186.1,
            "maximumRecentDistance": 223.88,
            "minimumRecentDistance": 75.93,
            "maxLifetimeDistance": 334.43,
            "shotsCount": 271,
            "percentFairwayHit": 58.62,
            "percentFairwayLeft": 13.79,
            "percentFairwayRight": 27.59,
            "percentGreenHit": 8.33,
            "percentGreenMissLeft": 8.33,
            "percentGreenMissLong": 0,
            "percentGreenMissRight": 8.33,
            "percentGreenMissShort": 75,
            "lastModifiedTime": "2025-08-25T18:29:39.000Z"
        }
    }
]
6. Then we need to create a hardcoded range of the users clubs with id, name, and most important the hardcoded range of the club. (the hardcoded range will be used to find miscalculated shots from that club.)
7. Then we need to find all scorecards of the user. This is done to find the scorecard id. This is represented from the scorecardSummaries and id.This is done from this endpoint: https://connect.garmin.com/gcs-golfcommunity/api/v2/scorecard/summary?user-locale=en&per-page=10000. 
8. When we have exracted all the id's from the scorecardSummaries we can start to itterate all the scorecards after miscalculated shots.
9. Each scorecard can be retrieved from this endpoint https://connect.garmin.com/gcs-golfcommunity/api/v2/shot/scorecard/{scorecardId}/hole?image-size=IMG_730X730. 
10. The data from the scorecard endpoint looks like this: 
{
  "holeShots": [
    {
      "holeNumber": 1,
      "holeImageUrl": "https://birdseye.garmin.com/birdseye/golf/raster3d/3000/gd27000/gid027051/hole01/gid027051_hole01_0_260260.jpg?garmindlm=1756153185_9c4f631ce4b69a2e93f5bd6f77beb612",
      "pinPosition": {
        "lat": 714725269,
        "lon": 126275677,
        "x": 381,
        "y": 152
      },
      "shots": [
        {
          "id": 7887548426,
          "scorecardId": 288271572,
          "playerProfileId": 115279887,
          "shotTime": 1723277139000,
          "shotOrder": 1,
          "shotTimeZoneOffset": 7200000,
          "clubId": 727631027,
          "holeNumber": 1,
          "autoShotType": "USED",
          "startLoc": {
            "lat": 714709648,
            "lon": 126268575,
            "x": 386,
            "y": 607,
            "lie": "TeeBox",
            "lieSource": "CARTOGRAPHY"
          },
          "endLoc": {
            "lat": 714722659,
            "lon": 126276010,
            "x": 403,
            "y": 223,
            "lie": "Rough",
            "lieSource": "CARTOGRAPHY"
          },
          "meters": 126.287,
          "shotSource": "DEVICE_AUTO",
          "shotType": "TEE"
        },
      ]
    }
  ]
}
11. in this body we will look through all the holeShots and shots to match against our clubId with our hardcoded range and check if the meters property is outside our range. If it is we will return the scorecardId to the user. 

Ask me clarifying questions if needed. 