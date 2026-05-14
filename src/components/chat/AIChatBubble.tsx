import React, { useState } from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { AIChatWindow } from './AIChatWindow';
import { cn } from '@/lib/utils';

export const AIChatBubble: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed sm:bottom-6 sm:right-6 bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:gap-4">
      {/* Chat Window */}
      {isOpen && (
        <div className="animate-in slide-in-from-bottom-5 fade-in duration-300 origin-bottom-right">
          <AIChatWindow onClose={() => setIsOpen(false)} />
        </div>
      )}

      {/* Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95",
          isOpen ? "bg-slate-800 text-white rotate-90" : "bg-blue-600 text-white"
        )}
      >
        {isOpen ? (
          <Bot size={28} />
        ) : (
          <div className="relative">
            <MessageCircle size={28} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
          </div>
        )}
      </button>
    </div>
  );
};
