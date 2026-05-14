import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedActions?: string[];
  bookingData?: any;
  isBookingCompleted?: boolean;
}

interface AIChatState {
  messages: Message[];
  sessionId: string | null;
  isLoading: boolean;
  addMessage: (message: Message) => void;
  setSessionId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  clearHistory: () => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
}

export const useAIChatStore = create<AIChatState>()(
  persist(
    (set) => ({
      messages: [],
      sessionId: null,
      isLoading: false,
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      setSessionId: (id) => set({ sessionId: id }),
      setLoading: (loading) => set({ isLoading: loading }),
      clearHistory: () => set({ messages: [], sessionId: null }),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
    }),
    {
      name: 'ai-chat-history',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
