-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop tables if they exist
DROP TABLE IF EXISTS artists;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS priority_locations;
DROP TABLE IF EXISTS water_polygons;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Locations table (cities, regions, countries, etc.)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  country VARCHAR(100),

  boundary GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  raw_boundary GEOGRAPHY(MULTIPOLYGON, 4326),
  center GEOGRAPHY(POINT, 4326) NOT NULL,

  osm_id BIGINT NOT NULL,
  osm_type VARCHAR(20) NOT NULL,
  display_name TEXT,
  type VARCHAR(50),
  class VARCHAR(50),
  importance DECIMAL(5,4),
  bounding_box DECIMAL[4],
  address_components JSONB,

  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  needs_refresh BOOLEAN DEFAULT FALSE,

  CONSTRAINT uq_location_province UNIQUE (name, province),
  CONSTRAINT uq_location_osm UNIQUE (osm_id, osm_type)
);

-- Priority locations for search boosting (self-contained with all needed data)
-- Data should be seeded via scripts/seed-priority-locations.ts (fetches from Nominatim)
CREATE TABLE IF NOT EXISTS priority_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query VARCHAR(100) NOT NULL,
  osm_id BIGINT NOT NULL,
  osm_type VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  country VARCHAR(100),
  display_name TEXT NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  rank INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT uq_priority_query_osm UNIQUE (search_query, osm_id, osm_type)
);

-- Water Polygons table
CREATE TABLE IF NOT EXISTS water_polygons (
  gid SERIAL PRIMARY KEY,
  geom GEOGRAPHY(MULTIPOLYGON, 4326)
);

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  source_image TEXT,
  avatar_crop JSONB,
  profile_crop JSONB,

  original_city VARCHAR(100) NOT NULL,
  original_province VARCHAR(100) NOT NULL,
  original_country VARCHAR(100),
  original_display_name TEXT,
  original_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  original_city_id UUID REFERENCES locations(id),

  active_city VARCHAR(100) NOT NULL,
  active_province VARCHAR(100) NOT NULL,
  active_country VARCHAR(100),
  active_display_name TEXT,
  active_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  active_city_id UUID REFERENCES locations(id),

  original_display_coordinates GEOGRAPHY(POINT, 4326),
  active_display_coordinates GEOGRAPHY(POINT, 4326),

  instagram_url TEXT,
  twitter_url TEXT,
  apple_music_url TEXT,
  website_url TEXT,
  youtube_url TEXT,

  debut_year INTEGER,
  inactive_year INTEGER,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for locations
CREATE INDEX IF NOT EXISTS idx_locations_boundary ON locations USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_locations_raw_boundary ON locations USING GIST(raw_boundary);
CREATE INDEX IF NOT EXISTS idx_locations_name_trgm ON locations USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_display_name_trgm ON locations USING gin(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_locations_importance ON locations(importance DESC);

CREATE INDEX IF NOT EXISTS idx_priority_search_query ON priority_locations(search_query);
CREATE INDEX IF NOT EXISTS idx_water_polygons_geom ON water_polygons USING GIST(geom);

-- Indexes for artists
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
CREATE INDEX IF NOT EXISTS idx_artists_original_coords ON artists USING GIST(original_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_active_coords ON artists USING GIST(active_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_original_display_coords ON artists USING GIST(original_display_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_active_display_coords ON artists USING GIST(active_display_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_original_city ON artists(original_city);
CREATE INDEX IF NOT EXISTS idx_artists_active_city ON artists(active_city);
CREATE INDEX IF NOT EXISTS idx_artists_original_city_id ON artists(original_city_id);
CREATE INDEX IF NOT EXISTS idx_artists_active_city_id ON artists(active_city_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Priority locations are seeded via: npm run db:seed-priority
-- This fetches verified data from Nominatim instead of hardcoding
