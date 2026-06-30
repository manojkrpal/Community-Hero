import React, { useState } from "react";
import { User, Issue } from "../types";
import { User as UserIcon, MapPin, History, X } from "lucide-react";
import { motion } from "motion/react";

interface ProfilePanelProps {
  currentUser: User | null;
  issues: Issue[];
  onBack: () => void;
}

export default function ProfilePanel({ currentUser, issues, onBack }: ProfilePanelProps) {
  if (!currentUser) return null;

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const raisedIssues = issues.filter(i => i.reporterId === currentUser.uid);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="fixed inset-0 bg-white z-[100] overflow-y-auto"
    >
      <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-[102]">
        <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
          <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-800 transition mr-2">
            ← Back
          </button>
          <UserIcon className="w-5 h-5" /> My Profile
        </h2>
      </div>

      <div className="p-6 space-y-6 max-w-lg mx-auto">
        {/* User Details */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-500 shadow-sm flex items-center justify-center font-bold text-blue-700 text-xl">
            {currentUser.name ? currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U"}
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900">{currentUser.name}</h3>
            <p className="text-xs text-slate-500 font-medium">{currentUser.role}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">Level {currentUser.level}</span>
              <span className="text-xs bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full">{currentUser.xp} XP</span>
            </div>
          </div>
        </div>

        {/* Activity History Section */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4" /> Activity History
          </h4>
          
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Issues Raised ({raisedIssues.length})</h5>
            {raisedIssues.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No issues reported yet.</p>
            ) : (
              <div className="space-y-2">
                {raisedIssues.map(issue => (
                  <button 
                    type="button"
                    key={issue.id} 
                    onClick={() => setSelectedIssue(issue)}
                    className="w-full text-left p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center cursor-pointer hover:bg-blue-50 transition relative z-[101]"
                  >
                    <div>
                      <p className="text-xs font-bold text-blue-600 hover:underline">{issue.title}</p>
                      <p className="text-[10px] text-slate-500">{issue.status} • {new Date(issue.createdAt).toLocaleDateString()}</p>
                    </div>
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Games Played</h5>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
              <span className="text-xs text-slate-600">Total Trivia Games Completed:</span>
              <span className="text-xs font-bold text-blue-600">0</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Issue Detail Overlay */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-slate-900/50 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Issue Details</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-800">{selectedIssue.title}</p>
              <p className="text-xs text-slate-600">{selectedIssue.description}</p>
              <div className="flex gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full capitalize">{selectedIssue.status}</span>
                <span className="text-xs text-slate-500">{new Date(selectedIssue.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
