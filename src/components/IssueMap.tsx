/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon, Tooltip } from "react-leaflet";
import L from "leaflet";
import { Issue } from "../types";
import { MapPin, Compass, Search, Activity, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { SF_DISTRICTS, calculateDistrictHealth, getHealthColor, getDistricts } from "../utils/districtUtils";

// Fix for default marker icons in Leaflet with Vite/React
// @ts-ignore
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
// @ts-ignore
import markerIcon from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface IssueMapProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onViewDetails?: (issue: Issue) => void;
  selectedIssueId?: string;
}

// Component to handle map centering
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function IssueMap({ issues, onSelectIssue, onViewDetails, selectedIssueId }: IssueMapProps) {
  const [mapMode, setMapMode] = useState<"standard" | "alarming">("standard");
  const [showHealthZones, setShowHealthZones] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null);
  const prevStatusesRef = React.useRef<Record<string, string>>({});

  useEffect(() => {
    issues.forEach(issue => {
      const prevStatus = prevStatusesRef.current[issue.id];
      if (prevStatus && prevStatus !== "Resolved" && issue.status === "Resolved") {
        setJustResolvedId(issue.id);
        const timer = setTimeout(() => {
          setJustResolvedId(null);
        }, 8000);
      }
      prevStatusesRef.current[issue.id] = issue.status;
    });
  }, [issues]);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewCenter, setViewCenter] = useState<[number, number]>([20.5937, 78.9629]); // India default fallback center
  const [viewZoom, setViewZoom] = useState(5);

  const activeDistricts = React.useMemo(() => {
    return getDistricts(viewCenter);
  }, [viewCenter]);

  // User/Citizen location states
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locatingError, setLocatingError] = useState<string | null>(null);

  const locateCitizen = () => {
    if (!navigator.geolocation) {
      setLocatingError("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocatingUser(true);
    setLocatingError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation([lat, lng]);
        setViewCenter([lat, lng]);
        setViewZoom(13); // Focus zoom level for the city
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
          if (res.ok) {
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.address?.suburb;
            if (city) {
              setUserCity(city);
            } else {
              setUserCity("Detected Municipal Area");
            }
          } else {
            setUserCity("Current Location");
          }
        } catch (err) {
          console.warn("Reverse-geocoding of current city failed:", err);
          setUserCity("Current Location");
        } finally {
          setIsLocatingUser(false);
        }
      },
      (err) => {
        console.warn("Geolocation denied or error:", err);
        setLocatingError("GPS location access denied or timed out. Map focused on community center.");
        setIsLocatingUser(false);
        
        // Fallback: If we have issues, center on the first issue's coordinates
        if (issues.length > 0) {
          setViewCenter([issues[0].latitude, issues[0].longitude]);
          setViewZoom(issues[0].latitude > 5 && issues[0].latitude < 38 && issues[0].longitude > 65 && issues[0].longitude < 98 ? 10 : 12);
        } else {
          setViewCenter([20.5937, 78.9629]);
          setViewZoom(5);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Find selected issue
  const selectedIssue = issues.find((i) => i.id === selectedIssueId);

  useEffect(() => {
    if (selectedIssue) {
      setViewCenter([selectedIssue.latitude, selectedIssue.longitude]);
      setViewZoom(16);
    } else {
      locateCitizen();
    }
  }, [selectedIssueId]);

  // Filter issues based on search query
  const filteredIssues = issues.filter((issue) => {
    const matchesSearch = searchQuery === "" || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Pothole": return "#f59e0b";
      case "Water Leakage": return "#3b82f6";
      case "Garbage Accumulation":
      case "Illegal Dumping": return "#10b981";
      case "Broken Streetlight": return "#eab308";
      case "Flooding": return "#0891b2";
      case "Public Safety": return "#ef4444";
      default: return "#64748b";
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Pothole": return "bg-amber-50 border-amber-200 text-amber-700";
      case "Water Leakage": return "bg-blue-50 border-blue-200 text-blue-700";
      case "Garbage Accumulation":
      case "Illegal Dumping": return "bg-emerald-50 border-emerald-200 text-emerald-700";
      case "Broken Streetlight": return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "Flooding": return "bg-cyan-50 border-cyan-200 text-cyan-700";
      case "Public Safety": return "bg-red-50 border-red-200 text-red-700";
      default: return "bg-slate-50 border-slate-200 text-slate-700";
    }
  };

  // Custom marker creator
  const createCustomIcon = (issue: Issue) => {
    const color = getCategoryColor(issue.category);
    const isSelected = issue.id === selectedIssueId;
    
    return L.divIcon({
      className: "custom-div-icon",
      html: `<div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; ${isSelected ? 'transform: scale(1.2);' : ''} transition: all 0.2s;">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  };

  // Citizen current location marker creator
  const createCitizenLocationIcon = () => {
    return L.divIcon({
      className: "citizen-gps-icon",
      html: `
        <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
          <style>
            @keyframes gpsPulse {
              0% { transform: scale(0.6); opacity: 0.6; }
              50% { transform: scale(1.8); opacity: 0; }
              100% { transform: scale(0.6); opacity: 0.6; }
            }
          </style>
          <div style="position: absolute; width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; animation: gpsPulse 2s ease-out infinite;"></div>
          <div style="position: relative; width: 14px; height: 14px; background: #1d4ed8; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 5px rgba(29,78,216,0.5);"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Calculate "alarming areas"
  // A simple way: find clusters of points.
  // For a basic implementation, we can show red circles around areas with > 3 issues in close proximity
  const alarmingAreas = React.useMemo(() => {
    if (mapMode !== "alarming") return [];
    
    const areas: { lat: number, lng: number, count: number }[] = [];
    const threshold = 0.005; // approx 500m
    
    const processed = new Set<string>();
    
    issues.forEach(issue => {
      if (processed.has(issue.id)) return;
      
      const cluster = issues.filter(other => {
        const dLat = Math.abs(issue.latitude - other.latitude);
        const dLng = Math.abs(issue.longitude - other.longitude);
        return dLat < threshold && dLng < threshold;
      });
      
      if (cluster.length >= 3) {
        // Average coordinates
        const avgLat = cluster.reduce((sum, i) => sum + i.latitude, 0) / cluster.length;
        const avgLng = cluster.reduce((sum, i) => sum + i.longitude, 0) / cluster.length;
        
        areas.push({ lat: avgLat, lng: avgLng, count: cluster.length });
        cluster.forEach(i => processed.add(i.id));
      }
    });
    
    return areas;
  }, [issues, mapMode]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs animate-fade-in" id="osm-map-module">
      {/* Map Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-base">
              OpenStreetMap Community Safety
            </h3>
            <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
              Live OS Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Plotted issues on OpenStreetMap. Red zones indicate high activity areas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 shrink-0 self-start md:self-auto">
          {/* Base Map Mode */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setMapMode("standard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mapMode === "standard"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setMapMode("alarming")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mapMode === "alarming"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Alarming Areas
            </button>
          </div>

          {/* Living City Overlays Toggle */}
          <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 text-xs">
            <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none px-2 py-1 hover:bg-white rounded-lg transition-all">
              <input
                type="checkbox"
                checked={showPins}
                onChange={(e) => setShowPins(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
              />
              <span>Pins</span>
            </label>
            <div className="w-px h-3.5 bg-slate-200" />
            <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none px-2 py-1 hover:bg-white rounded-lg transition-all">
              <input
                type="checkbox"
                checked={showHealthZones}
                onChange={(e) => setShowHealthZones(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
              />
              <span className="flex items-center gap-1">
                🏡 Living City
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Leaflet Map Area */}
        <div className="lg:col-span-8 relative bg-slate-100 border-r border-slate-200" style={{ height: "500px" }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .district-health-polygon {
              transition: fill 800ms ease-in-out, fill-opacity 800ms ease-in-out, stroke 800ms ease-in-out;
            }
            .district-health-polygon:hover {
              fill-opacity: 0.55 !important;
              stroke-width: 3px !important;
            }
            @keyframes pulseGlow {
              0% { transform: scale(1); opacity: 0.9; }
              50% { transform: scale(1.4); opacity: 0.3; }
              100% { transform: scale(1); opacity: 0.9; }
            }
            .resolved-pulse-glow {
              animation: pulseGlow 1.8s ease-out infinite;
            }
          `}} />
          
          <MapContainer 
            center={viewCenter} 
            zoom={viewZoom} 
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <ChangeView center={viewCenter} zoom={viewZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Living City Health Overlays */}
            {showHealthZones && activeDistricts.map((district) => {
              const report = calculateDistrictHealth(district.id, issues, activeDistricts);
              const healthColor = getHealthColor(report.score);
              return (
                <Polygon
                  key={district.id}
                  positions={district.polygon}
                  pathOptions={{
                    fillColor: healthColor.hex,
                    fillOpacity: 0.32,
                    color: healthColor.hex,
                    weight: report.atRisk ? 2.5 : 1.2,
                    dashArray: report.atRisk ? "5, 5" : undefined,
                    className: "district-health-polygon"
                  }}
                >
                  <Tooltip sticky>
                    <div className="p-2 font-sans text-xs max-w-[240px]">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1 mb-1.5 justify-between">
                        <span className="font-extrabold text-slate-800 text-xs">{district.name}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wide ${
                          report.atRisk 
                            ? "bg-rose-100 text-rose-700 animate-pulse" 
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {report.atRisk ? "at risk" : "stabel"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 font-medium">Health Score:</span>
                        <span className={`font-extrabold px-1.5 py-0.5 rounded text-[10px] ${healthColor.twBg} ${healthColor.twText} ${healthColor.twBorder} border`}>
                          {report.score}% ({healthColor.label})
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-4 text-[10px] text-slate-500">
                        <span>Active reports: <b>{report.openIssuesCount}</b></span>
                        <span>Resolved: <b>{report.resolvedIssuesCount}</b></span>
                      </div>
                      {report.resolvedIssuesCount > 0 && (
                        <div className="mt-1 text-[9px] font-mono text-slate-400">
                          Avg Dispatch Time: {report.avgResolveTimeHours.toFixed(1)}h
                        </div>
                      )}
                      {report.riskAlertSummary && (
                        <div className={`mt-2 border p-1.5 rounded text-[9px] flex gap-1.5 items-start leading-relaxed ${
                          report.atRisk 
                            ? "bg-rose-50 border-rose-100 text-rose-700 animate-pulse" 
                            : "bg-emerald-50 border-emerald-100 text-emerald-700"
                        }`}>
                          <ShieldAlert className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            report.atRisk ? "text-rose-600" : "text-emerald-600"
                          }`} />
                          <div>
                            <span className={`font-extrabold block leading-none mb-0.5 ${
                              report.atRisk ? "text-rose-800" : "text-emerald-800"
                            }`}>Gemini Risk Assessment</span>
                            <p className="text-slate-600 font-medium leading-normal">{report.riskAlertSummary}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Tooltip>
                </Polygon>
              );
            })}

            {/* Brief Resolution Reward Pulse */}
            {justResolvedId && (() => {
              const issue = issues.find(i => i.id === justResolvedId);
              if (!issue) return null;
              return (
                <Circle
                  center={[issue.latitude, issue.longitude]}
                  radius={180}
                  pathOptions={{
                    fillColor: '#10b981',
                    color: '#059669',
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.4,
                    className: "resolved-pulse-glow"
                  }}
                />
              );
            })()}

            {/* Alarming Areas (Heat-like circles) */}
            {mapMode === "alarming" && alarmingAreas.map((area, idx) => (
              <Circle
                key={`alarm-${idx}`}
                center={[area.lat, area.lng]}
                radius={500}
                pathOptions={{ 
                  fillColor: 'red', 
                  color: 'red', 
                  weight: 1, 
                  opacity: 0.5, 
                  fillOpacity: 0.2 
                }}
              />
            ))}

            {/* Citizen's Current GPS Location Marker */}
            {userLocation && (
              <Marker 
                position={userLocation}
                icon={createCitizenLocationIcon()}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-[200px] text-center">
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide inline-block mb-1">
                      📍 You Are Here
                    </span>
                    <h5 className="font-bold text-xs text-slate-800 mt-1">
                      {userCity || "Current Location"}
                    </h5>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                      GPS: {userLocation[0].toFixed(5)}°N, {userLocation[1].toFixed(5)}°W
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Issue Markers */}
            {showPins && filteredIssues.map((issue) => (
              <Marker 
                key={issue.id} 
                position={[issue.latitude, issue.longitude]}
                icon={createCustomIcon(issue)}
                eventHandlers={{
                  click: () => onSelectIssue(issue),
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-[200px]">
                    <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mb-2 uppercase tracking-wide border ${getCategoryBadge(issue.category)}`}>
                      {issue.category}
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 mb-1 leading-tight">{issue.title}</h4>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mb-2">{issue.description}</p>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{issue.address}</span>
                    </div>
                    <button 
                      onClick={() => onViewDetails ? onViewDetails(issue) : onSelectIssue(issue)}
                      className="w-full mt-3 bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Full Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Floating Focus Button */}
          <button
            onClick={locateCitizen}
            disabled={isLocatingUser}
            className="absolute top-4 right-4 bg-white/95 backdrop-blur hover:bg-blue-50 text-slate-700 hover:text-blue-600 px-3 py-2 rounded-2xl border border-slate-200 shadow-md transition duration-200 flex items-center gap-1.5 text-[11px] font-extrabold z-[1000] cursor-pointer disabled:opacity-50"
            title="Focus on my current city"
          >
            <Compass className={`w-3.5 h-3.5 ${isLocatingUser ? "animate-spin text-blue-500" : "text-slate-600"}`} />
            <span>{isLocatingUser ? "Locating..." : "Focus My City"}</span>
          </button>

          {/* Quick Overlay */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-xl pointer-events-none text-[10px] font-mono text-slate-600 space-y-1 z-[1000] shadow-sm">
            <div className="flex items-center gap-1.5 text-blue-600 font-bold border-b border-slate-100 pb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>OSM TELEMETRY</span>
            </div>
            <div className="flex gap-4">
              <div>ACTIVE: <span className="text-slate-900 font-bold">{filteredIssues.length}</span></div>
              {mapMode === "alarming" && (
                <div>ALARM ZONES: <span className="text-rose-600 font-bold">{alarmingAreas.length}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 p-5 flex flex-col" style={{ height: "500px" }}>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search OS records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            </div>

            {/* Geolocation Banners */}
            {isLocatingUser && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 flex gap-2.5 items-center justify-center animate-pulse">
                <Compass className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="font-bold">Locating city sector...</span>
              </div>
            )}

            {locatingError && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-800 flex gap-2 items-start">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">GPS Access Note</span>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{locatingError}</p>
                </div>
              </div>
            )}

            {userCity && !isLocatingUser && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-[11px] text-emerald-800 flex gap-2.5 items-center shadow-2xs">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-600 block leading-none">Focused City</span>
                  <p className="font-extrabold text-xs text-slate-800 mt-1 truncate">{userCity}</p>
                </div>
                <button
                  type="button"
                  onClick={locateCitizen}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline shrink-0"
                >
                  Re-Center
                </button>
              </div>
            )}

            {mapMode === "alarming" && alarmingAreas.length > 0 && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] text-rose-700 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Alarming Areas Detected</p>
                  <p>High density of reports identified in {alarmingAreas.length} locations. Priority maintenance suggested.</p>
                </div>
              </div>
            )}

            {!selectedIssue && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 flex gap-2 items-start">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Map Navigation</p>
                  <p>Click any marker on the map to view specific incident telemetry and resolution status.</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                LOCATED INCIDENTS ({filteredIssues.length})
              </h4>
              <div className="space-y-1.5 overflow-y-auto max-h-[250px] pr-1">
                {filteredIssues.map((issue) => {
                  const isSelected = issue.id === selectedIssueId;
                  return (
                    <button
                      key={issue.id}
                      onClick={() => onSelectIssue(issue)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-blue-50 border-blue-200 text-slate-900 shadow-xs"
                          : "bg-white border-slate-100 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: getCategoryColor(issue.category) }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs truncate text-slate-800">{issue.title}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 truncate">{issue.address}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedIssue && (
            <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-start gap-2 mb-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${getCategoryBadge(selectedIssue.category)}`}>
                  {selectedIssue.category}
                </span>
                <span className="text-[9px] font-mono text-slate-400">ID: {selectedIssue.id.slice(0, 8)}</span>
              </div>
              <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{selectedIssue.title}</h4>
              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{selectedIssue.description}</p>
              <div className="flex items-center gap-2 mt-3 text-[9px] text-slate-400 font-mono">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate">{selectedIssue.address}</span>
              </div>
              <button 
                onClick={() => onViewDetails ? onViewDetails(selectedIssue) : onSelectIssue(selectedIssue)}
                className="w-full mt-4 bg-slate-900 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                View Full Details in Feed
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

