export interface Settings {
  avgConsumption: number;
  fuelType: 'petrol' | 'diesel';
  petrolPrice: number;
  dieselPrice: number;
  passengers: string[];
}

export interface PassengerState {
  name: string;
  checked: boolean;
  amount?: number;
  isManual?: boolean;
}

export interface ActiveTrip {
  startPoint: string;
  endPoint: string;
  stops: string[];
  roundTrip: boolean;
  passengers: PassengerState[];
  avgConsumption: number;
  fuelType: 'petrol' | 'diesel';
  fuelPrice: number;
  distanceKm: number;
  totalPrice: number;
  isFinished: boolean;
}



const SETTINGS_KEY = 'pay_way_settings';
const ACTIVE_TRIP_KEY = 'pay_way_active_trip';
const SESSION_KEY = 'pay_way_session';

const DEFAULT_SETTINGS: Settings = {
  avgConsumption: 6.5,
  fuelType: 'petrol',
  petrolPrice: 37,
  dieselPrice: 34,
  passengers: ['Fíla', 'Sam', 'Tomáš', 'Pája', 'Artur', 'Max', 'Ruby'],
};

export const getSettings = (): Settings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getActiveTrip = (): ActiveTrip | null => {
  try {
    const data = localStorage.getItem(ACTIVE_TRIP_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveActiveTrip = (trip: ActiveTrip): void => {
  localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
};

export const clearActiveTrip = (): void => {
  localStorage.removeItem(ACTIVE_TRIP_KEY);
};



export const getSession = (): boolean => {
  return localStorage.getItem(SESSION_KEY) === 'true';
};

export const setSession = (loggedIn: boolean): void => {
  if (loggedIn) {
    localStorage.setItem(SESSION_KEY, 'true');
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};
