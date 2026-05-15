import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { chatSocketService } from '@/services/chat-socket.service';
import { useChatSocketStore } from '@/store/chat-socket.store';

export const SocketHandler: React.FC = () => {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  
  const { 
    setConnected, 
    setOnlineUsers, 
    addOnlineUser, 
    removeOnlineUser 
  } = useChatSocketStore();

  useEffect(() => {
    if (!token || !user) {
      chatSocketService.disconnect();
      setConnected(false);
      return;
    }

    chatSocketService.connect(token);

    const onConnect = () => {
      setConnected(true);
      chatSocketService.requestOnlineUsers();
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onOnlineUsers = (users: any[]) => {
      setOnlineUsers(users.map(u => u.id));
    };

    const onUserOnline = (payload: { userId: string; fullName: string }) => {
      addOnlineUser(payload.userId);
    };

    const onUserOffline = (payload: { userId: string }) => {
      removeOnlineUser(payload.userId);
    };

    const onNewMessage = (message: any) => {
      // Global notification if not on chat page
      if (window.location.pathname !== '/chat' && message.sender.id !== user.id) {
        toast.info(`Tin nhắn mới từ ${message.sender.fullName}`, {
          description: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
          action: {
            label: 'Xem ngay',
            onClick: () => window.location.href = `/chat/${message.chatroomId}`
          }
        });
      }
    };

    chatSocketService.onConnect(onConnect);
    chatSocketService.onDisconnect(onDisconnect);
    chatSocketService.onOnlineUsers(onOnlineUsers);
    chatSocketService.onUserOnline(onUserOnline);
    chatSocketService.onUserOffline(onUserOffline);
    chatSocketService.onNewMessage(onNewMessage);

    return () => {
      chatSocketService.offConnect(onConnect);
      chatSocketService.offDisconnect(onDisconnect);
      chatSocketService.offOnlineUsers(onOnlineUsers);
      chatSocketService.offUserOnline(onUserOnline);
      chatSocketService.offUserOffline(onUserOffline);
      chatSocketService.offNewMessage(onNewMessage);
    };
  }, [token, user, setConnected, setOnlineUsers, addOnlineUser, removeOnlineUser]);

  // Inactivity detection
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      chatSocketService.emitStatus('online');
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        chatSocketService.emitStatus('away');
      }, 5 * 60 * 1000); // 5 minutes
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);

    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      clearTimeout(timeoutId);
    };
  }, [token]);

  return null;
};
