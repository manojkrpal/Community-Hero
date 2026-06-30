import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, User, ShieldCheck } from 'lucide-react';

interface ChatMessageProps {
  text: string;
  sender: 'user' | 'officer' | 'ai';
  timestamp: string;
  senderName?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ text, sender, timestamp, senderName }) => {
  const isAi = sender === 'ai';
  const isUser = sender === 'user';
  const isOfficer = sender === 'officer';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}
    >
      <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm
          ${isAi ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white' : 
            isOfficer ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}
        >
          {isAi ? <Sparkles className="w-4 h-4" /> : isOfficer ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
        
        <div className={`p-3 rounded-2xl text-sm leading-relaxed
          ${isAi ? 'bg-blue-50 text-slate-800 border border-blue-100 rounded-bl-none' : 
            isUser ? 'bg-blue-600 text-white rounded-br-none' : 
            'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'}`}
        >
          {senderName && !isUser && <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">{senderName}</p>}
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
      <span className="text-[10px] text-slate-400 mt-1 px-10">
        {timestamp}
      </span>
    </motion.div>
  );
};
