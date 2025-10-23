"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitProvider,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { type Chain } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  injectedWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  metaMaskWallet,
  trustWallet,
  ledgerWallet,
  braveWallet,
  safeWallet,
  phantomWallet,
  zerionWallet,
  rabbyWallet,
  argentWallet,
  imTokenWallet,
  okxWallet,
  tahoWallet,
  xdefiWallet,
  uniswapWallet,
  frameWallet,
  coreWallet,
  bitgetWallet,
  roninWallet,
  mewWallet,
  oneKeyWallet,
  coin98Wallet,
  tokenaryWallet,
  frontierWallet,
  bitskiWallet,
  talismanWallet,
  enkryptWallet,
  bifrostWallet,
  omniWallet,
  tokenPocketWallet,
  clvWallet,
  foxWallet,
  kaikasWallet,
  nestWallet,
  bybitWallet,
  binanceWallet,
  krakenWallet,
  gateWallet,
  bitverseWallet,
  subWallet,
  bloomWallet,
  desigWallet,
  compassWallet,
} from '@rainbow-me/rainbowkit/wallets';

// Define Hedera Mainnet chain
const hederaMainnet: Chain = {
  id: 295,
  name: 'Hedera Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'HBAR',
    symbol: 'HBAR',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.hashio.io/api'],
    },
  },
  blockExplorers: {
    default: { name: 'HashScan', url: 'https://hashscan.io/mainnet' },
  },
};

// Create config only on client side to avoid SSR issues
const createWagmiConfig = () => {
  const connectors = connectorsForWallets(
    [
      {
        groupName: "Popular",
        wallets: [
          metaMaskWallet,
          walletConnectWallet,
          coinbaseWallet,
          rainbowWallet,
          trustWallet,
          injectedWallet,
        ],
      },
      {
        groupName: "Hardware",
        wallets: [ledgerWallet, safeWallet],
      },
      {
        groupName: "Browser Extensions",
        wallets: [
          braveWallet,
          rabbyWallet,
          zerionWallet,
          frameWallet,
          enkryptWallet,
          talismanWallet,
          xdefiWallet,
        ],
      },
      {
        groupName: "Mobile & Multi-Platform",
        wallets: [
          trustWallet,
          argentWallet,
          imTokenWallet,
          tokenPocketWallet,
          coin98Wallet,
          oneKeyWallet,
          mewWallet,
        ],
      },
      {
        groupName: "Exchange Wallets",
        wallets: [
          okxWallet,
          binanceWallet,
          bybitWallet,
          krakenWallet,
          gateWallet,
          bitgetWallet,
        ],
      },
      {
        groupName: "DeFi & Specialized",
        wallets: [
          uniswapWallet,
          phantomWallet,
          tahoWallet,
          coreWallet,
          roninWallet,
          frontierWallet,
          bitskiWallet,
          bifrostWallet,
          omniWallet,
          clvWallet,
          foxWallet,
          nestWallet,
          bitverseWallet,
          subWallet,
          bloomWallet,
          desigWallet,
        ],
      },

      {
        groupName: "Other",
        wallets: [kaikasWallet, tokenaryWallet, compassWallet],
      },
    ],
    {
      appName: "Atlas",
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "default",
    }
  );

  return createConfig({
    connectors,
    chains: [hederaMainnet],
    transports: {
      [hederaMainnet.id]: http(),
    },
    ssr: false, // Changed to false since we're creating this client-side only
  });
};

// Create a minimal fallback config for when the main config isn't ready
const createFallbackConfig = () => {
  return createConfig({
    connectors: [],
    chains: [hederaMainnet],
    transports: {
      [hederaMainnet.id]: http(),
    },
    ssr: false,
  });
};

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    console.log("🚀 WalletProvider mounting...");
    setMounted(true);
    try {
      const newConfig = createWagmiConfig();
      console.log("✅ WalletProvider config created:", newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error("❌ WalletProvider config creation failed:", error);
      // Use fallback config if main config fails
      setConfig(createFallbackConfig());
    }
  }, []);

  console.log("🔍 WalletProvider state:", { mounted, hasConfig: !!config });

  // Always provide a config, use fallback if main config isn't ready
  const activeConfig = config || createFallbackConfig();

  if (!mounted) {
    console.log("⏳ WalletProvider not mounted, using fallback config");
  } else if (config) {
    console.log("✅ WalletProvider ready with full wallet functionality");
  } else {
    console.log("⚠️ WalletProvider using fallback config");
  }

  return (
    <WagmiProvider config={activeConfig}>
      <QueryClientProvider client={queryClient}>
        {mounted && config ? (
          <RainbowKitProvider>{children}</RainbowKitProvider>
        ) : (
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}