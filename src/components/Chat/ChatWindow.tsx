import React, { useState, useRef, useEffect } from 'react';
import { Send, Image, MapPin, Sparkles, Loader2, Hash } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { getIssueByTicketId } from '../../firebase';

import { useChat } from './ChatContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'officer' | 'ai';
  timestamp: string;
  senderName?: string;
  issueContext?: any;
}

interface ChatWindowProps {
  type: 'ai' | 'issue' | 'municipality';
  issueId?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ type }) => {
  const { inputText, setInputText } = useChat();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: type === 'ai' 
        ? "Hello! I'm your Community Hero AI assistant. How can I help you today? I can help you report issues, track status, or answer municipal questions."
        : "Welcome to the issue support chat. An officer will be with you shortly.",
      sender: type === 'ai' ? 'ai' : 'officer',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      senderName: type === 'ai' ? 'AI Assistant' : 'System'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    if (type === 'ai') {
      setIsLoading(true);
      try {
        // Detect Ticket ID in the message (CH-XXXX-XXXX)
        const ticketMatch = inputText.match(/CH-[A-Z0-9]+-[A-Z0-9]+/i);
        let issueData = null;
        if (ticketMatch) {
          issueData = await getIssueByTicketId(ticketMatch[0].toUpperCase());
          if (issueData) {
            setMessages(prev => [...prev, {
              id: (Date.now() + 2).toString(),
              text: `🔍 I found issue ${ticketMatch[0]}: "${issueData.title}". It is currently "${issueData.status}".`,
              sender: 'ai',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              senderName: 'System'
            }]);
          }
        }

        // Limit history to last 5 messages to avoid token limits and keep it focused
        const history = messages.slice(-5).map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text
        }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: inputText,
            history: history,
            issueContext: issueData // Pass issue data to AI for better response
          })
        });
        const data = await response.json();
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply || "I'm sorry, I encountered an error processing your request.",
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          senderName: 'AI Assistant'
        };
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error('Chat error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth"
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} {...msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic ml-10 mb-4">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI is thinking...
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={type === 'ai' ? "Ask anything..." : "Type a message..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[44px] max-h-32"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <Image className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm
              ${inputText.trim() && !isLoading 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setInputText("How do I report a new issue?")}
              className="hover:text-blue-600 transition-colors"
            >
              Report Issue
            </button>
            <button 
              onClick={() => setInputText("I want to track my issue. Here is my ticket ID: ")}
              className="hover:text-blue-600 transition-colors"
            >
              Track Status
            </button>
          </div>
          {type === 'ai' && (
            <div className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-blue-500" />
              <span>Powered by Gemini</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
