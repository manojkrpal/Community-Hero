import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ChevronLeft, Search } from 'lucide-react';
import { useChat } from './ChatContext';
import { ChatWindow } from './ChatWindow';

export const ChatDrawer: React.FC = () => {
  const { isOpen, setIsOpen, activeTab, setActiveTab } = useChat();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900 z-50 md:hidden"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full md:w-[450px] bg-white shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-3">
                {activeTab !== 'home' && (
                  <button 
                    onClick={() => setActiveTab('home')} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="font-bold text-slate-900 tracking-tight">
                    {activeTab === 'home' ? 'Community Hero' : 'AI Assistant'}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 relative bg-slate-50 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'home' && (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full p-6 flex flex-col"
                  >
                    <div className="mb-8">
                      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">How can I help you?</h3>
                      <p className="text-slate-500">I'm your local government companion. Ask me about city services or report an issue.</p>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => setActiveTab('ai-assistant')} 
                        className="group w-full p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex items-center gap-4 text-left"
                      >
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Ask AI Assistant</p>
                          <p className="text-xs text-slate-500">Instant answers and issue reporting</p>
                        </div>
                      </button>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Track your issue</p>
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Enter Ticket ID (e.g. CH-...)"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setActiveTab('ai-assistant');
                              // We could pass the search query to ChatWindow via context if we wanted to auto-start the search
                            }
                          }}
                          className="w-full bg-white border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Water Leak', 'Pothole', 'Streetlight', 'Garbage'].map(tag => (
                          <button key={tag} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'ai-assistant' && (
                  <motion.div
                    key="ai"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <ChatWindow type="ai" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
