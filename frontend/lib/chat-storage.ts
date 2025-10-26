import { v4 as uuidv4 } from 'uuid';

// Types matching the backend interfaces
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

// Local storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'atlas_chat_conversations',
  MESSAGES: 'atlas_chat_messages',
  CONTEXTS: 'atlas_user_contexts',
  CURRENT_USER: 'atlas_current_user',
} as const;

// Utility functions for local storage
function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key ${key}:`, error);
    return defaultValue;
  }
}

function setToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key ${key}:`, error);
  }
}

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

  // Get existing conversations
  const conversations = getFromStorage<Record<string, ChatConversation>>(STORAGE_KEYS.CONVERSATIONS, {});
  conversations[chatId] = conversation;
  setToStorage(STORAGE_KEYS.CONVERSATIONS, conversations);

  // Initialize empty messages array for this chat
  const allMessages = getFromStorage<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, {});
  allMessages[chatId] = [];
  setToStorage(STORAGE_KEYS.MESSAGES, allMessages);

  // Update user context
  updateUserContext(userId, chatId);

  return conversation;
}

export function getUserChats(userId: string): ChatConversation[] {
  const conversations = getFromStorage<Record<string, ChatConversation>>(STORAGE_KEYS.CONVERSATIONS, {});
  const userChats: ChatConversation[] = [];
  
  for (const conversation of Object.values(conversations)) {
    if (conversation.userId === userId) {
      userChats.push(conversation);
    }
  }

  // Sort by updatedAt descending (most recent first)
  return userChats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChatById(chatId: string): ChatConversation | undefined {
  const conversations = getFromStorage<Record<string, ChatConversation>>(STORAGE_KEYS.CONVERSATIONS, {});
  return conversations[chatId];
}

export function getChatMessages(chatId: string): ChatMessage[] {
  const allMessages = getFromStorage<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, {});
  return allMessages[chatId] || [];
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
  const allMessages = getFromStorage<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, {});
  const messages = allMessages[chatId] || [];
  messages.push(message);
  allMessages[chatId] = messages;
  setToStorage(STORAGE_KEYS.MESSAGES, allMessages);

  // Update conversation metadata
  const conversations = getFromStorage<Record<string, ChatConversation>>(STORAGE_KEYS.CONVERSATIONS, {});
  const conversation = conversations[chatId];
  if (conversation) {
    conversation.updatedAt = now;
    conversation.messageCount = messages.length;
    conversation.lastMessage = content.substring(0, 100) + (content.length > 100 ? '...' : '');
    
    // Auto-generate title from first user message if not set
    if (conversation.messageCount === 1 && role === 'user' && conversation.title.startsWith('Chat ')) {
      conversation.title = generateChatTitle(content);
    }
    
    conversations[chatId] = conversation;
    setToStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
  }

  // Update user context
  updateUserContextWithMessage(userId, message);

  return message;
}

export function updateUserContext(userId: string, currentChatId?: string): void {
  const contexts = getFromStorage<Record<string, ChatContext>>(STORAGE_KEYS.CONTEXTS, {});
  let context = contexts[userId];
  
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

  contexts[userId] = context;
  setToStorage(STORAGE_KEYS.CONTEXTS, contexts);
}

export function updateUserContextWithMessage(userId: string, message: ChatMessage): void {
  const contexts = getFromStorage<Record<string, ChatContext>>(STORAGE_KEYS.CONTEXTS, {});
  let context = contexts[userId];
  
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

  contexts[userId] = context;
  setToStorage(STORAGE_KEYS.CONTEXTS, contexts);
}

export function getUserContext(userId: string): ChatContext | undefined {
  const contexts = getFromStorage<Record<string, ChatContext>>(STORAGE_KEYS.CONTEXTS, {});
  return contexts[userId];
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
  const conversations = getFromStorage<Record<string, ChatConversation>>(STORAGE_KEYS.CONVERSATIONS, {});
  const conversation = conversations[chatId];
  if (!conversation) return false;

  // Remove from storage
  delete conversations[chatId];
  setToStorage(STORAGE_KEYS.CONVERSATIONS, conversations);

  const allMessages = getFromStorage<Record<string, ChatMessage[]>>(STORAGE_KEYS.MESSAGES, {});
  delete allMessages[chatId];
  setToStorage(STORAGE_KEYS.MESSAGES, allMessages);

  // Update user context
  const contexts = getFromStorage<Record<string, ChatContext>>(STORAGE_KEYS.CONTEXTS, {});
  const context = contexts[conversation.userId];
  if (context) {
    context.recentChats = context.recentChats.filter(id => id !== chatId);
    if (context.currentChatId === chatId) {
      context.currentChatId = context.recentChats[0];
    }
    // Remove messages from conversation history
    context.conversationHistory = context.conversationHistory.filter(msg => msg.chatId !== chatId);
    contexts[conversation.userId] = context;
    setToStorage(STORAGE_KEYS.CONTEXTS, contexts);
  }

  return true;
}

export function updateChatTitle(chatId: string, title: string): boolean {
  const conversations = getFromStorage<Record<string, ChatConversation>>(STORAGE_KEYS.CONVERSATIONS, {});
  const conversation = conversations[chatId];
  if (!conversation) return false;

  conversation.title = title;
  conversation.updatedAt = Date.now();
  conversations[chatId] = conversation;
  setToStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
  
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

// Current user management
export function setCurrentUser(userId: string): void {
  setToStorage(STORAGE_KEYS.CURRENT_USER, userId);
}

export function getCurrentUser(): string | null {
  return getFromStorage<string | null>(STORAGE_KEYS.CURRENT_USER, null);
}

export function clearCurrentUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

// Clear all chat data (useful for logout)
export function clearAllChatData(): void {
  if (typeof window !== 'undefined') {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}