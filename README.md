# Achizu

<img width="1179" height="495" alt="image" src="https://github.com/user-attachments/assets/46fed266-456d-4d5a-82a4-f5f735a3ff1c" />

A map that visualizes the geographic distribution of artists (musicians)—where they're from and where they're currently based.

Inspired by [Anitabi](https://www.anitabi.cn/map), an interactive map website visualizing real-world locations of anime scenes.

Click [here](https://achizu.com/) to enter the website.

## Features

1. Create your own artist world map by add artists
    - Add avatar, locations, career year and social media links.

2. Interact with the map
    - A cluster view keeping your artist layout intact at any zoom level.
    - Click an artist marker to see the profile.
    - Toggle two map layers and location views.

3. Interact with others
    - Search artists, locations, or users.
    - Sneak peek on other user's map.
    - Featured artists: randomly selected artists across the world, from different users.

4. Accessibility: The website is screen reader friendly. Create and manage your artist location set, even if you are unable to use a map. 


## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL with PostGIS, Supabase
- **Frontend:** React, Vite, Tailwind CSS
- **Maps:** Leaflet, OSM
- **Authentication:** Supabase Auth
- **Image Storage:** Cloudinary
- **Geocoding:** LocationIQ (Nominatim), Overpass

## API Endpoints

### Artists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/artists` | List artists (query: name, city, province, view) |
| GET | `/api/artists/:id` | Get artist by ID |
| POST | `/api/artists` | Create artist |
| PUT | `/api/artists/:id` | Update artist |
| DELETE | `/api/artists/:id` | Delete artist |
| GET | `/api/artists/stats/by-city` | Artist count per city |

### Cities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cities/search?q=<query>` | Fuzzy search cities (local DB) |
| GET | `/api/cities/search/nominatim?q=<query>` | Search via LocationIQ |
| GET | `/api/cities/:id` | Get city with boundary GeoJSON |
| POST | `/api/cities/reverse` | Reverse geocode coordinates |
