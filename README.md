# Artist Location Map

Nerd: A full-stack web application that displays artist locations on an interactive map using PostGIS spatial queries and the Nominatim geocoding API.

Human: Built to visualize the geographic distribution of my favorite artists—where they're from and where they're currently based.

This project is inspired by [Anitabi](https://www.anitabi.cn/map), an interactive map website visualizing real-world location of Anime scenes for pilgrimage.

## Project Overview

This application tracks two locations per artist: their original location (hometown) and active location (current residence). Display coordinates are randomized within city boundaries using PostGIS `ST_GeneratePoints` to create visual clustering while maintaining geographic accuracy.

### Features

**Implemented:**
- **Dual location tracking** with PostGIS geography points and city boundary polygons
- **OSM ID-based city search** with fuzzy matching
- **Nominatim API integration** for geocoding and GeoJSON city boundary retrieval
- **Randomized display coordinates** within city boundaries using `ST_GeneratePoints`
- **Map view toggle** for switching between original and active locations
- **Supabase authentication** with email/password sign-in and user management
- **Artist Image upload** with cropping support via Cloudinary
- **Artist clustering** with marker clustering for better map visualization
- **Interactive location selection** - click on map to pick locations

**Planned:**
- A search engine for artists and cities
- More advanced artist filtering on UI level

## Current State

Not deployed to production. Requires environment configuration for production use.

The database is hosted on Supabase, and is accessible via Supabase Auth.

## Core Technology Stack

- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL with PostGIS extension, Supabase
- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Maps:** Leaflet
- **Authentication:** Supabase Auth
- **Image Storage:** Cloudinary
- **Testing:** Vitest, Docker
- **External APIs:** Nominatim

## Architecture

- **Controller-Service-Store Pattern:** HTTP layer, business logic, and data access are separated into distinct layers
- **Auth Middleware:** Supabase JWT verification for protected routes (create, update, delete)
- **PostGIS Spatial Queries:** Uses `ST_GeneratePoints` for coordinate randomization, `ST_MakePoint` for geography points, and GIST indexes for spatial searches
- **Dual Coordinate System:** Stores actual city centers (from Nominatim) and randomized display coordinates (generated within city boundary polygons) separately
- **Database Schema:** Two tables (`artists` and `city_boundaries`) with PostGIS geography types and foreign key references
- **Frontend State:** React Query for server state, React Context for auth state




## Getting Started

### Prerequisites
- Node.js (v18+)

### Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd artist-location-map

   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Environment Setup**

   Create `backend/.env`:
   ```
   PORT=3000
   NODE_ENV=development
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

   Create `frontend/.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset
   ```

3. **Run the application**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev  # http://localhost:3000

   # Terminal 2 - Frontend
   cd frontend && npm run dev  # http://localhost:5173
   ```


## API Endpoints

### Artists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/artists` | List all artists (supports query params: name, city, province, view) |
| GET | `/api/artists/:id` | Get single artist by ID |
| POST | `/api/artists` | Create new artist (supports OSM ID-based location) |
| PUT | `/api/artists/:id` | Update artist |
| DELETE | `/api/artists/:id` | Delete artist |
| GET | `/api/artists/stats/by-city` | Get artist count per city (supports view: original/active) |

### Cities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cities/search?q=<query>` | Fuzzy search cities (local DB with pg_trgm) |
| GET | `/api/cities/search/nominatim?q=<query>` | Search cities via Nominatim API |
| GET | `/api/cities/:id` | Get city by ID (includes boundary GeoJSON) |
| POST | `/api/cities/reverse` | Reverse geocode (coordinates → city) |

