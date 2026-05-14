import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User, RotateCcw, Sparkles, X, CheckCircle2 } from "lucide-react";
import { useAIChatStore, type Message } from "@/store/ai-chat.store";
import { aiChatBotService } from "@/services/ai-chatbot.service";
import { TypingEffect } from "./TypingEffect";
import { TypingIndicator } from "./TypingIndicator";
import { cn } from "@/lib/utils";
import { BookingPanel, type BookingData, type ConfirmDetail } from "./BookingPanel";

interface AIChatWindowProps {
  onClose?: () => void;
  isFullPage?: boolean;
}

export const AIChatWindow: React.FC<AIChatWindowProps> = ({
  onClose,
  isFullPage = false,
}) => {
  const [inputText, setInputText] = useState("");
  const {
    messages,
    sessionId,
    isLoading,
    addMessage,
    setSessionId,
    setLoading,
    clearHistory,
    updateMessage,
  } = useAIChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isBookingMinimized, setIsBookingMinimized] = useState(false);
  const bookingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, bookingData]);

  useEffect(() => {
    return () => {
      if (bookingTimerRef.current) {
        clearTimeout(bookingTimerRef.current);
      }
    };
  }, []);

  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    if (!text) setInputText("");

    if (bookingData) setIsBookingMinimized(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);

    setLoading(true);
    try {
      const response = await aiChatBotService.sendMessage(
        messageText,
        sessionId ?? undefined,
      );

      if (response.success) {
        if (response.meta.sessionId) {
          setSessionId(response.meta.sessionId);
        }

        const resData = response.data as any;
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.data.message ?? "",
          timestamp: response.data.timestamp ?? new Date().toISOString(),
          suggestedActions: response.data.suggestedActions ?? [],
          bookingData: (resData.action === "OPEN_BOOKING" && resData.bookingData?.doctorId) ? resData.bookingData : undefined,
        };
        addMessage(aiMsg);

        if (
          resData.action === "OPEN_BOOKING" &&
          resData.bookingData?.doctorId
        ) {
          bookingTimerRef.current = setTimeout(() => {
            setBookingData(resData.bookingData as BookingData);
            setIsBookingMinimized(false);
          }, 800);
        }
      }
    } catch (error: unknown) {
      console.error("AI Chat Error:", error);

      let errorText =
        "Xin lỗi, có lỗi xảy ra khi kết nối với máy chủ AI. Vui lòng thử lại sau.";
      if (error instanceof Error && error.message) {
        errorText = `Xin lỗi, có lỗi xảy ra`;
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorText,
        timestamp: new Date().toISOString(),
      };
      addMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingConfirm = (messageId: string, _detail: ConfirmDetail, confirmMessage: string) => {
    // Lưu trạng thái đã đặt vào tin nhắn cũ
    updateMessage(messageId, { isBookingCompleted: true });
    
    // Tắt panel active (nếu có)
    setBookingData(null);
    
    const confirmMsg: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: confirmMessage,
      timestamp: new Date().toISOString(),
      suggestedActions: ["Xem lịch hẹn của tôi", "Chuẩn bị gì trước khi khám?", "Đặt lịch khác"],
    };
    addMessage(confirmMsg);
  };



  return (
    <div
      className={cn(
        "flex flex-col bg-slate-50 overflow-hidden",
        isFullPage
          ? "h-full w-full"
          : "h-[600px] max-h-[85vh] w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border border-slate-200",
      )}
      style={{
        fontFamily:
          "'Inter', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif",
      }}
    >
      {/* Header */}
      <div className="bg-blue-600 p-4 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm">Trợ lý AI DuTu Pulmo</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-[10px] text-blue-100 uppercase font-medium tracking-wider">
                Hỗ trợ 24/7
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Xóa lịch sử"
          >
            <RotateCcw size={18} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-y-auto overflow-x-hidden p-4 space-y-4 scroll-smooth hide-scrollbar transition-all duration-300",
          "flex-1",
        )}
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-6">
            <div className="mb-4 p-5 bg-blue-100 rounded-full text-blue-600">
              <Sparkles size={48} />
            </div>
            <h4 className="text-lg font-bold text-slate-700">Chào mừng bạn!</h4>
            <p className="text-sm text-slate-500 mt-2">
              Tôi là Trợ lý AI chuyên về sức khỏe hô hấp. Tôi có thể giúp gì
              cho bạn hôm nay?
            </p>
          </div>
        )}

        {messages.map((item, index) => {
          const isAi = item.role === "assistant";
          const isLatestAi = isAi && index === messages.length - 1;

          return (
            <div
              key={item.id}
              className={cn(
                "flex w-full",
                isAi ? "justify-start" : "justify-end",
              )}
            >
              <div
                className={cn(
                  "flex gap-2 items-start min-w-0",
                  isAi && item.bookingData ? "max-w-[95%]" : "max-w-[85%]",
                  !isAi && "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    isAi
                      ? "bg-blue-100 text-blue-600"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {isAi ? <Bot size={16} /> : <User size={16} />}
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm",
                      isAi
                        ? "bg-white border border-slate-100 text-slate-800 shadow-sm"
                        : "bg-blue-600 text-white shadow-md",
                    )}
                    style={{ lineHeight: "1.75", wordBreak: "break-word" }}
                  >
                    {(() => {
                      const cleanContent = (text: string) => {
                        return text
                          .replace(/(?:^|\n)(?:date|time|type):\s*[^\n]*/gi, "")
                          .trim();
                      };
                      const displayContent = cleanContent(item.content);

                      if (isLatestAi && !bookingData && !item.bookingData) {
                        return <TypingEffect text={displayContent} />;
                      }
                      
                      return (
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                            li: ({node, ...props}) => <li className="mb-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-current" {...props} />,
                            em: ({node, ...props}) => <em className="italic" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-500 hover:underline" {...props} />,
                          }}
                        >
                          {displayContent}
                        </ReactMarkdown>
                      );
                    })()}
                  </div>

                  {isAi && item.bookingData && (
                    <div className="mt-3 w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
                      {item.isBookingCompleted ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 bg-green-50/50">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <CheckCircle2 size={24} />
                          </div>
                          <p className="font-bold text-slate-800 text-sm">Lịch khám đã được xác nhận!</p>
                          <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-medium">
                            Bạn đã hoàn tất đặt lịch cho tin nhắn này
                          </p>
                        </div>
                      ) : (
                        <BookingPanel
                          messageId={item.id}
                          bookingData={item.bookingData}
                          sessionId={sessionId}
                          isMinimized={isBookingMinimized}
                          onToggleMinimize={() => setIsBookingMinimized(!isBookingMinimized)}
                          onConfirm={(detail, msg) => handleBookingConfirm(item.id, detail, msg)}
                          onClose={() => {}}
                        />
                      )}
                    </div>
                  )}

                  {isAi &&
                    item.suggestedActions &&
                    item.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.suggestedActions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(action)}
                            className="text-xs px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && <TypingIndicator />}
      </div>

      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Nhập câu hỏi của bạn..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl transition-all",
              !inputText.trim() || isLoading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200",
            )}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};