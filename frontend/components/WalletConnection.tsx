"use client";

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Wallet, AlertTriangle } from "lucide-react";

interface WalletConnectionProps {
  onConnected?: () => void;
}

export function WalletConnection({ onConnected }: WalletConnectionProps) {
  const { address, isConnected, isConnecting, isDisconnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });
  const { connect, connectors, error } = useConnect();
  const { disconnect } = useDisconnect();

  // Debug wallet state
  React.useEffect(() => {
    console.log("🔍 WalletConnection Debug - Wallet State:", {
      isConnected,
      isConnecting,
      isDisconnected,
      address,
      connectors: connectors.map((c) => ({
        id: c.id,
        name: c.name,
        ready: c.ready,
        type: c.type,
      })),
      error: error?.message,
      totalConnectors: connectors.length,
      readyConnectors: connectors.filter((c) => c.ready).length,
    });

    // Log each connector details
    connectors.forEach((connector, index) => {
      console.log(`🔌 Connector ${index + 1}:`, {
        id: connector.id,
        name: connector.name,
        ready: connector.ready,
        type: connector.type,
        icon: connector.icon,
      });
    });
  }, [isConnected, isConnecting, isDisconnected, address, connectors, error]);

  // Handle successful connection
  React.useEffect(() => {
    if (isConnected && onConnected) {
      onConnected();
    }
  }, [isConnected, onConnected]);

  if (isConnected && address) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <CardTitle className="text-xl font-bold">Wallet Connected</CardTitle>
          <CardDescription>
            Your wallet is successfully connected to Atlas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">
                Address:
              </span>
              <span className="text-sm font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>
            {balance && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Balance:
                </span>
                <span className="text-sm font-medium">
                  {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                </span>
              </div>
            )}
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Wallet connected successfully! You can now use all Atlas features.
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <div
              onClick={() =>
                console.log("🖱️ Connected state ConnectButton wrapper clicked!")
              }
            >
              <ConnectButton />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-2">
          <Wallet className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">Connect Your Wallet</CardTitle>
        <CardDescription>
          Connect your Ethereum wallet to start using Atlas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div onClick={() => console.log("🖱️ ConnectButton wrapper clicked!")}>
            <ConnectButton />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connection Error: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {isConnecting && (
          <Alert>
            <AlertDescription>
              Connecting to wallet... Please check your wallet extension.
            </AlertDescription>
          </Alert>
        )}

        {!error && !isConnecting && (
          <Alert>
            <AlertDescription>
              Atlas supports multiple wallets including MetaMask, Rainbow,
              Coinbase Wallet, and more. Choose your preferred wallet from the
              options above.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Available connectors: {connectors.filter((c) => c.ready).length}{" "}
          ready, {connectors.length} total
        </div>
      </CardContent>
    </Card>
  );
}

export default WalletConnection;
