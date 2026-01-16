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
|Link|---|---|---|---|
| `type`    | String   | No       | Filter by user role. Values: `user`, `driver`.                              | -       |
| `phone`   | String   | No       | Filter by phone number (supports partial match).                            | -       |
| `email`   | String   | No       | Filter by email address (supports partial match).                           | -       |
| `page`    | Number   | No       | Page number for pagination.                                                 | 1       |
| `limit`   | Number   | No       | Number of items per page.                                                   | 20      |

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

### 2. Get Metrics

Retrieve aggregated metrics for the survey data, including total counts, breakdown by role, and breakdown by agent.

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
      "agent": "Agent A",
      "count": 300
    },
    {
      "agent": "Agent B",
      "count": 250
    },
    {
      "agent": "Unknown",
      "count": 50
    }
  ]
}
```

The `byAgent` metric attempts to extract the agent's name from the `raw_data` JSON field using common keys such as "Agent Name", "Enumerator Name", or "Interviewer Name".

---

## Data Structure

### User Survey Entity

| Field          | Type      | Description                                      |
|----------------|-----------|--------------------------------------------------|
| `id`           | Integer   | Unique identifier.                               |
| `role`         | String    | `user` or `driver`.                              |
| `profession`   | String    | Respondent's profession.                         |
| `email`        | String    | Respondent's email.                              |
| `phone`        | String    | Normalize phone number (+234 format).            |
| `name`         | String    | Respondent's name.                               |
| `raw_data`     | JSONB     | Full raw record from the source CSV.             |
| `is_duplicate` | Integer   | 1 if duplicate, 0 otherwise (reserved for flag). |
| `created_at`   | Timestamp | Date of insertion.                               |

