import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trash2,
  ArrowRight,
  Car,
  KeyRound,
  Wrench,
  Flag,
  Save,
  Trophy,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Compass,
  Coins
} from 'lucide-react';

import {
  getSettings,
  saveSettings,
  getActiveTrip,
  saveActiveTrip,
  clearActiveTrip,
  getSession,
  setSession,
  type Settings,
  type ActiveTrip,
  type PassengerState
} from './utils/storage';

import { searchAddress, calculateRoute, type OrsSuggestion } from './services/ors';
import { PaymentQrCode } from './components/PaymentQrCode';
import { playVolvoStartupSound } from './utils/engineSound';

function App() {
  // Video reference for intro video
  const videoRef = useRef<HTMLVideoElement>(null);

  // Volvo Startup Ignition screen state
  const [isIgnited, setIsIgnited] = useState<boolean>(() => {
    return sessionStorage.getItem('engine_ignited') === 'true';
  });
  const [isLoadingSound, setIsLoadingSound] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isClicked, setIsClicked] = useState<boolean>(false);

  // Navigation & Auth
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<boolean>(false);

  // Navigation Screen State: 'active-trip' | 'summary' | 'settings'
  const [currentScreen, setCurrentScreen] = useState<'active-trip' | 'summary' | 'settings'>('active-trip');

  // Compass Orientation State
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const isOrientationListenerAdded = useRef<boolean>(false);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const webkitHeading = (e as any).webkitCompassHeading;
    if (webkitHeading !== undefined) {
      // iOS: webkitCompassHeading is clockwise, so negate to rotate needle counter-clockwise to point North
      setDeviceHeading(-webkitHeading);
    } else if (e.alpha !== null) {
      // Android alpha is counter-clockwise, so rotate needle clockwise (positive) to point North
      setDeviceHeading(e.alpha);
    }
  }, []);

  const requestOrientationPermission = useCallback(async () => {
    if (isOrientationListenerAdded.current) return;

    const useAbsolute = 'ondeviceorientationabsolute' in window;
    const eventName = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';

    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          window.addEventListener(eventName, handleOrientation);
          isOrientationListenerAdded.current = true;
        }
      } catch (error) {
        console.warn('DeviceOrientation permission request failed:', error);
      }
    } else {
      window.addEventListener(eventName, handleOrientation);
      isOrientationListenerAdded.current = true;
    }
  }, [handleOrientation]);

  useEffect(() => {
    const useAbsolute = 'ondeviceorientationabsolute' in window;
    const eventName = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';

    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission !== 'function'
    ) {
      window.addEventListener(eventName, handleOrientation);
      isOrientationListenerAdded.current = true;
    }
    return () => {
      window.removeEventListener(eventName, handleOrientation);
    };
  }, [handleOrientation]);

  // Touch swipe handling for mobile navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.table-responsive')) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isLoggedIn) return;
    if (touchStartX.current === null || touchStartY.current === null) return;

    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Trigger swipe if the horizontal movement is significant and larger than vertical movement
    if (Math.abs(diffX) > 80 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        // Swipe Right (finger moves left-to-right) -> Go to Trasa (left tab)
        if (currentScreen === 'settings') {
          setCurrentScreen('active-trip');
        }
      } else {
        // Swipe Left (finger moves right-to-left) -> Go to Settings (right tab)
        if (currentScreen === 'active-trip') {
          setCurrentScreen('settings');
        }
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Settings State
  const [settings, setSettingsState] = useState<Settings>(getSettings());
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<boolean>(false);
  const [newPassengerName, setNewPassengerName] = useState<string>('');

  // Active Trip State
  const [startPoint, setStartPoint] = useState<string>('');
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<string>('');
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [stops, setStops] = useState<string[]>([]);
  const [stopCoords, setStopCoords] = useState<([number, number] | null)[]>([]);

  const [roundTrip, setRoundTrip] = useState<boolean>(false);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [isManualDistance, setIsManualDistance] = useState<boolean>(false);

  const [tripPassengers, setTripPassengers] = useState<PassengerState[]>([]);
  const [shouldRound, setShouldRound] = useState<boolean>(true);

  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [routingError, setRoutingError] = useState<string>('');

  // Autocomplete UI State
  const [suggestions, setSuggestions] = useState<OrsSuggestion[]>([]);
  const [activeAutocomplete, setActiveAutocomplete] = useState<{
    type: 'start' | 'end' | 'stop';
    index?: number;
  } | null>(null);

  // Summary Data State (stores details of finished trip to render QR codes)
  const [summaryData, setSummaryData] = useState<{
    startPoint: string;
    endPoint: string;
    stops: string[];
    distanceKm: number;
    totalPrice: number;
    roundTrip: boolean;
    passengers: PassengerState[];
  } | null>(null);
  const [summaryMsg, setSummaryMsg] = useState<string>('Nafta');
  const summaryVs = '';

  // Debounce ref for address lookup
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculation formulas (Reads consumption and fuel prices directly from Settings)
  const calculateTotalPrice = useCallback((): number => {
    const effectiveDistance = roundTrip ? distanceKm * 2 : distanceKm;
    const fuelPrice = settings.fuelType === 'petrol' ? settings.petrolPrice : settings.dieselPrice;
    const totalLitres = effectiveDistance * (settings.avgConsumption / 100);
    const rawCost = totalLitres * fuelPrice;
    return parseFloat(rawCost.toFixed(2));
  }, [roundTrip, distanceKm, settings.fuelType, settings.avgConsumption, settings.petrolPrice, settings.dieselPrice]);

  // Load session, configurations and restore state
  useEffect(() => {
    const session = getSession();
    setIsLoggedIn(session);

    const savedSettings = getSettings();
    setSettingsState(savedSettings);

    // Restore active trip if available
    const active = getActiveTrip();
    if (active) {
      setStartPoint(active.startPoint);
      setEndPoint(active.endPoint);
      setStops(active.stops);
      setRoundTrip(active.roundTrip);
      // Sync active trip passengers with savedSettings.passengers to prevent mismatch
      const syncedPassengers = savedSettings.passengers.map(name => {
        const existing = active.passengers.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
        return existing 
          ? { ...existing, name } // Ensure name matches the cleaned settings name
          : { name, checked: false, amount: 0, isManual: false };
      });
      setTripPassengers(syncedPassengers);
      setDistanceKm(active.distanceKm);
      setIsManualDistance(active.distanceKm > 0 && !active.startPoint);

      setCurrentScreen('active-trip');
    } else {
      // Initialize trip passengers if no active trip is restored
      setTripPassengers(savedSettings.passengers.map(name => ({
        name,
        checked: false,
        amount: 0,
        isManual: false
      })));
    }
  }, []);

  // Save active trip automatically when any key trip states change
  useEffect(() => {
    if (isLoggedIn && (startPoint || endPoint || stops.length > 0 || distanceKm > 0 || tripPassengers.length > 0)) {
      const activeData: ActiveTrip = {
        startPoint,
        endPoint,
        stops,
        roundTrip,
        passengers: tripPassengers,
        avgConsumption: settings.avgConsumption,
        fuelType: settings.fuelType,
        fuelPrice: settings.fuelType === 'petrol' ? settings.petrolPrice : settings.dieselPrice,
        distanceKm,
        totalPrice: calculateTotalPrice(),
        isFinished: false
      };
      saveActiveTrip(activeData);
    }
  }, [
    startPoint, endPoint, stops, roundTrip,
    tripPassengers, distanceKm, isLoggedIn, settings, calculateTotalPrice
  ]);


  // Get active API key (strictly from .env)
  const getOrsApiKey = (): string => {
    return import.meta.env.VITE_ORS_API_KEY || '';
  };

  // Helper to trigger visual transition timers (aligned with 11.67s sound length)
  const triggerVisualFallbackTimers = () => {
    // Trigger visual overlay fade out at 11.0 seconds (matching audio duration)
    setTimeout(() => {
      setIsFadingOut(true);
    }, 11000);

    // Transition overlay out completely at 11.6 seconds
    setTimeout(() => {
      setIsIgnited(true);
      sessionStorage.setItem('engine_ignited', 'true');
    }, 11600);
  };



  // Ignition sound & loading screen handler
  const handleIgnition = () => {
    // 1. Play the video FIRST and synchronously inside the click handler to satisfy strict mobile browser constraints!
    let videoPromise: Promise<void> | undefined;
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.currentTime = 0; // ensure play starts from beginning
      videoPromise = videoRef.current.play();
    }

    // 2. Play the startup soundtrack immediately
    playVolvoStartupSound();

    // 3. Trigger the spring click animation
    setIsClicked(true);

    // 4. Delay transition to loading screen until button animation bounces back up (450ms)
    setTimeout(() => {
      setIsLoadingSound(true);
      requestOrientationPermission();

      // 5. Handle video playback promise results
      if (videoPromise !== undefined) {
        videoPromise
          .then(() => {
            console.log("Muted video playback started successfully.");
          })
          .catch(err => {
            console.warn("Muted video play blocked or failed. Running fallback visual transition...", err);
            // If the video failed, we trigger the visual transition fallback timers
            triggerVisualFallbackTimers();
          });
      } else {
        triggerVisualFallbackTimers();
      }
    }, 450);
  };

  const handleVideoEnded = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsIgnited(true);
      sessionStorage.setItem('engine_ignited', 'true');
    }, 600);
  };




  // Auth Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    requestOrientationPermission();
    const envEmail = import.meta.env.VITE_LOGIN_EMAIL || '';
    const envPassword = import.meta.env.VITE_LOGIN_PASSWORD || '';

    if (!envEmail || !envPassword) {
      setLoginError(true);
      return;
    }

    if (email.trim().toLowerCase() === envEmail.toLowerCase() && password === envPassword) {
      setSession(true);
      setIsLoggedIn(true);
      setLoginError(false);
      setEmail('');
      setPassword('');
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setSession(false);
    setIsLoggedIn(false);
    setCurrentScreen('active-trip');
  };

  // Settings Handlers
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3000);
  };

  const handleAddPassenger = () => {
    if (newPassengerName.trim() && !settings.passengers.includes(newPassengerName.trim())) {
      const updated = [...settings.passengers, newPassengerName.trim()];
      const nextSettings = { ...settings, passengers: updated };
      setSettingsState(nextSettings);
      saveSettings(nextSettings);
      setNewPassengerName('');

      // Add to live active trip checklist as checked by default
      setTripPassengers(prev => [...prev, { name: newPassengerName.trim(), checked: true, amount: 0, isManual: false }]);
    }
  };

  const handleDeletePassenger = (name: string) => {
    const updated = settings.passengers.filter(p => p !== name);
    const nextSettings = { ...settings, passengers: updated };
    setSettingsState(nextSettings);
    saveSettings(nextSettings);

    // Also remove from active trip checklist if editing live
    setTripPassengers(prev => prev.filter(tp => tp.name !== name));
  };

  // Autocomplete search trigger with debounce
  const triggerAutocomplete = (val: string, type: 'start' | 'end' | 'stop', index?: number) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const apiKey = getOrsApiKey();
    if (!val.trim() || !apiKey) {
      setSuggestions([]);
      setActiveAutocomplete(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(val, apiKey);
        setSuggestions(results);
        setActiveAutocomplete({ type, index });
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }, 450);
  };

  const selectSuggestion = (suggestion: OrsSuggestion) => {
    if (!activeAutocomplete) return;

    const { type, index } = activeAutocomplete;
    if (type === 'start') {
      setStartPoint(suggestion.label);
      setStartCoords(suggestion.coordinates);
    } else if (type === 'end') {
      setEndPoint(suggestion.label);
      setEndCoords(suggestion.coordinates);
    } else if (type === 'stop' && typeof index === 'number') {
      const nextStops = [...stops];
      nextStops[index] = suggestion.label;
      setStops(nextStops);

      const nextCoords = [...stopCoords];
      nextCoords[index] = suggestion.coordinates;
      setStopCoords(nextCoords);
    }

    setSuggestions([]);
    setActiveAutocomplete(null);
  };

  // OpenRouteService Routing trigger
  const handleCalculateRoute = async () => {
    const apiKey = getOrsApiKey();
    if (!apiKey) {
      setRoutingError('API klíč OpenRouteService v souboru .env chybí. Zadejte vzdálenost ručně.');
      setIsManualDistance(true);
      return;
    }

    if (!startPoint || !endPoint) {
      setRoutingError('Vyberte start a cíl jízdy!');
      return;
    }

    // Assemble coordinates array
    const coordsList: [number, number][] = [];

    if (startCoords) {
      coordsList.push(startCoords);
    } else {
      setRoutingError('Vyberte start z nabízeného seznamu.');
      return;
    }

    for (let i = 0; i < stops.length; i++) {
      if (stopCoords[i]) {
        coordsList.push(stopCoords[i]!);
      } else {
        setRoutingError(`Vyberte checkpoint ${i + 1} z nabízeného seznamu.`);
        return;
      }
    }

    if (endCoords) {
      coordsList.push(endCoords);
    } else {
      setRoutingError('Vyberte cíl z nabízeného seznamu.');
      return;
    }

    setIsCalculating(true);
    setRoutingError('');

    try {
      const result = await calculateRoute(coordsList, apiKey);
      setDistanceKm(result.distanceKm);
      setIsManualDistance(false);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'INVALID_API_KEY') {
        setRoutingError('Neplatný API klíč v .env souboru! Zkontrolujte nastavení.');
      } else {
        setRoutingError('Routovací server neodpovídá. Zadejte délku trasy ručně.');
      }
      setIsManualDistance(true);
    } finally {
      setIsCalculating(false);
    }
  };

  // Passenger toggle checker
  const handleTogglePassenger = (name: string) => {
    setTripPassengers(prev => {
      const exists = prev.some(p => p.name === name);
      if (!exists) {
        return [...prev, { name, checked: true, amount: 0, isManual: false }];
      }
      return prev.map(p => {
        if (p.name === name) {
          // If unchecking, reset manual settings
          return { ...p, checked: !p.checked, isManual: false, amount: 0 };
        }
        return p;
      });
    });
  };

  // Manual share override inputs handler
  const handleManualAmountChange = (name: string, val: string) => {
    const numeric = parseFloat(val);
    const amount = isNaN(numeric) ? 0 : numeric;

    setTripPassengers(prev => {
      return prev.map(p => {
        if (p.name === name) {
          return { ...p, isManual: true, amount };
        }
        return p;
      });
    });
  };

  const handleResetManualAmount = (name: string) => {
    setTripPassengers(prev => {
      return prev.map(p => {
        if (p.name === name) {
          return { ...p, isManual: false, amount: 0 };
        }
        return p;
      });
    });
  };

  // Stopover Add/Remove
  const handleAddStop = () => {
    setStops([...stops, '']);
    setStopCoords([...stopCoords, null]);
  };

  const handleRemoveStop = (idx: number) => {
    const nextStops = [...stops];
    nextStops.splice(idx, 1);
    setStops(nextStops);

    const nextCoords = [...stopCoords];
    nextCoords.splice(idx, 1);
    setStopCoords(nextCoords);
  };


  const getActiveCheckedPassengers = (): PassengerState[] => {
    return tripPassengers.filter(p => p.checked);
  };

  // Cost splitting Engine
  const getCalculatedPassengerShares = (): PassengerState[] => {
    const activeChecked = getActiveCheckedPassengers();
    if (activeChecked.length === 0) return [];

    const totalPrice = calculateTotalPrice();
    const manuals = activeChecked.filter(p => p.isManual);
    const sumManuals = manuals.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Unmodified passengers excluding Pája (since she pays 0)
    const unmod = activeChecked.filter(p => !p.isManual && p.name.trim().toLowerCase() !== 'pája');
    const nUnmod = unmod.length;

    if (nUnmod === 0) {
      return activeChecked.map(p => {
        if (p.name.trim().toLowerCase() === 'pája') {
          return { ...p, amount: 0 };
        }
        return p;
      });
    }

    const remainingToSplit = Math.max(0, totalPrice - sumManuals);
    const hasFila = unmod.some(u => u.name.trim().toLowerCase() === 'fíla');

    // Calculate raw shares for unmodified passengers (including the driver)
    let unmodShares: { name: string; amount: number }[] = [];
    if (hasFila) {
      const totalWeight = nUnmod + 1 - 0.1; // +1 for the driver, -0.1 for Fila discount
      const baseShare = remainingToSplit / totalWeight;
      unmodShares = unmod.map(u => {
        const isFila = u.name.trim().toLowerCase() === 'fíla';
        const raw = isFila ? baseShare * 0.9 : baseShare;
        const rounded = shouldRound ? Math.round(raw) : parseFloat(raw.toFixed(2));
        return { name: u.name, amount: rounded };
      });
    } else {
      const baseShare = remainingToSplit / (nUnmod + 1); // +1 for the driver
      unmodShares = unmod.map(u => {
        const rounded = shouldRound ? Math.round(baseShare) : parseFloat(baseShare.toFixed(2));
        return { name: u.name, amount: rounded };
      });
    }

    // Map back to activeChecked passengers
    return activeChecked.map(p => {
      if (p.name.trim().toLowerCase() === 'pája') {
        return { ...p, amount: 0 };
      }
      if (p.isManual) {
        return p;
      }
      const calculated = unmodShares.find(u => u.name === p.name);
      return { ...p, amount: calculated ? calculated.amount : 0 };
    });
  };

  const getManualOverrideSum = (): number => {
    return tripPassengers
      .filter(p => p.checked && p.isManual)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  // Checks validation rules before ending trip
  const isTripValid = (): boolean => {
    const activeChecked = getActiveCheckedPassengers();
    if (activeChecked.length === 0) return false;
    if (distanceKm <= 0) return false;

    const totalPrice = calculateTotalPrice();
    const sumManuals = getManualOverrideSum();

    if (sumManuals > totalPrice) return false;

    const unmod = activeChecked.filter(p => !p.isManual);
    if (unmod.length === 0) {
      const diff = Math.abs(totalPrice - sumManuals);
      if (diff > 1) return false;
    }

    return true;
  };

  // Finish Trip / Split Save
  const handleFinishTrip = () => {
    if (!isTripValid()) return;

    const totalPrice = calculateTotalPrice();
    const finalShares = getCalculatedPassengerShares();

    // Store in summary view
    setSummaryData({
      startPoint: startPoint || 'Ruční vzdálenost',
      endPoint: endPoint || '',
      stops,
      distanceKm: roundTrip ? distanceKm * 2 : distanceKm,
      totalPrice,
      roundTrip,
      passengers: finalShares
    });

    // Clear active autosave
    clearActiveTrip();
    setCurrentScreen('summary');
  };

  // Back to Dashboard / Reset Active form
  const handleResetActiveTrip = () => {
    clearActiveTrip();
    setStartPoint('');
    setStartCoords(null);
    setEndPoint('');
    setEndCoords(null);
    setStops([]);
    setStopCoords([]);
    setDistanceKm(0);
    setTripPassengers(settings.passengers.map(name => ({
      name,
      checked: false,
      amount: 0,
      isManual: false
    })));
    setCurrentScreen('active-trip');
  };

  const totalPrice = calculateTotalPrice();
  const activeChecked = getActiveCheckedPassengers();
  const calculatedShares = getCalculatedPassengerShares();
  const sumManuals = getManualOverrideSum();
  const hasManuals = activeChecked.some(p => p.isManual);
  const remainingToSplit = Math.max(0, totalPrice - sumManuals);
  const unmodifiedCount = activeChecked.filter(p => !p.isManual && p.name.trim().toLowerCase() !== 'pája').length;

  const hasFilaInUnmod = activeChecked.some(p => !p.isManual && p.name.trim().toLowerCase() === 'fíla');
  let equalShareRaw = 0;
  if (unmodifiedCount > 0) {
    if (hasFilaInUnmod) {
      equalShareRaw = remainingToSplit / (unmodifiedCount + 0.9); // +1 for driver, -0.1 for Fila discount
    } else {
      equalShareRaw = remainingToSplit / (unmodifiedCount + 1); // +1 for driver
    }
  }
  const equalShareDisplay = shouldRound ? Math.round(equalShareRaw) : parseFloat(equalShareRaw.toFixed(2));

  const showSharedQr = unmodifiedCount > 0 && equalShareDisplay > 0;

  // Render Volvo Startup overlay if not ignited yet
  if (!isIgnited) {
    return (
      <div className={`ignition-overlay ${isFadingOut ? 'fade-out-overlay' : ''}`}>
        <div className="ignition-card-center">
          <div className="ignition-system-wrapper" style={{ position: 'relative', margin: '0 auto 30px auto', maxWidth: '480px' }}>
            <div
              className="ignition-video-container"
              style={{ margin: 0 }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <video
                ref={videoRef}
                src={`${import.meta.env.BASE_URL}ffadfadfad.mp4`}
                className="ignition-video"
                playsInline
                muted
                disablePictureInPicture
                controlsList="nodownload nofullscreen noremoteplayback"
                preload="auto"
                onEnded={handleVideoEnded}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
            {!isLoadingSound && (
              <button
                type="button"
                className={`volvo-ev-start-btn ${isClicked ? 'is-clicked' : ''}`}
                onClick={handleIgnition}
                aria-label="Nastartovat motor"
              >
                <span className="ev-btn-face">
                  <span className="ev-btn-power-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                      <line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                  </span>
                  <span className="ev-btn-label">START ENGINE</span>
                </span>
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div
      className="app-container fade-in"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >


      {/* Main Header */}
      <header className="app-header">
        <div className="brand" onClick={() => isLoggedIn && setCurrentScreen('active-trip')}>
          <div className="brand-text">
            <h1 className="brand-title">SÁREK EXPRESS</h1>
            <p className="brand-subtitle">PILOTNÍ PALUBNÍ SYSTÉM</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Logout Button */}
          {isLoggedIn && (
            <button
              type="button"
              className="btn-logout"
              onClick={handleLogout}
            >
              <X size={16} />
              <span className="hide-mobile">Odejít z kokpitu (Odhlásit se)</span>
            </button>
          )}
        </div>
      </header>

      {/* Login Screen Gate */}
      {!isLoggedIn ? (
        <div className="login-wrapper">
          <div className="racing-card login-card fade-in">
            <h2 className="card-title">
              <KeyRound size={22} style={{ marginRight: 8 }} />
              KLÍČKY DO ZAPALOVÁNÍ / AUTORIZACE PILOTA
            </h2>

            {loginError && (
              <div className="login-error">
                <AlertTriangle size={18} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
                <span>Chyba! Klíček nepasuje, nebo jsi moc opilý na řízení (nesprávný e-mail/heslo)!</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">E-mail kapitána korábu</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="driver@payway.cz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kód k tajnému raketovému pohonu (heslo)</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-racing">
                <KeyRound size={20} />
                <span>SEŠLÁPNOUT PLYN (PŘIHLÁSIT SE)</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Authenticated Session Layout */
        <>
          {/* Top Level Screen Navigation */}
          <nav className="app-nav">
            <div
              className="nav-active-indicator"
              style={{
                transform: `translateX(${currentScreen === 'settings' ? 'calc(100% + 4px)' : '0%'})`,
                opacity: currentScreen === 'summary' ? 0 : 1
              }}
            />
            <button
              type="button"
              className={`nav-tab ${currentScreen === 'active-trip' ? 'active' : ''}`}
              onClick={() => {
                setCurrentScreen('active-trip');
                requestOrientationPermission();
              }}
            >
              <Compass
                className="nav-icon-compass"
                size={18}
                style={{
                  marginRight: 6,
                  ['--device-heading' as any]: `${deviceHeading}deg`
                }}
              />
              <span>Trasa</span>
            </button>

            <button
              type="button"
              className={`nav-tab ${currentScreen === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setCurrentScreen('settings');
                requestOrientationPermission();
              }}
            >
              <Wrench className="nav-icon-wrench" size={18} style={{ marginRight: 6 }} />
              <span>Servis & Garáž <span className="hide-mobile">(Tuning)</span></span>
            </button>
          </nav>

          {/* Screen Content Resolver */}
          <div className="screens-slider-viewport" style={{ display: currentScreen === 'summary' && summaryData ? 'none' : 'block' }}>
            <div className="screens-slider-track" style={{ transform: `translateX(${currentScreen === 'settings' ? '-50%' : '0%'})` }}>
              <div className={`slide-pane ${currentScreen === 'active-trip' ? 'active' : ''}`}>
                <div className="trip-overview-grid">
                  {/* Active Trip Left Panel: Config Form */}
                  <div className="racing-card">
                    <h3 className="card-title">
                      <Flag size={22} style={{ marginRight: 8 }} />
                      TRASA PRO DNEŠNÍ ZÁVOD
                    </h3>

                    {routingError && (
                      <div className="alert-warning">
                        <AlertTriangle size={18} />
                        <span>{routingError}</span>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">STARTOVNÍ ČÁRA (Odkud)</label>
                      <div className="autocomplete-wrapper">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Kde startujeme motory?"
                          value={startPoint}
                          onChange={(e) => {
                            setStartPoint(e.target.value);
                            triggerAutocomplete(e.target.value, 'start');
                          }}
                        />
                        {activeAutocomplete?.type === 'start' && suggestions.length > 0 && (
                          <div className="autocomplete-dropdown">
                            {suggestions.map((s, idx) => (
                              <div
                                key={idx}
                                className="autocomplete-item"
                                onClick={() => selectSuggestion(s)}
                              >
                                {s.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Waypoints Stops List */}
                    {stops.map((stop, idx) => (
                      <div className="form-group fade-in" key={idx}>
                        <label className="form-label">MEZIČAS #{idx + 1} (Průjezdní bod)</label>
                        <div className="stopover-item">
                          <div className="autocomplete-wrapper" style={{ flex: 1 }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Kudy to střihneme?"
                              value={stop}
                              onChange={(e) => {
                                const next = [...stops];
                                next[idx] = e.target.value;
                                setStops(next);
                                triggerAutocomplete(e.target.value, 'stop', idx);
                              }}
                            />
                            {activeAutocomplete?.type === 'stop' && activeAutocomplete.index === idx && suggestions.length > 0 && (
                              <div className="autocomplete-dropdown">
                                {suggestions.map((s, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="autocomplete-item"
                                    onClick={() => selectSuggestion(s)}
                                  >
                                    {s.label}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn-remove-stop"
                            onClick={() => handleRemoveStop(idx)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div style={{ marginBottom: 20 }}>
                      <button
                        type="button"
                        className="btn-racing btn-racing-secondary"
                        onClick={handleAddStop}
                        style={{ padding: '8px 16px', width: 'auto' }}
                      >
                        <Flag size={16} />
                        <span style={{ fontSize: '14px' }}>PŘIDAT ZASTÁVKU NA PIVO/KAFE</span>
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label">CÍL (Kam)</label>
                      <div className="autocomplete-wrapper">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Kde budeme slavit přežití?"
                          value={endPoint}
                          onChange={(e) => {
                            setEndPoint(e.target.value);
                            triggerAutocomplete(e.target.value, 'end');
                          }}
                        />
                        {activeAutocomplete?.type === 'end' && suggestions.length > 0 && (
                          <div className="autocomplete-dropdown">
                            {suggestions.map((s, idx) => (
                              <div
                                key={idx}
                                className="autocomplete-item"
                                onClick={() => selectSuggestion(s)}
                              >
                                {s.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Round Trip Toggle */}
                    <div style={{ marginBottom: 20 }}>
                      <label className="form-label">Konfigurace převodovky (Mód jízdy)</label>
                      <div className="display-flex-mobile-stack" style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          className={`btn-racing ${!roundTrip ? '' : 'btn-racing-secondary'}`}
                          onClick={() => setRoundTrip(false)}
                          style={{ padding: '10px 14px' }}
                        >
                          Jen tam
                        </button>
                        <button
                          type="button"
                          className={`btn-racing ${roundTrip ? '' : 'btn-racing-secondary'}`}
                          onClick={() => setRoundTrip(true)}
                          style={{ padding: '10px 14px' }}
                        >
                          Tam a zpět
                        </button>
                      </div>
                    </div>

                    {isManualDistance && (
                      <div className="form-grid m-t-20 fade-in">
                        <div className="form-group">
                          <label className="form-label">UJETÁ VZDÁLENOST (Ruční zadání při chybě GPS)</label>
                          <div className="input-with-suffix">
                            <input
                              type="number"
                              className="form-control"
                              value={distanceKm || ''}
                              onChange={(e) => {
                                setDistanceKm(Math.max(0, parseFloat(e.target.value) || 0));
                              }}
                            />
                            <span className="input-suffix">km</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                      <button
                        type="button"
                        className="btn-racing btn-racing-danger"
                        onClick={handleResetActiveTrip}
                      >
                        <X size={18} />
                        <span>SEŠROTOVAT JÍZDU (Smazat data)</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Trip Right Panel: Cost Splits & Passenger Checks */}
                  <div>
                    <div className="racing-card">
                      <h3 className="card-title">
                        <Flag size={22} style={{ marginRight: 8 }} />
                        Kdo přežil tuhle divočinu? (Posádka)
                      </h3>

                      {settings.passengers.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                          V autě nikdo nesedí? Takhle za palivo neušetříš! Zajeď do Garáže a naber lidi.
                        </p>
                      ) : (
                        <div className="passenger-grid">
                          {settings.passengers.map(name => {
                            const tripP = tripPassengers.find(tp => tp.name === name);
                            const isChecked = tripP ? tripP.checked : false;
                            return (
                              <div
                                key={name}
                                className={`passenger-check-card ${isChecked ? 'checked' : ''}`}
                                onClick={() => handleTogglePassenger(name)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                />
                                <span>{name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {activeChecked.length === 0 && (
                        <div className="alert-warning" style={{ margin: '15px 0 0 0' }}>
                          <AlertTriangle size={18} />
                          <span>Nemůžeš jet sám, kdo by navigoval nebo ti podával vapo?</span>
                        </div>
                      )}

                      {/* Route calculation button placed under the passenger list */}
                      <div style={{ marginTop: 20 }}>
                        <button
                          type="button"
                          className="btn-racing btn-racing-cyan"
                          onClick={handleCalculateRoute}
                          disabled={isCalculating}
                        >
                          <Compass size={18} />
                          <span>{isCalculating ? 'Žhavíme navigátora...' : 'SPOČÍTAT TRASU (GPS satelit)'}</span>
                        </button>
                      </div>

                      {/* Loading state bar during calculation */}
                      {isCalculating && (
                        <div style={{ marginTop: 15 }}>
                          <div className="nitro-gauge">
                            <div className="nitro-fill" style={{ width: '85%' }}></div>
                          </div>
                          <div className="nitro-label">
                            <span>GPS VSTŘIKOVÁNÍ</span>
                            <span>Hledáme zkratky přes pole a lesy...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="racing-card">
                      <h3 className="card-title">
                        <Trophy size={22} style={{ marginRight: 8 }} />
                        VYUČTOVÁNÍ  (ŽIDOVSTVÍ)
                      </h3>

                      <div className="summary-stats">
                        <div className="stat-box">
                          <div className="stat-label">CELKEM UJETÝCH KILOMETRŮ</div>
                          <div className="stat-val">{roundTrip ? distanceKm * 2 : distanceKm} km</div>
                        </div>
                        <div className="stat-box">
                          <div className="stat-label">ÚČET ZA BENZÍNKU (Celkem)</div>
                          <div className="stat-val">{totalPrice} Kč</div>
                        </div>
                        <div className="stat-box">
                          <div className="stat-label">DAŇ ZA PŘEŽITÍ (Na osobu)</div>
                          <div className="stat-val">{equalShareDisplay % 1 === 0 ? equalShareDisplay.toFixed(0) : equalShareDisplay.toFixed(2)} Kč</div>
                        </div>
                      </div>

                      {/* Manual Cost Splits Table */}
                      {activeChecked.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                            <button
                              type="button"
                              className={`btn-round ${shouldRound ? 'active' : ''}`}
                              onClick={() => setShouldRound(!shouldRound)}
                            >
                              <Coins size={16} />
                              <span>{shouldRound ? 'Zaokrouhleno (celé Kč)' : 'Zaokrouhlit na celé Kč'}</span>
                            </button>
                          </div>

                          {sumManuals > totalPrice && (
                            <div className="alert-warning" style={{ margin: '12px 0' }}>
                              <AlertTriangle size={16} />
                              <span>Bacha! Rozdělil jsi víc peněz, než kolik ta jízda vůbec stála. Takhle nezbohatneme!</span>
                            </div>
                          )}

                          <div className="table-responsive">
                            <table className="split-table">
                              <thead>
                                <tr>
                                  <th>Spolupachatel</th>
                                  <th style={{ textAlign: 'right' }}>Dluh (Kč)</th>
                                  <th style={{ textAlign: 'center' }}>Jak platí</th>
                                </tr>
                              </thead>
                              <tbody>
                                {calculatedShares.map(p => (
                                  <tr key={p.name}>
                                    <td className="split-name">{p.name}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div className="split-amount-wrapper" style={{ justifyContent: 'flex-end' }}>
                                        <input
                                          type="number"
                                          className={`split-amount-input ${p.isManual ? 'manual-active' : ''}`}
                                          value={p.isManual ? (p.amount || '') : (p.amount !== undefined && p.amount % 1 === 0 ? p.amount.toFixed(0) : p.amount?.toFixed(2))}
                                          placeholder={p.amount !== undefined && p.amount % 1 === 0 ? p.amount.toFixed(0) : p.amount?.toFixed(2)}
                                          onChange={(e) => handleManualAmountChange(p.name, e.target.value)}
                                          disabled={p.name.trim().toLowerCase() === 'pája'}
                                        />
                                        {p.isManual && (
                                          <button
                                            type="button"
                                            className="btn-remove-stop"
                                            onClick={() => handleResetManualAmount(p.name)}
                                            style={{ padding: 6, marginLeft: 4 }}
                                            title="Zpět na rovný podíl"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={`split-badge ${p.isManual ? 'manual' : (p.name.trim().toLowerCase() === 'pája' ? 'princess' : (p.name.trim().toLowerCase() === 'fíla' ? 'discount' : 'equal'))}`}>
                                        {p.isManual ? 'VIP taxa' : (p.name.trim().toLowerCase() === 'pája' ? 'Passenger princess' : (p.name.trim().toLowerCase() === 'fíla' ? 'Fíla (sleva 10%)' : 'Běžný smrtelník'))}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {hasManuals && (
                            <div className="alert-info" style={{ marginTop: 15 }}>
                              <Info size={16} />
                              <span>
                                Zbývá rozdělit: <strong>{(totalPrice - sumManuals).toFixed(shouldRound ? 0 : 2)} Kč</strong> {hasFilaInUnmod ? `mezi ${unmodifiedCount} chudáků a řidiče (Fíla má 10% slevu)` : `spravedlivě mezi ${unmodifiedCount} chudáků a řidiče`}.
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: 24 }}>
                        <button
                          type="button"
                          className="btn-racing btn-racing-cyan"
                          onClick={handleFinishTrip}
                          disabled={!isTripValid()}
                        >
                          <Flag size={18} />
                          <span>VYSTAVIT ÚČTENKY</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              <div className={`slide-pane ${currentScreen === 'settings' ? 'active' : ''}`}>
                <div className="racing-card">
                  <h2 className="card-title">
                    <Wrench size={24} style={{ marginRight: 8 }} />
                    TUNING GARÁŽ (Konfigurace stroje)
                  </h2>

                  {settingsSavedMsg && (
                    <div className="alert-success">
                      <CheckCircle size={18} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
                      <span>Motor naladěn, ventily seřízeny, uloženo do paměti!</span>
                    </div>
                  )}



                  <form onSubmit={handleSaveSettings}>

                    <h3 className="settings-section-title">
                      <Car size={18} style={{ marginRight: 8 }} />
                      PRESETY MOTORU A CHUŤ K JÍDLU
                    </h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Jak moc ta bestie chlastá (Průměrná spotřeba)</label>
                        <div className="input-with-suffix">
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={settings.avgConsumption || ''}
                            onChange={(e) => setSettingsState({ ...settings, avgConsumption: Math.max(0, parseFloat(e.target.value) || 0) })}
                            required
                          />
                          <span className="input-suffix">l/100km</span>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Co teče do nádrže</label>
                        <div className="display-flex-mobile-stack" style={{ display: 'flex', gap: 10 }}>
                          <button
                            type="button"
                            className={`btn-racing ${settings.fuelType === 'petrol' ? '' : 'btn-racing-secondary'}`}
                            onClick={() => setSettingsState({ ...settings, fuelType: 'petrol' })}
                            style={{ padding: '10px 14px' }}
                          >
                            Benzín
                          </button>
                          <button
                            type="button"
                            className={`btn-racing ${settings.fuelType === 'diesel' ? '' : 'btn-racing-secondary'}`}
                            onClick={() => setSettingsState({ ...settings, fuelType: 'diesel' })}
                            style={{ padding: '10px 14px' }}
                          >
                            Nafta
                          </button>
                        </div>
                      </div>
                    </div>

                    <h3 className="settings-section-title">POJEBANÉ POHONNÉ HMOTY </h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Benzín (Kč/l)</label>
                        <div className="input-with-suffix">
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={settings.petrolPrice || ''}
                            onChange={(e) => setSettingsState({ ...settings, petrolPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                            required
                          />
                          <span className="input-suffix">Kč/l</span>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nafta (Kč/l)</label>
                        <div className="input-with-suffix">
                          <input
                            type="number"
                            step="0.1"
                            className="form-control"
                            value={settings.dieselPrice || ''}
                            onChange={(e) => setSettingsState({ ...settings, dieselPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                            required
                          />
                          <span className="input-suffix">Kč/l</span>
                        </div>
                      </div>
                    </div>

                    <h3 className="settings-section-title">
                      <Flag size={18} style={{ marginRight: 8 }} />
                      NEJVĚTŠÍ ZABIJÁCI
                    </h3>
                    <div className="passenger-input-group">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Jméno další oběti"
                        value={newPassengerName}
                        onChange={(e) => setNewPassengerName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPassenger())}
                      />
                      <button
                        type="button"
                        className="btn-racing btn-racing-cyan"
                        onClick={handleAddPassenger}
                        style={{ width: 'auto', padding: '10px 20px' }}
                      >
                        PŘIBRAT DO AUTO
                      </button>
                    </div>

                    <div className="passenger-list-box">
                      {settings.passengers.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', padding: 16, fontSize: 13, textAlign: 'center' }}>
                          Garáž zeje prázdnotou, nikoho tu nemáš.
                        </p>
                      ) : (
                        settings.passengers.map(name => (
                          <div key={name} className="passenger-item">
                            <span>{name}</span>
                            <button
                              type="button"
                              className="btn-delete-passenger"
                              onClick={() => handleDeletePassenger(name)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ marginTop: 30 }}>
                      <button type="submit" className="btn-racing">
                        <Save size={20} />
                        <span>ZAMKNOUT TUNING (Uložit)</span>
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            </div>
          </div>

          {currentScreen === 'summary' && summaryData && (
            <div className="fade-in">
              <div className="racing-card">
                <h2 className="card-title">
                  <Trophy size={24} style={{ marginRight: 8 }} />
                  KDO KOLIK CÁLUJE (Finální účtenka)
                </h2>

                <div className="summary-stats">
                  <div className="stat-box">
                    <div className="stat-label">CELKEM UJETÝCH KILOMETRŮ</div>
                    <div className="stat-val">{summaryData.distanceKm} km</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">CELKOVÁ ÚTRATA ZA POHONNOU CHCANKU</div>
                    <div className="stat-val">{summaryData.totalPrice} Kč</div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: 16, border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: 24 }}>
                  <div style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 'bold' }}>Kudy jsme letěli:</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--volvo-blue)' }}>
                    {summaryData.startPoint} {summaryData.endPoint && <><ArrowRight size={14} style={{ display: 'inline', margin: '0 6px' }} /> {summaryData.endPoint}</>}
                  </div>
                  {summaryData.stops.length > 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                      Kde jsme dělali bordel (Zastávky): {summaryData.stops.join(', ')}
                    </div>
                  )}
                </div>

                {/* Optional Message for QR codes */}
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Zpráva pro příjemce (Ať vědí, za co platí)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Norsko Touge Run"
                    value={summaryMsg}
                    onChange={(e) => setSummaryMsg(e.target.value)}
                  />
                </div>

                <h3 className="settings-section-title" style={{ marginTop: 32 }}>
                  <Save size={18} style={{ marginRight: 8 }} />
                  PLATEBNÍ RAKETY (Naskenuj a plať, než tě příště nevezmeme)
                </h3>

                {/* QR Codes Grid */}
                <div className="summary-grid">
                  {/* Shared equal share QR code */}
                  {showSharedQr && (
                    !summaryData.passengers.some(p => !p.isManual && p.name.trim().toLowerCase() === 'fíla') ||
                    summaryData.passengers.some(p => !p.isManual && p.name.trim().toLowerCase() !== 'fíla' && p.name.trim().toLowerCase() !== 'pája')
                  ) && (
                      <PaymentQrCode
                        amount={equalShareDisplay}
                        name={summaryData.passengers.some(p => !p.isManual && p.name.trim().toLowerCase() === 'fíla') ? "Běžní smrtelníci (každý)" : undefined}
                        message={summaryMsg || 'SÁREK EXPRESS'}
                        vs={summaryVs}
                        payingNames={summaryData.passengers.filter(p => !p.isManual && p.name.trim().toLowerCase() !== 'fíla' && p.name.trim().toLowerCase() !== 'pája').map(p => p.name)}
                      />
                    )}

                  {/* Individual overridden QR codes and special discount for Fíla */}
                  {summaryData.passengers.filter(p => p.isManual || p.name.trim().toLowerCase() === 'fíla').map(p => (
                    <PaymentQrCode
                      key={p.name}
                      amount={p.amount || 0}
                      name={p.name}
                      message={summaryMsg || 'SÁREK EXPRESS'}
                      vs={summaryVs}
                      payingNames={[p.name]}
                    />
                  ))}
                </div>

                <div style={{ marginTop: 30 }}>
                  <button
                    type="button"
                    className="btn-racing"
                    onClick={handleResetActiveTrip}
                  >
                    <Car size={20} />
                    <span>DOPLNIT NITRO A NASTARTOVAT ZNOVU</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <footer style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '20px', fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7, letterSpacing: '1px' }}>
        MADE BY FAJLAJP BABYY
      </footer>
    </div>
  );
}

export default App;

