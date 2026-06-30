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
  Compass
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
  // Volvo Startup Ignition screen state
  const [isIgnited, setIsIgnited] = useState<boolean>(() => {
    return sessionStorage.getItem('engine_ignited') === 'true';
  });
  const [isLoadingSound, setIsLoadingSound] = useState<boolean>(false);
  const [showVolvoLogo, setShowVolvoLogo] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // Navigation & Auth
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<boolean>(false);
  
  // Navigation Screen State: 'active-trip' | 'summary' | 'settings'
  const [currentScreen, setCurrentScreen] = useState<'active-trip' | 'summary' | 'settings'>('active-trip');
  
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
  const [toastMessage, setToastMessage] = useState<string>('');
  
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
  const [summaryMsg, setSummaryMsg] = useState<string>('');
  const [summaryVs, setSummaryVs] = useState<string>('');

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
        const existing = active.passengers.find(p => p.name === name);
        return existing || { name, checked: true, amount: 0, isManual: false };
      });
      setTripPassengers(syncedPassengers);
      setDistanceKm(active.distanceKm);
      setIsManualDistance(active.distanceKm > 0 && !active.startPoint);
      
      setCurrentScreen('active-trip');
      showToast('Rozpracovaná jízda byla načtena z garáže!');
    } else {
      // Initialize trip passengers if no active trip is restored
      setTripPassengers(savedSettings.passengers.map(name => ({
        name,
        checked: true,
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

  // Toast message helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Get active API key (strictly from .env)
  const getOrsApiKey = (): string => {
    return import.meta.env.VITE_ORS_API_KEY || '';
  };

  // Ignition sound & loading screen handler
  const handleIgnition = async () => {
    setIsLoadingSound(true);
    // Play startup sound immediately
    playVolvoStartupSound();

    // Trigger Volvo Logo drawing animation after starting cranks
    setTimeout(() => {
      setShowVolvoLogo(true);
    }, 300);

    // Trigger visual overlay fade out at 4.4 seconds
    setTimeout(() => {
      setIsFadingOut(true);
    }, 4400);

    // Transition overlay out completely at 5.0 seconds
    setTimeout(() => {
      setIsIgnited(true);
      sessionStorage.setItem('engine_ignited', 'true');
    }, 5000);
  };

  // Auth Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const envEmail = import.meta.env.VITE_LOGIN_EMAIL || 'driver@payway.cz';
    const envPassword = import.meta.env.VITE_LOGIN_PASSWORD || 'racing-fuel';

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
    
    const unmod = activeChecked.filter(p => !p.isManual);
    const nUnmod = unmod.length;

    if (nUnmod === 0) {
      return activeChecked;
    }

    const remainingToSplit = Math.max(0, totalPrice - sumManuals);
    const rawEqualShare = remainingToSplit / nUnmod;
    const finalEqualShare = shouldRound ? Math.round(rawEqualShare) : parseFloat(rawEqualShare.toFixed(2));

    return activeChecked.map((p) => {
      const subIndex = unmod.findIndex(u => u.name === p.name);
      if (subIndex === nUnmod - 1) {
        // Last person absorbs rounding error to guarantee exact sum
        const sumOthersManual = manuals.reduce((sum, x) => sum + (x.amount || 0), 0);
        const sumOthersEqual = finalEqualShare * (nUnmod - 1);
        const lastAmt = parseFloat((totalPrice - (sumOthersManual + sumOthersEqual)).toFixed(2));
        return { ...p, amount: Math.max(0, lastAmt) };
      } else {
        return { ...p, amount: finalEqualShare };
      }
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
    setTripPassengers(settings.passengers.map(name => ({ name, checked: true, amount: 0, isManual: false })));
    setCurrentScreen('active-trip');
  };

  const totalPrice = calculateTotalPrice();
  const activeChecked = getActiveCheckedPassengers();
  const calculatedShares = getCalculatedPassengerShares();
  const sumManuals = getManualOverrideSum();
  const hasManuals = activeChecked.some(p => p.isManual);
  const remainingToSplit = Math.max(0, totalPrice - sumManuals);
  const unmodifiedCount = activeChecked.filter(p => !p.isManual).length;
  
  const equalShareRaw = unmodifiedCount > 0 ? remainingToSplit / unmodifiedCount : 0;
  const equalShareDisplay = shouldRound ? Math.round(equalShareRaw) : parseFloat(equalShareRaw.toFixed(2));

  const showSharedQr = unmodifiedCount > 0 && equalShareDisplay > 0;

  // Render Volvo Startup overlay if not ignited yet
  if (!isIgnited) {
    return (
      <div className={`ignition-overlay ${isFadingOut ? 'fade-out-overlay' : ''}`}>
        <div className="ignition-card-center">
          <h1 className="ignition-title">VOLVO EXPRESS</h1>
          <p className="ignition-subtitle">Touge Run Expense Division</p>
          
          <div className={`volvo-logo-container ${showVolvoLogo ? 'show-logo' : ''}`}>
            <img 
              src="/volvo_logo.png" 
              alt="Volvo Logo" 
              className={`volvo-logo-png ${isLoadingSound ? 'engine-start' : ''}`}
            />
          </div>

          {!isLoadingSound ? (
            <button 
              type="button" 
              className="ignition-button" 
              onClick={handleIgnition}
            >
              <KeyRound size={32} />
              <span style={{ marginTop: 4 }}>NASTARTOVAT</span>
            </button>
          ) : (
            <div style={{ marginTop: 20, color: 'var(--volvo-blue)', fontWeight: '700', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Startování motoru...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--volvo-blue)',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          padding: '12px 24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 15,
          fontWeight: '600',
          color: 'var(--volvo-blue)'
        }} className="fade-in">
          <Info size={18} color="var(--volvo-blue)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="app-header">
        <div className="brand" onClick={() => isLoggedIn && setCurrentScreen('active-trip')}>
          <Car size={36} className="brand-icon" />
          <div className="brand-text">
            <h1>VOLVO EXPRESS</h1>
            <p>TOUGE RUN EXPENSE DIVISION</p>
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
              <span className="hide-mobile">Odhlásit se</span>
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
              START MOTORU / PŘIHLÁŠENÍ
            </h2>
            
            {loginError && (
              <div className="login-error">
                <AlertTriangle size={18} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
                <span>CHYBA: NESPRÁVNÝ E-MAIL NEBO HESLO!</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">E-mail řidiče</label>
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
                <label className="form-label">Heslo</label>
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
                <span>PŘIHLÁSIT SE</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Authenticated Session Layout */
        <>
          {/* Top Level Screen Navigation */}
          <nav className="app-nav">
            <button 
              type="button" 
              className={`nav-tab ${currentScreen === 'active-trip' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('active-trip')}
            >
              <Compass size={18} style={{ marginRight: 6 }} />
              Jízda (Stage)
            </button>

            <button 
              type="button" 
              className={`nav-tab ${currentScreen === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('settings')}
            >
              <Wrench size={18} style={{ marginRight: 6 }} />
              Garáž (Tuning)
            </button>
          </nav>

          {/* Screen Content Resolver */}
          {currentScreen === 'active-trip' && (
            <div className="trip-overview-grid fade-in">
              {/* Active Trip Left Panel: Config Form */}
              <div className="racing-card">
                <h3 className="card-title">
                  <Flag size={22} style={{ marginRight: 8 }} />
                  AKTIVNÍ ERZETA (STAGE)
                </h3>
                
                {routingError && (
                  <div className="alert-warning">
                    <AlertTriangle size={18} />
                    <span>{routingError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">START (Odkud)</label>
                  <div className="autocomplete-wrapper">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Místo startu" 
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
                    <label className="form-label">CHECKPOINT #{idx + 1}</label>
                    <div className="stopover-item">
                      <div className="autocomplete-wrapper" style={{ flex: 1 }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Checkpoint na trase" 
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
                    <span style={{ fontSize: '14px' }}>PŘIDAT CHECKPOINT</span>
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">CÍL (Kam)</label>
                  <div className="autocomplete-wrapper">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Cílová destinace" 
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

                {/* Round Trip Toggle & Routing Trigger */}
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div>
                    <label className="form-label">Mód jízdy</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button 
                        type="button" 
                        className={`btn-racing ${!roundTrip ? '' : 'btn-racing-secondary'}`}
                        onClick={() => setRoundTrip(false)}
                        style={{ padding: '10px 14px' }}
                      >
                        Jednosměrná
                      </button>
                      <button 
                        type="button" 
                        className={`btn-racing ${roundTrip ? '' : 'btn-racing-secondary'}`}
                        onClick={() => setRoundTrip(true)}
                        style={{ padding: '10px 14px' }}
                      >
                        Zpáteční
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">&nbsp;</label>
                    <button 
                      type="button" 
                      className="btn-racing btn-racing-cyan" 
                      onClick={handleCalculateRoute}
                      disabled={isCalculating}
                    >
                      <Compass size={18} />
                      <span>{isCalculating ? 'Vypočítávám...' : 'VYPOČÍTAT TRASU'}</span>
                    </button>
                  </div>
                </div>

                {/* Loading state bar during calculation */}
                {isCalculating && (
                  <div style={{ marginTop: 15 }}>
                    <div className="nitro-gauge">
                      <div className="nitro-fill" style={{ width: '85%' }}></div>
                    </div>
                    <div className="nitro-label">
                      <span>Routování trasy</span>
                      <span>Vyhledávám optimální cestu...</span>
                    </div>
                  </div>
                )}

                <div className="form-grid m-t-20">
                  <div className="form-group">
                    <label className="form-label">DÉLKA TRASY (KILOMETRY)</label>
                    <div className="input-with-suffix">
                      <input 
                        type="number" 
                        className="form-control" 
                        value={distanceKm || ''}
                        onChange={(e) => {
                          setDistanceKm(Math.max(0, parseFloat(e.target.value) || 0));
                          setIsManualDistance(true);
                        }}
                      />
                      <span className="input-suffix">km</span>
                    </div>
                  </div>
                  
                  {isManualDistance && (
                    <div className="alert-info" style={{ marginTop: 10 }}>
                      <Info size={16} />
                      <span>Délka trasy je zadána ručně.</span>
                    </div>
                  )}
                </div>

                {/* Info block displaying current calculation preset from settings */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: 16, marginTop: 16 }}>
                  <div style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--volvo-blue)', fontWeight: 'bold', marginBottom: 4 }}>
                    Aktivní parametry z nastavení:
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    Spotřeba vozu: <strong style={{ color: 'var(--volvo-blue)' }}>{settings.avgConsumption} l/100km</strong> | 
                    Palivo: <strong style={{ color: 'var(--volvo-blue)' }}>{settings.fuelType === 'petrol' ? 'Benzín' : 'Nafta'}</strong> | 
                    Aktuální cena: <strong style={{ color: 'var(--volvo-blue)' }}>{settings.fuelType === 'petrol' ? settings.petrolPrice : settings.dieselPrice} Kč/l</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                    Pro úpravu cen, spotřeby nebo typu paliva přejděte do záložky "Garáž (Tuning)".
                  </div>
                </div>

                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                  <button 
                    type="button" 
                    className="btn-racing btn-racing-danger" 
                    onClick={handleResetActiveTrip}
                  >
                    <X size={18} />
                    <span>VYMAZAT STATE</span>
                  </button>
                </div>
              </div>

              {/* Active Trip Right Panel: Cost Splits & Passenger Checks */}
              <div>
                <div className="racing-card">
                  <h3 className="card-title">
                    <Flag size={22} style={{ marginRight: 8 }} />
                    Posádka v autě (Team)
                  </h3>
                  
                  {settings.passengers.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                      Žádní cestující v paměti nastavení. Přidejte je nejprve v záložce Nastavení.
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
                      <span>Označte alespoň jednoho spolucestujícího!</span>
                    </div>
                  )}
                </div>

                <div className="racing-card">
                  <h3 className="card-title">
                    <Trophy size={22} style={{ marginRight: 8 }} />
                    ROZDĚLENÍ NÁKLADŮ
                  </h3>

                  <div className="summary-stats">
                    <div className="stat-box">
                      <div className="stat-label">CELKOVÉ NÁKLADY JÍZDY</div>
                      <div className="stat-val">{totalPrice} Kč</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-label">ZÁKLADNÍ PODÍL / OSOBA</div>
                      <div className="stat-val">{equalShareDisplay} Kč</div>
                    </div>
                  </div>

                  {/* Manual Cost Splits Table */}
                  {activeChecked.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div className="flex-between">
                        <h4 style={{ fontSize: 16, color: 'var(--volvo-blue)', fontWeight: '700' }}>ÚPRAVA PODÍLŮ POSÁDKY</h4>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: '500' }}>
                          <input 
                            type="checkbox" 
                            checked={shouldRound} 
                            onChange={(e) => setShouldRound(e.target.checked)}
                            style={{ accentColor: 'var(--volvo-blue)', width: 15, height: 15 }}
                          />
                          Zaokrouhlovat podíly
                        </label>
                      </div>

                      {sumManuals > totalPrice && (
                        <div className="alert-warning" style={{ margin: '12px 0' }}>
                          <AlertTriangle size={16} />
                          <span>Překročen celkový rozpočet jízdy! Upravte podíly.</span>
                        </div>
                      )}

                      <table className="split-table">
                        <thead>
                          <tr>
                            <th>Řidič / Posádka</th>
                            <th style={{ textAlign: 'right' }}>Podíl (Kč)</th>
                            <th style={{ textAlign: 'center' }}>Mód</th>
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
                                    value={p.isManual ? (p.amount || '') : p.amount?.toFixed(2)}
                                    placeholder={p.amount?.toFixed(2)}
                                    onChange={(e) => handleManualAmountChange(p.name, e.target.value)}
                                  />
                                  {p.isManual && (
                                    <button 
                                      type="button" 
                                      className="btn-remove-stop"
                                      onClick={() => handleResetManualAmount(p.name)}
                                      style={{ padding: 6, marginLeft: 4 }}
                                      title="Reset na rovný podíl"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`split-badge ${p.isManual ? 'manual' : 'equal'}`}>
                                  {p.isManual ? 'Ruční' : 'Rovný'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {hasManuals && (
                        <div className="alert-info" style={{ marginTop: 15 }}>
                          <Info size={16} />
                          <span>
                            Zbylo k rozdělení: <strong>{(totalPrice - sumManuals).toFixed(0)} Kč</strong> rovným dílem mezi {unmodifiedCount} os.
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
                      <span>DOKONČIT A ZOBRAZIT QR PLATBY</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'summary' && summaryData && (
            <div className="fade-in">
              <div className="racing-card" style={{ borderColor: 'var(--volvo-blue)' }}>
                <h2 className="card-title">
                  <Trophy size={24} style={{ marginRight: 8 }} />
                  KONEČNÉ ROZÚČTOVÁNÍ JÍZDY
                </h2>

                <div className="summary-stats">
                  <div className="stat-box">
                    <div className="stat-label">CELKOVÁ VZDÁLENOST</div>
                    <div className="stat-val">{summaryData.distanceKm} km</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">CELKOVÉ NÁKLADY STAGE</div>
                    <div className="stat-val">{summaryData.totalPrice} Kč</div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: 16, border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: 24 }}>
                  <div style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 'bold' }}>Detaily trasy:</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--volvo-blue)' }}>
                    {summaryData.startPoint} {summaryData.endPoint && <><ArrowRight size={14} style={{ display: 'inline', margin: '0 6px' }} /> {summaryData.endPoint}</>}
                  </div>
                  {summaryData.stops.length > 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                      Checkpointy: {summaryData.stops.join(', ')}
                    </div>
                  )}
                </div>

                {/* Optional Message & VS for QR codes */}
                <div className="form-grid" style={{ marginBottom: 24 }}>
                  <div className="form-group">
                    <label className="form-label">Zpráva pro příjemce (Název eventu)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Norsko Touge Run"
                      value={summaryMsg}
                      onChange={(e) => setSummaryMsg(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Variabilní symbol (nepovinné)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      placeholder="12345"
                      value={summaryVs}
                      onChange={(e) => setSummaryVs(e.target.value)}
                    />
                  </div>
                </div>

                <h3 className="settings-section-title" style={{ marginTop: 32 }}>
                  <Save size={18} style={{ marginRight: 8 }} />
                  PLATEBNÍ QR KÓDY PRO MOBILNÍ BANKOVNICTVÍ
                </h3>
                
                {/* QR Codes Grid */}
                <div className="summary-grid">
                  {/* Shared equal share QR code */}
                  {showSharedQr && (
                    <PaymentQrCode 
                      amount={equalShareDisplay}
                      message={summaryMsg || 'VOLVO EXPRESS'}
                      vs={summaryVs}
                    />
                  )}

                  {/* Individual overridden QR codes */}
                  {summaryData.passengers.filter(p => p.isManual).map(p => (
                    <PaymentQrCode 
                      key={p.name}
                      amount={p.amount || 0}
                      name={p.name}
                      message={summaryMsg || 'VOLVO EXPRESS'}
                      vs={summaryVs}
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
                    <span>ZAHÁJIT DALŠÍ JÍZDU</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'settings' && (
            <div className="racing-card fade-in">
              <h2 className="card-title">
                <Wrench size={24} style={{ marginRight: 8 }} />
                GARÁŽ (NASTAVENÍ VOZU A CEN)
              </h2>

              {settingsSavedMsg && (
                <div className="alert-success">
                  <CheckCircle size={18} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
                  <span>Parametry vozidla byly úspěšně uloženy!</span>
                </div>
              )}

              {/* Warning/Info alert mentioning static environment variables configuration */}
              <div className="alert-info" style={{ marginBottom: 24 }}>
                <Info size={20} style={{ marginRight: 8 }} />
                <div>
                  <strong>ZABEZPEČENÉ ÚDAJE:</strong> Bankovní spojení a Mapové klíče jsou načteny přímo ze souboru <code>.env</code> a nelze je měnit v uživatelském rozhraní.
                </div>
              </div>

              <form onSubmit={handleSaveSettings}>
                
                <h3 className="settings-section-title">
                  <Car size={18} style={{ marginRight: 8 }} />
                  PRESETY MOTORU & SPOTŘEBY
                </h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Průměrná spotřeba vozu (l/100 km)</label>
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
                    <label className="form-label">Typ paliva</label>
                    <div style={{ display: 'flex', gap: 10 }}>
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

                <h3 className="settings-section-title">CENY PALIV NA ČERPACÍ STANICI (KČ/L)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Benzín (Natural 95 / V-Power)</label>
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
                    <label className="form-label">Nafta (Diesel / V-Power Diesel)</label>
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
                  POSÁDKA V PAMĚTI GARÁŽE (TEAM)
                </h3>
                <div className="passenger-input-group">
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Přidat jméno spolucestujícího"
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
                    PŘIDAT
                  </button>
                </div>

                <div className="passenger-list-box">
                  {settings.passengers.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', padding: 16, fontSize: 13, textAlign: 'center' }}>
                      Žádní registrovaní cestující.
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
                    <span>ULOŽIT PARAMETRY</span>
                  </button>
                </div>

              </form>
            </div>
          )}
        </>
      )}

    </div>
  );
}

export default App;
