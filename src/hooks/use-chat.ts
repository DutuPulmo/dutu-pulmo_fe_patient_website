import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { chatService } from '@/services/chat.service';
import { chatSocketService } from '@/services/chat-socket.service';
import type {
  ChatMessage,
  ChatRoom,
  JoinRoomPayload,
  LocalChatMessage,
  TypingUser,
} from '@/types/chat';

type SendMessageContext = {
  roomId: string;
  tempId: string;
};

const TEMP_MATCH_WINDOW_MS = 15000;

export const CHAT_KEYS = {
  all: ['chat'] as const,
  rooms: () => [...CHAT_KEYS.all, 'rooms'] as const,
  messages: (roomId: string) => [...CHAT_KEYS.all, 'messages', roomId] as const,
};

function normalizeServerMessage(message: ChatMessage): LocalChatMessage {
  return {
    ...message,
    status: 'sent',
  };
}

function toTimestamp(dateValue: string): number {
  const parsed = Date.parse(dateValue);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function appendOrReplaceMessage(
  previous: LocalChatMessage[] | undefined,
  incoming: ChatMessage,
): LocalChatMessage[] {
  const list = previous ? [...previous] : [];
  const serverMessage = normalizeServerMessage(incoming);

  if (list.some((item) => item.id === serverMessage.id)) {
    return list;
  }

  const matchedTempIndex = list.findIndex((item) => {
    if (item.status !== 'sending' || !item.clientSentAt) return false;
    if (item.sender.id !== serverMessage.sender.id) return false;
    if (item.content.trim() !== serverMessage.content.trim()) return false;

    const diff = Math.abs(item.clientSentAt - toTimestamp(serverMessage.createdAt));
    return diff <= TEMP_MATCH_WINDOW_MS;
  });

  if (matchedTempIndex >= 0) {
    list[matchedTempIndex] = serverMessage;
    return list.sort(
      (a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt),
    );
  }

  list.push(serverMessage);
  return list.sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
}

function markMessageFailed(
  previous: LocalChatMessage[] | undefined,
  tempId: string,
): LocalChatMessage[] {
  if (!previous) return [];

  return previous.map((item) => {
    if (item.id !== tempId && item.tempId !== tempId) return item;
    return { ...item, status: 'failed' as const };
  });
}

function bumpRoomOrder(
  previous: ChatRoom[] | undefined,
  roomId: string,
  updatedAt: string,
): ChatRoom[] {
  if (!previous) return [];

  const next = previous.map((room) =>
    room.id === roomId ? { ...room, updatedAt } : room,
  );

  return next.sort(
    (a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt),
  );
}

import { useChatSocketStore } from '@/store/chat-socket.store';

export function useChat() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentUserId = authUser?.id ?? '';

  const { isConnected: isSocketConnected, onlineUserIds } = useChatSocketStore();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [typingUsersByRoom, setTypingUsersByRoom] = useState<
    Record<string, TypingUser[]>
  >({});

  const joinedRoomRef = useRef<string | null>(null);

  const roomsQuery = useQuery<ChatRoom[]>({
    queryKey: CHAT_KEYS.rooms(),
    queryFn: () => chatService.getMyChatRooms(),
    staleTime: 10000,
  });

  useEffect(() => {
    if (!selectedRoomId && roomsQuery.data && roomsQuery.data.length > 0) {
      setSelectedRoomId(roomsQuery.data[0].id);
    }
  }, [roomsQuery.data, selectedRoomId]);

  const messagesQuery = useQuery<LocalChatMessage[]>({
    queryKey: CHAT_KEYS.messages(selectedRoomId ?? ''),
    queryFn: async () => {
      const result = await chatService.getMessagesByRoom(selectedRoomId!);
      return result.map(normalizeServerMessage);
    },
    enabled: !!selectedRoomId,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!isSocketConnected) return;

    const onTyping = (payload: { chatroomId: string; users: TypingUser[] }) => {
      setTypingUsersByRoom((previous) => ({
        ...previous,
        [payload.chatroomId]: payload.users,
      }));
    };

    const onNewMessage = (message: ChatMessage) => {
      queryClient.setQueryData<LocalChatMessage[]>(
        CHAT_KEYS.messages(message.chatroomId),
        (previous) => appendOrReplaceMessage(previous, message),
      );

      queryClient.setQueryData<ChatRoom[]>(CHAT_KEYS.rooms(), (previous) =>
        bumpRoomOrder(previous, message.chatroomId, message.createdAt),
      );
    };

    const onJoinedRoom = (_payload: JoinRoomPayload & { message: string }) => {
      // no-op
    };

    chatSocketService.onTyping(onTyping);
    chatSocketService.onNewMessage(onNewMessage);
    chatSocketService.onJoinedRoom(onJoinedRoom);

    return () => {
      chatSocketService.offTyping(onTyping);
      chatSocketService.offNewMessage(onNewMessage);
      chatSocketService.offJoinedRoom(onJoinedRoom);
    };
  }, [isSocketConnected, queryClient]);

  useEffect(() => {
    if (!selectedRoomId || !isSocketConnected) return;

    if (joinedRoomRef.current && joinedRoomRef.current !== selectedRoomId) {
      chatSocketService.leaveRoom(joinedRoomRef.current);
    }

    chatSocketService.joinRoom(selectedRoomId);
    joinedRoomRef.current = selectedRoomId;
  }, [isSocketConnected, selectedRoomId]);

  const createRoomMutation = useMutation({
    mutationFn: async (participantUserId: string) => {
      if (!currentUserId) {
        throw new Error('Vui lòng đăng nhập để bắt đầu trò chuyện.');
      }
      return chatService.createOrGetChatRoom(currentUserId, participantUserId);
    },
    onSuccess: (room) => {
      queryClient.setQueryData<ChatRoom[]>(CHAT_KEYS.rooms(), (previous) => {
        const list = previous ? [...previous] : [];
        const existingIndex = list.findIndex((item) => item.id === room.id);
        if (existingIndex >= 0) {
          list[existingIndex] = room;
        } else {
          list.push(room);
        }

        return list.sort(
          (a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt),
        );
      });

      setSelectedRoomId(room.id);
    },
  });

  const sendMessageMutation = useMutation<
    ChatMessage,
    Error,
    { chatroomId: string; content: string },
    SendMessageContext
  >({
    mutationFn: ({ chatroomId, content }) => chatService.sendMessage(chatroomId, content),
    onMutate: async ({ chatroomId, content }) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date().toISOString();

      const tempMessage: LocalChatMessage = {
        id: tempId,
        tempId,
        chatroomId,
        sender: {
          id: currentUserId,
          fullName: authUser?.fullName ?? 'Bạn',
          email: '',
        },
        content,
        createdAt: now,
        clientSentAt: Date.now(),
        status: 'sending',
      };

      queryClient.setQueryData<LocalChatMessage[]>(
        CHAT_KEYS.messages(chatroomId),
        (previous) => {
          const list = previous ? [...previous] : [];
          list.push(tempMessage);
          return list.sort(
            (a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt),
          );
        },
      );

      queryClient.setQueryData<ChatRoom[]>(CHAT_KEYS.rooms(), (previous) =>
        bumpRoomOrder(previous, chatroomId, now),
      );

      return { roomId: chatroomId, tempId };
    },
    onSuccess: (message, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<LocalChatMessage[]>(
        CHAT_KEYS.messages(context.roomId),
        (previous) => appendOrReplaceMessage(previous, message),
      );

      queryClient.setQueryData<ChatRoom[]>(CHAT_KEYS.rooms(), (previous) =>
        bumpRoomOrder(previous, context.roomId, message.createdAt),
      );
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<LocalChatMessage[]>(
        CHAT_KEYS.messages(context.roomId),
        (previous) => markMessageFailed(previous, context.tempId),
      );
      toast.error('Gửi tin nhắn thất bại. Vui lòng thử lại.');
    },
  });

  const typingUsersForActiveRoom = useMemo(() => {
    if (!selectedRoomId) return [];
    return (typingUsersByRoom[selectedRoomId] ?? []).filter(
      (item) => item.userId !== currentUserId,
    );
  }, [currentUserId, selectedRoomId, typingUsersByRoom]);

  const rooms = roomsQuery.data ?? [];
  const activeRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const localMessages = messagesQuery.data ?? [];

  const sendMessage = (content: string) => {
    if (!selectedRoomId) return;
    sendMessageMutation.mutate({ chatroomId: selectedRoomId, content });
  };

  const emitTyping = useCallback((isTyping: boolean) => {
    if (!selectedRoomId) return;
    chatSocketService.emitTyping({ chatroomId: selectedRoomId, isTyping });
  }, [selectedRoomId]);

  return {
    currentUserId,
    rooms,
    activeRoom,
    selectedRoomId,
    setSelectedRoomId,
    messages: localMessages,
    onlineUserIds,
    typingUsersForActiveRoom,
    isSocketConnected,
    isLoadingRooms: roomsQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
    isCreatingRoom: createRoomMutation.isPending,
    isSendingMessage: sendMessageMutation.isPending,
    createRoomWithParticipant: (participantUserId: string) =>
      createRoomMutation.mutateAsync(participantUserId),
    sendMessage,
    emitTyping,
    refetchRooms: roomsQuery.refetch,
  };
}
