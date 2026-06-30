/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Issue, PredictionForecast } from "../types";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  Loader2, 
  Map, 
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Heart
} from "lucide-react";
import { motion } from "motion/react";
import { calculateCitywideHealth, getHealthColor, getActiveCityCenter } from "../utils/districtUtils";

interface AnalyticsPanelProps {
  issues: Issue[];
}

export default function AnalyticsPanel({ issues }: AnalyticsPanelProps) {
  const [forecasts, setForecasts] = useState<PredictionForecast[]>([]);
  const [loadingForecasts, setLoadingForecasts] = useState(true);
  const [activeTab, setActiveTab] = useState<"charts" | "predictions">("charts");

  // Fetch predictive forecasts from backend
  useEffect(() => {
    async function loadForecasts() {
      try {
        setLoadingForecasts(true);
        const center = getActiveCityCenter(issues);
        // Filter issues to only focus on the current city of the citizen (within ~20km / 0.18 degrees)
        const cityIssues = issues.filter(i => {
          const latDiff = i.latitude - center[0];
          const lngDiff = i.longitude - center[1];
          return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) <= 0.18;
        });

        const response = await fetch("/api/generate-predictive-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            currentIssues: cityIssues,
            cityCenter: center
          })
        });
        const data = await response.json();
        if (data.success && data.forecasts) {
          setForecasts(data.forecasts);
        }
      } catch (err) {
        console.error("Failed to load predictive GIS forecasts", err);
      } finally {
        setLoadingForecasts(false);
      }
    }
    loadForecasts();
  }, [issues]);

  // Aggregate Data for Custom SVG Charts
  const totalReported = issues.length;
  const resolvedCount = issues.filter(i => i.status === "Resolved" || i.status === "Closed").length;
  const activeCount = totalReported - resolvedCount;

  // Category counts
  const categoryCounts: Record<string, number> = {};
  issues.forEach(i => {
    categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
  });

  const categoriesData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Resolution performance by department (simulated indices)
  const departments = [
    { name: "Public Works", performance: 88, active: 4, speed: "1.2 Days" },
    { name: "Water & Sewage", performance: 94, active: 2, speed: "0.8 Days" },
    { name: "Sanitation Dept", performance: 82, active: 7, speed: "1.5 Days" },
    { name: "Electrical Grid", performance: 91, active: 3, speed: "0.9 Days" }
  ];

  const maxCategoryValue = Math.max(...categoriesData.map(c => c.value), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm" id="analytics-module-container">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-5 mb-6 gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">
            Analytics & Predictive Planning
          </h3>
          <p className="text-slate-400 text-xs">
            Dynamic public transparency data & AI risk forecasting
          </p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("charts")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "charts"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" /> Municipal Dashboard
          </button>
          <button
            onClick={() => setActiveTab("predictions")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "predictions"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> AI Predictive Alerts
          </button>
        </div>
      </div>

      {activeTab === "charts" ? (
        <div className="space-y-6">
          {/* Key Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg flex items-center justify-center font-bold">
                {totalReported}
              </div>
              <div>
                <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  Total Incidents
                </span>
                <span className="text-slate-800 font-bold text-sm">
                  Active Community Feed
                </span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <span className="block text-emerald-600/80 text-[10px] uppercase font-bold tracking-wider">
                  Resolved Incidents
                </span>
                <span className="text-emerald-800 font-bold text-sm">
                  {resolvedCount} Cases Restored
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 animate-pulse" />
              </div>
              <div>
                <span className="block text-blue-600/80 text-[10px] uppercase font-bold tracking-wider">
                  Resolution Rate
                </span>
                <span className="text-blue-800 font-bold text-sm">
                  {totalReported > 0 ? Math.round((resolvedCount / totalReported) * 100) : 0}% Efficiency Index
                </span>
              </div>
            </div>

            {/* City Health Index Indicator Card */}
            {(() => {
              const cityScore = calculateCitywideHealth(issues);
              const healthColor = getHealthColor(cityScore);
              return (
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${healthColor.twBg} ${healthColor.twBorder}`}>
                  <div className={`w-12 h-10 rounded-lg flex items-center justify-center font-extrabold border ${healthColor.twBg} ${healthColor.twText} ${healthColor.twBorder} text-sm shrink-0`}>
                    {cityScore}%
                  </div>
                  <div>
                    <span className={`block text-[10px] uppercase font-bold tracking-wider ${healthColor.twText}`}>
                      City Health Index
                    </span>
                    <span className="text-slate-800 font-extrabold text-[13px] flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0 fill-rose-500" />
                      Status: {healthColor.label}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Custom SVG Bar Chart for Category Distributions */}
            <div className="bg-slate-50/40 border border-slate-200 p-5 rounded-xl">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Map className="w-4 h-4 text-slate-500" /> Topic Distribution
              </h4>
              {categoriesData.length > 0 ? (
                <div className="space-y-4">
                  {categoriesData.map((cat, i) => {
                    const pct = (cat.value / maxCategoryValue) * 100;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-600">
                          <span>{cat.name}</span>
                          <span className="font-mono text-slate-400">{cat.value} reports</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className="bg-blue-600 h-full rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No registered reports to display category distribution.
                </div>
              )}
            </div>

            {/* Department Resolution Performance */}
            <div className="bg-slate-50/40 border border-slate-200 p-5 rounded-xl">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" /> Operational Metrics (Department Performance)
              </h4>
              <div className="space-y-3">
                {departments.map((dept) => (
                  <div key={dept.name} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center shadow-xs">
                    <div>
                      <span className="block font-semibold text-xs text-slate-800">{dept.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dept.active} active tickets • avg speed {dept.speed}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-emerald-50 text-emerald-600 border border-emerald-200 font-mono text-xs font-bold px-2.5 py-1 rounded-md">
                        {dept.performance}% Rating
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Predictive AI Alert summary */}
          <div className="bg-slate-900 text-white border border-slate-800 p-5 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="bg-blue-600 text-white p-3 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm tracking-tight mb-0.5">
                Predictive Risk Warnings & Preemptive Planning Active
              </h4>
              <p className="text-xs text-slate-300">
                AI cross-references localized incident clusters, reported water leaks, open drain metrics, and seasonality coordinates to model probability forecasts. All forecasts are statistically probabilistic.
              </p>
            </div>
          </div>

          {loadingForecasts ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="font-mono text-xs text-blue-600 font-medium">Computing probabilistic ward models...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {forecasts.map((item, i) => (
                <div 
                  key={i} 
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Top Header Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-blue-50 text-blue-600 border border-blue-100 font-mono text-[10px] font-bold px-2.5 py-1 rounded-md">
                        {item.wardName}
                      </span>
                      <span className="bg-red-50 text-red-600 border border-red-200 font-mono text-xs font-bold px-2 py-0.5 rounded-md">
                        {item.probability}% Risk
                      </span>
                    </div>

                    <h5 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      {item.hazardType}
                    </h5>

                    <p className="text-slate-500 text-xs leading-relaxed mb-4">
                      {item.factors}
                    </p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200/60 p-3 rounded-lg text-[11px] text-emerald-800 leading-normal flex gap-1.5 items-start">
                    <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-emerald-700 mb-0.5">Recommended Preemption:</span>
                      {item.preventativeAction}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
