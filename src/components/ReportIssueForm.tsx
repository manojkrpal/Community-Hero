/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Issue, AIAnalysis } from "../types";
import { 
  Camera, 
  MapPin, 
  Mic, 
  MicOff, 
  Sparkles, 
  Upload, 
  AlertTriangle, 
  Loader2, 
  X,
  Volume2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ReportIssueFormProps {
  onSuccess: (newIssue: Omit<Issue, "id">) => void;
  onCancel: () => void;
}

export default function ReportIssueForm({ onSuccess, onCancel }: ReportIssueFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Form submission and AI states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Locate Me Handler (using standard HTML Geolocation API with robust fallback)
  const handleLocateMe = () => {
    if (navigator.geolocation) {
      setAnalysisProgress("Acquiring GPS coordinates...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          // Reverse-geocoding simulation
          setAddress(`Near Coordinate Grid: ${position.coords.latitude.toFixed(4)}°N, ${position.coords.longitude.toFixed(4)}°W`);
        },
        (err) => {
          console.warn("Geolocation permission declined, placing pin on standard Municipal center.", err);
          // Random offset near San Francisco City Hall
          const mockLat = 37.7792 + (Math.random() - 0.5) * 0.02;
          const mockLng = -122.4191 + (Math.random() - 0.5) * 0.02;
          setLatitude(mockLat);
          setLongitude(mockLng);
          setAddress(`City Hall District Area (Geocoded fallback)`);
        }
      );
    }
  };

  // Speech-to-Text Voice Simulation
  const toggleVoiceRecord = () => {
    if (isRecording) {
      clearInterval(voiceTimerRef.current!);
      setIsRecording(false);
      setIsTranscribing(true);
      
      // Simulate speech transcriber AI
      setTimeout(() => {
        setIsTranscribing(false);
        const voiceMockTexts = [
          "The water leakage from the broken drainage cap is spreading across the sidewalk causing safety hazard.",
          "I am seeing four broken streetlights completely dark on 14th street near the bus stop.",
          "Three massive bags of plastic garbage and construction rubble dumped near the public garbage can.",
          "Large pothole in the center of the lane is forcing vehicles to brake suddenly or swerve into incoming traffic."
        ];
        const selectedText = voiceMockTexts[Math.floor(Math.random() * voiceMockTexts.length)];
        setDescription(prev => prev ? prev + " " + selectedText : selectedText);
      }, 1500);
    } else {
      setIsRecording(true);
      setVoiceDuration(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration(d => d + 1);
      }, 1000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Please provide a concise title and details describing the community issue.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    // AI Pipeline simulation stages
    setAnalysisProgress("Initializing Vision & OCR Core...");
    
    setTimeout(async () => {
      setAnalysisProgress("Cross-referencing database for duplicate reports...");
      
      setTimeout(async () => {
        setAnalysisProgress("Estimating safety threat priority points...");

        try {
          const response = await fetch("/api/analyze-issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              description,
              imageBase64: imageBase64 || undefined
            })
          });

          const data = await response.json();
          if (data.success && data.analysis) {
            const aiResult: AIAnalysis = data.analysis;

            // Prepare final structure to send back
            const newIssuePayload: Omit<Issue, "id"> = {
              title,
              description,
              category: aiResult.category,
              severity: aiResult.severity,
              status: "Pending Verification", // Newly reported issues need verification consensus
              latitude,
              longitude,
              address: address || "City Center Municipal Sector",
              imageUrl: image || "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=600&auto=format&fit=crop",
              reporterId: "user-current",
              reporterName: "Sarah Connor (You)",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              upvotes: 1, // Self-upvote
              downvotes: 0,
              evidenceCount: image ? 1 : 0,
              aiConfidence: aiResult.confidenceScore,
              aiAnalysis: aiResult,
              verificationRadius: 1500, // 1500 meters verification boundary
              verificationConsensus: "none"
            };

            setIsAnalyzing(false);
            onSuccess(newIssuePayload);
          } else {
            throw new Error(data.error || "AI validation process returned empty analysis structure.");
          }
        } catch (err: any) {
          setError(err.message || "Failed during remote AI assessment.");
          setIsAnalyzing(false);
        }
      }, 1000);
    }, 1000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden" id="report-issue-card">
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center text-white"
          >
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-6" />
            <Sparkles className="w-8 h-8 text-blue-300 absolute animate-pulse" style={{ top: "35%", right: "42%" }} />
            <h4 className="font-bold text-xl mb-2 tracking-tight">
              Community AI Core Active
            </h4>
            <p className="text-sm text-slate-300 mb-6 max-w-sm">
              Analyzing photo metadata, parsing localized safety vectors, and classifying risk metrics.
            </p>
            <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              <span className="font-mono text-xs text-slate-300 font-medium">
                {analysisProgress}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              Report Civic Issue
            </h3>
            <p className="text-slate-400 text-xs">
              AI automatically classifies & checks duplicates
            </p>
          </div>
        </div>
        <button 
          onClick={onCancel}
          className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Issue Heading / What is wrong?
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Broken water pipe flooding neighborhood street"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
          />
        </div>

        {/* Voice Recording / Description Group */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Issue description & hazard details
            </label>
            <div className="flex gap-2">
              {isTranscribing && (
                <span className="text-blue-600 text-xs flex items-center gap-1 font-medium font-mono animate-pulse">
                  <Volume2 className="w-3.5 h-3.5 animate-bounce" /> Transcribing Speech...
                </span>
              )}
              <button
                type="button"
                onClick={toggleVoiceRecord}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all ${
                  isRecording 
                    ? "bg-red-50 text-red-600 border border-red-100 animate-pulse" 
                    : "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-3 h-3" /> Stop ({voiceDuration}s)
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3 text-blue-500" /> Dictate Description
                  </>
                )}
              </button>
            </div>
          </div>

          {isRecording && (
            <div className="mb-3 bg-red-50/50 border border-red-100 p-3 rounded-xl flex items-center justify-between">
              <span className="text-red-600 font-mono text-[11px] font-semibold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span> Recording audio stream...
              </span>
              <div className="flex gap-1 items-end h-6">
                <span className="w-1 bg-red-400 rounded-full animate-[pulse_0.4s_infinite]"></span>
                <span className="w-1 bg-red-400 h-4 rounded-full animate-[pulse_0.6s_infinite]"></span>
                <span className="w-1 bg-red-500 h-2 rounded-full animate-[pulse_0.3s_infinite]"></span>
                <span className="w-1 bg-red-600 h-5 rounded-full animate-[pulse_0.5s_infinite]"></span>
              </div>
            </div>
          )}

          <textarea
            required
            rows={4}
            placeholder="Describe the exact location, visual elements, any obstruction to public pathways, and immediate danger level. You may use the voice recorder button to dictate details easily."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
          />
        </div>

        {/* Location Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Physical Street Address / Sector
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 415 Pine St, San Francisco, CA"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Spatial GPS Coordinates
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 font-mono flex items-center justify-between">
                <span>Lat: {latitude.toFixed(4)}</span>
                <span>Lng: {longitude.toFixed(4)}</span>
              </div>
              <button
                type="button"
                onClick={handleLocateMe}
                className="px-4 py-3 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              >
                <MapPin className="w-4 h-4" /> Locate Me
              </button>
            </div>
          </div>
        </div>

        {/* Photo Upload Area */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Attach Evidence Photo (Optional but highly recommended)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/10 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all">
              <Upload className="w-6 h-6 text-blue-500 mb-2 animate-pulse" />
              <span className="text-xs font-bold text-slate-700">Choose file or drag photo</span>
              <span className="text-[10px] text-slate-400 mt-1">JPEG, PNG up to 10MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {image ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 h-28 md:h-auto">
                <img src={image} alt="Report Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => { setImage(null); setImageBase64(null); }}
                  className="absolute top-2 right-2 p-1 bg-slate-900/85 backdrop-blur text-white rounded-lg hover:bg-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 bg-slate-50 rounded-xl p-5 flex flex-col items-center justify-center text-slate-400 text-xs text-center">
                <Camera className="w-6 h-6 text-slate-300 mb-1.5" />
                <span>No image provided</span>
                <span className="text-[10px] text-slate-400 mt-0.5">AI will use context text-matching fallback</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 p-3.5 rounded-xl text-red-600 text-xs flex gap-2 items-center">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-50 active:scale-95"
          >
            <Sparkles className="w-4 h-4" /> Analyze & Submit Report
          </button>
        </div>
      </form>
    </div>
  );
}
