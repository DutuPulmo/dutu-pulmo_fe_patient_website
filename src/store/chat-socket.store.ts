import { create } from 'zustand';

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

interface ChatSocketState {
  isConnected: boolean;
  onlineUserIds: Set<string>;
  userStatus: UserStatus;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setUserStatus: (status: UserStatus) => void;
}

export const useChatSocketStore = create<ChatSocketState>((set) => ({
  isConnected: false,
  onlineUserIds: new Set<string>(),
  userStatus: 'online',

  setConnected: (connected) => set({ isConnected: connected }),
  
  setOnlineUsers: (userIds) => set({ onlineUserIds: new Set(userIds) }),
  
  addOnlineUser: (userId) => set((state) => {
    const next = new Set(state.onlineUserIds);
    next.add(userId);
    return { onlineUserIds: next };
  }),
  
  removeOnlineUser: (userId) => set((state) => {
    const next = new Set(state.onlineUserIds);
    next.delete(userId);
    return { onlineUserIds: next };
  }),
  
  setUserStatus: (status) => set({ userStatus: status }),
}));
