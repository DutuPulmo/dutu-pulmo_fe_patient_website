import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Send, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/use-chat';
import { doctorService } from '@/services/doctor';
import type { ChatRoom } from '@/types/chat';

function getDisplayInitial(fullName?: string): string {
  if (!fullName?.trim()) return '?';
  return fullName.trim().charAt(0).toUpperCase();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOtherParticipant(room: ChatRoom, currentUserId: string) {
  return room.user1.id === currentUserId ? room.user2 : room.user1;
}

export const ChatPage = () => {
  const { chatroomId: urlChatroomId } = useParams<{ chatroomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDoctorId = searchParams.get('doctorId');

  const {
    currentUserId,
    rooms,
    activeRoom,
    selectedRoomId,
    setSelectedRoomId,
    messages,
    onlineUserIds,
    typingUsersForActiveRoom,
    isSocketConnected,
    isLoadingRooms,
    isLoadingMessages,
    isCreatingRoom,
    isSendingMessage,
    sendMessage,
    emitTyping,
    createRoomWithParticipant,
  } = useChat();

  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    if (urlChatroomId) {
      setSelectedRoomId(urlChatroomId);
    }
  }, [urlChatroomId, setSelectedRoomId]);

  useEffect(() => {
    if (urlDoctorId) {
      void handleCreateOrOpenRoom(urlDoctorId);
      // Xóa doctorId khỏi URL sau khi đã xử lý
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('doctorId');
      setSearchParams(nextParams, { replace: true });
    }
  }, [urlDoctorId]);

  const [doctorKeyword, setDoctorKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingEmitAtRef = useRef(0);
  const messageBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedKeyword(doctorKeyword.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [doctorKeyword]);

  const doctorSearchQuery = useQuery({
    queryKey: ['chat', 'doctors-search', debouncedKeyword],
    queryFn: async () => {
      const result = await doctorService.getDoctors(1, {
        search: debouncedKeyword,
        specialty: 'ALL',
        hospitalId: '',
        appointmentType: 'all',
        sort: 'createdAt',
        order: 'DESC',
      });
      return result.data.items;
    },
    enabled: debouncedKeyword.length >= 2,
    staleTime: 10000,
  });

  const availableDoctors = useMemo(() => {
    const items = doctorSearchQuery.data ?? [];
    return items.filter((doctor) => doctor.id && doctor.id !== currentUserId);
  }, [currentUserId, doctorSearchQuery.data]);

  useEffect(() => {
    if (isLoadingMessages) return;

    const timer = setTimeout(() => {
      messageBottomRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [messages.length, selectedRoomId, isLoadingMessages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        emitTyping(false);
        isTypingRef.current = false;
      }
    };
  }, [emitTyping]);

  const activeParticipant = useMemo(() => {
    if (!activeRoom || !currentUserId) return null;
    return getOtherParticipant(activeRoom, currentUserId);
  }, [activeRoom, currentUserId]);

  const handleCreateOrOpenRoom = async (doctorId: string) => {
    try {
      // Vì API Chat cần userId của bác sĩ, chúng ta cần fetch detail để lấy userId
      const detail = await doctorService.getPublicDoctorDetail(doctorId);
      if (!detail.userId) {
        throw new Error('Bác sĩ này chưa kích hoạt tính năng chat.');
      }
      await createRoomWithParticipant(detail.userId);
      setDoctorKeyword('');
      setDebouncedKeyword('');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Không thể tạo cuộc trò chuyện mới.';
      toast.error(errorMessage);
    }
  };

  const handleEmitTyping = (isTyping: boolean, force = false) => {
    if (!selectedRoomId) return;
    if (!force && isTypingRef.current === isTyping) return;

    const now = Date.now();
    if (!force && isTyping && now - lastTypingEmitAtRef.current < 300) return;

    lastTypingEmitAtRef.current = now;
    isTypingRef.current = isTyping;
    emitTyping(isTyping);
  };

  const handleMessageChange = (value: string) => {
    setMessageInput(value);
    handleEmitTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleEmitTyping(false);
    }, 1000);
  };

  const handleSendMessage = () => {
    const trimmed = messageInput.trim();
    if (!selectedRoomId || !trimmed) return;
    if (trimmed.length > 5000) {
      toast.error('Nội dung tin nhắn tối đa 5000 ký tự.');
      return;
    }

    sendMessage(trimmed);
    setMessageInput('');
    handleEmitTyping(false, true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 h-[calc(100vh-64px)] overflow-hidden flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <h1 className="text-2xl font-bold">Tin nhắn trao đổi</h1>
        <p className="text-slate-500 text-sm">Trao đổi trực tiếp với bác sĩ chuyên khoa</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] flex-1 min-h-0">
        <Card className="h-full flex flex-col overflow-hidden">
          <CardHeader className="space-y-4 p-4 border-b">
            <CardTitle className="text-base font-semibold">Cuộc trò chuyện</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={doctorKeyword}
                onChange={(event) => setDoctorKeyword(event.target.value)}
                className="pl-9 h-10 border-slate-200"
                placeholder="Tìm bác sĩ để chat"
              />
            </div>
            {debouncedKeyword.length >= 2 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-2 bg-slate-50/50">
                <p className="mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">Kết quả tìm kiếm</p>
                <div className="space-y-1">
                  {doctorSearchQuery.isLoading &&
                    Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  {!doctorSearchQuery.isLoading && availableDoctors.length === 0 && (
                    <p className="text-xs text-slate-500 py-2 text-center">Không có bác sĩ phù hợp.</p>
                  )}
                  {!doctorSearchQuery.isLoading &&
                    availableDoctors.map((doc) => (
                      <Button
                        key={doc.id}
                        variant="ghost"
                        className="h-auto w-full justify-start px-2 py-2 text-left hover:bg-white border-transparent hover:border-slate-200 border"
                        disabled={isCreatingRoom}
                        onClick={() => void handleCreateOrOpenRoom(doc.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getDisplayInitial(doc.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold truncate">
                              {doc.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate uppercase tracking-tighter">
                              {doc.specialty || 'Bác sĩ'}
                            </span>
                          </div>
                        </div>
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full hide-scrollbar scroll-lock">
              <div className="p-3 space-y-2">
                {isLoadingRooms &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-xl" />
                  ))}

                {!isLoadingRooms && rooms.length === 0 && (
                  <div className="py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                       <MessageSquareText className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">Chưa có cuộc trò chuyện nào.</p>
                  </div>
                )}

                {!isLoadingRooms &&
                  rooms.map((room) => {
                    const participant = getOtherParticipant(room, currentUserId);
                    const isActive = room.id === selectedRoomId;
                    const isOnline = onlineUserIds.has(participant.id);

                    return (
                      <button
                        type="button"
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all',
                          isActive
                            ? 'border-primary/20 bg-primary/5 ring-1 ring-primary/10'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-11 w-11 border border-white shadow-sm">
                            <AvatarFallback className="bg-primary/5 text-primary text-sm font-medium">{getDisplayInitial(participant.fullName)}</AvatarFallback>
                          </Avatar>
                          {isOnline && (
                             <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={cn("truncate text-sm font-bold", isActive ? "text-primary" : "text-slate-900")}>
                              {participant.fullName || 'Bác sĩ'}
                            </p>
                          </div>
                          <p className="truncate text-[11px] text-slate-400 tracking-tight">{participant.email || 'Chuyên khoa'}</p>
                        </div>
                        {!isActive && isOnline && (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[10px] px-1.5 h-4 border-emerald-100/50">
                            Online
                          </Badge>
                        )}
                      </button>
                    );
                  })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col overflow-hidden">
          <CardHeader className="border-b px-6 py-4 bg-slate-50/30">
            <div className="flex items-center justify-between gap-4">
              {activeParticipant ? (
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 border border-white shadow-sm">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{getDisplayInitial(activeParticipant.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base font-bold text-slate-900">
                      {activeParticipant.fullName}
                    </CardTitle>
                    <p className="truncate text-xs text-slate-400 mt-0.5">
                      {onlineUserIds.has(activeParticipant.id) ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Đang hoạt động
                        </span>
                       ) : 'Đang ngoại tuyến'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                   <div className="space-y-1.5">
                      <div className="w-32 h-4 bg-slate-100 rounded animate-pulse" />
                      <div className="w-20 h-3 bg-slate-50 rounded animate-pulse" />
                   </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] font-medium transition-all px-2 py-0.5',
                    isSocketConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100',
                  )}
                >
                  {isSocketConnected ? 'Sẵn sàng' : 'Mất kết nối'}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
             {!selectedRoomId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/20">
                  <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquareText className="h-8 w-8 text-primary/40" />
                  </div>
                  <h3 className="text-slate-900 font-bold mb-1">Bắt đầu trò chuyện</h3>
                  <p className="text-sm max-w-[240px] text-center">Chọn một bác sĩ từ danh sách hoặc tìm kiếm bác sĩ mới để nhắn tin.</p>
                </div>
             ) : (
               <>
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full px-6 py-4">
                    <div className="space-y-4">
                      {isLoadingMessages &&
                        Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className={cn("flex", index % 2 === 0 ? "justify-end" : "justify-start")}>
                             <Skeleton className="h-14 w-[60%] rounded-2xl" />
                          </div>
                        ))}

                      {!isLoadingMessages && messages.map((message, index) => {
                        const isMine = message.sender.id === currentUserId;
                        const showAvatar = !isMine && (!messages[index - 1] || messages[index - 1].sender.id !== message.sender.id);
                        
                        return (
                          <div
                            key={message.id}
                            className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start', !showAvatar && !isMine && "pl-12")}
                          >
                            {!isMine && showAvatar && (
                              <Avatar className="h-10 w-10 border-2 border-white shadow-sm self-end">
                                <AvatarFallback className="text-xs bg-primary/5 text-primary font-bold">{getDisplayInitial(message.sender.fullName)}</AvatarFallback>
                              </Avatar>
                            )}
                            <div
                              className={cn(
                                'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all',
                                isMine 
                                  ? 'bg-primary text-white rounded-br-none' 
                                  : 'bg-white border border-slate-100 text-slate-900 rounded-bl-none',
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                              <div
                                className={cn(
                                  'mt-1.5 flex items-center gap-2 text-[10px] font-medium opacity-60',
                                  isMine ? 'text-white' : 'text-slate-400',
                                )}
                              >
                                <span>{formatDateTime(message.createdAt)}</span>
                                {isMine && message.status === 'sending' && <span className="italic">Đang gửi...</span>}
                                {isMine && message.status === 'failed' && (
                                  <span className="font-bold text-red-200 uppercase">Lỗi gửi</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {typingUsersForActiveRoom.length > 0 && (
                        <div className="flex items-center gap-2 pl-2">
                           <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
                           </div>
                           <p className="text-[11px] font-medium text-slate-400">
                             {typingUsersForActiveRoom[0].fullName} đang nhập...
                           </p>
                        </div>
                      )}

                      <div ref={messageBottomRef} className="h-4" />
                    </div>
                  </ScrollArea>
                </div>

                <div className="p-4 border-t bg-slate-50/30">
                  <div className="flex flex-col gap-2 bg-white rounded-2xl border border-slate-200 p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/5 transition-all">
                    <Textarea
                      value={messageInput}
                      onChange={(event) => handleMessageChange(event.target.value)}
                      onBlur={() => handleEmitTyping(false, true)}
                      onKeyDown={handleMessageKeyDown}
                      className="min-h-[80px] border-none focus-visible:ring-0 resize-none px-2 pt-2 bg-transparent"
                      maxLength={5000}
                      placeholder="Nhập nội dung tin nhắn..."
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{messageInput.length}/5000</p>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl h-9 px-5 bg-primary hover:opacity-90 font-bold"
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || isSendingMessage}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Gửi tin
                      </Button>
                    </div>
                  </div>
                </div>
               </>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatPage;
