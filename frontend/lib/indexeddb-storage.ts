import { v4 as uuidv4 } from 'uuid';

// Types matching the backend interfaces
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  contentHash: string; // For efficient deduplication
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

// IndexedDB configuration
const DB_NAME = 'AtlasChatDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  CONTEXTS: 'contexts',
  USERS: 'users',
} as const;

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create conversations store
        if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
          const conversationsStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
          conversationsStore.createIndex('userId', 'userId', { unique: false });
          conversationsStore.createIndex('createdAt', 'createdAt', { unique: false });
          conversationsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          conversationsStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // Create messages store with deduplication indexes
        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
          messagesStore.createIndex('chatId', 'chatId', { unique: false });
          messagesStore.createIndex('userId', 'userId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
          messagesStore.createIndex('contentHash', 'contentHash', { unique: false });
          messagesStore.createIndex('chatId_contentHash', ['chatId', 'contentHash'], { unique: true });
        }

        // Create contexts store
        if (!db.objectStoreNames.contains(STORES.CONTEXTS)) {
          const contextsStore = db.createObjectStore(STORES.CONTEXTS, { keyPath: 'userId' });
        }

        // Create users store
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          db.createObjectStore(STORES.USERS, { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.initPromise) {
      this.initPromise = this.initDB();
    }
    await this.initPromise;
    
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
    return this.db;
  }

  private generateContentHash(content: string, role: string, metadata?: ChatMessage['metadata']): string {
    const hashInput = JSON.stringify({
      content: content.trim(),
      role,
      metadata: metadata || {},
    });
    
    // Simple hash function (you might want to use a more robust one)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Conversation operations
  async createConversation(userId: string, title?: string): Promise<ChatConversation> {
    const db = await this.ensureDB();
    const conversation: ChatConversation = {
      id: uuidv4(),
      userId,
      title: title || 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      isActive: true,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONVERSATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const request = store.add(conversation);

      request.onsuccess = () => resolve(conversation);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserConversations(userId: string): Promise<ChatConversation[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONVERSATIONS], 'readonly');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const conversations = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(conversations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getConversationById(chatId: string): Promise<ChatConversation | undefined> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONVERSATIONS], 'readonly');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const request = store.get(chatId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateConversation(conversation: ChatConversation): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONVERSATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.CONVERSATIONS);
      const request = store.put({ ...conversation, updatedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversation(chatId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONVERSATIONS, STORES.MESSAGES], 'readwrite');
      
      // Delete conversation
      const conversationStore = transaction.objectStore(STORES.CONVERSATIONS);
      conversationStore.delete(chatId);

      // Delete all messages for this conversation
      const messagesStore = transaction.objectStore(STORES.MESSAGES);
      const index = messagesStore.index('chatId');
      const request = index.openCursor(chatId);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Message operations with deduplication
  async addMessage(
    chatId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: ChatMessage['metadata']
  ): Promise<ChatMessage | null> {
    const db = await this.ensureDB();
    const contentHash = this.generateContentHash(content, role, metadata);

    // Check for duplicates using the compound index
    const isDuplicate = await this.checkDuplicate(chatId, contentHash);
    if (isDuplicate) {
      console.log('Duplicate message detected, skipping:', { chatId, contentHash });
      return null;
    }

    const message: ChatMessage = {
      id: uuidv4(),
      chatId,
      userId,
      role,
      content,
      timestamp: Date.now(),
      contentHash,
      metadata,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MESSAGES, STORES.CONVERSATIONS], 'readwrite');
      
      // Add message
      const messagesStore = transaction.objectStore(STORES.MESSAGES);
      messagesStore.add(message);

      // Update conversation
      const conversationsStore = transaction.objectStore(STORES.CONVERSATIONS);
      const getConversation = conversationsStore.get(chatId);

      getConversation.onsuccess = () => {
        const conversation = getConversation.result;
        if (conversation) {
          conversation.messageCount = (conversation.messageCount || 0) + 1;
          conversation.lastMessage = content.substring(0, 100);
          conversation.updatedAt = Date.now();
          conversationsStore.put(conversation);
        }
      };

      transaction.oncomplete = () => resolve(message);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async checkDuplicate(chatId: string, contentHash: string): Promise<boolean> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.MESSAGES);
      const index = store.index('chatId_contentHash');
      const request = index.get([chatId, contentHash]);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.MESSAGES);
      const index = store.index('chatId');
      const request = index.getAll(chatId);

      request.onsuccess = () => {
        const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Context operations
  async updateUserContext(context: ChatContext): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONTEXTS], 'readwrite');
      const store = transaction.objectStore(STORES.CONTEXTS);
      const request = store.put(context);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserContext(userId: string): Promise<ChatContext | undefined> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONTEXTS], 'readonly');
      const store = transaction.objectStore(STORES.CONTEXTS);
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // User operations
  async setCurrentUser(userId: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.USERS], 'readwrite');
      const store = transaction.objectStore(STORES.USERS);
      const request = store.put({ id: 'current', userId });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCurrentUser(): Promise<string | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.USERS], 'readonly');
      const store = transaction.objectStore(STORES.USERS);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result?.userId || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearCurrentUser(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.USERS], 'readwrite');
      const store = transaction.objectStore(STORES.USERS);
      const request = store.delete('current');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONVERSATIONS, STORES.MESSAGES, STORES.CONTEXTS, STORES.USERS], 'readwrite');
      
      transaction.objectStore(STORES.CONVERSATIONS).clear();
      transaction.objectStore(STORES.MESSAGES).clear();
      transaction.objectStore(STORES.CONTEXTS).clear();
      transaction.objectStore(STORES.USERS).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Create singleton instance
