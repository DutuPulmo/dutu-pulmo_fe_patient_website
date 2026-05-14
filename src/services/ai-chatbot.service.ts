import axios from "axios";
import { APP_CONFIG } from "@/constants/config";
import type { ConfirmDetail } from "@/components/chat/BookingPanel";

export interface BookingConfirmPayload extends ConfirmDetail {
  sessionId: string;
  messageId: string;
}

export interface BookingConfirmResponse {
  success: boolean;
  data: {
    message: string;
    type: string;
    severity: string;
    timestamp: string;
    suggestedActions: string[];
  };
  meta: {
    sessionId: string;
    queryType: string;
    processedAt: string;
  };
}

export interface AIChatResponse {
  success: boolean;
  data: {
    message: string;
    type: string;
    severity: string;
    timestamp: string;
    disclaimer?: string | null;
    suggestedActions: string[];
  };
  meta: {
    sessionId: string;
    queryType: string;
    processedAt: string;
  };
}

export const aiChatBotService = {
  sendMessage: async (
    message: string,
    sessionId?: string,
  ): Promise<AIChatResponse> => {
    if (!APP_CONFIG.AI_WEBHOOK_URL) {
      throw new Error("AI Webhook URL is not configured");
    }

    const response = await axios.post<AIChatResponse>(
      APP_CONFIG.AI_WEBHOOK_URL,
      {
        message,
        sessionId,
      },
    );

    return response.data;
  },
};

/**
 * Gọi về n8n sau khi user xác nhận đặt lịch thành công.
 * n8n sẽ lưu vào conversation memory và trả về message xác nhận.
 */
export async function notifyBookingConfirmed(
  payload: BookingConfirmPayload,
): Promise<BookingConfirmResponse> {
  const aiWebhookUrl = APP_CONFIG.AI_WEBHOOK_URL || "";
  const N8N_BASE_URL = aiWebhookUrl.substring(0, aiWebhookUrl.lastIndexOf("/"));

  const res = await fetch(`${N8N_BASE_URL}/booking-confirmed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Booking notify failed: ${res.status}`);
  }

  return res.json();
}
