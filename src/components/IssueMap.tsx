/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Issue } from "../types";
import { MapPin, Compass, Filter, Sparkles, Layers, Info, Search, List, Activity, AlertTriangle } from "lucide-react";

interface IssueMapProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId?: string;
}

// Bounding box coordinates for mapping coordinates to SVG canvas space (San Francisco region)
const LAT_MIN = 37.7400;
const LAT_MAX = 37.8000;
const LNG_MIN = -122.4500;
const LNG_MAX = -122.3900;

export default function IssueMap({ issues, onSelectIssue, selectedIssueId }: IssueMapProps) {
  const [zoom, setZoom] = useState(1);
  const [mapMode, setMapMode] = useState<"vector" | "radar" | "heat">("vector");
  const [radius, setRadius] = useState(3.5); // Search filter radius (in km-like units)
  const [center, setCenter] = useState({ lat: 37.7749, lng: -122.4194 }); // SF Pine St coordinates as default epicenter
  const [hoveredIssue, setHoveredIssue] = useState<Issue | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Translate geographic coordinates to percentage-based SVG coordinate space
  const getXY = (lat: number, lng: number) => {
    // Clamped coordinates to ensure layout consistency
    const clampedLat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
    const clampedLng = Math.max(LNG_MIN, Math.min(LNG_MAX, lng));
    
    const x = ((clampedLng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100;
    const y = (1 - (clampedLat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100;
    
    return { x, y };
  };

  // Convert SVG clicks back into rough geographic coordinates
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!mapContainerRef.current) return;
    
    // Ignore if clicking on a marker (interactive buttons/links inside the map)
    const target = e.target as SVGElement;
    if (target.closest('.map-marker')) {
      return;
    }

    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const pctX = clickX / rect.width;
    const pctY = clickY / rect.height;
    
    // Inverse transformation
    const lng = LNG_MIN + pctX * (LNG_MAX - LNG_MIN);
    const lat = LAT_MAX - pctY * (LAT_MAX - LAT_MIN);
    
    setCenter({ lat, lng });
  };

  // Distance calculator using standard coordinate delta
  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    // Simple Euclidean distance scaled to represent kilometers-like scale
    const dy = (lat1 - lat2) * 111.32; // 1 degree lat = 111.32km
    const dx = (lng1 - lng2) * 40075 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180) / 360;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Select issue if specified by outer component
  const selectedIssue = issues.find((i) => i.id === selectedIssueId);
  useEffect(() => {
    if (selectedIssue) {
      setCenter({ lat: selectedIssue.latitude, lng: selectedIssue.longitude });
    }
  }, [selectedIssueId]);

  // Filter issues based on distance from center and optional query search
  const filteredIssues = issues.filter((issue) => {
    const distance = getDistance(center.lat, center.lng, issue.latitude, issue.longitude);
    const matchesSearch = searchQuery === "" || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.address.toLowerCase().includes(searchQuery.toLowerCase());
    return distance <= radius && matchesSearch;
  });

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "Pothole":
        return { bg: "bg-amber-500", text: "text-amber-500", stroke: "#f59e0b", badge: "bg-amber-50 border-amber-200 text-amber-700" };
      case "Water Leakage":
        return { bg: "bg-blue-500", text: "text-blue-500", stroke: "#3b82f6", badge: "bg-blue-50 border-blue-200 text-blue-700" };
      case "Garbage Accumulation":
      case "Illegal Dumping":
        return { bg: "bg-emerald-500", text: "text-emerald-500", stroke: "#10b981", badge: "bg-emerald-50 border-emerald-200 text-emerald-700" };
      case "Broken Streetlight":
        return { bg: "bg-yellow-500", text: "text-yellow-500", stroke: "#eab308", badge: "bg-yellow-50 border-yellow-200 text-yellow-700" };
      case "Flooding":
        return { bg: "bg-cyan-600", text: "text-cyan-600", stroke: "#0891b2", badge: "bg-cyan-50 border-cyan-200 text-cyan-700" };
      case "Public Safety":
        return { bg: "bg-red-500", text: "text-red-500", stroke: "#ef4444", badge: "bg-red-50 border-red-200 text-red-700" };
      default:
        return { bg: "bg-slate-500", text: "text-slate-500", stroke: "#64748b", badge: "bg-slate-50 border-slate-200 text-slate-700" };
    }
  };

  const centerPos = getXY(center.lat, center.lng);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs animate-fade-in" id="gis-map-module">
      {/* Map Header and Controllers */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-base">
              Interactive GIS Safety Map
            </h3>
            <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
              Vector Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time geospatial visualization of active incidents across municipal subdivisions.
          </p>
        </div>

        {/* View Mode Controllers */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setMapMode("vector")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapMode === "vector"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Vector Grid
          </button>
          <button
            onClick={() => setMapMode("radar")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapMode === "radar"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Radar Scan
          </button>
          <button
            onClick={() => setMapMode("heat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapMode === "heat"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            AI Heatmap
          </button>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        
        {/* SVG Map Canvas Area (9 Cols) */}
        <div className="lg:col-span-8 relative bg-slate-950 border-r border-slate-200 overflow-hidden select-none" style={{ height: "480px" }} ref={mapContainerRef}>
          
          {/* Coordinate Grid / Satellite Lines Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="w-full h-full" style={{ 
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)", 
              backgroundSize: "20px 20px, 40px 40px, 40px 40px" 
            }} />
          </div>

          {/* Compass Rose Ornament */}
          <div className="absolute top-4 right-4 bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl pointer-events-none text-[9px] font-mono text-slate-400 flex items-center gap-1.5 z-10 backdrop-blur-xs">
            <Compass className="w-4 h-4 text-blue-400 animate-spin" style={{ animationDuration: "25s" }} />
            <div>
              <div className="font-bold text-slate-200">GIS SENSOR</div>
              <div>SF_SUBD_WGS84</div>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <svg 
            className="w-full h-full cursor-crosshair"
            onClick={handleMapClick}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Topography vector paths / contour lines in vector mode */}
            {mapMode === "vector" && (
              <g opacity="0.15" stroke="#3b82f6" strokeWidth="0.15" fill="none" strokeDasharray="1,1">
                <path d="M-10,50 Q20,30 50,60 T110,40" />
                <path d="M-10,30 Q30,70 60,30 T110,60" />
                <path d="M-10,70 Q40,40 70,80 T110,50" />
                <path d="M20,-10 Q40,30 10,60 T30,110" />
                <path d="M60,-10 Q80,50 50,80 T70,110" />
              </g>
            )}

            {/* Radar scan circular wave effect */}
            {mapMode === "radar" && (
              <g>
                <circle cx={centerPos.x} cy={centerPos.y} r={radius * 5} fill="none" stroke="#2563eb" strokeWidth="0.25" strokeDasharray="1,2" opacity="0.4" />
                <circle cx={centerPos.x} cy={centerPos.y} r={radius * 10} fill="none" stroke="#2563eb" strokeWidth="0.15" opacity="0.2" />
                {/* Rotating scanner sweep */}
                <line 
                  x1={centerPos.x} 
                  y1={centerPos.y} 
                  x2={centerPos.x + radius * 12 * Math.cos(Date.now() / 1500)} 
                  y2={centerPos.y + radius * 12 * Math.sin(Date.now() / 1500)} 
                  stroke="#3b82f6" 
                  strokeWidth="0.3" 
                  opacity="0.6" 
                />
              </g>
            )}

            {/* AI Heat gradients */}
            {mapMode === "heat" && (
              <g opacity="0.6">
                {issues.map((issue) => {
                  const pos = getXY(issue.latitude, issue.longitude);
                  const isCritical = issue.severity === "Critical";
                  const isHigh = issue.severity === "High";
                  return (
                    <circle
                      key={`heat-${issue.id}`}
                      cx={pos.x}
                      cy={pos.y}
                      r={isCritical ? 14 : isHigh ? 10 : 7}
                      fill="url(#heatGradient)"
                      opacity="0.4"
                    />
                  );
                })}
              </g>
            )}

            {/* Definitions for map gradients */}
            <defs>
              <radialGradient id="heatGradient">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="epicenterGradient">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#2563eb" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Geodesic radius overlay for the focal search center */}
            <circle
              cx={centerPos.x}
              cy={centerPos.y}
              r={radius * 7.5}
              fill="url(#epicenterGradient)"
              stroke="#3b82f6"
              strokeWidth="0.3"
              strokeDasharray="2,2"
              className="transition-all duration-300"
            />

            {/* Center Epicenter Cursor */}
            <g className="transition-all duration-300">
              {/* Outer wave */}
              <circle cx={centerPos.x} cy={centerPos.y} r="2.5" fill="none" stroke="#3b82f6" strokeWidth="0.2" opacity="0.8">
                <animate attributeName="r" values="1.5;5;1.5" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="3s" repeatCount="indefinite" />
              </circle>
              {/* Solid center dot */}
              <circle cx={centerPos.x} cy={centerPos.y} r="0.8" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.2" />
            </g>

            {/* Render Map Issue Markers */}
            {filteredIssues.map((issue) => {
              const pos = getXY(issue.latitude, issue.longitude);
              const theme = getCategoryTheme(issue.category);
              const isSelected = issue.id === selectedIssueId;
              const isHovered = hoveredIssue?.id === issue.id;
              
              // Pulsing radius depending on severity
              const isCritical = issue.severity === "Critical";
              const isHigh = issue.severity === "High";

              return (
                <g 
                  key={issue.id} 
                  className="map-marker cursor-pointer"
                  onClick={() => onSelectIssue(issue)}
                  onMouseEnter={() => setHoveredIssue(issue)}
                  onMouseLeave={() => setHoveredIssue(null)}
                >
                  {/* Outer safety envelope pulse */}
                  {(isCritical || isHigh) && (
                    <circle 
                      cx={pos.x} 
                      cy={pos.y} 
                      r={isCritical ? "3.5" : "2.5"} 
                      fill="none" 
                      stroke={isCritical ? "#ef4444" : "#f59e0b"} 
                      strokeWidth="0.25"
                      opacity="0.5"
                    >
                      <animate attributeName="r" values="1.5;4.5;1.5" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Marker Pin Shadow */}
                  <ellipse cx={pos.x} cy={pos.y + 0.8} rx="0.8" ry="0.4" fill="#000000" opacity="0.4" />

                  {/* Main Marker Pin */}
                  <path 
                    d={`M ${pos.x} ${pos.y} C ${pos.x - 1.2} ${pos.y - 1.5} ${pos.x - 1.2} ${pos.y - 3} ${pos.x} ${pos.y - 3} C ${pos.x + 1.2} ${pos.y - 3} ${pos.x + 1.2} ${pos.y - 1.5} ${pos.x} ${pos.y} Z`} 
                    fill={theme.stroke}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? "0.4" : "0.2"}
                    className="transition-all duration-150"
                    transform={isSelected || isHovered ? `scale(1.25) translate(${-pos.x * 0.2}, ${-pos.y * 0.2})` : ""}
                  />

                  {/* Inner Pin Core Indicator */}
                  <circle 
                    cx={pos.x} 
                    cy={pos.y - 2.0} 
                    r="0.45" 
                    fill="#ffffff" 
                  />
                </g>
              );
            })}
          </svg>

          {/* Quick Stats Panel Overlay at bottom left */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-3 rounded-xl pointer-events-none text-[10px] font-mono text-slate-350 space-y-1.5 shadow-md">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold border-b border-slate-800 pb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>RADAR TELEMETRY</span>
            </div>
            <div className="flex gap-4">
              <div>
                <span className="text-slate-500">RADIUS:</span> <span className="text-slate-200 font-bold">{radius} KM</span>
              </div>
              <div>
                <span className="text-slate-500">ACTIVE:</span> <span className="text-blue-400 font-bold">{filteredIssues.length}</span>
              </div>
            </div>
            <div>
              <span className="text-slate-500">LAT/LNG:</span> <span className="text-slate-300">{center.lat.toFixed(4)}°N, {center.lng.toFixed(4)}°W</span>
            </div>
          </div>
        </div>

        {/* Search List & Details Sidebar Panel (4 Cols) */}
        <div className="lg:col-span-4 p-5 flex flex-col justify-between" style={{ height: "480px" }}>
          
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Search Input Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search issues, street names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            </div>

            {/* Live Filter Information Banner */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-[11px] text-slate-500 leading-normal flex gap-2 items-start">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700">Focal Range Filter Active</p>
                <p>Showing cases within <span className="font-bold text-slate-700">{radius} km</span> of your custom focal point. Click the map to reposition.</p>
              </div>
            </div>

            {/* List of issues currently on radar */}
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                <span>RADAR FEED ({filteredIssues.length})</span>
                <List className="w-3.5 h-3.5" />
              </h4>

              {filteredIssues.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  No cases detected on sensor.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                  {filteredIssues.map((issue) => {
                    const theme = getCategoryTheme(issue.category);
                    const isSelected = issue.id === selectedIssueId;
                    const distance = getDistance(center.lat, center.lng, issue.latitude, issue.longitude);
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
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${theme.bg}`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate text-slate-800">
                            {issue.title}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                            <span className="truncate">{issue.category}</span>
                            <span className="font-mono text-[9px] font-bold text-slate-500">{distance.toFixed(2)} km away</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Selected Issue Bottom Slot */}
          <div className="border-t border-slate-150 pt-4 mt-4 bg-white">
            {selectedIssue ? (
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${getCategoryTheme(selectedIssue.category).badge}`}>
                    {selectedIssue.category}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                    selectedIssue.severity === "Critical" ? "bg-red-50 text-red-700" :
                    selectedIssue.severity === "High" ? "bg-amber-50 text-amber-700" :
                    "bg-blue-50 text-blue-700"
                  }`}>
                    {selectedIssue.severity} Priority
                  </span>
                </div>
                
                <div>
                  <h4 className="font-bold text-xs text-slate-800 line-clamp-1">
                    {selectedIssue.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {selectedIssue.description}
                  </p>
                </div>

                <div className="flex gap-2 items-center text-[9px] text-slate-400 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{selectedIssue.address}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-xs">
                Select an incident pin to view telemetry details.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Geofencing Focal Radius Slider */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between text-slate-600 text-xs font-medium">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-slate-500 flex items-center gap-1.5 text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Focal Scan Radius:
          </span>
          <input
            type="range"
            min="1.0"
            max="10.0"
            step="0.5"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-40 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500/25"
          />
          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px] font-bold border border-slate-300/30">
            {radius.toFixed(1)} km
          </span>
        </div>

        <div className="flex gap-4 items-center justify-between w-full md:w-auto text-[10px] font-mono">
          <span className="text-slate-400">
            GRID: {center.lat.toFixed(4)}°N, {center.lng.toFixed(4)}°W
          </span>
          <span className="text-blue-600 flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            {filteredIssues.length} of {issues.length} cases detected on grid
          </span>
        </div>
      </div>
    </div>
  );
}
