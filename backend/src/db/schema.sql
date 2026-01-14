-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- City table
CREATE TABLE IF NOT EXISTS city_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  country VARCHAR(100),
  
  boundary GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  
  osm_id BIGINT UNIQUE,
  last_updated TIMESTAMP DEFAULT NOW(),
  needs_refresh BOOLEAN DEFAULT FALSE,

  -- Duplication check
  CONSTRAINT uq_city_province UNIQUE (name, province)
);

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  profile_picture TEXT,

  original_city VARCHAR(100) NOT NULL,
  original_province VARCHAR(100) NOT NULL,
  original_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  original_city_id UUID REFERENCES city_boundaries(id),

  active_city VARCHAR(100) NOT NULL,
  active_province VARCHAR(100) NOT NULL,
  active_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  active_city_id UUID REFERENCES city_boundaries(id),

  original_display_coordinates GEOGRAPHY(POINT, 4326),
  active_display_coordinates GEOGRAPHY(POINT, 4326),

  instagram_url TEXT,
  twitter_url TEXT,
  spotify_url TEXT,
  website_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_artists_original_coords ON artists USING GIST(original_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_active_coords ON artists USING GIST(active_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_original_display_coords ON artists USING GIST(original_display_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_active_display_coords ON artists USING GIST(active_display_coordinates);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_original_city ON artists(original_city);
CREATE INDEX IF NOT EXISTS idx_artists_active_city ON artists(active_city);
CREATE INDEX IF NOT EXISTS idx_artists_original_city_id ON artists(original_city_id);
CREATE INDEX IF NOT EXISTS idx_artists_active_city_id ON artists(active_city_id);

CREATE INDEX IF NOT EXISTS idx_city_boundaries_boundary ON city_boundaries USING GIST(boundary);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();