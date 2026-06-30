import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  ArrowRight
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

// Import our custom pixel art sprites
import { 
  PixelCar, 
  PixelKey, 
  PixelWrench, 
  PixelFlag, 
  PixelSave, 
  PixelTrophy, 
  PixelAlert, 
  PixelCheck, 
  PixelInfo, 
  PixelCross, 
  PixelCompass 
} from './components/PixelIcons';

function App() {
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
      showToast('Rozpracovaný stage byl načten z garáže!');
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
    tripPassengers, distanceKm, isLoggedIn, settings
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
      setRoutingError('VITE_ORS_API_KEY klíč v .env souboru chybí. Zadej kilometry ručně.');
      setIsManualDistance(true);
      return;
    }

    if (!startPoint || !endPoint) {
      setRoutingError('Chybí Start nebo Cíl!');
      return;
    }

    // Assemble coordinates array
    const coordsList: [number, number][] = [];
    
    if (startCoords) {
      coordsList.push(startCoords);
    } else {
      setRoutingError('Vyber Start z nápovědy.');
      return;
    }

    for (let i = 0; i < stops.length; i++) {
      if (stopCoords[i]) {
        coordsList.push(stopCoords[i]!);
      } else {
        setRoutingError(`Vyber Checkpoint ${i + 1} z nápovědy.`);
        return;
      }
    }

    if (endCoords) {
      coordsList.push(endCoords);
    } else {
      setRoutingError('Vyber Cíl z nápovědy.');
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
        setRoutingError('Neplatný VITE_ORS_API_KEY v .env souboru! Zkontroluj nastavení.');
      } else {
        setRoutingError('Routovací server neodpovídá. Zadej vzdálenost ručně.');
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

  // Calculation formulas (Reads consumption and fuel prices directly from Settings)
  const calculateTotalPrice = (): number => {
    const effectiveDistance = roundTrip ? distanceKm * 2 : distanceKm;
    const fuelPrice = settings.fuelType === 'petrol' ? settings.petrolPrice : settings.dieselPrice;
    const totalLitres = effectiveDistance * (settings.avgConsumption / 100);
    const rawCost = totalLitres * fuelPrice;
    return parseFloat(rawCost.toFixed(2));
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

  return (
    <div className="app-container fade-in">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          backgroundColor: 'var(--bg-tertiary)',
          border: '4px solid var(--accent-cyan)',
          boxShadow: '4px 4px 0px #000',
          padding: '12px 24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 16,
          fontWeight: 'bold'
        }} className="fade-in">
          <PixelInfo size={24} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="app-header">
        <div className="brand" onClick={() => isLoggedIn && setCurrentScreen('active-trip')}>
          <PixelCar size={64} />
          <div className="brand-text">
            <h1>VOLVO EXPRESS</h1>
            <p>峠 TOUGE RUN EXPENSE DIVISION</p>
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
              <PixelCross size={16} />
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
              <PixelKey size={30} style={{ marginRight: 8 }} />
              TOUGE IGNITION / START MOTORU
            </h2>
            
            {loginError && (
              <div className="login-error">
                <PixelAlert size={20} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
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
                <PixelKey size={24} />
                <span>START MOTORU</span>
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
              <PixelCompass size={22} style={{ marginRight: 6 }} />
              Jízda (Stage)
            </button>

            <button 
              type="button" 
              className={`nav-tab ${currentScreen === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('settings')}
            >
              <PixelWrench size={22} style={{ marginRight: 6 }} />
              Garáž (Tuning)
            </button>
          </nav>

          {/* Screen Content Resolver */}
          {currentScreen === 'active-trip' && (
            <div className="trip-overview-grid fade-in">
              {/* Active Trip Left Panel: Config Form */}
              <div className="racing-card">
                <h3 className="card-title">
                  <PixelFlag size={30} style={{ marginRight: 8 }} />
                  ACTIVE STAGE / AKTIVNÍ ERZETA
                </h3>
                
                {routingError && (
                  <div className="alert-warning">
                    <PixelAlert size={20} />
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
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                <div style={{ marginBottom: 24 }}>
                  <button 
                    type="button" 
                    className="btn-racing btn-racing-secondary" 
                    onClick={handleAddStop}
                    style={{ padding: '8px 16px', width: 'auto', fontSize: 18 }}
                  >
                    <PixelFlag size={18} />
                    <span style={{ fontSize: 18 }}>+ PŘIDAT CHECKPOINT</span>
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
                        className={`btn-racing ${!roundTrip ? 'btn-racing-cyan' : 'btn-racing-secondary'}`}
                        onClick={() => setRoundTrip(false)}
                        style={{ padding: '10px 14px', fontSize: 18 }}
                      >
                        Jednosměrná
                      </button>
                      <button 
                        type="button" 
                        className={`btn-racing ${roundTrip ? 'btn-racing-cyan' : 'btn-racing-secondary'}`}
                        onClick={() => setRoundTrip(true)}
                        style={{ padding: '10px 14px', fontSize: 18 }}
                      >
                        Zpáteční
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">&nbsp;</label>
                    <button 
                      type="button" 
                      className="btn-racing" 
                      onClick={handleCalculateRoute}
                      disabled={isCalculating}
                      style={{ fontSize: 20 }}
                    >
                      <PixelCompass size={22} />
                      <span>{isCalculating ? 'Kalkuluji...' : 'VYPOČÍTAT STAGE'}</span>
                    </button>
                  </div>
                </div>

                {/* Segmented HP-like gauge bar during calculations */}
                {isCalculating && (
                  <div>
                    <div className="nitro-gauge">
                      <div className="nitro-fill" style={{ width: '85%' }}></div>
                    </div>
                    <div className="nitro-label">
                      <span>BOOST INJECTOR ACTIVE</span>
                      <span className="animate-pulse">PRACUJI (MAPUJI CHECKPOINTY)</span>
                    </div>
                  </div>
                )}

                <div className="form-grid m-t-20">
                  <div className="form-group">
                    <label className="form-label">DÉLKA STAGE (KILOMETRY)</label>
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
                      <PixelInfo size={18} />
                      <span>Vzdálenost stage zadána ručně.</span>
                    </div>
                  )}
                </div>

                {/* Info block displaying current calculation preset from settings */}
                <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '4px solid #000', padding: 16, marginTop: 10 }}>
                  <div style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-pink)', fontWeight: 'bold', marginBottom: 4 }}>
                    Aktivní parametry z garáže:
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    Spotřeba vozu: <strong style={{ color: 'var(--accent-cyan)' }}>{settings.avgConsumption} l/100km</strong> | 
                    Palivo: <strong style={{ color: 'var(--accent-cyan)' }}>{settings.fuelType === 'petrol' ? 'Benzín' : 'Nafta'}</strong> | 
                    Aktuální cena: <strong style={{ color: 'var(--accent-cyan)' }}>{settings.fuelType === 'petrol' ? settings.petrolPrice : settings.dieselPrice} Kč/l</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                    Pro úpravu cen, spotřeby nebo typu paliva přejdi do záložky "Garáž (Tuning)".
                  </div>
                </div>

                <div style={{ marginTop: 30, display: 'flex', gap: 12 }}>
                  <button 
                    type="button" 
                    className="btn-racing btn-racing-danger" 
                    onClick={handleResetActiveTrip}
                    style={{ fontSize: 20 }}
                  >
                    <PixelCross size={20} />
                    <span>VYMAZAT STATE</span>
                  </button>
                </div>
              </div>

              {/* Active Trip Right Panel: Cost Splits & Passenger Checks */}
              <div>
                <div className="racing-card">
                  <h3 className="card-title">
                    <PixelFlag size={30} style={{ marginRight: 8 }} />
                    Posádka v autě (Team)
                  </h3>
                  
                  {settings.passengers.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                      Žádní jezdci v paměti garáže. Přidej je nejdříve v Nastavení.
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
                      <PixelAlert size={18} />
                      <span>Označ alespoň jednoho člena posádky!</span>
                    </div>
                  )}
                </div>

                <div className="racing-card">
                  <h3 className="card-title">
                    <PixelTrophy size={30} style={{ marginRight: 8 }} />
                    TUNING BUDGET (NÁKLADY)
                  </h3>

                  <div className="summary-stats">
                    <div className="stat-box">
                      <div className="stat-label">CELKOVÉ NÁKLADY STAGE</div>
                      <div className="stat-val text-accent">{totalPrice} Kč</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-label">ZÁKLADNÍ PODÍL / OSOBA</div>
                      <div className="stat-val text-yellow">{equalShareDisplay} Kč</div>
                    </div>
                  </div>

                  {/* Manual Cost Splits Table */}
                  {activeChecked.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div className="flex-between">
                        <h4 style={{ fontSize: 24, color: 'var(--accent-purple)' }}>DRIFT PARTNERS / ROZDĚLENÍ</h4>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={shouldRound} 
                            onChange={(e) => setShouldRound(e.target.checked)}
                            style={{ accentColor: 'var(--accent-pink)', width: 16, height: 16 }}
                          />
                          Zaokrouhlovat podíly
                        </label>
                      </div>

                      {sumManuals > totalPrice && (
                        <div className="alert-warning" style={{ margin: '12px 0' }}>
                          <PixelAlert size={16} />
                          <span>Překročen tuning budget jízdy! Uprav podíly.</span>
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
                                      style={{ padding: 4 }}
                                      title="Reset na rovný podíl"
                                    >
                                      <Trash2 size={14} />
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
                          <PixelInfo size={16} />
                          <span>
                            Zbylo k rozdělení: <strong>{(totalPrice - sumManuals).toFixed(0)} Kč</strong> rovným dílem mezi {unmodifiedCount} os.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 30 }}>
                    <button 
                      type="button" 
                      className="btn-racing btn-racing-cyan"
                      onClick={handleFinishTrip}
                      disabled={!isTripValid()}
                    >
                      <PixelFlag size={22} />
                      <span>CÍLOVÁ ROVINKA (FINISH)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'summary' && summaryData && (
            <div className="fade-in">
              <div className="racing-card" style={{ borderColor: 'var(--accent-cyan)' }}>
                <h2 className="card-title text-cyan">
                  <PixelTrophy size={34} style={{ marginRight: 10 }} />
                  VICTORY LAP / VÝSLEDKY ZÁVODU
                </h2>

                <div className="summary-stats">
                  <div className="stat-box" style={{ borderColor: 'var(--accent-cyan)' }}>
                    <div className="stat-label">UJETÁ VZDÁLENOST STAGE</div>
                    <div className="stat-val text-cyan">{summaryData.distanceKm} km</div>
                  </div>
                  <div className="stat-box" style={{ borderColor: 'var(--accent-cyan)' }}>
                    <div className="stat-label">TUNING BUDGET CELKEM</div>
                    <div className="stat-val text-cyan">{summaryData.totalPrice} Kč</div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: 16, border: '4px solid #000', marginBottom: 24 }}>
                  <div style={{ fontSize: 15, textTransform: 'uppercase', color: 'var(--accent-pink)', marginBottom: 8, fontWeight: 'bold' }}>Detaily trasy (Race Stage)</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    {summaryData.startPoint} {summaryData.endPoint && <><ArrowRight size={14} style={{ display: 'inline', margin: '0 6px' }} /> {summaryData.endPoint}</>}
                  </div>
                  {summaryData.stops.length > 0 && (
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
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
                      placeholder="JDM Touge Run"
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

                <h3 className="settings-section-title">
                  <PixelSave size={30} style={{ marginRight: 8 }} />
                  PLATEBNÍ QR KÓDY
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
                    <PixelCar size={24} />
                    <span>DALŠÍ ZÁVOD</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'settings' && (
            <div className="racing-card fade-in">
              <h2 className="card-title">
                <PixelWrench size={34} style={{ marginRight: 10 }} />
                GARAGE & TUNING / NASTAVENÍ
              </h2>

              {settingsSavedMsg && (
                <div className="alert-success">
                  <PixelCheck size={20} style={{ marginRight: 8 }} />
                  <span>Garáž byla úspěšně vytuněna!</span>
                </div>
              )}

              {/* Warning/Info alert mentioning static environment variables configuration */}
              <div className="alert-info" style={{ marginBottom: 24 }}>
                <PixelInfo size={20} style={{ marginRight: 8 }} />
                <div>
                  <strong>STATIC PROFILE:</strong> Bankovní spojení a Mapové klíče jsou pevně načteny ze souboru <code>.env</code> na serveru a z bezpečnostních důvodů je nelze měnit v rozhraní.
                </div>
              </div>

              <form onSubmit={handleSaveSettings}>
                
                <h3 className="settings-section-title">
                  <PixelCar size={24} style={{ marginRight: 8 }} />
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
                        className={`btn-racing ${settings.fuelType === 'petrol' ? 'btn-racing-cyan' : 'btn-racing-secondary'}`}
                        onClick={() => setSettingsState({ ...settings, fuelType: 'petrol' })}
                        style={{ padding: '10px 14px', fontSize: 18 }}
                      >
                        Benzín
                      </button>
                      <button 
                        type="button" 
                        className={`btn-racing ${settings.fuelType === 'diesel' ? 'btn-racing-cyan' : 'btn-racing-secondary'}`}
                        onClick={() => setSettingsState({ ...settings, fuelType: 'diesel' })}
                        style={{ padding: '10px 14px', fontSize: 18 }}
                      >
                        Nafta
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="settings-section-title">VÝCHOZÍ CENY ZDVIHU (KČ/L)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Benzín</label>
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
                    <label className="form-label">Nafta</label>
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
                  <PixelFlag size={24} style={{ marginRight: 8 }} />
                  POSÁDKA V GARÁŽI (TEAM MEMORY)
                </h3>
                <div className="passenger-input-group">
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Přidat jméno jezdce"
                    value={newPassengerName}
                    onChange={(e) => setNewPassengerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPassenger())}
                  />
                  <button 
                    type="button" 
                    className="btn-racing btn-racing-cyan"
                    onClick={handleAddPassenger}
                    style={{ width: 'auto', padding: '12px 20px', fontSize: 18 }}
                  >
                    PŘIDAT
                  </button>
                </div>

                <div className="passenger-list-box">
                  {settings.passengers.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', padding: 16, fontSize: 14, textAlign: 'center' }}>
                      Garáž je prázdná. Žádná posádka.
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
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: 30 }}>
                  <button type="submit" className="btn-racing">
                    <PixelSave size={24} />
                    <span>ULOŽIT DO GARÁŽE</span>
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
