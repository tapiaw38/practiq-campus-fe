import type { AxiosInstance } from "axios";
import type { ConversationSummary, Message, MessageRecipient } from "@/types";

export interface IMessageService {
  send(recipientId: string, body: string): Promise<{ data: Message }>;
  broadcast(courseId: string, body: string): Promise<{ data: { sent: number } }>;
  listConversations(): Promise<{ data: ConversationSummary[] }>;
  listMessages(conversationId: string): Promise<{ data: Message[] }>;
  reply(conversationId: string, body: string): Promise<{ data: Message }>;
  searchRecipients(courseId: string, query: string): Promise<{ data: MessageRecipient[] }>;
  markRead(conversationId: string): Promise<void>;
}

export class MessageService implements IMessageService {
  constructor(private readonly api: AxiosInstance) {}

  async send(recipientId: string, body: string): Promise<{ data: Message }> {
    const { data } = await this.api.post("/messages", { to_user_id: recipientId, body });
    return data;
  }

  async broadcast(courseId: string, body: string): Promise<{ data: { sent: number } }> {
    const { data } = await this.api.post(`/courses/${courseId}/messages/broadcast`, { body });
    return data;
  }

  async listConversations(): Promise<{ data: ConversationSummary[] }> {
    const { data } = await this.api.get("/conversations");
    return data;
  }

  async listMessages(conversationId: string): Promise<{ data: Message[] }> {
    const { data } = await this.api.get(`/conversations/${conversationId}/messages`);
    return data;
  }

  async reply(conversationId: string, body: string): Promise<{ data: Message }> {
    const { data } = await this.api.post(`/conversations/${conversationId}/messages`, { body });
    return data;
  }

  async searchRecipients(courseId: string, query: string): Promise<{ data: MessageRecipient[] }> {
    const { data } = await this.api.get(`/courses/${courseId}/messageable-users`, {
      params: { q: query },
    });
    return data;
  }

  async markRead(conversationId: string): Promise<void> {
    await this.api.post(`/conversations/${conversationId}/read`);
  }
}
