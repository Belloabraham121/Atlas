'use client'

import { useState, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'

export interface StreamStep {
  step: string
  data: any
  timestamp?: string
}

export interface ChatStreamMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  graphs?: any[]
}

export interface UseChatStreamReturn {
  messages: ChatStreamMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (message: string) => Promise<void>
  clearMessages: () => void
  isConnected: boolean
  hederaAccountId: string | null // Contains EVM address for API calls
}

/**
 * Custom hook for handling chat streaming with the backend API
 * Automatically converts wallet address to Hedera account ID for API calls
 * Uses Server-Sent Events (SSE) for real-time streaming responses
 */
export function useChatStream(): UseChatStreamReturn {
  const { address, isConnected } = useAccount()
  const [messages, setMessages] = useState<ChatStreamMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const currentStreamingMessageRef = useRef<string>('')

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return
    
    // Check if we have a valid wallet connection
    if (!address || !isConnected) {
      setError('Please connect your wallet first to start chatting')
      return
    }

    if (isStreaming) {
      setError('Please wait for the current message to complete')
      return
    }

    setError(null)
    setIsStreaming(true)
    currentStreamingMessageRef.current = ''

    // Add user message immediately
    const userMessage: ChatStreamMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])

    // Create assistant message placeholder for streaming
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ChatStreamMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      // Use the EVM address directly as the user ID for the API
      // The backend's resolveAccountId function can handle EVM addresses (0x...)
      console.log('Debug - wallet address:', address)
      console.log('Debug - isConnected:', isConnected)
      const apiUrl = `http://localhost:3000/api/${address}/chat-stream`
      console.log('Debug - API URL:', apiUrl)
      
      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      // Send the message via POST and handle the SSE stream response
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ 
          message: message.trim(),
          useContext: true 
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body received')
      }

      // Read the SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              finishStreaming(assistantMessageId)
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('event:')) {
                // Extract event type
                const eventType = line.substring(6).trim()
                continue
              }
              
              if (line.startsWith('data:')) {
                try {
                  const dataStr = line.substring(5).trim()
                  if (dataStr) {
                    const data = JSON.parse(dataStr)
                    
                    // Handle different event types
                    if (data.step) {
                      handleStreamStep(data, assistantMessageId)
                    } else {
                      // Handle direct data events
                      handleStreamStep({ step: 'update', data }, assistantMessageId)
                    }

                    // Check for completion
                    if (data.step === 'complete' || data.step === 'summary') {
                      finishStreaming(assistantMessageId, data.response, data.graphs)
                      break
                    }

                    // Check for errors
                    if (data.step === 'error') {
                      handleStreamError(data.error || 'An error occurred during streaming')
                      finishStreaming(assistantMessageId, `Error: ${data.error || 'Unknown error'}`)
                      break
                    }
                  }
                } catch (parseError) {
                  console.error('Error parsing SSE data:', parseError)
                }
              }
            }
          }
        } catch (streamError) {
          console.error('Error reading stream:', streamError)
          handleStreamError('Stream reading error occurred')
          finishStreaming(assistantMessageId, 'Stream reading error occurred')
        } finally {
          reader.releaseLock()
        }
      }

      // Start reading the stream
      readStream()

    } catch (err) {
      console.error('Error sending message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      finishStreaming(assistantMessageId, `Error: ${errorMessage}`)
    }
  }, [address, isConnected, isStreaming])

  const handleStreamStep = useCallback((stepData: StreamStep, messageId: string) => {
    const { step, data } = stepData
    
    // Update the streaming message content based on the step
    let stepMessage = ''
    
    switch (step) {
      case 'start':
        stepMessage = '🚀 Starting analysis...'
        break
      case 'processing':
        stepMessage = '🤔 Analyzing your request...'
        break
      case 'scanner_start':
        stepMessage = data.message || '🔍 Scanning portfolio...'
        break
      case 'scanner_complete':
        stepMessage = '✅ Portfolio scan complete'
        break
      case 'llm_start':
        stepMessage = '🤖 Generating AI analysis...'
        break
      case 'llm_complete':
        stepMessage = '✅ AI analysis complete'
        break
      case 'complete':
      case 'summary':
        // Final response will be handled in finishStreaming
        return
      default:
        stepMessage = data.message || `Processing: ${step}`
    }

    // Append the step message to the current streaming content
    currentStreamingMessageRef.current += stepMessage + '\n'

    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: currentStreamingMessageRef.current }
        : msg
    ))
  }, [])

  const handleStreamError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setIsStreaming(false)
    
    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const finishStreaming = useCallback((messageId: string, finalContent?: string, graphs?: any[]) => {
    setIsStreaming(false)
    
    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Update the message with final content
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            content: finalContent || currentStreamingMessageRef.current || 'Analysis complete',
            isStreaming: false,
            graphs: graphs || undefined
          }
        : msg
    ))

    // Reset streaming content
    currentStreamingMessageRef.current = ''
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    isConnected: isConnected,
    hederaAccountId: address || null // Return EVM address for display purposes
  }
}