'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { AccountId, EvmAddress } from '@hashgraph/sdk'

export interface EvmToHederaResult {
  hederaAccountId: string | null
  evmAddress: string | null
  isValid: boolean
  error: string | null
  isLoading: boolean
  isConnected: boolean
}

export interface UseEvmToHederaAccountReturn {
  result: EvmToHederaResult
  convertEvmToHedera: (evmAddress?: string) => Promise<void>
  convertConnectedWallet: () => Promise<void>
  reset: () => void
  connectedAddress: string | undefined
}

/**
 * Custom hook to convert EVM wallet addresses to Hedera account IDs
 * Uses the Hedera SDK for proper validation and conversion
 * Automatically integrates with connected wallet via wagmi
 * 
 * @returns {UseEvmToHederaAccountReturn} Object containing conversion result and utility functions
 */
export function useEvmToHederaAccount(): UseEvmToHederaAccountReturn {
  const { address: connectedAddress, isConnected } = useAccount()
  
  const [result, setResult] = useState<EvmToHederaResult>({
    hederaAccountId: null,
    evmAddress: null,
    isValid: false,
    error: null,
    isLoading: false,
    isConnected: false
  })

  // Update connection status when wallet connection changes
  useEffect(() => {
    setResult(prev => ({ ...prev, isConnected }))
  }, [isConnected])

  // Auto-convert connected wallet address when it changes
  useEffect(() => {
    if (isConnected && connectedAddress) {
      convertEvmToHedera(connectedAddress)
    } else if (!isConnected) {
      reset()
    }
  }, [isConnected, connectedAddress])

  /**
   * Validates if the provided string is a valid EVM address
   */
  const isValidEvmAddress = useCallback((address: string): boolean => {
    try {
      // Remove 0x prefix if present
      const cleanAddress = address.startsWith('0x') ? address.slice(2) : address
      
      // Check if it's a valid hex string of 40 characters (20 bytes)
      if (!/^[0-9a-fA-F]{40}$/.test(cleanAddress)) {
        return false
      }
      
      // Try to create EvmAddress instance to validate
      EvmAddress.fromString(address)
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * Converts EVM address to Hedera account ID
   * If no address is provided, uses the connected wallet address
   */
  const convertEvmToHedera = useCallback(async (evmAddress?: string): Promise<void> => {
    const addressToConvert = evmAddress || connectedAddress
    
    if (!addressToConvert) {
      setResult(prev => ({ 
        ...prev, 
        error: 'No EVM address provided and no wallet connected',
        isLoading: false 
      }))
      return
    }

    setResult(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Validate the EVM address format
      if (!addressToConvert || typeof addressToConvert !== 'string') {
        throw new Error('EVM address is required and must be a string')
      }

      // Trim whitespace and ensure proper format
      const cleanAddress = addressToConvert.trim()
      
      if (!isValidEvmAddress(cleanAddress)) {
        throw new Error('Invalid EVM address format. Please provide a valid Ethereum address.')
      }

      // Convert using Hedera SDK
      const evmAddr = EvmAddress.fromString(cleanAddress)
      const hederaAccountId = AccountId.fromEvmAddress(0, 0, evmAddr)
      
      setResult({
        hederaAccountId: hederaAccountId.toString(),
        evmAddress: cleanAddress,
        isValid: true,
        error: null,
        isLoading: false,
        isConnected
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert EVM address to Hedera account ID'
      
      setResult({
        hederaAccountId: null,
        evmAddress: addressToConvert,
        isValid: false,
        error: errorMessage,
        isLoading: false,
        isConnected
      })
    }
  }, [connectedAddress, isConnected, isValidEvmAddress])

  /**
   * Converts the currently connected wallet address to Hedera account ID
   */
  const convertConnectedWallet = useCallback(async (): Promise<void> => {
    if (!isConnected || !connectedAddress) {
      setResult(prev => ({ 
        ...prev, 
        error: 'No wallet connected. Please connect your wallet first.',
        isLoading: false 
      }))
      return
    }
    
    await convertEvmToHedera(connectedAddress)
  }, [isConnected, connectedAddress, convertEvmToHedera])

  /**
   * Resets the conversion result to initial state
   */
  const reset = useCallback(() => {
    setResult({
      hederaAccountId: null,
      evmAddress: null,
      isValid: false,
      error: null,
      isLoading: false,
      isConnected
    })
  }, [isConnected])

  return useMemo(() => ({
    result,
    convertEvmToHedera,
    convertConnectedWallet,
    reset,
    connectedAddress
  }), [result, convertEvmToHedera, convertConnectedWallet, reset, connectedAddress])
}

/**
 * Standalone utility function to convert EVM address to Hedera account ID
 * Does not require React context - can be used outside of components
 * 
 * @param evmAddress - The EVM address to convert
 * @returns Promise<string> - The Hedera account ID in format "0.0.xxxxx"
 * @throws Error if the address is invalid or conversion fails
 */
export async function convertEvmAddressToHederaAccountId(evmAddress: string): Promise<string> {
  try {
    if (!evmAddress || typeof evmAddress !== 'string') {
      throw new Error('EVM address is required and must be a string')
    }

    // Trim whitespace and ensure proper format
    const cleanAddress = evmAddress.trim()
    
    // Validate format
    const cleanHex = cleanAddress.startsWith('0x') ? cleanAddress.slice(2) : cleanAddress
    if (!/^[0-9a-fA-F]{40}$/.test(cleanHex)) {
      throw new Error('Invalid EVM address format. Must be a 40-character hex string.')
    }

    // Convert using Hedera SDK
    const evmAddr = EvmAddress.fromString(cleanAddress)
    const hederaAccountId = AccountId.fromEvmAddress(0, 0, evmAddr)
    
    return hederaAccountId.toString()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to convert EVM address'
    throw new Error(`Conversion failed: ${errorMessage}`)
  }
}