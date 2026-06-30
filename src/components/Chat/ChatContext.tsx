import React, { createContext, useContext, useState } from 'react';

type ChatTab = 'home' | 'ai-assistant';

interface ChatContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeTab: ChatTab;
  setActiveTab: (tab: ChatTab) => void;
  inputText: string;
  setInputText: (text: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('home');
  const [inputText, setInputText] = useState('');

  return (
    <ChatContext.Provider value={{ isOpen, setIsOpen, activeTab, setActiveTab, inputText, setInputText }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
