import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/constants';
import type {
  ChatMessage,
  JoinRoomPayload,
  OnlineUser,
  TypingPayload,
  TypingUser,
} from '@/types/chat';

type UserPresenceEvent = {
  userId: string;
  fullName: string;
  timestamp: string;
};

type TypingEvent = {
  chatroomId: string;
  users: TypingUser[];
};

type ExceptionEvent = {
  message?: string;
};

class ChatSocketService {
  private socket: Socket | null = null;

  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(`${SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
    });

    return this.socket;
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  joinRoom(chatroomId: string): void {
    if (!this.socket) return;
    this.socket.emit('join-room', { chatroomId } satisfies JoinRoomPayload);
  }

  leaveRoom(chatroomId: string): void {
    if (!this.socket) return;
    this.socket.emit('leave-room', { chatroomId } satisfies JoinRoomPayload);
  }

  emitTyping(payload: TypingPayload): void {
    if (!this.socket) return;
    this.socket.emit('typing', payload);
  }

  requestOnlineUsers(): void {
    if (!this.socket) return;
    this.socket.emit('get-online-users');
  }

  onNewMessage(handler: (message: ChatMessage) => void): void {
    this.socket?.on('new-message', handler);
  }

  onTyping(handler: (payload: TypingEvent) => void): void {
    this.socket?.on('user-typing', handler);
  }

  onOnlineUsers(handler: (users: OnlineUser[]) => void): void {
    this.socket?.on('online-users', handler);
  }

  onUserOnline(handler: (payload: UserPresenceEvent) => void): void {
    this.socket?.on('user-online', handler);
  }

  onUserOffline(handler: (payload: UserPresenceEvent) => void): void {
    this.socket?.on('user-offline', handler);
  }

  onJoinedRoom(handler: (payload: JoinRoomPayload & { message: string }) => void): void {
    this.socket?.on('joined-room', handler);
  }

  onException(handler: (payload: ExceptionEvent) => void): void {
    this.socket?.on('exception', handler);
  }

  onConnect(handler: () => void): void {
    this.socket?.on('connect', handler);
  }

  onDisconnect(handler: () => void): void {
    this.socket?.on('disconnect', handler);
  }

  offNewMessage(handler: (message: ChatMessage) => void): void {
    this.socket?.off('new-message', handler);
  }

  offTyping(handler: (payload: TypingEvent) => void): void {
    this.socket?.off('user-typing', handler);
  }

  offOnlineUsers(handler: (users: OnlineUser[]) => void): void {
    this.socket?.off('online-users', handler);
  }

  offUserOnline(handler: (payload: UserPresenceEvent) => void): void {
    this.socket?.off('user-online', handler);
  }

  offUserOffline(handler: (payload: UserPresenceEvent) => void): void {
    this.socket?.off('user-offline', handler);
  }

  offJoinedRoom(handler: (payload: JoinRoomPayload & { message: string }) => void): void {
    this.socket?.off('joined-room', handler);
  }

  offException(handler: (payload: ExceptionEvent) => void): void {
    this.socket?.off('exception', handler);
  }

  offConnect(handler: () => void): void {
    this.socket?.off('connect', handler);
  }

  offDisconnect(handler: () => void): void {
    this.socket?.off('disconnect', handler);
  }

  emitStatus(status: 'online' | 'away' | 'busy' | 'offline'): void {
    if (!this.socket) return;
    this.socket.emit('update-status', { status });
  }
}

export const chatSocketService = new ChatSocketService();
export default chatSocketService;
