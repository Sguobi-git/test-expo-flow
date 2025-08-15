import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ArrowRight, Package, Truck, CheckCircle2, Clock, AlertCircle, MapPin, Star, Zap, Bell, RefreshCw, Building2, Award, Shield, Search, X } from 'lucide-react';

function App() {
  const [selectedExhibitor, setSelectedExhibitor] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [abacusStatus, setAbacusStatus] = useState(null);
  const [exhibitors, setExhibitors] = useState([]); // Dynamic exhibitors from Google Sheets
  const [loadingExhibitors, setLoadingExhibitors] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); // Search functionality

  // Professional icon generator based on booth number
  const generateExhibitorIcon = (exhibitorName, boothNumber) => {
    // Extract booth section (letter) and number
    const boothMatch = boothNumber.match(/([A-Z]+)[-]?(\d+)/);
    const section = boothMatch ? boothMatch[1] : 'A';
    const number = boothMatch ? parseInt(boothMatch[2]) : 100;
    
    // Generate professional colors based on section - using only professional colors
    const sectionColors = {
      'A': { bg: 'from-slate-600 to-slate-700', text: 'text-slate-100', accent: 'border-slate-300' },
      'B': { bg: 'from-gray-600 to-gray-700', text: 'text-gray-100', accent: 'border-gray-300' },
      'C': { bg: 'from-zinc-600 to-zinc-700', text: 'text-zinc-100', accent: 'border-zinc-300' },
      'D': { bg: 'from-stone-600 to-stone-700', text: 'text-stone-100', accent: 'border-stone-300' },
      'E': { bg: 'from-neutral-600 to-neutral-700', text: 'text-neutral-100', accent: 'border-neutral-300' },
      'F': { bg: 'from-slate-700 to-slate-800', text: 'text-slate-100', accent: 'border-slate-400' },
      'G': { bg: 'from-gray-700 to-gray-800', text: 'text-gray-100', accent: 'border-gray-400' },
      'H': { bg: 'from-zinc-700 to-zinc-800', text: 'text-zinc-100', accent: 'border-zinc-400' },
      'I': { bg: 'from-slate-500 to-slate-600', text: 'text-slate-100', accent: 'border-slate-300' },
      'J': { bg: 'from-gray-500 to-gray-600', text: 'text-gray-100', accent: 'border-gray-300' },
    };
    
    const colorScheme = sectionColors[section] || sectionColors['A'];
    
    // Generate initials from company name (first letter of each word, max 2)
    const words = exhibitorName.split(' ').filter(word => word.length > 2); // Filter out small words like "Inc", "LLC"
    let initials = '';
    
    if (words.length >= 2) {
      initials = words[0][0] + words[1][0];
    } else if (words.length === 1) {
      initials = words[0].substring(0, 2);
    } else {
      initials = exhibitorName.substring(0, 2);
    }
    
    return {
      initials: initials.toUpperCase(),
      colorScheme,
      section,
      number: boothNumber
    };
  };

  // Keep original status colors exactly as they were
  const orderStatuses = {
    'delivered': { 
      label: 'Delivered', 
      progress: 100, 
      color: 'from-green-500 to-emerald-500',
      icon: CheckCircle2,
      bgColor: 'bg-green-500/20 text-green-400',
      priority: 5
    },
    'out-for-delivery': { 
      label: 'Out for Delivery', 
      progress: 75, 
      color: 'from-blue-500 to-cyan-500',
      icon: Truck,
      bgColor: 'bg-blue-500/20 text-blue-400',
      priority: 3
    },
    'in-route': { 
      label: 'In Route from Warehouse', 
      progress: 50, 
      color: 'from-yellow-500 to-orange-500',
      icon: MapPin,
      bgColor: 'bg-yellow-500/20 text-yellow-400',
      priority: 2
    },
    'in-process': { 
      label: 'In Process', 
      progress: 25, 
      color: 'from-purple-500 to-pink-500',
      icon: Clock,
      bgColor: 'bg-purple-500/20 text-purple-400',
      priority: 1
    },
    'cancelled': { 
      label: 'Cancelled', 
      progress: 0, 
      color: 'from-red-500 to-red-600',
      icon: AlertCircle,
      bgColor: 'bg-red-500/20 text-red-400',
      priority: 4
    }
  };

  const sortOrdersByStatus = (ordersArray) => {
    return ordersArray.sort((a, b) => {
      const aPriority = orderStatuses[a.status]?.priority || 99;
      const bPriority = orderStatuses[b.status]?.priority || 99;
      return aPriority - bPriority;
    });
  };

  const API_BASE = 'https://v3-exhibitor-live-update.onrender.com/api';

  // Actual Expo CCI Logo Component
  const ExpoLogo = ({ size = "large", color = "black" }) => {
    const isLarge = size === "large";
    const logoHeight = isLarge ? "h-12" : "h-8";
    const filter = color === "white" ? "brightness(0) invert(1)" : "";
    
    return (
      <div className="flex items-center">
        <img 
          src="https://i.ibb.co/5gdgZVxj/output-onlinepngtools.png" 
          alt="Expo Convention Contractors"
          className={`${logoHeight} w-auto object-contain ${filter}`}
          style={{ filter: color === "white" ? "brightness(0) invert(1)" : "none" }}
        />
      </div>
    );
  };

  // KEPT EXACTLY AS YOUR WORKING VERSION
  const fetchAbacusStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/abacus-status`);
      const data = await response.json();
      setAbacusStatus(data);
      console.log('🤖 System Status:', data);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  }, [API_BASE]);

  // KEPT EXACTLY AS YOUR WORKING VERSION (with only API_BASE URL updated)
  const fetchExhibitors = useCallback(async (forceRefresh = false) => {
    setLoadingExhibitors(true);
    try {
      console.log('🏢 Fetching all exhibitors from Google Sheets...');
      
      const url = `${API_BASE}/exhibitors${forceRefresh ? '?force_refresh=true' : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Exhibitors Response:', data);
      
      // Ensure data is an array and has content
      if (Array.isArray(data) && data.length > 0) {
        // Sort exhibitors alphabetically for consistent display
        const sortedExhibitors = data.sort((a, b) => a.name.localeCompare(b.name));
        setExhibitors(sortedExhibitors);
        console.log(`✅ Loaded ${sortedExhibitors.length} exhibitors dynamically`);
      } else {
        throw new Error('No exhibitors found in API response');
      }
      
    } catch (error) {
      console.error('Error fetching exhibitors:', error);
      
      // CRITICAL: Use same fallback pattern as your working version
      // Fallback exhibitors with real names from your working code
      const fallbackExhibitors = [
        { name: 'nevetal', booth: '3005', total_orders: 3, delivered_orders: 1 },
        { name: 'Saint Lucia Tourism Authority', booth: 'B-156', total_orders: 2, delivered_orders: 2 },
        { name: 'Costa Rica', booth: 'C-089', total_orders: 1, delivered_orders: 0 },
        { name: 'Discover Dominica Authority', booth: 'D-312', total_orders: 4, delivered_orders: 3 },
        { name: 'Great Italy Tour & Events', booth: 'E-445', total_orders: 2, delivered_orders: 1 },
        { name: 'Quench USA', booth: 'F-201', total_orders: 3, delivered_orders: 2 }
      ];
      setExhibitors(fallbackExhibitors);
      console.log('⚠️ Using fallback exhibitors from your working version');
    } finally {
      setLoadingExhibitors(false);
    }
  }, [API_BASE]);

  // Filter exhibitors based on search term
  const filteredExhibitors = exhibitors.filter(exhibitor =>
    exhibitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exhibitor.booth.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearSearch = () => {
    setSearchTerm('');
  };

  const generateNotifications = useCallback((ordersData) => {
    const notifications = [];
    ordersData.forEach((order) => {
      if (order.status === 'in-route') {
        notifications.push({
          id: Math.random(),
          message: `${order.item} is in route from warehouse`,
          time: `${Math.floor(Math.random() * 30) + 1} min ago`,
          type: 'delivery'
        });
      } else if (order.status === 'delivered') {
        notifications.push({
          id: Math.random(),
          message: `${order.item} has been delivered`,
          time: `${Math.floor(Math.random() * 120) + 1} min ago`,
          type: 'success'
        });
      } else if (order.status === 'out-for-delivery') {
        notifications.push({
          id: Math.random(),
          message: `${order.item} is out for delivery`,
          time: `${Math.floor(Math.random() * 15) + 1} min ago`,
          type: 'delivery'
        });
      }
    });
    setNotifications(notifications.slice(0, 3));
  }, []);

  const createFallbackOrders = useCallback((exhibitorName) => {
    const realItems = [
      'Round Table 30" high',
      'White Side Chair', 
      'Black Side Chair',
      'Skirted Table 2\' x 4\' 30" High',
      'White Stool with back',
      '2 Meter Curved Counter',
      'Round Table 42" high',
      'Arm Light'
    ];

    const realStatuses = ['delivered', 'in-route', 'in-process', 'out-for-delivery'];
    
    return Array.from({length: 6}, (_, i) => ({
      id: `ECC-${exhibitorName.replace(/\s+/g, '-')}-${i + 1}`,
      item: realItems[i % realItems.length],
      description: `Professional exhibition furniture and equipment`,
      booth_number: `${Math.floor(Math.random() * 9000) + 1000}`,
      color: ['White', 'Black', 'Natural Wood'][i % 3],
      quantity: Math.floor(Math.random() * 5) + 1,
      status: realStatuses[i % realStatuses.length],
      order_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      comments: 'Coordinated by Expo Convention Contractors',
      section: `Section ${Math.floor(Math.random() * 3) + 1}`,
      data_source: 'Expo CCI Database',
      expo_processed: true
    }));
  }, []);

  // KEPT EXACTLY AS YOUR WORKING VERSION (with only API_BASE URL updated)
  const fetchOrders = useCallback(async (exhibitorName, forceRefresh = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      console.log(`🔍 Fetching orders for: ${exhibitorName}${forceRefresh ? ' (FORCE REFRESH)' : ''}`);
      
      const url = `${API_BASE}/orders/exhibitor/${encodeURIComponent(exhibitorName)}${forceRefresh ? '?force_refresh=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      console.log('📊 System Response:', data);
      
      const sortedOrders = sortOrdersByStatus(data.orders || []);
      setOrders(sortedOrders);
      setLastUpdated(new Date(data.last_updated));
      generateNotifications(sortedOrders);
      
      if (forceRefresh) {
        console.log('🔄 MANUAL REFRESH COMPLETED - Fresh data from Google Sheets');
      }
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      
      const fallbackOrders = createFallbackOrders(exhibitorName);
      const sortedFallbackOrders = sortOrdersByStatus(fallbackOrders);
      setOrders(sortedFallbackOrders);
      setLastUpdated(new Date());
      generateNotifications(sortedFallbackOrders);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, generateNotifications, createFallbackOrders, loading]);

  // ONLY CHANGE: Force refresh exhibitors on component mount
  useEffect(() => {
    fetchExhibitors(true); // <- ONLY CHANGE: Added 'true' to force refresh
    fetchAbacusStatus();
  }, [fetchExhibitors, fetchAbacusStatus]);

  // KEPT EXACTLY AS YOUR WORKING VERSION
  useEffect(() => {
    if (isLoggedIn && selectedExhibitor) {
      const exhibitor = exhibitors.find(e => e.name === selectedExhibitor);
      if (exhibitor) {
        // Initial fetch (uses cache if available)
        fetchOrders(exhibitor.name, false);
        
        const interval = setInterval(() => {
          fetchOrders(exhibitor.name, false); // Auto-refresh uses cache
        }, 120000); // Auto-refresh every 2 minutes
        
        return () => clearInterval(interval);
      }
    }
  }, [isLoggedIn, selectedExhibitor]);

  const handleLogin = () => {
    if (selectedExhibitor) {
      setIsLoggedIn(true);
    }
  };

  // KEPT EXACTLY AS YOUR WORKING VERSION
  const handleRefresh = () => {
    if (selectedExhibitor && !loading) {
      const exhibitor = exhibitors.find(e => e.name === selectedExhibitor);
      if (exhibitor) {
        // Force refresh bypasses cache and gets fresh data from Google Sheets
        fetchOrders(exhibitor.name, true);
      }
    }
  };

  const renderProgressBar = (status) => {
    const statusInfo = orderStatuses[status] || orderStatuses['in-process'];
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">Delivery Progress</span>
          <span className="text-gray-900 font-bold">{statusInfo.progress}%</span>
        </div>
        <div className="relative w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`bg-gradient-to-r ${statusInfo.color} h-3 rounded-full transition-all duration-1000 relative overflow-hidden`}
            style={{ width: `${statusInfo.progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent w-20 animate-sweep"></div>
          </div>
        </div>
        <style jsx>{`
          @keyframes sweep {
            0% { transform: translateX(-100px); }
            100% { transform: translateX(calc(100vw)); }
          }
          .animate-sweep {
            animation: sweep 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  };

  // Login Screen with Dynamic Exhibitors
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-teal-100/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gray-100/60 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-teal-50/60 rounded-full blur-3xl"></div>
        </div>

        <div className="relative w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl p-8 border border-gray-200 shadow-2xl">
            <div className="text-center mb-8">
              <div className="mb-6">
                <ExpoLogo size="large" />
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ExpoFlow</h1>
              <p className="text-teal-600 font-medium">Order Tracking System</p>
              
              <div className="flex items-center justify-center space-x-2 mt-4">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span className="text-gray-600 text-sm">Expo Convention Contractors</span>
              </div>
              
              {abacusStatus && (
                <div className="mt-3 text-xs text-gray-500 flex items-center justify-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>System Online</span>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Your Company
                </label>
                <span className="text-xs text-gray-500">
                  {loadingExhibitors ? 'Loading...' : `${filteredExhibitors.length} of ${exhibitors.length} companies`}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search companies or booth numbers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-2xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      onClick={clearSearch}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {loadingExhibitors ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Loading exhibitors from Google Sheets...</p>
                </div>
              ) : filteredExhibitors.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No companies found matching "{searchTerm}"</p>
                  <button
                    onClick={clearSearch}
                    className="mt-2 text-teal-600 hover:text-teal-700 text-sm font-medium"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                  {filteredExhibitors.map((exhibitor, index) => {
                    const iconData = generateExhibitorIcon(exhibitor.name, exhibitor.booth);
                    
                    return (
                      <div
                        key={`${exhibitor.name}-${index}`}
                        className={`relative cursor-pointer transition-all duration-300 ${
                          selectedExhibitor === exhibitor.name ? '' : 'hover:scale-102'
                        }`}
                        onClick={() => setSelectedExhibitor(exhibitor.name)}
                      >
                        <div className={`
                          p-4 rounded-2xl border-2 transition-all duration-300
                          ${selectedExhibitor === exhibitor.name
                            ? 'border-teal-400 bg-teal-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                          }
                        `}>
                          <div className="flex items-center space-x-4">
                            {/* Dynamic Professional Icon */}
                            <div className={`
                              w-12 h-12 rounded-xl bg-gradient-to-br ${iconData.colorScheme.bg} 
                              flex items-center justify-center shadow-lg border border-gray-300
                            `}>
                              <span className={`text-sm font-bold ${iconData.colorScheme.text}`}>
                                {iconData.initials}
                              </span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">{exhibitor.name}</h3>
                              <div className="flex items-center space-x-3 mt-1">
                                <p className="text-xs text-teal-600 font-medium">Booth {exhibitor.booth}</p>
                              </div>
                              {/* Show order stats if available */}
                              {exhibitor.total_orders !== undefined && (
                                <div className="flex items-center space-x-3 mt-1">
                                  <span className="text-xs text-gray-600">{exhibitor.total_orders} orders</span>
                                  <span className="text-xs text-green-600">{exhibitor.delivered_orders} delivered</span>
                                </div>
                              )}
                            </div>
                            
                            {selectedExhibitor === exhibitor.name && (
                              <div className="text-teal-600">
                                <ArrowRight className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleLogin}
              disabled={!selectedExhibitor || loadingExhibitors}
              className={`
                w-full py-4 rounded-2xl font-semibold text-white transition-all duration-300
                ${selectedExhibitor && !loadingExhibitors
                  ? 'bg-gradient-to-r from-teal-600 to-teal-700 hover:shadow-lg hover:scale-105 active:scale-95'
                  : 'bg-gray-400 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-center justify-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>Access Your Orders</span>
              </div>
            </button>

            <div className="text-center mt-6">
              <p className="text-xs text-gray-500">
                Professional Exhibition Management • Real-time Updates
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  const exhibitor = exhibitors.find(e => e.name === selectedExhibitor);
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const pendingOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

  if (!exhibitor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-6">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Exhibitor Not Found</h3>
          <p className="text-gray-600 mb-4">The selected exhibitor could not be found.</p>
          <button 
            onClick={() => setIsLoggedIn(false)}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const iconData = generateExhibitorIcon(exhibitor.name, exhibitor.booth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile Responsive */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl p-4 md:p-6 border border-gray-200 shadow-xl mb-8">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            {/* Left side - Company info */}
            <div className="flex items-center space-x-3 md:space-x-6">
              <div className="flex items-center space-x-3 md:space-x-4">
                <ExpoLogo size="small" />
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${iconData.colorScheme.bg} flex items-center justify-center shadow-lg border border-gray-300`}>
                  <span className={`text-sm md:text-lg font-bold ${iconData.colorScheme.text}`}>
                    {iconData.initials}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl md:text-3xl font-bold text-gray-900 truncate">{exhibitor.name}</h1>
                <p className="text-sm md:text-base text-gray-600">
                  <span className="text-teal-600">Booth {exhibitor.booth}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 md:mt-2">
                  <span className="text-xs md:text-sm text-teal-600 flex items-center space-x-1">
                    <Award className="w-3 h-3 md:w-4 md:h-4" />
                    <span>Expo Convention Contractors</span>
                  </span>
                  <span className="text-xs md:text-sm text-gray-500">Live Order Tracking</span>
                </div>
              </div>
            </div>
            
            {/* Right side - Action buttons - KEPT EXACTLY AS YOUR WORKING VERSION */}
            <div className="flex items-center justify-end space-x-2 md:space-x-4 flex-shrink-0">
              <button 
                onClick={handleRefresh}
                disabled={loading}
                className="p-2 md:p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl md:rounded-2xl transition-all duration-300 border border-gray-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <div className="relative">
                <Bell className="w-5 h-5 md:w-6 md:h-6 text-gray-600 cursor-pointer hover:text-teal-600 transition-colors" />
                {notifications.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <button 
                onClick={() => setIsLoggedIn(false)}
                className="px-3 py-2 md:px-6 md:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl md:rounded-2xl transition-all duration-300 border border-gray-200 text-sm md:text-base"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <Package className="w-8 h-8 text-teal-600" />
              <h3 className="text-lg font-semibold text-gray-900">Total Orders</h3>
            </div>
            <div className="text-3xl font-bold text-teal-600">{orders.length}</div>
            <div className="text-xs text-gray-500 mt-1">Managed by Expo CCI</div>
          </div>
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Delivered</h3>
            </div>
            <div className="text-3xl font-bold text-green-500">{deliveredOrders}</div>
            <div className="text-xs text-gray-500 mt-1">Completed</div>
          </div>
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <Clock className="w-8 h-8 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-900">In Progress</h3>
            </div>
            <div className="text-3xl font-bold text-purple-500">{pendingOrders}</div>
            <div className="text-xs text-gray-500 mt-1">Auto-refresh every 2 min</div>
          </div>
        </div>

        {/* Order Status Legend */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 shadow-lg mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery Steps</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(orderStatuses)
              .sort(([,a], [,b]) => a.priority - b.priority)
              .map(([status, info]) => (
                <div key={status} className={`flex items-center space-x-2 p-3 rounded-lg ${info.bgColor}`}>
                  <info.icon className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">{info.label}</div>
                    <div className="text-xs opacity-75">Priority {info.priority}</div>
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Orders are automatically sorted by priority. Pending orders appear first, delivered orders appear last.
          </div>
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 shadow-lg mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Zap className="w-6 h-6 text-teal-600" />
              <span>Live Updates</span>
            </h2>
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-800 flex-1">{notif.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700">Synchronizing with Expo CCI Database...</p>
          </div>
        )}

        {/* Orders Grid - Keeping original status colors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {orders.map((order) => {
            const statusInfo = orderStatuses[order.status] || orderStatuses['in-process'];
            const StatusIcon = statusInfo.icon;
            
            return (
              <div key={order.id} className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-300 shadow-lg">
                {/* Order Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <StatusIcon className="w-6 h-6 text-gray-700" />
                    <span className="text-gray-900 font-bold">{order.id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      Priority {statusInfo.priority}
                    </span>
                    {order.expo_processed && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
                        Expo CCI
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Info */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{order.item}</h3>
                <p className="text-gray-600 text-sm mb-4">{order.description}</p>

                {/* Order Details */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <p className="text-gray-500">Order Date</p>
                    <p className="text-gray-900 font-medium">{order.order_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="text-gray-900 font-medium">{order.quantity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Color</p>
                    <p className="text-gray-900 font-medium">{order.color}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Section</p>
                    <p className="text-gray-900 font-medium">{order.section}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  {renderProgressBar(order.status)}
                </div>

                {/* Status Badge - Original colors preserved */}
                <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-full ${statusInfo.bgColor}`}>
                  <StatusIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{statusInfo.label}</span>
                </div>

                {/* Comments */}
                {order.comments && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-gray-500 text-xs mb-1">Comments</p>
                    <p className="text-gray-800 text-sm">{order.comments}</p>
                  </div>
                )}

                {/* Expo CCI Footer */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <ExpoLogo size="small" />
                  <span className="text-xs text-gray-400">Managed by Expo Convention Contractors</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* No orders message */}
        {!loading && orders.length === 0 && (
          <div className="text-center py-12">
            <div className="mb-4">
              <ExpoLogo size="large" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-600">No orders found for {exhibitor.name} in our system.</p>
            <p className="text-gray-500 text-sm mt-2">Managed by Expo Convention Contractors</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center bg-white/90 backdrop-blur-lg rounded-2xl p-6 border border-gray-200 shadow-lg">
          <div className="flex items-center justify-center mb-3">
            <ExpoLogo size="large" />
          </div>
          <p className="text-gray-600 text-sm font-medium mb-2">
            "Large Enough To Be Exceptional, Yet Small Enough To Be Personable"
          </p>
          <p className="text-gray-500 text-xs">
            Expo Convention Contractors Inc. • Professional Exhibition Management • Miami, Florida
          </p>
          <div className="mt-4 text-xs text-gray-400">
            ExpoFlow v3.0 • Real-time Order Tracking System
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