export const indexedDBStorage = new IndexedDBStorage();

// Export convenience functions that match the original API
export async function createNewChat(userId: string, title?: string): Promise<ChatConversation> {
  return indexedDBStorage.createConversation(userId, title);
}

export async function getUserChats(userId: string): Promise<ChatConversation[]> {
  return indexedDBStorage.getUserConversations(userId);
}

export async function getChatById(chatId: string): Promise<ChatConversation | undefined> {
  return indexedDBStorage.getConversationById(chatId);
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  return indexedDBStorage.getChatMessages(chatId);
}

export async function addMessageToChat(
  chatId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: ChatMessage['metadata']
): Promise<ChatMessage | null> {
  return indexedDBStorage.addMessage(chatId, userId, role, content, metadata);
}

export async function updateUserContext(userId: string, currentChatId?: string): Promise<void> {
  const context: ChatContext = {
    userId,
    currentChatId,
    recentChats: [],
    conversationHistory: [],
    maxContextMessages: 50,
  };
  return indexedDBStorage.updateUserContext(context);
}

export async function getUserContext(userId: string): Promise<ChatContext | undefined> {
  return indexedDBStorage.getUserContext(userId);
}

export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    await indexedDBStorage.deleteConversation(chatId);
    return true;
  } catch (error) {
    console.error('Failed to delete chat:', error);
    return false;
  }
}

export async function updateChatTitle(chatId: string, title: string): Promise<boolean> {
  try {
    const conversation = await indexedDBStorage.getConversationById(chatId);
    if (conversation) {
      conversation.title = title;
      await indexedDBStorage.updateConversation(conversation);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to update chat title:', error);
    return false;
  }
}

export async function setCurrentUser(userId: string): Promise<void> {
  return indexedDBStorage.setCurrentUser(userId);
}

export async function getCurrentUser(): Promise<string | null> {
  return indexedDBStorage.getCurrentUser();
}

export async function clearCurrentUser(): Promise<void> {
  return indexedDBStorage.clearCurrentUser();
}

export async function searchChats(userId: string, query: string): Promise<ChatConversation[]> {
  const conversations = await getUserChats(userId);
  const lowercaseQuery = query.toLowerCase();
  
  return conversations.filter(conv => 
    conv.title.toLowerCase().includes(lowercaseQuery) ||
    conv.lastMessage?.toLowerCase().includes(lowercaseQuery) ||
    conv.summary?.toLowerCase().includes(lowercaseQuery)
  );
}

export async function clearAllChatData(): Promise<void> {
  return indexedDBStorage.clearAllData();
}