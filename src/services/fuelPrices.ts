export interface FuelPricesResult {
  petrol: number;
  diesel: number;
  lastUpdated?: string; // Date string e.g. "2026-07-22"
}

/**
 * Fetches current daily average petrol and diesel prices for the Czech Republic
 * from open JSON endpoint (data.kurzy.cz).
 */
export async function fetchLiveFuelPrices(): Promise<FuelPricesResult> {
  const url = 'https://data.kurzy.cz/json/komodity/id[motorova-nafta;benzin-cz]mena[czk].json';
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('FAILED_TO_FETCH');
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('INVALID_DATA_STRUCTURE');
  }

  let petrol: number | null = null;
  let diesel: number | null = null;
  let lastUpdated: string | undefined = undefined;

  for (const item of data) {
    if (item.kod === 'benzin-cz' && Array.isArray(item.data) && item.data.length > 0) {
      const val = parseFloat(item.data[0].hodnota);
      if (!isNaN(val)) {
        petrol = parseFloat(val.toFixed(2));
        lastUpdated = item.data[0].den;
      }
    } else if (item.kod === 'motorova-nafta' && Array.isArray(item.data) && item.data.length > 0) {
      const val = parseFloat(item.data[0].hodnota);
      if (!isNaN(val)) {
        diesel = parseFloat(val.toFixed(2));
        if (!lastUpdated) {
          lastUpdated = item.data[0].den;
        }
      }
    }
  }

  if (petrol === null || diesel === null) {
    throw new Error('FUEL_PRICES_NOT_FOUND');
  }

  return {
    petrol,
    diesel,
    lastUpdated,
  };
}
