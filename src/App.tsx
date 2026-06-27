/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Issue, 
  UserRole, 
  IssueStatus, 
  User, 
  VerificationActivity, 
  TimelineUpdate 
} from "./types";
import { 
  fetchIssues, 
  createIssue, 
  updateIssue, 
  voteIssue, 
  addVerificationEvidence, 
  fetchVerifications, 
  fetchTimeline, 
  logTimelineUpdate, 
  getUserProfile, 
  awardUserXP,
  onAuthChanged,
  logoutUser
} from "./firebase";
import IssueMap from "./components/IssueMap";
import ReportIssueForm from "./components/ReportIssueForm";
import AnalyticsPanel from "./components/AnalyticsPanel";
import AuthPage from "./components/AuthPage";
import { 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  User as UserIcon, 
  Award, 
  TrendingUp, 
  Plus, 
  Check, 
  ShieldAlert,
  ListFilter,
  Users,
  ChevronRight,
  BookOpen,
  MessageSquare,
  HelpCircle,
  FileCheck,
  ChevronDown,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedIssueVerifications, setSelectedIssueVerifications] = useState<VerificationActivity[]>([]);
  const [selectedIssueTimeline, setSelectedIssueTimeline] = useState<TimelineUpdate[]>([]);
  
  // Auth and portal gates
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthGate, setShowAuthGate] = useState(true);

  // UI States
  const [showReportForm, setShowReportForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "map" | "analytics">("feed");
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");

  // Suggestion AI resolution steps loading
  const [loadingResolutionSteps, setLoadingResolutionSteps] = useState(false);
  const [verificationComment, setVerificationComment] = useState("");

  // Resolution inputs
  const [resolutionNotesInput, setResolutionNotesInput] = useState("");

  // Load Issues and Auth Session on Mount
  useEffect(() => {
    async function loadInitialData() {
      const data = await fetchIssues();
      setIssues(data);
    }
    loadInitialData();

    // Listen to Auth State changes smoothly
    onAuthChanged((user) => {
      if (user) {
        setCurrentUser(user);
        setShowAuthGate(false);
      } else {
        setCurrentUser(null);
        setShowAuthGate(true);
      }
      setAuthLoading(false);
    });
  }, []);

  // Fetch comments and timeline updates when selecting an issue
  useEffect(() => {
    if (selectedIssue) {
      async function loadDetails() {
        const verifications = await fetchVerifications(selectedIssue.id);
        const timeline = await fetchTimeline(selectedIssue.id);
        setSelectedIssueVerifications(verifications);
        setSelectedIssueTimeline(timeline);
      }
      loadDetails();
    }
  }, [selectedIssue, issues]);

  // Handle report success
  const handleReportSuccess = async (newIssuePayload: Omit<Issue, "id">) => {
    const savedIssue = await createIssue(newIssuePayload);
    
    // Add custom initial timeline update
    await logTimelineUpdate(
      savedIssue.id,
      "system-ai",
      "AI Architect Core",
      "Administrator",
      "Submitted",
      "AI Processing",
      `AI engine analyzed description: "${savedIssue.aiAnalysis?.riskAssessment}". Set initial priority factor.`
    );

    // Refresh feed
    const updated = await fetchIssues();
    setIssues(updated);
    setShowReportForm(false);
    setSelectedIssue(savedIssue);

    // Award user points
    if (currentUser) {
      const updatedUser = awardUserXP(currentUser.uid, 120, 30, "Eagle Eye");
      setCurrentUser(updatedUser);
    }
  };

  // Upvote / Downvote Issue
  const handleVote = async (type: "upvote" | "downvote") => {
    if (!selectedIssue || !currentUser) return;
    const success = await voteIssue(selectedIssue.id, type, currentUser.uid, currentUser.name);
    if (success) {
      const updatedList = await fetchIssues();
      setIssues(updatedList);
      const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
      if (updatedIssue) {
        setSelectedIssue(updatedIssue);
      }
      
      // Award micro XP for verifying
      const updatedUser = awardUserXP(currentUser.uid, 40, 10, "First Responder");
      setCurrentUser(updatedUser);
    }
  };

  // Add custom verification comment / evidence
  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !currentUser || !verificationComment.trim()) return;

    await addVerificationEvidence(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      verificationComment
    );

    // Record timeline update
    await logTimelineUpdate(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      selectedIssue.status,
      selectedIssue.status,
      `${currentUser.name} uploaded verification comment: "${verificationComment}"`
    );

    setVerificationComment("");
    
    // Refresh issues list
    const updatedList = await fetchIssues();
    setIssues(updatedList);
    const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
    if (updatedIssue) setSelectedIssue(updatedIssue);

    const updatedUser = awardUserXP(currentUser.uid, 80, 20, "Verified Civic Hero");
    setCurrentUser(updatedUser);
  };

  // AI Smart resolution recommendations checklist generator
  const handleGenerateResolutionSteps = async () => {
    if (!selectedIssue) return;
    setLoadingResolutionSteps(true);
    try {
      const response = await fetch("/api/suggest-resolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIssue.title,
          category: selectedIssue.category,
          description: selectedIssue.description,
          severity: selectedIssue.severity
        })
      });

      const data = await response.json();
      if (data.success && data.recommendation) {
        const rec = data.recommendation;
        await updateIssue(selectedIssue.id, {
          resolutionSteps: rec.steps,
          materialsRequired: rec.materialsRequired,
          safetyPrecautions: rec.safetyPrecautions,
          estimatedHours: rec.estimatedHours,
          assignedDepartment: rec.assignedDepartment
        });

        // Record timeline
        await logTimelineUpdate(
          selectedIssue.id,
          "system-ai",
          "AI Architect Core",
          "Administrator",
          selectedIssue.status,
          selectedIssue.status,
          `Generated Smart Repair Checklists & safety recommendations from Gemini model.`
        );

        const updatedList = await fetchIssues();
        setIssues(updatedList);
        const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
        if (updatedIssue) setSelectedIssue(updatedIssue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResolutionSteps(false);
    }
  };

  // Route issue to specific department (Officers or Admins only)
  const handleRouteDepartment = async (department: string) => {
    if (!selectedIssue || !currentUser) return;
    
    const updates: Partial<Issue> = {
      assignedDepartment: department,
      updatedAt: new Date().toISOString()
    };

    let oldStatus = selectedIssue.status;
    let targetStatus = oldStatus;
    // If status was Pending Verification or Submitted, update to Assigned
    if (oldStatus === "Pending Verification" || oldStatus === "Submitted") {
      updates.status = "Assigned";
      targetStatus = "Assigned";
    }

    await updateIssue(selectedIssue.id, updates);

    // Log to audit log timeline
    await logTimelineUpdate(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      oldStatus,
      targetStatus,
      `Routed problem to ${department} department.`
    );

    const updatedList = await fetchIssues();
    setIssues(updatedList);
    const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
    if (updatedIssue) setSelectedIssue(updatedIssue);
  };

  // Change Issue status (Officers or Admins only)
  const handleStatusChange = async (targetStatus: IssueStatus, comment: string) => {
    if (!selectedIssue || !currentUser) return;
    const oldStatus = selectedIssue.status;
    
    const updates: Partial<Issue> = { 
      status: targetStatus,
      updatedAt: new Date().toISOString()
    };
    
    if (targetStatus === "In Progress") {
      updates.assignedTo = currentUser.name;
    }

    if (targetStatus === "Resolved") {
      updates.resolutionNotes = resolutionNotesInput || "Restoration works successfully finished. Issue closed.";
    }

    await updateIssue(selectedIssue.id, updates);

    // Log to audit log timeline
    await logTimelineUpdate(
      selectedIssue.id,
      currentUser.uid,
      currentUser.name,
      currentUser.role,
      oldStatus,
      targetStatus,
      comment
    );

    // Reward points for resolving
    if (targetStatus === "Resolved") {
      const updatedUser = awardUserXP(currentUser.uid, 500, 150, "Resolution Master");
      setCurrentUser(updatedUser);
      setResolutionNotesInput("");
    }

    // Refresh feed
    const updatedList = await fetchIssues();
    setIssues(updatedList);
    const updatedIssue = updatedList.find(i => i.id === selectedIssue.id);
    if (updatedIssue) setSelectedIssue(updatedIssue);
  };

  // Filtering Logic
  const filteredIssues = issues.filter(issue => {
    const isApproved = [
      "Verified",
      "Assigned",
      "Accepted",
      "In Progress",
      "Resolved",
      "Citizen Confirmation",
      "Closed"
    ].includes(issue.status);

    if (currentUser?.role === "Municipality Officer") {
      // Municipal officer only see the approved incidents
      if (!isApproved) {
        return false;
      }
    } else if (currentUser?.role === "Administrator") {
      // Administrator can see all reports for monitoring and operations
    } else {
      // Citizen / Guest / standard user
      const isMyOwnIssue = currentUser && issue.reporterId === currentUser.uid;
      const isPending = [
        "Submitted",
        "AI Processing",
        "Pending Verification"
      ].includes(issue.status);

      if (isPending) {
        // Can only see if they raised it themselves
        if (!isMyOwnIssue) {
          return false;
        }
      } else if (!isApproved) {
        // Hide spam, rejected, or archived issues unless they raised it
        if (!isMyOwnIssue) {
          return false;
        }
      }
    }

    const matchCategory = categoryFilter === "All" || issue.category === categoryFilter;
    const matchStatus = statusFilter === "All" || issue.status === statusFilter;
    const matchSeverity = severityFilter === "All" || issue.severity === severityFilter;
    return matchCategory && matchStatus && matchSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    let classes = "";
    switch (severity) {
      case "Critical":
        classes = "bg-orange-100 text-orange-700";
        break;
      case "High":
        classes = "bg-amber-100 text-amber-700";
        break;
      case "Medium":
        classes = "bg-blue-100 text-blue-700";
        break;
      default:
        classes = "bg-slate-100 text-slate-600";
    }
    return (
      <span className={`${classes} font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider`}>
        {severity}
      </span>
    );
  };

  const getStatusBadge = (status: IssueStatus) => {
    let classes = "";
    switch (status) {
      case "Submitted":
        classes = "bg-slate-100 text-slate-700";
        break;
      case "Pending Verification":
        classes = "bg-yellow-100 text-yellow-800 border border-yellow-200";
        break;
      case "Verified":
        classes = "bg-emerald-100 text-emerald-800";
        break;
      case "In Progress":
        classes = "bg-blue-100 text-blue-800 animate-pulse";
        break;
      case "Resolved":
      case "Closed":
        classes = "bg-green-100 text-green-800";
        break;
      case "Rejected":
      case "Spam":
        classes = "bg-red-100 text-red-800";
        break;
      default:
        classes = "bg-slate-100 text-slate-600";
    }
    return (
      <span className={`${classes} font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-tight`}>
        {status}
      </span>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4" id="app-auth-loader">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-500 font-bold tracking-tight">Initializing secure portal link...</p>
      </div>
    );
  }

  if (showAuthGate && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between" id="app-auth-gate">
        {/* Navigation bar with simplified guest view options */}
        <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CommunityHero</span>
          </div>
          <button
            onClick={() => setShowAuthGate(false)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Browse as Guest
          </button>
        </nav>
        
        <AuthPage 
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            setShowAuthGate(false);
          }}
          onSkip={() => setShowAuthGate(false)}
        />
        
        <footer className="py-6 border-t border-slate-200 bg-white text-center text-[11px] text-slate-400">
          Secure Civic Network Portal. Powered by Google AI Studio.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col" id="applet-main-container">
      {/* Top Navigation Bar */}
      <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">CommunityHero</span>
          </div>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
            <button 
              onClick={() => setActiveTab("feed")} 
              className={`py-5 transition-colors border-b-2 hover:text-slate-950 ${activeTab === "feed" ? "text-blue-600 border-blue-600 font-bold" : "border-transparent"}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("map")} 
              className={`py-5 transition-colors border-b-2 hover:text-slate-950 ${activeTab === "map" ? "text-blue-600 border-blue-600 font-bold" : "border-transparent"}`}
            >
              Issue Map
            </button>
            <button 
              onClick={() => setActiveTab("analytics")} 
              className={`py-5 transition-colors border-b-2 hover:text-slate-950 ${activeTab === "analytics" ? "text-blue-600 border-blue-600 font-bold" : "border-transparent"}`}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Gamified Profile Bar & Role Switcher */}
        <div className="flex items-center gap-4">
          {currentUser ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 text-right">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reputation</div>
                  <div className="text-sm font-bold text-slate-900 italic">
                    Level {currentUser.level} Guardian <span className="text-blue-600">• {currentUser.xp} XP</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-500 shadow-sm overflow-hidden flex items-center justify-center font-bold text-blue-700">
                  {currentUser.name ? currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U"}
                </div>
              </div>
              
              <button
                onClick={async () => {
                  await logoutUser();
                }}
                className="text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-xl px-3 py-1.5 transition-all"
                id="navbar-sign-out-btn"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthGate(true)}
              className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 transition-all shadow-sm"
              id="navbar-sign-in-btn"
            >
              Sign In
            </button>
          )}

          {currentUser && (
            <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[10px] text-blue-500 font-bold font-mono uppercase tracking-wider">Role:</span>
              <span className="text-xs font-black text-blue-700">{currentUser.role}</span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Grid Workspace */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Column: List Feed and Actions (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Sub-header Stats Row / Quick Stats Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Community Issues</div>
                <div className="text-2xl font-extrabold text-slate-900">{issues.length} Cases</div>
              </div>
              <div className="text-xs text-blue-600 font-medium mt-1.5 flex items-center justify-between">
                <span>Active Feed Layer</span>
                <button
                  onClick={() => setShowReportForm(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                >
                  <Plus className="w-3.5 h-3.5" /> File New Report
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">AI Resolution Efficiency</div>
                <div className="text-2xl font-extrabold text-blue-600">98.4%</div>
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1.5">
                {issues.filter(i => i.status === "Verified").length} confirmed by local consensus
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50/50 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Closed Stability</div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {issues.filter(i => i.status === "Resolved" || i.status === "Closed").length} Resolved
                </div>
              </div>
              <div className="text-xs text-blue-500 font-medium mt-1.5">
                Top response rate this week
              </div>
            </div>
          </div>

          {/* Form Trigger Conditional Render */}
          <AnimatePresence>
            {showReportForm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="z-20 relative"
              >
                <ReportIssueForm
                  onSuccess={handleReportSuccess}
                  onCancel={() => setShowReportForm(false)}
                  currentUser={currentUser}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Selection Row */}
          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-xs">
            <button
              onClick={() => setActiveTab("feed")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "feed" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Community Issues Feed
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "map" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Interactive GIS Map
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "analytics" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              AI Predictive Analytics
            </button>
          </div>

          {/* Tab Renderers */}
          {activeTab === "feed" && (
            <div className="space-y-4">
              {/* Filter Strip */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-wrap gap-3 items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <ListFilter className="w-4 h-4 text-slate-400" /> Filter Criteria
                </span>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="Pothole">Potholes</option>
                    <option value="Water Leakage">Water Leakage</option>
                    <option value="Garbage Accumulation">Garbage Accumulation</option>
                    <option value="Illegal Dumping">Illegal Dumping</option>
                    <option value="Broken Streetlight">Streetlamps</option>
                    <option value="Flooding">Flooding</option>
                    <option value="Public Safety">Public Safety</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Verified">Verified Consensus</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 font-semibold focus:outline-none"
                  >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Feed List */}
              {filteredIssues.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredIssues.map((issue) => {
                    const isSelected = selectedIssue?.id === issue.id;
                    const leftBorderColor = 
                      issue.severity === "Critical" ? "border-l-orange-500" :
                      issue.severity === "High" ? "border-l-amber-500" : "border-l-blue-500";
                    
                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className={`bg-white border rounded-xl p-4.5 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 transition-all flex flex-col md:flex-row gap-4 relative border-l-4 ${leftBorderColor} ${
                          isSelected ? "ring-2 ring-blue-500/20 border-blue-400" : "border-slate-200"
                        }`}
                      >
                        {/* Left: Thumbnail image if available */}
                        {issue.imageUrl && (
                          <div className="w-full md:w-28 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                            <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}

                        {/* Right: Content details */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                                {issue.category}
                              </span>
                              <div className="flex gap-1.5">
                                {getSeverityBadge(issue.severity)}
                                {getStatusBadge(issue.status)}
                              </div>
                            </div>

                            <h3 className="font-bold text-slate-900 text-sm md:text-base leading-snug">
                              {issue.title}
                            </h3>

                            <p className="text-slate-500 text-xs mt-1 line-clamp-1">
                              {issue.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-4 items-center justify-between mt-3 border-t border-slate-100 pt-2">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              📍 {issue.address}
                            </span>
                            <div className="flex gap-3 text-[10px] font-mono text-slate-500">
                              <span>👍 {issue.upvotes} upvotes</span>
                              <span>💬 {issue.evidenceCount} verified comments</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 text-sm">
                  No issues reported matching your filter selections.
                </div>
              )}
            </div>
          )}

          {activeTab === "map" && (
            <IssueMap
              issues={filteredIssues}
              onSelectIssue={(issue) => {
                setSelectedIssue(issue);
                setActiveTab("feed");
              }}
              selectedIssueId={selectedIssue?.id}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsPanel issues={issues} />
          )}

        </div>

        {/* Right Column: Dynamic Issue details & Workflows (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <AnimatePresence mode="wait">
            {selectedIssue ? (
              <motion.div
                key={selectedIssue.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm sticky top-24"
                id="issue-details-panel"
              >
                {/* Header detail */}
                <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <span className="bg-slate-100 text-slate-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                      ID: {selectedIssue.id}
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm mt-1">
                      Report File Information
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedIssue(null)}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-md transition text-xs font-bold"
                  >
                    ✕ Close Panel
                  </button>
                </div>

                {/* Banner Image */}
                {selectedIssue.imageUrl && (
                  <div className="h-44 w-full overflow-hidden border-b border-slate-200 relative">
                    <img src={selectedIssue.imageUrl} alt={selectedIssue.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded text-white text-[10px] font-mono">
                      GPS accuracy: ±2.5 meters
                    </div>
                  </div>
                )}

                {/* Info summary */}
                <div className="p-5 space-y-5">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {getSeverityBadge(selectedIssue.severity)}
                      {getStatusBadge(selectedIssue.status)}
                      {selectedIssue.assignedDepartment && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
                          🏢 {selectedIssue.assignedDepartment}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-base md:text-lg tracking-tight">
                      {selectedIssue.title}
                    </h4>
                    <p className="text-slate-500 text-xs leading-relaxed mt-2">
                      {selectedIssue.description}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-3 font-mono font-bold">
                      Reported by {selectedIssue.reporterName} on {new Date(selectedIssue.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* AI Diagnosis Insights Dashboard Card (Clean Minimalism Style) */}
                  {selectedIssue.aiAnalysis && (
                    <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-850 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="bg-blue-600 text-[9px] font-bold px-2 py-0.5 rounded text-white tracking-wider uppercase">GEMINI AI ENGINE</div>
                        <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Analysis Summary</div>
                      </div>
                      
                      <h4 className="text-base font-bold text-white mb-2">AI Confidence Score: {Math.round(selectedIssue.aiAnalysis.confidenceScore * 100)}%</h4>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 border-b border-slate-850 pb-3">
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-[10px] text-slate-400 font-medium">Category</span>
                          <span className="text-[10px] font-mono text-green-400 uppercase font-bold">{selectedIssue.aiAnalysis.category}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-[10px] text-slate-400 font-medium">Threat Rating</span>
                          <span className="text-[10px] font-mono text-orange-400 font-bold">{selectedIssue.aiAnalysis.priorityScore}/100</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Risk Assessment</span>
                        <p className="leading-relaxed text-[11px] text-slate-300">
                          {selectedIssue.aiAnalysis.riskAssessment}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Operational workflow checklists */}
                  {selectedIssue.resolutionSteps && selectedIssue.resolutionSteps.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                      <span className="block font-bold text-slate-700 text-xs uppercase tracking-wider">
                        🔧 AI Resolution Checklist
                      </span>
                      {selectedIssue.assignedDepartment && (
                        <div className="text-[10px] bg-slate-200/60 text-slate-700 px-2 py-1 rounded font-semibold font-mono">
                          Assigned: {selectedIssue.assignedDepartment}
                        </div>
                      )}
                      <ul className="space-y-2 text-xs">
                        {selectedIssue.resolutionSteps.map((step, idx) => (
                          <li key={idx} className="flex gap-2 items-start text-slate-600">
                            <span className="bg-white border border-slate-200 text-[9px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>

                      {selectedIssue.materialsRequired && (
                        <div className="border-t border-slate-200/50 pt-2 text-[11px]">
                          <span className="font-bold text-slate-700 block mb-0.5">Recommended Materials:</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {selectedIssue.materialsRequired.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Citizen consensus and verification center */}
                  <div className="border-t border-slate-200 pt-4 space-y-4">
                    <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                      Verified Consensus Portal
                    </h5>
                    
                    {/* Votes buttons */}
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleVote("upvote")}
                        className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        👍 Upvote Support ({selectedIssue.upvotes || 0})
                      </button>
                      <button
                        onClick={() => handleVote("downvote")}
                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        👎 Oppose ({selectedIssue.downvotes || 0})
                      </button>
                    </div>

                    {/* Verification comment log */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Evidence commentary ({selectedIssueVerifications.length})
                      </span>
                      {selectedIssueVerifications.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                          {selectedIssueVerifications.map((v) => (
                            <div key={v.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                              <div className="flex justify-between text-[9px] text-slate-400 font-bold mb-0.5">
                                <span>{v.userName} ({v.userRole})</span>
                                <span>{new Date(v.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-slate-600 leading-normal">{v.comment}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="block text-center text-slate-400 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                          No commentary yet. Be the first to upload evidence notes.
                        </span>
                      )}

                      {/* Add comment input */}
                      <form onSubmit={handleAddEvidence} className="flex gap-2 mt-2">
                        <input
                          type="text"
                          required
                          placeholder="Add your proximity check details or evidence description..."
                          value={verificationComment}
                          onChange={(e) => setVerificationComment(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                        >
                          Submit
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* OFFICER ACTIONS WORKFLOW (Independent Privileges) */}
                  {(currentUser?.role === "Municipality Officer" || currentUser?.role === "Administrator") && (
                    <div className="border border-slate-200 pt-4 space-y-3 bg-slate-50 p-4.5 rounded-xl">
                      <span className="font-bold text-xs uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-blue-600" /> Authorized Officer Panel
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {selectedIssue.status === "Pending Verification" && (
                          <button
                            onClick={() => handleStatusChange("Verified", "Municipal Officer validated report and authorized dispatch workflow.")}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                          >
                            ✓ Approve & Verify Incident
                          </button>
                        )}

                        {selectedIssue.status === "Verified" && (
                          <button
                            onClick={() => handleStatusChange("In Progress", "Assigned officer. Repair crews dispatched with inventory.")}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                          >
                            ⚙ Dispatch Crews (In Progress)
                          </button>
                        )}

                        {/* Generates Gemini Smart checklist if missing */}
                        {(!selectedIssue.resolutionSteps || selectedIssue.resolutionSteps.length === 0) && (
                          <button
                            onClick={handleGenerateResolutionSteps}
                            disabled={loadingResolutionSteps}
                            className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-blue-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
                          >
                            {loadingResolutionSteps ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching AI Resolution steps...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" /> Suggest AI repair checklist
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Resolution actions with Notes inputs */}
                      {selectedIssue.status === "In Progress" && (
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Final Restorations notes
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Describe exact repair outcomes, materials depleted, and final stability checks..."
                            value={resolutionNotesInput}
                            onChange={(e) => setResolutionNotesInput(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
                          />
                          <button
                            onClick={() => handleStatusChange("Resolved", "Crews completed all repair stages. Restored local stability.")}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                          >
                            ✓ Mark Case as Fully Resolved
                          </button>
                        </div>
                      )}

                      {/* Department Routing Section */}
                      {selectedIssue.status !== "Resolved" && selectedIssue.status !== "Closed" && (
                        <div className="border-t border-slate-200/60 pt-3 mt-2 space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            🏢 Route Problem to Department
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={selectedIssue.assignedDepartment || ""}
                              onChange={async (e) => {
                                await handleRouteDepartment(e.target.value);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                            >
                              <option value="" disabled>Select department to assign...</option>
                              {["Public Works", "Water & Sewage", "Sanitation Dept", "Electrical Grid"].map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Reject or spam options */}
                      {selectedIssue.status !== "Resolved" && selectedIssue.status !== "Closed" && (
                        <div className="flex gap-2 border-t border-slate-200 pt-3 mt-1">
                          <button
                            onClick={() => handleStatusChange("Rejected", "Declined: Insufficient hazard criteria detected on site inspection.")}
                            className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg transition"
                          >
                            Decline report
                          </button>
                          <button
                            onClick={() => handleStatusChange("Spam", "Identified as malicious false report. Reporter flag compiled.")}
                            className="flex-1 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 text-[10px] font-bold rounded-lg transition"
                          >
                            Spam flag
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit Timeline panel */}
                  <div className="border-t border-slate-200 pt-4">
                    <span className="block font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">
                      Auditable Security Timeline Logs
                    </span>
                    {selectedIssueTimeline.length > 0 ? (
                      <div className="relative border-l border-slate-100 pl-4 space-y-3 pb-2 ml-1">
                        {selectedIssueTimeline.map((item, idx) => (
                          <div key={item.id} className="relative text-xs">
                            {/* Bullet dot */}
                            <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100" />
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
                              <span>{item.actorName} ({item.actorRole})</span>
                              <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <span className="inline-block text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 rounded mb-1">
                              {item.fromStatus} → {item.toStatus}
                            </span>
                            <p className="text-slate-500 leading-normal">{item.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-slate-400 text-xs font-mono">
                        Loading timeline logs...
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            ) : (
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center h-80">
                <MapPin className="w-10 h-10 text-slate-300 mb-3 animate-bounce" />
                <h4 className="font-semibold text-slate-600 mb-1">
                  No Incident Selected
                </h4>
                <p className="text-xs text-slate-400 max-w-xs leading-normal">
                  Click on an issue in the community feed or select a pin on the Interactive Map to load official files, Gemini AI assessments, and verification logs.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Humble Footer */}
      <footer className="mt-16 border-t border-slate-100 py-8 bg-white text-center text-xs text-slate-400 font-mono">
        <p className="font-semibold text-slate-500">
          Community Hero • Google AI Studio Starter Tier Optimized Civic Platform
        </p>
        <p className="mt-1 text-slate-400">
          Built with React 19, Vite, Express, Firestore & Gemini 2.5 models.
        </p>
      </footer>
    </div>
  );
}
