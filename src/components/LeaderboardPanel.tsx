import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Trophy, 
  Search, 
  TrendingUp, 
  Calendar, 
  User as UserIcon, 
  Award, 
  AlertTriangle,
  Info,
  Medal,
  ChevronRight,
  Flame,
  ArrowUpRight,
  ShieldAlert,
  ThumbsUp,
  Map,
  ShieldCheck,
  Heart
} from "lucide-react";
import { Issue, User } from "../types";
import { SF_DISTRICTS, calculateDistrictHealth, getHealthColor, isPointInPolygon, getActiveCityCenter, getDistricts } from "../utils/districtUtils";

interface LeaderboardPanelProps {
  issues: Issue[];
  currentUser: User | null;
}

type PeriodType = "weekly" | "monthly" | "yearly" | "overall";

interface LeaderboardUser {
  reporterId: string;
  name: string;
  points: number;
  issueCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  districtBoostCount: number;
}

export default function LeaderboardPanel({ issues, currentUser }: LeaderboardPanelProps) {
  const [period, setPeriod] = useState<PeriodType>("overall");
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<"guardians" | "districts">("guardians");
  const [searchQuery, setSearchQuery] = useState("");

  const activeDistricts = useMemo(() => {
    const center = getActiveCityCenter(issues);
    return getDistricts(center);
  }, [issues]);

  // Point helper based on severity
  const getPointsForSeverity = (severity: "Low" | "Medium" | "High" | "Critical" | string): number => {
    switch (severity) {
      case "Critical": return 5;
      case "High": return 4;
      case "Medium": return 3;
      case "Low": return 2;
      default: return 2; // default fallback
    }
  };

  // Calculate leaderboard data
  const leaderboardData = useMemo(() => {
    const now = Date.now();
    const map: Record<string, LeaderboardUser> = {};

    issues.forEach(issue => {
      // 1. Date filter
      if (!issue.reporterId) return;

      const issueTime = new Date(issue.createdAt).getTime();
      let matchesPeriod = true;

      if (period === "weekly") {
        matchesPeriod = now - issueTime <= 7 * 24 * 60 * 60 * 1000;
      } else if (period === "monthly") {
        matchesPeriod = now - issueTime <= 30 * 24 * 60 * 60 * 1000;
      } else if (period === "yearly") {
        matchesPeriod = now - issueTime <= 365 * 24 * 60 * 60 * 1000;
      }

      if (!matchesPeriod) return;

      // 2. Aggregate points
      let pts = getPointsForSeverity(issue.severity);
      const sev = issue.severity;

      // District Health Boost: If the reported incident is resolved and the district health rating is healthy (score >= 60),
      // the citizen receives an additional +5 Hero Points District Health Boost!
      let isDistrictBoost = false;
      if (issue.status === "Resolved" || issue.status === "Closed") {
        const district = activeDistricts.find(d => isPointInPolygon([issue.latitude, issue.longitude], d.polygon));
        if (district) {
          const report = calculateDistrictHealth(district.id, issues, activeDistricts);
          if (report.score >= 60) {
            pts += 5;
            isDistrictBoost = true;
          }
        }
      }

      if (!map[issue.reporterId]) {
        map[issue.reporterId] = {
          reporterId: issue.reporterId,
          name: issue.reporterName || "Anonymous Guardian",
          points: 0,
          issueCount: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          districtBoostCount: 0,
        };
      }

      const u = map[issue.reporterId];
      u.points += pts;
      u.issueCount += 1;
      if (isDistrictBoost) u.districtBoostCount += 1;
      if (sev === "Critical") u.criticalCount += 1;
      else if (sev === "High") u.highCount += 1;
      else if (sev === "Medium") u.mediumCount += 1;
      else if (sev === "Low") u.lowCount += 1;
    });

    // Convert to sorted array
    return Object.values(map).sort((a, b) => b.points - a.points || b.issueCount - a.issueCount);
  }, [issues, period]);

  // Filter list by search query
  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboardData;
    const lower = searchQuery.toLowerCase();
    return leaderboardData.filter(u => u.name.toLowerCase().includes(lower));
  }, [leaderboardData, searchQuery]);

  // Find current user's entry
  const currentUserEntry = useMemo(() => {
    if (!currentUser) return null;
    const index = leaderboardData.findIndex(u => u.reporterId === currentUser.uid);
    if (index === -1) return null;
    return {
      rank: index + 1,
      data: leaderboardData[index]
    };
  }, [leaderboardData, currentUser]);

  // Extract top 3 for podium
  const topThree = useMemo(() => {
    return filteredLeaderboard.slice(0, 3);
  }, [filteredLeaderboard]);

  // Remainder for list
  const remainderUsers = useMemo(() => {
    return filteredLeaderboard.slice(3);
  }, [filteredLeaderboard]);

  // District Rankings for District Leaderboard Tab
  const districtRankings = useMemo(() => {
    return activeDistricts.map((district) => {
      const report = calculateDistrictHealth(district.id, issues, activeDistricts);
      return {
        ...district,
        report,
        healthColor: getHealthColor(report.score)
      };
    }).sort((a, b) => b.report.score - a.report.score);
  }, [issues, activeDistricts]);

  return (
    <div className="space-y-6" id="leaderboard-root-section">
      {/* Header and explanation */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Trophy className="w-40 h-40 text-blue-600" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Trophy className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Guardian Leaderboard</h1>
            </div>
            <p className="text-slate-500 text-sm max-w-2xl">
              Honoring community heroes who actively report and safeguard our neighborhood. Ranks are assigned based on points earned for raising verified issues.
            </p>
          </div>

          {/* Quick Point Rule Legend */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 space-y-1.5 md:min-w-[280px]">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-500" />
              Point Formula for Reports:
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Critical: <strong className="text-slate-800">5 pts</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span>High: <strong className="text-slate-800">4 pts</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span>Medium: <strong className="text-slate-800">3 pts</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Low: <strong className="text-slate-800">2 pts</strong></span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-200/60 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Resolved cases in healthy zones get <strong className="font-bold">+5 pts</strong> boost!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-6 mb-6">
        <button
          onClick={() => setActiveLeaderboardTab("guardians")}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
            activeLeaderboardTab === "guardians"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserIcon className="w-4 h-4 text-blue-500" />
          <span>Guardian Rankings</span>
        </button>
        <button
          onClick={() => setActiveLeaderboardTab("districts")}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
            activeLeaderboardTab === "districts"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Map className="w-4 h-4 text-emerald-500" />
          <span>District Health standings</span>
        </button>
      </div>

      {activeLeaderboardTab === "guardians" ? (
        <>
          {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Category switcher */}
        <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-2xs shrink-0 self-start">
          {(["weekly", "monthly", "yearly", "overall"] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setSearchQuery("");
              }}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                period === p
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search community guardians..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-slate-400 text-slate-800"
          />
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column: Rankings */}
        <div className="lg:col-span-2 space-y-6">
          {filteredLeaderboard.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">No Active Reports Found</h3>
              <p className="text-slate-500 text-xs max-w-sm">
                {searchQuery 
                  ? "No community hero matches your search. Try another name!" 
                  : `Be the first to submit a report and top the ${period} leaderboard!`}
              </p>
            </div>
          ) : (
            <>
              {/* Podium for top 3 (only shown if we have users and not filtering severely or can fit) */}
              {!searchQuery && topThree.length > 0 && (
                <div className="bg-gradient-to-b from-blue-50/50 to-white border border-slate-200/60 p-6 rounded-2xl shadow-2xs">
                  <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-6 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    Top Guardians Podium
                  </h2>

                  <div className="flex flex-col sm:flex-row items-end justify-center gap-4 pt-4 pb-2">
                    {/* 2nd Place */}
                    {topThree[1] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="w-full sm:w-1/3 order-2 sm:order-1 flex flex-col items-center"
                      >
                        <div className="relative mb-2 flex flex-col items-center">
                          <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center shadow-xs font-black text-slate-700 text-lg">
                            🥈
                          </div>
                          <span className="absolute -top-2 right-0 bg-slate-300 text-slate-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-white">
                            2nd
                          </span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 w-full text-center shadow-3xs flex flex-col items-center">
                          <div className="font-bold text-xs text-slate-800 truncate max-w-full mb-0.5">
                            {topThree[1].name}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full mb-2">
                            {topThree[1].points} pts
                          </div>
                          <div className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-500" />
                            {topThree[1].issueCount} issues raised
                          </div>
                        </div>
                        <div className="h-6 w-16 bg-slate-100 border-x border-t border-slate-200 rounded-t-lg hidden sm:block mt-3"></div>
                      </motion.div>
                    )}

                    {/* 1st Place */}
                    {topThree[0] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full sm:w-1/3 order-1 sm:order-2 flex flex-col items-center"
                      >
                        <div className="relative mb-2 flex flex-col items-center">
                          <div className="w-18 h-18 rounded-full bg-amber-50 border-4 border-amber-400 flex items-center justify-center shadow-sm font-black text-slate-800 text-2xl relative">
                            🥇
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                              className="absolute inset-0 border border-amber-300 rounded-full border-dashed m-0.5 pointer-events-none"
                            />
                          </div>
                          <span className="absolute -top-2 right-0 bg-amber-400 text-amber-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-white shadow-xs">
                            Leader
                          </span>
                        </div>
                        <div className="bg-white border-2 border-amber-200 rounded-xl p-4 w-full text-center shadow-xs flex flex-col items-center relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />
                          <div className="font-extrabold text-sm text-slate-900 truncate max-w-full mb-0.5 flex items-center gap-1 justify-center">
                            {topThree[0].name}
                          </div>
                          <div className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full mb-2">
                            {topThree[0].points} pts
                          </div>
                          <div className="text-[9px] text-slate-500 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            {topThree[0].issueCount} issues raised
                          </div>
                        </div>
                        <div className="h-10 w-20 bg-amber-100/50 border-x border-t border-amber-200 rounded-t-lg hidden sm:block mt-3"></div>
                      </motion.div>
                    )}

                    {/* 3rd Place */}
                    {topThree[2] && (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="w-full sm:w-1/3 order-3 sm:order-3 flex flex-col items-center"
                      >
                        <div className="relative mb-2 flex flex-col items-center">
                          <div className="w-14 h-14 rounded-full bg-amber-50/20 border-2 border-amber-600/40 flex items-center justify-center shadow-xs font-black text-amber-800 text-lg">
                            🥉
                          </div>
                          <span className="absolute -top-2 right-0 bg-amber-700 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-white">
                            3rd
                          </span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3 w-full text-center shadow-3xs flex flex-col items-center">
                          <div className="font-bold text-xs text-slate-800 truncate max-w-full mb-0.5">
                            {topThree[2].name}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-amber-850 bg-amber-50/50 px-2 py-0.5 rounded-full mb-2">
                            {topThree[2].points} pts
                          </div>
                          <div className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-500" />
                            {topThree[2].issueCount} issues raised
                          </div>
                        </div>
                        <div className="h-4 w-16 bg-slate-50 border-x border-t border-slate-200 rounded-t-lg hidden sm:block mt-3"></div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Remainder List View */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                  <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-widest">
                    {searchQuery ? "Search Results" : "Guardian Rankings"}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Showing {filteredLeaderboard.length} contributors
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredLeaderboard.map((user, idx) => {
                    const rank = idx + 1;
                    const isSelf = currentUser && user.reporterId === currentUser.uid;

                    return (
                      <motion.div
                        key={user.reporterId}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className={`px-5 py-3.5 flex items-center justify-between gap-4 transition-colors ${
                          isSelf ? "bg-blue-50/40 font-medium border-l-4 border-blue-500" : "hover:bg-slate-50/30"
                        }`}
                      >
                        {/* Rank and Name */}
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Rank Circle */}
                          <div className="w-6 shrink-0 text-center flex items-center justify-center">
                            {rank === 1 ? (
                              <span className="text-base" title="1st Place">🥇</span>
                            ) : rank === 2 ? (
                              <span className="text-base" title="2nd Place">🥈</span>
                            ) : rank === 3 ? (
                              <span className="text-base" title="3rd Place">🥉</span>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 font-mono">#{rank}</span>
                            )}
                          </div>

                          {/* Avatar Initials */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            isSelf 
                              ? "bg-blue-100 text-blue-700 ring-2 ring-blue-200" 
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                          </div>

                          {/* Name info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {user.name}
                              </span>
                              {isSelf && (
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-mono uppercase tracking-wide shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Calendar className="w-3 h-3 text-slate-300" />
                                {user.issueCount} {user.issueCount === 1 ? "issue" : "issues"}
                              </span>
                              {user.criticalCount > 0 && (
                                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded">
                                  {user.criticalCount} Crit
                                </span>
                              )}
                              {user.highCount > 0 && (
                                <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1 rounded">
                                  {user.highCount} High
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Points Badge */}
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black font-mono text-slate-900">
                            {user.points} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                          </div>
                          <div className="text-[9px] text-slate-400 font-medium">
                            avg: {(user.points / user.issueCount).toFixed(1)} / issue
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Personal Status, Rules breakdown */}
        <div className="space-y-6">
          {/* User Progress Card */}
          {currentUser && (
            <div className="bg-white border-2 border-blue-500/10 p-6 rounded-2xl shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
              
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                Your Leaderboard Status
              </h3>

              {currentUserEntry ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex flex-col items-center justify-center shadow-xs">
                      <span className="text-[9px] font-black uppercase tracking-wider opacity-85 leading-none">Rank</span>
                      <span className="text-lg font-black font-mono leading-none mt-1">#{currentUserEntry.rank}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{currentUserEntry.data.name}</h4>
                      <p className="text-xs text-slate-500">
                        {currentUserEntry.data.points} pts accrued during this period
                      </p>
                    </div>
                  </div>

                  {/* Severity Breakdown stats */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Raised</span>
                      <strong className="text-slate-800 text-sm font-mono font-bold">
                        {currentUserEntry.data.issueCount}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Avg Points</span>
                      <strong className="text-slate-800 text-sm font-mono font-bold">
                        {(currentUserEntry.data.points / currentUserEntry.data.issueCount).toFixed(1)}
                      </strong>
                    </div>
                  </div>

                  {/* Position relative message */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      {currentUserEntry.rank === 1 ? (
                        <span>You are currently leading the pack! Keep up the incredible work guarding your community!</span>
                      ) : (
                        <span>
                          You are currently ranked <strong className="font-bold">#{currentUserEntry.rank}</strong>. 
                          Raise more issues with accurate locations and details to climb the leaderboard!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                    <Flame className="w-5 h-5 text-slate-300" />
                  </div>
                  <div className="text-xs text-slate-500 max-w-xs mx-auto">
                    You haven't raised any issues in the selected period (<strong className="font-bold capitalize">{period}</strong>).
                  </div>
                  <div className="bg-amber-50/60 border border-amber-100/80 rounded-xl p-3 text-left text-xs text-amber-800 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      Submit your first issue report on the Dashboard map to earn points and claim your spot on the leaderboard!
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Rules Card */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-blue-500" />
              How Points are Distributed
            </h3>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                We believe in recognizing citizens based on the significance and severity of the issues they report. Points are earned instantly upon submitting a neighborhood report:
              </p>

              <div className="space-y-3">
                {/* Critical */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-xs font-bold text-slate-800">Critical Issues</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    +5 Points
                  </span>
                </div>

                {/* High */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-bold text-slate-800">High Issues</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    +4 Points
                  </span>
                </div>

                {/* Medium */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="text-xs font-bold text-slate-800">Medium Issues</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                    +3 Points
                  </span>
                </div>

                {/* Low */}
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-xs font-bold text-slate-800">Low Issues</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    +2 Points
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl flex items-start gap-2 text-[10px] text-blue-700 leading-relaxed mt-2">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  Please ensure reports are verified and accurate. Spammed or rejected reports may lead to points deduction or suspension of reputation levels.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Short description banner */}
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block text-emerald-900 text-sm">Active Safety Zones</span>
              <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                Districts are ranked by their aggregate safety score. Submitting reports and verifying fixes directly improves your local district's rating and unlocks community-wide Hero Point multipliers!
              </p>
            </div>
          </div>

          {/* Grid of Districts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {districtRankings.map((item, idx) => {
              const rank = idx + 1;
              const score = item.report.score;
              const color = item.healthColor;
              const openCount = item.report.openIssuesCount;
              const resolvedCount = item.report.resolvedIssuesCount;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all relative overflow-hidden group"
                >
                  {/* Subtle background glow for healthy districts */}
                  {score >= 80 && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
                  )}
                  
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                          rank === 1 ? "bg-amber-100 text-amber-700 border-amber-200 shadow-sm" :
                          rank === 2 ? "bg-slate-100 text-slate-700 border-slate-200" :
                          rank === 3 ? "bg-amber-50 text-amber-800 border-amber-150" :
                          "bg-slate-50 text-slate-400 border-slate-100"
                        }`}>
                          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
                            {item.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">San Francisco Ward Sector</span>
                        </div>
                      </div>

                      {/* Health Pill */}
                      <div className={`px-2.5 py-1 rounded-xl font-extrabold text-xs border flex items-center gap-1 shrink-0 ${color.twBg} ${color.twText} ${color.twBorder}`}>
                        <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse animate-duration-1000" />
                        <span>{score}% Healthy</span>
                      </div>
                    </div>

                    {/* Status Indicator Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4 border border-slate-100">
                      <div 
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${score}%`, 
                          backgroundColor: color.hex 
                        }}
                      />
                    </div>

                    {/* Stats Breakdown */}
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider leading-none mb-1">
                          Active Reports
                        </span>
                        <span className="font-extrabold text-slate-700">{openCount} Unresolved</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider leading-none mb-1">
                          Case Resolution
                        </span>
                        <span className="font-extrabold text-slate-700">{resolvedCount} Restored</span>
                      </div>
                    </div>
                  </div>

                  {/* At-Risk Predictor warning */}
                  {item.report.riskAlertSummary && (
                    <div className={`mt-4 border p-2.5 rounded-xl text-[10px] flex gap-2 items-start ${
                      item.report.atRisk 
                        ? "bg-rose-50 border-rose-100 text-rose-700 animate-pulse" 
                        : "bg-emerald-50 border-emerald-100 text-emerald-700"
                    }`}>
                      <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${
                        item.report.atRisk ? "text-rose-600" : "text-emerald-600"
                      }`} />
                      <div>
                        <span className={`font-extrabold block leading-none mb-0.5 ${
                          item.report.atRisk ? "text-rose-800" : "text-emerald-800"
                        }`}>Gemini Ward Risk Alert</span>
                        <p className="text-slate-600 font-medium leading-normal">{item.report.riskAlertSummary}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
