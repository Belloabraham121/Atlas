import { useState, useCallback, useEffect } from "react";
import { useChatStream } from "./use-chat-stream";
import {
  createNewChat,
  getUserChats,
  getChatById,
  getChatMessages,
  addMessageToChat,
  updateUserContext,
  getUserContext,
  deleteChat,
  updateChatTitle,
  setCurrentUser,
  getCurrentUser,
  clearCurrentUser,
  searchChats,
  ChatConversation,
  ChatMessage,
} from "@/lib/indexeddb-storage";

export interface UseChatWithStorageReturn {
  // State
  conversations: ChatConversation[];
  currentConversation: ChatConversation | null;
  messages: ChatMessage[];
  isLoading: boolean;

  // Chat management
  createChat: (title?: string) => Promise<ChatConversation | null>;
  selectChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<boolean>;
  updateChatTitle: (chatId: string, title: string) => Promise<boolean>;

  // Message management
  sendMessage: (content: string) => Promise<void>;

  // Stream integration
  streamMessages: any[];
  isStreaming: boolean;
  streamError: string | null;
  streamSendMessage: (content: string) => void;
  streamClearMessages: () => void;

  // Search
  searchChats: (query: string) => Promise<ChatConversation[]>;

  // User management
  setCurrentUser: (userId: string) => Promise<void>;
  getCurrentUser: () => Promise<string | null>;
  clearCurrentUser: () => Promise<void>;
}

