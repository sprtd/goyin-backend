# Survey Sync API Documentation

## Overview

The Survey Sync module exposes endpoints for administrators to query survey data synced from external sources (e.g., ODK, CSV uploads) and view aggregation metrics.

**Base URL**: `/admin/survey-sync`

---

## Endpoints

### 1. List Surveys

Retrieve a paginated list of survey responses. Supports filtering by role, phone number, and email.

**Endpoint**: `GET /`

**Query Parameters**:

| Parameter | Type     | Required | Description                                                                 | Default |
|-----------|----------|----------|-----------------------------------------------------------------------------|---------|
| `type`    | String   | No       | Filter by user role. Values: `user`, `driver`.                              | -       |
| `phone`   | String   | No       | Filter by phone number (supports partial match).                            | -       |
| `email`   | String   | No       | Filter by email address (supports partial match).                           | -       |
| `page`    | Number   | No       | Page number for pagination.                                                 | 1       |
| `limit`   | Number   | No       | Number of items per page (max 100).                                         | 20      |

**Response**:

```json
{
  "data": [
    {
      "id": 1,
      "role": "driver",
      "profession": "Driver",
      "email": "driver@example.com",
      "phone": "+2348000000000",
      "name": "John Doe",
      "raw_data": { ... },
      "is_duplicate": 0,
      "created_at": "2023-10-27T10:00:00.000Z",
      "updated_at": "2023-10-27T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### 2. Get Survey by ID

Retrieve a single survey record by its unique identifier.

**Endpoint**: `GET /:id`

**Path Parameters**:

| Parameter | Type   | Required | Description                                      |
|-----------|--------|----------|--------------------------------------------------|
| `id`      | Integer| Yes      | The unique ID of the survey record to retrieve.  |

**Response (Success)**:

```json
{
  "id": 1,
  "role": "driver",
  "profession": "Driver",
  "email": "driver@example.com",
  "phone": "+2348000000000",
  "name": "John Doe",
  "raw_data": { ... },
  "is_duplicate": 0,
  "created_at": "2023-10-27T10:00:00.000Z",
  "updated_at": "2023-10-27T10:00:00.000Z"
}
```

**Response (Not Found)**:

```json
{
  "message": "Survey with ID 834 not found",
  "error": "Not Found",
  "statusCode": 404
}
```

---

### 3. Get Metrics (Agent Performance)

Retrieve aggregated metrics for the survey data, including:
- Total surveys count
- Breakdown by role (user vs driver)
- **Agent performance metrics** - tracked by unique agent phone number with counts for driver and user surveys collected

**Endpoint**: `GET /metrics`

**Query Parameters**: None

**Response**:

```json
{
  "totalSurveys": 1500,
  "byRole": [
    {
      "role": "user",
      "count": 1000
    },
    {
      "role": "driver",
      "count": 500
    }
  ],
  "byAgent": [
    {
      "agentPhone": "09163436642",
      "totalCount": 85,
      "driverCount": 35,
      "userCount": 50
    },
    {
      "agentPhone": "Unknown",
      "totalCount": 5,
      "driverCount": 2,
      "userCount": 3
    }
  ],
  "agentCount": 12
}
```

### Metrics Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `totalSurveys` | Number | Total number of survey responses in the database |
| `byRole` | Array | Breakdown of surveys by role (user/driver) |
| `byAgent` | Array | List of agents with their performance metrics |
| `byAgent[].agentPhone` | String | The unique agent phone number (identifier) |
| `byAgent[].totalCount` | Number | Total surveys collected by this agent |
| `byAgent[].driverCount` | Number | Number of driver surveys collected |
| `byAgent[].userCount` | Number | Number of user surveys collected |
| `agentCount` | Number | Total number of unique agents (excluding "Unknown") |

---

## Data Structure

### User Survey Entity

| Field          | Type      | Description                                      |
|----------------|-----------|--------------------------------------------------|
| `id`           | Integer   | Unique identifier.                               |
| `role`         | String    | `user` or `driver`.                              |
| `profession`   | String    | Respondent's profession.                         |
| `email`        | String    | Respondent's email.                              |
| `phone`        | String    | Normalized phone number (+234 format).           |
| `name`         | String    | Respondent's name.                               |
| `raw_data`     | JSONB     | Full raw record from the source CSV.             |
| `is_duplicate` | Integer   | 1 if duplicate, 0 otherwise (reserved for flag). |
| `created_at`   | Timestamp | Date of insertion.                               |

### Raw Data Fields (CSV Headers)

The `raw_data` field contains the complete CSV row as a JSON object. Key fields used for agent tracking:

| CSV Header | Description |
|------------|-------------|
| `Agent's Phone number ` | The phone number of the agent who conducted the survey (note: has trailing space) |
| `Name` / `Driver Name` | Name of the respondent |
| `Phone Number: ` / `Phone Number` | Phone number of the respondent |
| `Email` | Email of the respondent |
| `Profession` | Profession of the respondent |
