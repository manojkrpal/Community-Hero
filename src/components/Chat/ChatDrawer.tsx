import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Sparkles, Home, ChevronLeft } from 'lucide-react';
import { useChat } from './ChatContext';

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
            className="fixed inset-y-0 right-0 z-50 w-full md:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {activeTab !== 'home' && (
                  <button onClick={() => setActiveTab('home')} className="p-1 hover:bg-slate-100 rounded-full">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="font-semibold text-lg text-slate-900">Community Hero</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'home' && (
                <div className="p-4 space-y-4">
                  <h3 className="text-xl font-bold">Welcome! 👋</h3>
                  <p className="text-slate-600">Get updates on your reports, chat with municipal officers, or ask our AI assistant for help.</p>
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => setActiveTab('conversations')} className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 flex items-center gap-3">
                      <MessageSquare className="w-6 h-6 text-blue-600" />
                      <span>My Conversations</span>
                    </button>
                    <button onClick={() => setActiveTab('ai-assistant')} className="p-4 bg-blue-50 rounded-xl hover:bg-blue-100 flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-blue-600" />
                      <span>Ask AI Assistant</span>
                    </button>
                  </div>
                </div>
              )}
              {activeTab === 'conversations' && <div className="p-4">Conversation List</div>}
              {activeTab === 'ai-assistant' && <div className="p-4">AI Assistant Chat</div>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
