'use client'

import { useState } from 'react'
import { useEvmToHederaAccount, convertEvmAddressToHederaAccountId } from '@/hooks/use-evm-to-hedera-account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

/**
 * Example component demonstrating how to use the EVM to Hedera account conversion hook
 */
export function EvmToHederaConverter() {
  const [inputAddress, setInputAddress] = useState('')
  const [copied, setCopied] = useState(false)
  const { result, convertEvmToHedera, convertConnectedWallet, reset, connectedAddress } = useEvmToHederaAccount()

  const handleConvert = async () => {
    if (!inputAddress.trim()) return
    await convertEvmToHedera(inputAddress.trim())
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleReset = () => {
    reset()
    setInputAddress('')
    setCopied(false)
  }

  // Example of using the standalone utility function
  const handleDirectConversion = async () => {
    if (!inputAddress.trim()) return
    
    try {
      const hederaAccountId = await convertEvmAddressToHederaAccountId(inputAddress.trim())
      console.log('Direct conversion result:', hederaAccountId)
    } catch (error) {
      console.error('Direct conversion error:', error)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>EVM to Hedera Account Converter</CardTitle>
        <CardDescription>
          Convert EVM wallet addresses to Hedera account IDs using the Hedera SDK
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Connection Status */}
        {result.isConnected && connectedAddress && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div><strong>Connected Wallet:</strong> {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}</div>
                <div className="text-xs text-muted-foreground">
                  Your wallet address is automatically converted to Hedera account ID
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Input Section */}
        <div className="space-y-2">
          <label htmlFor="evm-address" className="text-sm font-medium">
            EVM Address {result.isConnected ? '(Optional - Connected wallet auto-converts)' : ''}
          </label>
          <div className="flex gap-2">
            <Input
              id="evm-address"
              placeholder={connectedAddress || "0x1234567890123456789012345678901234567890"}
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleConvert}
              disabled={result.isLoading || (!inputAddress.trim() && !connectedAddress)}
            >
              {result.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Convert'
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        {result.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}

        {result.isValid && result.hederaAccountId && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <strong>EVM Address:</strong> {result.evmAddress}
                </div>
                <div className="flex items-center gap-2">
                  <strong>Hedera Account ID:</strong> 
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    {result.hederaAccountId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(result.hederaAccountId!)}
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          {result.isConnected && connectedAddress && (
            <Button variant="outline" onClick={convertConnectedWallet}>
              Convert Connected Wallet
            </Button>
          )}
          <Button variant="outline" onClick={handleDirectConversion}>
            Test Direct Conversion
          </Button>
        </div>

        {/* Usage Example */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Usage Examples:</h4>
          <div className="space-y-4">
            <div>
              <h5 className="text-sm font-medium mb-1">Auto-convert connected wallet:</h5>
              <pre className="text-xs overflow-x-auto bg-background p-2 rounded">
{`import { useEvmToHederaAccount } from '@/hooks/use-evm-to-hedera-account'

function MyComponent() {
  const { result, connectedAddress } = useEvmToHederaAccount()
  
  // Automatically converts when wallet connects!
  return (
    <div>
      {result.isConnected && result.isValid && (
        <p>Your Hedera Account: {result.hederaAccountId}</p>
      )}
    </div>
  )
}`}
              </pre>
            </div>
            
            <div>
              <h5 className="text-sm font-medium mb-1">Manual conversion:</h5>
              <pre className="text-xs overflow-x-auto bg-background p-2 rounded">
{`const { result, convertEvmToHedera } = useEvmToHederaAccount()

// Convert any EVM address
await convertEvmToHedera('0x1234...7890')

// Convert connected wallet manually
await convertConnectedWallet()`}
              </pre>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}