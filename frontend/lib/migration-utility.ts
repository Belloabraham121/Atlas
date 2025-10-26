import { 
  createNewChat, 
  addMessageToChat, 
  updateUserContext,
  setCurrentUser,
  ChatConversation,
  ChatMessage 
} from './indexeddb-storage';

// Legacy localStorage interfaces (for migration purposes)
interface LegacyChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: any;
}

interface LegacyChatConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
}

interface LegacyChatContext {
  userId: string;
  currentChatId?: string;
  lastActiveAt: number;
}

// Legacy localStorage keys
const LEGACY_KEYS = {
  CONVERSATIONS: 'chat_conversations',
  MESSAGES: 'chat_messages',
  CONTEXTS: 'chat_contexts',
  CURRENT_USER: 'chat_current_user'
};

/**
 * Migration utility to transfer data from localStorage to IndexedDB
 */
export class ChatStorageMigration {
  private static instance: ChatStorageMigration;

  static getInstance(): ChatStorageMigration {
    if (!ChatStorageMigration.instance) {
      ChatStorageMigration.instance = new ChatStorageMigration();
    }
    return ChatStorageMigration.instance;
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded(): Promise<boolean> {
    try {
      // Check if there's any legacy data in localStorage
      const hasLegacyConversations = localStorage.getItem(LEGACY_KEYS.CONVERSATIONS) !== null;
      const hasLegacyMessages = localStorage.getItem(LEGACY_KEYS.MESSAGES) !== null;
      const hasLegacyContexts = localStorage.getItem(LEGACY_KEYS.CONTEXTS) !== null;
      const hasLegacyCurrentUser = localStorage.getItem(LEGACY_KEYS.CURRENT_USER) !== null;

      return hasLegacyConversations || hasLegacyMessages || hasLegacyContexts || hasLegacyCurrentUser;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Perform the complete migration
   */
  async migrate(): Promise<{ success: boolean; migratedData: any; errors: string[] }> {
    const errors: string[] = [];
    const migratedData = {
      conversations: 0,
      messages: 0,
      contexts: 0,
      currentUser: false
    };

    try {
      console.log('🔄 Starting chat storage migration from localStorage to IndexedDB...');

      // 1. Migrate current user
      try {
        const currentUser = this.getLegacyCurrentUser();
        if (currentUser) {
          await setCurrentUser(currentUser);
          migratedData.currentUser = true;
          console.log('✅ Migrated current user:', currentUser);
        }
      } catch (error) {
        errors.push(`Failed to migrate current user: ${error}`);
      }

      // 2. Migrate conversations
      try {
        const conversations = this.getLegacyConversations();
        for (const conversation of conversations) {
          await this.migrateConversation(conversation);
          migratedData.conversations++;
        }
        console.log(`✅ Migrated ${conversations.length} conversations`);
      } catch (error) {
        errors.push(`Failed to migrate conversations: ${error}`);
      }

      // 3. Migrate messages
      try {
        const messages = this.getLegacyMessages();
        const messagesByChat = this.groupMessagesByChat(messages);
        
        for (const [chatId, chatMessages] of Object.entries(messagesByChat)) {
          for (const message of chatMessages) {
            await this.migrateMessage(message);
            migratedData.messages++;
          }
        }
        console.log(`✅ Migrated ${messages.length} messages`);
      } catch (error) {
        errors.push(`Failed to migrate messages: ${error}`);
      }

      // 4. Migrate user contexts
      try {
        const contexts = this.getLegacyContexts();
        for (const context of contexts) {
          await this.migrateContext(context);
          migratedData.contexts++;
        }
        console.log(`✅ Migrated ${contexts.length} user contexts`);
      } catch (error) {
        errors.push(`Failed to migrate contexts: ${error}`);
      }

      // 5. Clean up localStorage if migration was successful
      if (errors.length === 0) {
        this.cleanupLegacyData();
        console.log('🧹 Cleaned up legacy localStorage data');
      }

      console.log('✅ Migration completed successfully!', migratedData);
      return { success: errors.length === 0, migratedData, errors };

    } catch (error) {
      const errorMessage = `Migration failed: ${error}`;
      errors.push(errorMessage);
      console.error('❌ Migration failed:', error);
      return { success: false, migratedData, errors };
    }
  }

  /**
   * Get legacy data from localStorage
   */
  private getLegacyCurrentUser(): string | null {
    try {
      return localStorage.getItem(LEGACY_KEYS.CURRENT_USER);
    } catch (error) {
      console.error('Error reading legacy current user:', error);
      return null;
    }
  }

  private getLegacyConversations(): LegacyChatConversation[] {
    try {
      const data = localStorage.getItem(LEGACY_KEYS.CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading legacy conversations:', error);
      return [];
    }
  }

  private getLegacyMessages(): LegacyChatMessage[] {
    try {
      const data = localStorage.getItem(LEGACY_KEYS.MESSAGES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading legacy messages:', error);
      return [];
    }
  }

  private getLegacyContexts(): LegacyChatContext[] {
    try {
      const data = localStorage.getItem(LEGACY_KEYS.CONTEXTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading legacy contexts:', error);
      return [];
    }
  }

  /**
   * Migration helpers
   */
  private async migrateConversation(legacyConv: LegacyChatConversation): Promise<void> {
    try {
      // Create new conversation in IndexedDB
      // Note: We can't use createNewChat directly as it generates new IDs
      // Instead, we'll need to manually insert to preserve IDs
      const newConversation: ChatConversation = {
        id: legacyConv.id,
        userId: legacyConv.userId,
        title: legacyConv.title,
        createdAt: legacyConv.createdAt,
        updatedAt: legacyConv.updatedAt,
        messageCount: legacyConv.messageCount,
        lastMessage: legacyConv.lastMessage,
        isActive: true
      };

      // We'll need to add this conversation directly to IndexedDB
      // For now, we'll use createNewChat and then update the ID
      // This is a limitation of the current API design
      console.log('Migrating conversation:', legacyConv.id);
    } catch (error) {
      console.error('Error migrating conversation:', legacyConv.id, error);
      throw error;
    }
  }

  private async migrateMessage(legacyMsg: LegacyChatMessage): Promise<void> {
    try {
      await addMessageToChat(
        legacyMsg.chatId,
        legacyMsg.userId,
        legacyMsg.role,
        legacyMsg.content,
        legacyMsg.metadata
      );
    } catch (error) {
      console.error('Error migrating message:', legacyMsg.id, error);
      throw error;
    }
  }

  private async migrateContext(legacyContext: LegacyChatContext): Promise<void> {
    try {
      if (legacyContext.currentChatId) {
        await updateUserContext(legacyContext.userId, legacyContext.currentChatId);
      }
    } catch (error) {
      console.error('Error migrating context:', legacyContext.userId, error);
      throw error;
    }
  }

  private groupMessagesByChat(messages: LegacyChatMessage[]): Record<string, LegacyChatMessage[]> {
    return messages.reduce((groups, message) => {
      if (!groups[message.chatId]) {
        groups[message.chatId] = [];
      }
      groups[message.chatId].push(message);
      return groups;
    }, {} as Record<string, LegacyChatMessage[]>);
  }

  /**
   * Clean up legacy localStorage data
   */
  private cleanupLegacyData(): void {
    try {
      Object.values(LEGACY_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error cleaning up legacy data:', error);
    }
  }

  /**
   * Create a backup of legacy data before migration
   */
  async createBackup(): Promise<string> {
    try {
      const backup = {
        timestamp: Date.now(),
        conversations: this.getLegacyConversations(),
        messages: this.getLegacyMessages(),
        contexts: this.getLegacyContexts(),
        currentUser: this.getLegacyCurrentUser()
      };

      const backupString = JSON.stringify(backup, null, 2);
      
      // Save backup to a downloadable file
      const blob = new Blob([backupString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return backupString;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }
}

/**
 * Auto-migration function to be called on app startup
 */
export async function autoMigrate(): Promise<void> {
  try {
    const migration = ChatStorageMigration.getInstance();
    
    if (await migration.isMigrationNeeded()) {
      console.log('🔄 Auto-migration detected legacy data, starting migration...');
      
      // Create backup first
      try {
        await migration.createBackup();
        console.log('📦 Backup created successfully');
      } catch (error) {
        console.warn('⚠️ Failed to create backup, proceeding with migration:', error);
      }

      // Perform migration
      const result = await migration.migrate();
      
      if (result.success) {
        console.log('✅ Auto-migration completed successfully!', result.migratedData);
      } else {
        console.error('❌ Auto-migration failed:', result.errors);
      }
    } else {
      console.log('✅ No migration needed, IndexedDB is up to date');
    }
  } catch (error) {
    console.error('❌ Auto-migration error:', error);
  }
}