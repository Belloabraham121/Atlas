"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { useChatStream } from "./use-chat-stream";
import {
  ChatConversation,
  ChatMessage,
  createNewChat,
  getUserChats,
  getChatById,
  getChatMessages,
  addMessageToChat,
  updateUserContext,
  setCurrentUser,
  getCurrentUser,
  clearCurrentUser,
  deleteChat,
  updateChatTitle,
  searchChats,
} from "@/lib/chat-storage";

export interface UseChatWithStorageReturn {
  // Chat conversations
  conversations: ChatConversation[];
  currentConversation: ChatConversation | null;
  
  // Messages
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  createChat: (title?: string) => ChatConversation;
  selectChat: (chatId: string) => void;
  deleteChat: (chatId: string) => boolean;
  updateChatTitle: (chatId: string, title: string) => boolean;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  searchChats: (query: string) => ChatConversation[];
  
  // Connection status
  isConnected: boolean;
  hederaAccountId: string | null;
}

export function useChatWithStorage(): UseChatWithStorageReturn {
  const { address, isConnected } = useAccount();
  const {
    messages: streamMessages,
    isStreaming,
    error: streamError,
    sendMessage: streamSendMessage,
    clearMessages: streamClearMessages,
    hederaAccountId,
  } = useChatStream();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize user and load conversations when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      setCurrentUser(address);
      loadUserConversations();
    } else {
      clearCurrentUser();
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
    }
  }, [isConnected, address]);

  // Load user conversations from local storage
  const loadUserConversations = useCallback(() => {
    if (!address) return;
    
    const userChats = getUserChats(address);
    setConversations(userChats);
    
    // If there's no current conversation but there are chats, select the most recent one
    if (userChats.length > 0 && !currentConversation) {
      const mostRecent = userChats[0];
      setCurrentConversation(mostRecent);
      loadChatMessages(mostRecent.id);
      updateUserContext(address, mostRecent.id);
    }
  }, [address, currentConversation]);

  // Load messages for a specific chat
  const loadChatMessages = useCallback((chatId: string) => {
    const chatMessages = getChatMessages(chatId);
    setMessages(chatMessages);
  }, []);

  // Create a new chat
  const createChat = useCallback((title?: string): ChatConversation => {
    if (!address) {
      throw new Error("User must be connected to create a chat");
    }

    const newChat = createNewChat(address, title);
    
    // Update local state
    setConversations(prev => [newChat, ...prev]);
    setCurrentConversation(newChat);
    setMessages([]);
    
    // Clear streaming messages when creating a new chat to prevent old messages from showing
    streamClearMessages();
    
    return newChat;
  }, [address, streamClearMessages]);

  // Select a chat
  const selectChat = useCallback((chatId: string) => {
    if (!address) return;

    const chat = getChatById(chatId);
    if (!chat) return;

    setCurrentConversation(chat);
    loadChatMessages(chatId);
    updateUserContext(address, chatId);
    
    // Clear streaming messages when switching chats
    streamClearMessages();
  }, [address, loadChatMessages, streamClearMessages]);

  // Delete a chat
  const deleteChatHandler = useCallback((chatId: string): boolean => {
    const success = deleteChat(chatId);
    
    if (success) {
      // Update local state
      setConversations(prev => prev.filter(chat => chat.id !== chatId));
      
      // If we deleted the current chat, select another one or clear
      if (currentConversation?.id === chatId) {
        const remainingChats = conversations.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          selectChat(remainingChats[0].id);
        } else {
          setCurrentConversation(null);
          setMessages([]);
          streamClearMessages();
        }
      }
    }
    
    return success;
  }, [conversations, currentConversation, selectChat, streamClearMessages]);

  // Update chat title
  const updateChatTitleHandler = useCallback((chatId: string, title: string): boolean => {
    const success = updateChatTitle(chatId, title);
    
    if (success) {
      // Update local state
      setConversations(prev => 
        prev.map(chat => 
          chat.id === chatId ? { ...chat, title, updatedAt: Date.now() } : chat
        )
      );
      
      // Update current conversation if it's the one being updated
      if (currentConversation?.id === chatId) {
        setCurrentConversation(prev => 
          prev ? { ...prev, title, updatedAt: Date.now() } : null
        );
      }
    }
    
    return success;
  }, [currentConversation]);

  // Send a message
  const sendMessage = useCallback(async (message: string) => {
    if (!address) {
      setError("Please connect your wallet to send a message");
      return;
    }

    // If no current conversation, create a new one
    let conversation = currentConversation;
    if (!conversation) {
      conversation = createChat("New Chat");
    }

    try {
      setError(null);
      
      // Add user message to local storage
      const userMessage = addMessageToChat(
        conversation.id,
        address,
        'user',
        message
      );
      
      // Update local messages state
      setMessages(prev => [...prev, userMessage]);
      
      // Update conversation in local state
      setConversations(prev => 
        prev.map(chat => 
          chat.id === conversation.id 
            ? { 
                ...chat, 
                messageCount: chat.messageCount + 1,
                lastMessage: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
                updatedAt: Date.now()
              }
            : chat
        )
      );
      
      // Send message through streaming hook
      await streamSendMessage(message);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setError(error instanceof Error ? error.message : "Failed to send message");
    }
  }, [address, currentConversation, streamSendMessage, createChat]);

  // Handle streaming messages - add them to local storage when complete
  useEffect(() => {
    if (!isStreaming && streamMessages.length > 0 && currentConversation && address) {
      // Get all assistant messages from the stream
      const assistantMessages = streamMessages.filter(msg => msg.role === 'assistant');
      
      if (assistantMessages.length > 0) {
        // Get existing messages to check for duplicates
        const existingMessages = getChatMessages(currentConversation.id);
        
        // Separate messages with graphs from those without
        const messagesWithGraphs = assistantMessages.filter(msg => msg.graphs && msg.graphs.length > 0);
        const messagesWithoutGraphs = assistantMessages.filter(msg => !msg.graphs || msg.graphs.length === 0);
        
        // Combine text-only messages
        const combinedTextContent = messagesWithoutGraphs
          .map(msg => msg.content)
          .join('\n\n');
        
        // Check if this combined text message is already in local storage
        const textMessageExists = existingMessages.some(msg => 
          msg.content === combinedTextContent && 
          msg.role === 'assistant' &&
          (!msg.metadata?.graphs || msg.metadata.graphs.length === 0)
        );
        
        // Add combined text message if it doesn't exist and has content
        if (!textMessageExists && combinedTextContent.trim()) {
          addMessageToChat(
            currentConversation.id,
            address,
            'assistant',
            combinedTextContent,
            {
              graphs: [], // Explicitly no graphs for text-only messages
            }
          );
        }
        
        // Handle each message with graphs separately to prevent mixing
        messagesWithGraphs.forEach(graphMessage => {
          // Check if this specific graph message already exists
          const graphMessageExists = existingMessages.some(msg => 
            msg.content === graphMessage.content && 
            msg.role === 'assistant' &&
            msg.metadata?.graphs && 
            msg.metadata.graphs.length > 0 &&
            JSON.stringify(msg.metadata.graphs) === JSON.stringify(graphMessage.graphs)
          );
          
          if (!graphMessageExists) {
            addMessageToChat(
              currentConversation.id,
              address,
              'assistant',
              graphMessage.content,
              {
                graphs: graphMessage.graphs || [],
              }
            );
          }
        });
        
        // Update conversation metadata only once
        const totalNewMessages = (combinedTextContent.trim() ? 1 : 0) + 
          messagesWithGraphs.filter(msg => !existingMessages.some(existing => 
            existing.content === msg.content && 
            existing.role === 'assistant' &&
            JSON.stringify(existing.metadata?.graphs) === JSON.stringify(msg.graphs)
          )).length;
        
        if (totalNewMessages > 0) {
          // Update conversation in local state
          setConversations(prev => 
            prev.map(chat => 
              chat.id === currentConversation.id 
                ? { 
                    ...chat, 
                    messageCount: chat.messageCount + totalNewMessages,
                    lastMessage: (combinedTextContent || messagesWithGraphs[messagesWithGraphs.length - 1]?.content || '').substring(0, 100) + 
                      ((combinedTextContent || messagesWithGraphs[messagesWithGraphs.length - 1]?.content || '').length > 100 ? '...' : ''),
                    updatedAt: Date.now()
                  }
                : chat
            )
          );
          
          // Reload messages from storage to ensure consistency
          const updatedMessages = getChatMessages(currentConversation.id);
          setMessages(updatedMessages);
        }
      }
    }
  }, [isStreaming, streamMessages, currentConversation, address]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    streamClearMessages();
  }, [streamClearMessages]);

  // Search chats
  const searchChatsHandler = useCallback((query: string): ChatConversation[] => {
    if (!address) return [];
    return searchChats(address, query);
  }, [address]);

  // Combine stream error with local error
  const combinedError = error || streamError;

  // Convert stream messages to ChatMessage format for consistency
  const convertedStreamMessages: ChatMessage[] = streamMessages.map(msg => ({
    id: msg.id,
    chatId: currentConversation?.id || 'temp',
    userId: address || 'unknown',
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp.getTime(),
    metadata: {
      graphs: msg.graphs,
    },
  }));

  // Determine which messages to show
  const displayMessages = (() => {
    if (!currentConversation) {
      // No conversation selected, show stream messages for new chats
      return convertedStreamMessages;
    }
    
    if (isStreaming && streamMessages.length > 0) {
      // During streaming, show local messages plus live stream messages
      // Use more precise duplicate detection based on content and exact timestamp
      const localMessagesWithoutDuplicates = messages.filter(localMsg => 
        !streamMessages.some(streamMsg => 
          streamMsg.role === localMsg.role && 
          streamMsg.content === localMsg.content &&
          Math.abs(streamMsg.timestamp.getTime() - localMsg.timestamp) < 1000 // Reduced to 1 second for more precision
        )
      );
      return [...localMessagesWithoutDuplicates, ...convertedStreamMessages];
    }
    
    // Not streaming, show local stored messages
    return messages;
  })();

  return {
    conversations,
    currentConversation,
    messages: displayMessages,
    isStreaming,
    error: combinedError,
    createChat,
    selectChat,
    deleteChat: deleteChatHandler,
    updateChatTitle: updateChatTitleHandler,
    sendMessage,
    clearMessages,
    searchChats: searchChatsHandler,
    isConnected,
    hederaAccountId,
  };
}