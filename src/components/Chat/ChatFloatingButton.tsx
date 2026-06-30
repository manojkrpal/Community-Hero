import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useChat } from './ChatContext';

export const ChatFloatingButton: React.FC = () => {
  const { setIsOpen } = useChat();

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-700 transition-all animate-pulse z-50"
    >
      <MessageSquare className="w-6 h-6" />
      <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
    </button>
  );
};
