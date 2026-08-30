export interface ConversationSummary {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_email: string;
  last_message_body: string;
  last_message_at: string | null;
  last_message_sender_id: string;
  unread: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  sent_at: string;
}

export interface MessageRecipient {
  id: string;
  full_name: string;
  email: string;
}
