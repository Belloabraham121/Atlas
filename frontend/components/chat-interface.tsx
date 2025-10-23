"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Dithering } from "@paper-design/shaders-react"
import { useAccount, useDisconnect } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import WalletConnection from "@/components/WalletConnection"
import Link from "next/link"
import { useChatStream } from "@/hooks/use-chat-stream"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
  graphs?: any[]
}

interface ChatSession {
  id: string
  title: string
  timestamp: Date
  messageCount: number
}

export function ChatInterface() {
  const { isConnected, address } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  
  // Use the streaming chat hook
  const { 
    messages: streamMessages, 
    isStreaming, 
    error: streamError, 
    sendMessage, 
    clearMessages,
    isConnected: isStreamConnected,
    hederaAccountId 
  } = useChatStream()
  
  const [input, setInput] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    { id: "1", title: "Portfolio Analysis", timestamp: new Date(Date.now() - 86400000), messageCount: 12 },
    { id: "2", title: "Risk Assessment", timestamp: new Date(Date.now() - 172800000), messageCount: 8 },
    { id: "3", title: "Market Trends", timestamp: new Date(Date.now() - 259200000), messageCount: 15 },
  ])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initialize with welcome message when connected
  const [hasInitialized, setHasInitialized] = useState(false)
  
  useEffect(() => {
    if (isConnected && hederaAccountId && !hasInitialized) {
      // Clear any existing messages and show welcome message
      clearMessages()
      setHasInitialized(true)
    } else if (!isConnected) {
      setHasInitialized(false)
    }
  }, [isConnected, hederaAccountId, hasInitialized, clearMessages])

  // Use streaming messages, but add welcome message if empty
  const messages = streamMessages.length === 0 && isConnected ? [
    {
      id: "welcome",
      role: "assistant" as const,
      content: `Hello! I'm ATLAS, your AI-powered Hedera portfolio intelligence assistant. I can see you're connected with wallet ${hederaAccountId}. How can I help you today? You can ask me about portfolio analysis, risk assessment, market trends, or any questions about your Hedera investments.`,
      timestamp: new Date(),
    }
  ] : streamMessages

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    // Use the streaming hook to send the message
    await sendMessage(input)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSendMessage(e as any)
    }
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat",
      timestamp: new Date(),
      messageCount: 0,
    }
    setChatSessions((prev) => [newChat, ...prev])
    setActiveChatId(newChat.id)
    clearMessages()
  }

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId)
    // In a real app, this would load the chat history from storage
    clearMessages()
  }

  // Show wallet connection screen if not connected
  if (!isConnected) {
    return (
      <div className="relative w-full min-h-screen flex flex-col overflow-hidden">
        {/* Background with dithering effect */}
        <div className="fixed inset-0 z-0">
          <Dithering
            colorBack="#00000000"
            colorFront="#614B00"
            speed={0.43}
            shape="wave"
            type="4x4"
            pxSize={3}
            scale={1.13}
            style={{
              backgroundColor: "#000000",
              height: "100vh",
              width: "100vw",
            }}
          />
        </div>

        {/* Header */}
        <div className="relative z-20 border-b border-gray-600/30 backdrop-blur-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                  <span className="text-black font-bold text-xs">A</span>
                </div>
                <span className="text-white font-bold text-sm hidden sm:inline">ATLAS</span>
              </div>
            </Link>
            <div className="text-gray-400 text-sm flex-1 text-center">Connect Wallet to Continue</div>
            <Link href="/">
              <Button variant="ghost" className="text-gray-400 hover:text-white text-sm">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Wallet Connection Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <WalletConnection />
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full min-h-screen flex flex-col overflow-hidden">
      {/* Background with dithering effect */}
      <div className="fixed inset-0 z-0">
        <Dithering
          colorBack="#00000000"
          colorFront="#614B00"
          speed={0.43}
          shape="wave"
          type="4x4"
          pxSize={3}
          scale={1.13}
          style={{
            backgroundColor: "#000000",
            height: "100vh",
            width: "100vw",
          }}
        />
      </div>

      {/* Header - Fixed positioning */}
      <div className="relative z-20 border-b border-gray-600/30 backdrop-blur-sm sticky top-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                <span className="text-black font-bold text-xs">A</span>
              </div>
              <span className="text-white font-bold text-sm hidden sm:inline">ATLAS</span>
            </div>
          </Link>

          {/* Center: Title */}
          <div className="text-gray-400 text-sm flex-1 text-center">Portfolio Intelligence Chat</div>

          {/* Right: Hamburger Button and Back Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/">
              <Button variant="ghost" className="text-gray-400 hover:text-white text-sm">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full bg-black/60 backdrop-blur-sm border-r border-gray-600/30 flex flex-col transition-all duration-300 overflow-hidden",
            sidebarOpen ? "w-64" : "w-0",
          )}
        >
          {/* New Chat Button */}
          <div className="p-4 border-b border-gray-600/30">
            <Button
              onClick={handleNewChat}
              className="w-full bg-white text-black hover:bg-gray-200 rounded font-semibold text-sm"
            >
              + New Chat
            </Button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="text-xs text-gray-500 font-semibold px-2 mb-3">CHAT HISTORY</div>
            {chatSessions.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm transition-colors truncate",
                  activeChatId === chat.id
                    ? "bg-white/20 text-white border border-gray-600/50"
                    : "text-gray-300 hover:bg-white/10",
                )}
                title={chat.title}
              >
                {chat.title}
              </button>
            ))}
          </div>

          {/* Wallet Section */}
          <div className="p-4 border-t border-gray-600/30">
            <div className="text-xs text-gray-500 font-semibold px-2 mb-3">WALLET</div>
            {isConnected ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-green-400 text-xs font-medium mb-1">Connected</p>
                  <p className="text-white text-sm font-mono break-all">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                  </p>
                </div>
                <Button 
                  onClick={() => disconnect()} 
                  variant="outline"
                  className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 rounded text-sm"
                >
                  Disconnect Wallet
                </Button>
              </div>
            ) : (
              <Button 
                onClick={openConnectModal}
                className="w-full bg-white text-black hover:bg-gray-200 rounded text-sm font-semibold"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div
          className={cn("relative flex flex-col flex-1 transition-all duration-300", sidebarOpen ? "ml-64" : "ml-0")}
        >
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 flex items-center justify-center">
                      <span className="text-black font-bold text-sm">A</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-white text-black"
                        : "bg-black/40 backdrop-blur-sm border border-gray-600/30 text-gray-100",
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 flex items-center justify-center">
                    <span className="text-black font-bold text-sm">A</span>
                  </div>
                  <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg px-4 py-3">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-600/30 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio, risk analysis, market trends..."
                  className="flex-1 bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white resize-none max-h-32"
                  rows={1}
                  style={{
                    fontSize: "16px",
                    WebkitUserSelect: "text",
                    userSelect: "text",
                  }}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isStreaming}
                  className="bg-white text-black hover:bg-gray-200 rounded px-6 py-3 font-semibold flex-shrink-0 h-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </Button>
              </form>
              <p className="text-xs text-gray-500 mt-2">Press Cmd+Enter or Ctrl+Enter to send</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
