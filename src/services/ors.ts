export interface OrsSuggestion {
  label: string;
  coordinates: [number, number]; // [lon, lat]
}

export interface OrsRouteResult {
  distanceKm: number;
  durationMins: number;
}

/**
 * Searches for addresses using OpenRouteService autocomplete.
 */
export async function searchAddress(query: string, apiKey: string): Promise<OrsSuggestion[]> {
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${apiKey}&text=${encodedQuery}&boundary.country=CZ&size=5`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }
    throw new Error('GEOPROCESSING_FAILED');
  }

  const data = await response.json();
  if (!data.features || !Array.isArray(data.features)) {
    return [];
  }

  return data.features.map((feature: any) => ({
    label: feature.properties.label || feature.properties.name || 'Unknown address',
    coordinates: feature.geometry.coordinates as [number, number],
  }));
}

/**
 * Calculates distance and duration for a sequence of coordinates.
 * coordinates is an array of [lon, lat] pairs.
 */
export async function calculateRoute(
  coordinates: [number, number][],
  apiKey: string
): Promise<OrsRouteResult> {
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  if (coordinates.length < 2) {
    throw new Error('INVALID_COORDINATES_COUNT');
  }

  const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({
      coordinates,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }
    throw new Error('ROUTING_FAILED');
  }

  const data = await response.json();
  const route = data.features?.[0];
  if (!route || !route.properties?.summary) {
    throw new Error('NO_ROUTE_FOUND');
  }

  const { distance, duration } = route.properties.summary; // distance in meters, duration in seconds
  
  return {
    distanceKm: parseFloat((distance / 1000).toFixed(2)),
    durationMins: Math.round(duration / 60),
  };
}
