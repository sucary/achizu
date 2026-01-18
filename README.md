# Artist Location Map

Nerd: A full-stack web application that displays artist locations on an interactive map using PostGIS spatial queries and the Nominatim geocoding API.

Human: Built to visualize the geographic distribution of my favorite artists—where they're from and where they're currently based.

This project is inspired by [Anitabi](https://www.anitabi.cn/map), an interactive map website visualizing real-world location of Anime scenes.

## Project Overview

This application tracks two locations per artist: their original location (hometown) and active location (current residence). Display coordinates are randomized within city boundaries using PostGIS `ST_GeneratePoints` to create visual clustering while maintaining geographic accuracy.

### Features

**Implemented:**
- **Dual location tracking** with PostGIS geography points and city boundary polygons
- **Nominatim API integration** for geocoding and GeoJSON city boundary retrieval
- **Randomized display coordinates** within city boundaries using `ST_GeneratePoints`
- Two views for original location and current location
- RESTful API with filtering by name, city, and province

**Planned:**
- Authentication and admin dashboard for managing content
- A search engine for artists and cities
- Image upload and adjustment service
- More advanced artist filtering on UI level
- Refined visual and interaction

## Current State

Not deployed to production. Requires environment configuration and authentication implementation for production use.

The application is functional in development. It includes a REST API with CRUD endpoints, PostgreSQL database with PostGIS, and a React frontend with Leaflet map integration. The Nominatim API is used for geocoding city names to coordinates and retrieving GeoJSON city boundaries.

## Core Technology Stack

- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL with PostGIS extension
- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Maps:** Leaflet with leaflet.markercluster
- **Testing:** Vitest, Docker
- **External APIs:** Nominatim (OpenStreetMap) for geocoding

## Architecture

- **Controller-Service-Store Pattern:** HTTP layer, business logic, and data access are separated into distinct layers
- **PostGIS Spatial Queries:** Uses `ST_GeneratePoints` for coordinate randomization, `ST_MakePoint` for geography points, and GIST indexes for spatial searches
- **Dual Coordinate System:** Stores actual city centers (from Nominatim) and randomized display coordinates (generated within city boundary polygons) separately
- **Database Schema:** Two tables (`artists` and `city_boundaries`) with PostGIS geography types and foreign key references




## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) with PostGIS extension installed
- (optional) Docker and Docker Compose for running tests

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd artist-location-map
   ```

2. **Database Setup**
   ```bash
   # Create the database in PostgreSQL
   psql -U postgres -c "CREATE DATABASE artist_map;"

   # Enable PostGIS extension
   psql -U postgres -d artist_map -c "CREATE EXTENSION postgis;"
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install

   # Create .env file with your PostgreSQL credentials
   cat > .env << EOF
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=artist_map
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432
   PORT=5000
   EOF

   # Initialize database schema (creates tables and indexes)
   npm run db:init

   # (Optional) Seed with sample data
   npm run db:seed
   ```

4. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start Backend**
   ```bash
   cd backend
   npm run dev  # Runs on http://localhost:5000
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm run dev  # Runs on http://localhost:5173 (or next available port)
   ```

3. **Access the application**
   - Open your browser to `http://localhost:5173`
   - The map should load with any seeded artists

## Testing

The project includes Vitest for backend testing with a dedicated test database running in Docker. Test infrastructure is set up for:
- Unit tests for services and utilities
- Integration tests for database operations
- API endpoint testing

### Running Tests

```bash
# Backend tests (requires Docker)
cd backend
npm run test:db:up    # Start test database in Docker (port 5433)
npm run test          # Run test suite
npm run test:db:down  # Stop test database

# Note: Tests use a separate PostgreSQL database in Docker (port 5433)
# to avoid conflicts with the development database (port 5432)
```


## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/artists` | List all artists (supports query params: name, city, province) |
| GET | `/api/artists/:id` | Get single artist by ID |
| POST | `/api/artists` | Create new artist |
| PUT | `/api/artists/:id` | Update artist |
| DELETE | `/api/artists/:id` | Delete artist |
| GET | `/api/artists/stats/by-city` | Get artist count per city (supports view: original/active) |