export function useChatWithStorage(address?: string): UseChatWithStorageReturn {
  // Local state
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stream integration
  const {
    messages: streamMessages,
    isStreaming,
    error: streamError,
    sendMessage: streamSendMessage,
    clearMessages: streamClearMessages,
  } = useChatStream();

  // Load user conversations from IndexedDB
  const loadUserConversations = useCallback(
    async (forceSelectRecent = false) => {
      if (!address) return;

      try {
        setIsLoading(true);
        const userChats = await getUserChats(address);
        setConversations(userChats);

        // Get user context to restore the last active chat
        const userContext = await getUserContext(address);
        let chatToSelect = null;

        if (
          userContext?.currentChatId &&
          userChats.find((chat) => chat.id === userContext.currentChatId)
        ) {
          // Restore the last active chat
          chatToSelect = userChats.find(
            (chat) => chat.id === userContext.currentChatId
          );
        } else if (
          userChats.length > 0 &&
          (forceSelectRecent || !currentConversation)
        ) {
          // Select the most recent chat if no context or forced
          chatToSelect = userChats[0];
        }

        if (chatToSelect) {
          setCurrentConversation(chatToSelect);
          // Load messages for the selected chat
          try {
            const messages = await getChatMessages(chatToSelect.id);
            setMessages(messages);
            // Clear streaming messages when loading a conversation to prevent old messages from showing
            streamClearMessages();
          } catch (error) {
            console.error("Failed to load chat messages:", error);
          }
          await updateUserContext(address, chatToSelect.id);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [address, streamClearMessages]
  );

  // Load messages for a specific chat
  const loadChatMessages = useCallback(async (chatId: string) => {
    try {
      const messages = await getChatMessages(chatId);
      setMessages(messages);
    } catch (error) {
      console.error("Failed to load chat messages:", error);
    }
  }, []);

  // Create a new chat
  const createChat = useCallback(
    async (title?: string): Promise<ChatConversation | null> => {
      if (!address) {
        console.error("User must be connected to create a chat");
        return null;
      }

      try {
        setIsLoading(true);
        const newChat = await createNewChat(address, title);

        // Update local state
        setConversations((prev) => [newChat, ...prev]);
        setCurrentConversation(newChat);
        setMessages([]);

        // Clear streaming messages when creating a new chat to prevent old messages from showing
        streamClearMessages();

        return newChat;
      } catch (error) {
        console.error("Failed to create chat:", error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, streamClearMessages]
  );

  // Select a chat
  const selectChat = useCallback(
    async (chatId: string) => {
      try {
        setIsLoading(true);
        const conversation = await getChatById(chatId);
        if (conversation) {
          setCurrentConversation(conversation);
          await loadChatMessages(chatId);
          // Clear streaming messages when selecting a chat to prevent old messages from showing
          streamClearMessages();
          if (address) {
            await updateUserContext(address, chatId);
          }
        }
      } catch (error) {
        console.error("Failed to select chat:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [address, loadChatMessages, streamClearMessages]
  );

  // Delete a chat
  const deleteChatHandler = useCallback(
    async (chatId: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        const success = await deleteChat(chatId);
        if (success) {
          setConversations((prev) => prev.filter((conv) => conv.id !== chatId));

          // If we deleted the current conversation, clear it
          if (currentConversation?.id === chatId) {
            setCurrentConversation(null);
            setMessages([]);
          }
        }
        return success;
      } catch (error) {
        console.error("Failed to delete chat:", error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversation]
  );

  // Update chat title
  const updateChatTitleHandler = useCallback(
    async (chatId: string, title: string): Promise<boolean> => {
      try {
        const success = await updateChatTitle(chatId, title);
        if (success) {
          setConversations((prev) =>
            prev.map((conv) => (conv.id === chatId ? { ...conv, title } : conv))
          );

          if (currentConversation?.id === chatId) {
            setCurrentConversation((prev) =>
              prev ? { ...prev, title } : null
            );
          }
        }
        return success;
      } catch (error) {
        console.error("Failed to update chat title:", error);
        return false;
      }
    },
    [currentConversation]
  );

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!address) return;

      try {
        // If no current conversation exists, create one
        let conversation = currentConversation;
        if (!conversation) {
          conversation = await createChat("New Chat");
          if (!conversation) {
            console.error("Failed to create new conversation");
            return;
          }
        }

        // Add user message to storage
        const userMessage = await addMessageToChat(
          conversation.id,
          address,
          "user",
          content
        );

        if (userMessage) {
          setMessages((prev) => [...prev, userMessage]);

          // Update conversation metadata
          const updatedConversation = {
            ...conversation,
            messageCount: (conversation.messageCount || 0) + 1,
            lastMessage: content.substring(0, 100),
            updatedAt: Date.now(),
          };
          setCurrentConversation(updatedConversation);
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversation.id ? updatedConversation : conv
            )
          );
        }

        // Send to stream for AI response
        streamSendMessage(content);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [address, currentConversation, createChat, streamSendMessage]
  );

  // Handle streaming messages and save them to storage when complete
  useEffect(() => {
    if (
      !isStreaming &&
      streamMessages.length > 0 &&
      address &&
      currentConversation
    ) {
      const assistantMessages = streamMessages.filter(
        (msg) => msg.role === "assistant"
      );

      assistantMessages.forEach(async (streamMsg) => {
        try {
          // Check if this message already exists in local storage
          const existingMessages = await getChatMessages(
            currentConversation.id
          );
          const isDuplicate = existingMessages.some(
            (existing) =>
              existing.role === "assistant" &&
              existing.content === streamMsg.content &&
              Math.abs(existing.timestamp - streamMsg.timestamp.getTime()) <
                5000 // Within 5 seconds
          );

          if (!isDuplicate) {
            const savedMessage = await addMessageToChat(
              currentConversation.id,
              address,
              "assistant",
              streamMsg.content,
              {
                ...(streamMsg.graphs ? { graphs: streamMsg.graphs } : {}),
                ...(streamMsg.marketAnalysis
                  ? { marketAnalysis: streamMsg.marketAnalysis }
                  : {}),
              }
            );

            if (savedMessage) {
              // Reload messages to get the latest state
              const updatedMessages = await getChatMessages(
                currentConversation.id
              );
              setMessages(updatedMessages);

              // Update conversation metadata
              const messageCount = updatedMessages.length;
              const lastMessage =
                updatedMessages[messageCount - 1]?.content.substring(0, 100) ||
                "";

              const updatedConversation = {
                ...currentConversation,
                messageCount,
                lastMessage,
                updatedAt: Date.now(),
              };
              setCurrentConversation(updatedConversation);
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.id === currentConversation.id
                    ? updatedConversation
                    : conv
                )
              );
            }
          }
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }
      });
    }
  }, [isStreaming, streamMessages, address, currentConversation]);

  // Load conversations when wallet connects
  useEffect(() => {
    if (address) {
      loadUserConversations();
    }
  }, [address]);

  // Initialize on mount if address is already available
  useEffect(() => {
    if (address && conversations.length === 0 && !isLoading) {
      loadUserConversations(true);
    }
  }, []);

  // Determine which messages to display
  const displayMessages = (() => {
    if (!currentConversation) {
      // If no conversation is selected, show converted stream messages
      return streamMessages.map((msg) => ({
        id: msg.id,
        chatId: "",
        userId: address || "",
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        contentHash: "",
        metadata: {
          ...(msg.graphs ? { graphs: msg.graphs } : {}),
          ...(msg.marketAnalysis ? { marketAnalysis: msg.marketAnalysis } : {}),
        },
      }));
    }

    if (isStreaming) {
      // During streaming, merge local and stream messages, avoiding duplicates
      const streamMsgs = streamMessages.map((msg) => ({
        id: msg.id,
        chatId: currentConversation.id,
        userId: address || "",
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        contentHash: "",
        metadata: {
          ...(msg.graphs ? { graphs: msg.graphs } : {}),
          ...(msg.marketAnalysis ? { marketAnalysis: msg.marketAnalysis } : {}),
        },
      }));

      // Combine and deduplicate
      const allMessages = [...messages, ...streamMsgs];
      const uniqueMessages = allMessages.filter(
        (msg, index, arr) =>
          arr.findIndex(
            (m) => m.content === msg.content && m.role === msg.role
          ) === index
      );

      return uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);
    }

    // When not streaming, show local stored messages
    return messages;
  })();

  // Search chats
  const searchChatsHandler = useCallback(
    async (query: string): Promise<ChatConversation[]> => {
      if (!address) return [];
      try {
        return await searchChats(address, query);
      } catch (error) {
        console.error("Failed to search chats:", error);
        return [];
      }
    },
    [address]
  );

  // User management
  const setCurrentUserHandler = useCallback(async (userId: string) => {
    try {
      await setCurrentUser(userId);
    } catch (error) {
      console.error("Failed to set current user:", error);
    }
  }, []);

  const getCurrentUserHandler = useCallback(async (): Promise<
    string | null
  > => {
    try {
      return await getCurrentUser();
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  }, []);

  const clearCurrentUserHandler = useCallback(async () => {
    try {
      await clearCurrentUser();
    } catch (error) {
      console.error("Failed to clear current user:", error);
    }
  }, []);

  return {
    // State
    conversations,
    currentConversation,
    messages: displayMessages,
    isLoading,

    // Chat management
    createChat,
    selectChat,
    deleteChat: deleteChatHandler,
    updateChatTitle: updateChatTitleHandler,

    // Message management
    sendMessage,

    // Stream integration
    streamMessages,
    isStreaming,
    streamError,
    streamSendMessage,
    streamClearMessages,

    // Search
    searchChats: searchChatsHandler,

    // User management
    setCurrentUser: setCurrentUserHandler,
    getCurrentUser: getCurrentUserHandler,
    clearCurrentUser: clearCurrentUserHandler,
  };
}
