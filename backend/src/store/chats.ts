import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    graphs?: any[];
    latency?: number;
    tokens?: number;
    model?: string;
    marketAnalysis?: any;
  };
}

export interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
  isActive: boolean;
  tags?: string[];
  summary?: string;
}

export interface ChatContext {
  userId: string;
  currentChatId?: string;
  recentChats: string[];
  conversationHistory: ChatMessage[];
  maxContextMessages: number;
}

// In-memory storage (you can replace this with a database later)
export const CHAT_CONVERSATIONS = new Map<string, ChatConversation>();
export const CHAT_MESSAGES = new Map<string, ChatMessage[]>();
export const USER_CONTEXTS = new Map<string, ChatContext>();

// Chat Management Functions
export function createNewChat(userId: string, title?: string): ChatConversation {
  const chatId = uuidv4();
  const now = Date.now();
  
  const conversation: ChatConversation = {
    id: chatId,
    userId,
    title: title || `Chat ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    isActive: true,
  };

  CHAT_CONVERSATIONS.set(chatId, conversation);
  CHAT_MESSAGES.set(chatId, []);

  // Update user context
  updateUserContext(userId, chatId);

  return conversation;
}

export function getUserChats(userId: string): ChatConversation[] {
  const userChats: ChatConversation[] = [];
  
  for (const [_, conversation] of CHAT_CONVERSATIONS) {
    if (conversation.userId === userId) {
      userChats.push(conversation);
    }
  }

  // Sort by updatedAt descending (most recent first)
  return userChats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChatById(chatId: string): ChatConversation | undefined {
  return CHAT_CONVERSATIONS.get(chatId);
}

export function getChatMessages(chatId: string): ChatMessage[] {
  return CHAT_MESSAGES.get(chatId) || [];
}

export function addMessageToChat(
  chatId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: ChatMessage['metadata']
): ChatMessage {
  const messageId = uuidv4();
  const now = Date.now();

  const message: ChatMessage = {
    id: messageId,
    chatId,
    userId,
    role,
    content,
    timestamp: now,
    metadata,
  };

  // Add message to chat
  const messages = CHAT_MESSAGES.get(chatId) || [];
  messages.push(message);
  CHAT_MESSAGES.set(chatId, messages);

  // Update conversation metadata
  const conversation = CHAT_CONVERSATIONS.get(chatId);
  if (conversation) {
    conversation.updatedAt = now;
    conversation.messageCount = messages.length;
    conversation.lastMessage = content.substring(0, 100) + (content.length > 100 ? '...' : '');
    
    // Auto-generate title from first user message if not set
    if (conversation.messageCount === 1 && role === 'user' && conversation.title.startsWith('Chat ')) {
      conversation.title = generateChatTitle(content);
    }
    
    CHAT_CONVERSATIONS.set(chatId, conversation);
  }

  // Update user context
  updateUserContextWithMessage(userId, message);

  return message;
}

export function updateUserContext(userId: string, currentChatId?: string): void {
  let context = USER_CONTEXTS.get(userId);
  
  if (!context) {
    context = {
      userId,
      recentChats: [],
      conversationHistory: [],
      maxContextMessages: 20, // Keep last 20 messages for context
    };
  }

  if (currentChatId) {
    context.currentChatId = currentChatId;
    
    // Add to recent chats if not already there
    if (!context.recentChats.includes(currentChatId)) {
      context.recentChats.unshift(currentChatId);
      // Keep only last 10 recent chats
      context.recentChats = context.recentChats.slice(0, 10);
    }
  }

  USER_CONTEXTS.set(userId, context);
}

export function updateUserContextWithMessage(userId: string, message: ChatMessage): void {
  let context = USER_CONTEXTS.get(userId);
  
  if (!context) {
    context = {
      userId,
      recentChats: [],
      conversationHistory: [],
      maxContextMessages: 20,
    };
  }

  // Add message to conversation history
  context.conversationHistory.push(message);
  
  // Keep only the most recent messages for context
  if (context.conversationHistory.length > context.maxContextMessages) {
    context.conversationHistory = context.conversationHistory.slice(-context.maxContextMessages);
  }

  USER_CONTEXTS.set(userId, context);
}

export function getUserContext(userId: string): ChatContext | undefined {
  return USER_CONTEXTS.get(userId);
}

export function getContextualHistory(userId: string, chatId?: string): ChatMessage[] {
  const context = getUserContext(userId);
  if (!context) return [];

  if (chatId) {
    // Return messages from specific chat
    return getChatMessages(chatId);
  }

  // Return recent conversation history across all chats
  return context.conversationHistory;
}

export function deleteChat(chatId: string): boolean {
  const conversation = CHAT_CONVERSATIONS.get(chatId);
  if (!conversation) return false;

  // Remove from storage
  CHAT_CONVERSATIONS.delete(chatId);
  CHAT_MESSAGES.delete(chatId);

  // Update user context
  const context = USER_CONTEXTS.get(conversation.userId);
  if (context) {
    context.recentChats = context.recentChats.filter(id => id !== chatId);
    if (context.currentChatId === chatId) {
      context.currentChatId = context.recentChats[0];
    }
    // Remove messages from conversation history
    context.conversationHistory = context.conversationHistory.filter(msg => msg.chatId !== chatId);
    USER_CONTEXTS.set(conversation.userId, context);
  }

  return true;
}

export function updateChatTitle(chatId: string, title: string): boolean {
  const conversation = CHAT_CONVERSATIONS.get(chatId);
  if (!conversation) return false;

  conversation.title = title;
  conversation.updatedAt = Date.now();
  CHAT_CONVERSATIONS.set(chatId, conversation);
  
  return true;
}

function generateChatTitle(firstMessage: string): string {
  // Generate a meaningful title from the first message
  const words = firstMessage.trim().split(' ').slice(0, 6);
  let title = words.join(' ');
  
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  return title || `Chat ${new Date().toLocaleDateString()}`;
}

// Analytics and utility functions
export function getChatStats(userId: string): {
  totalChats: number;
  totalMessages: number;
  activeChats: number;
  averageMessagesPerChat: number;
} {
  const userChats = getUserChats(userId);
  const totalChats = userChats.length;
  const activeChats = userChats.filter(chat => chat.isActive).length;
  const totalMessages = userChats.reduce((sum, chat) => sum + chat.messageCount, 0);
  const averageMessagesPerChat = totalChats > 0 ? totalMessages / totalChats : 0;

  return {
    totalChats,
    totalMessages,
    activeChats,
    averageMessagesPerChat: Math.round(averageMessagesPerChat * 100) / 100,
  };
}

export function searchChats(userId: string, query: string): ChatConversation[] {
  const userChats = getUserChats(userId);
  const lowercaseQuery = query.toLowerCase();

  return userChats.filter(chat => {
    // Search in title
    if (chat.title.toLowerCase().includes(lowercaseQuery)) return true;
    
    // Search in last message
    if (chat.lastMessage?.toLowerCase().includes(lowercaseQuery)) return true;
    
    // Search in tags
    if (chat.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))) return true;
    
    return false;
  });
}