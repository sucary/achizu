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

The full application will be containerized with Docker when ready for production. Currently, only the database is containerized using Docker Compose.

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
- Docker and Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd artist-location-map
   ```

2. **Environment Setup**
   ```bash
   # Create root .env file for Docker
   cat > .env << EOF
   DB_PASSWORD=your_secure_password
   EOF

   # Create backend .env file
   cat > backend/.env << EOF
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=artist_map
   DB_PASSWORD=your_secure_password
   DB_PORT=5432
   PORT=3000
   NODE_ENV=development
   EOF
   ```

3. **Database Setup**
   ```bash
   # Start PostgreSQL with PostGIS in Docker
   docker-compose up -d

   # Wait for database to be ready
   docker-compose ps

   # Initialize schema, import ocean data, and seed
   cd backend
   npm install
   npm run db:setup

   ```

   ```bash
   # If you entcounter problems while setting up the databse, try to disable local PG service
   net stop postgresql-x64-18
   
   # then retry setting up the database
   npm run db:setup
   ```

4. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start Docker Database** (if not already running)
   ```bash
   docker-compose up -d
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm run dev  # Runs on http://localhost:3000
   ```

3. **Start Frontend**
   ```bash
   cd frontend
   npm run dev  # Runs on http://localhost:5173
   ```

4. **Access the application**
   - Open your browser to `http://localhost:5173`
   - The map should load with seeded artists

## Testing

### Automated Tests (Vitest)

The project includes Vitest for backend testing with a test database running in Docker:

```bash
cd backend

# Start test database in Docker (port 5433)
npm run test:db:up

# Run test suite
npm test

# Stop test database
npm run test:db:down
```

### Manual API Testing

Test API endpoints interactively without hitting Nominatim rate limits:

```bash
# Ensure Docker database is running
docker-compose up -d

# Start backend
npm run dev

# In another terminal, run manual tests
npm run test:api
```

### Database Inspection

```bash
# View all artists
npm run inspect:db artists

# View all cities
npm run inspect:db cities
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

