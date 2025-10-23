"use client"

import { Button } from "@/components/ui/button"
import { Dithering } from "@paper-design/shaders-react"
import Link from "next/link"
import { AtlasFooter } from "@/components/atlas-footer"

export function AtlasLanding() {
  return (
    <div className="relative w-full min-h-screen flex flex-col">
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

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation */}
        <nav className="border-b border-gray-600/30 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                <span className="text-black font-bold text-sm">A</span>
              </div>
              <span className="text-white font-bold text-lg">ATLAS</span>
            </div>
            <Link href="/chat">
              <Button className="bg-white text-black hover:bg-gray-200 rounded">Launch Chat</Button>
            </Link>
          </div>
        </nav>

        {/* Main Content - Scrollable */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto text-center space-y-8 w-full">
            {/* Main Heading */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                AI-Powered Hedera Portfolio Intelligence
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
                Your intelligent guardian for Hedera network investments. Real-time monitoring, AI-driven insights, and
                proactive risk management.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/chat">
                <Button className="bg-white text-black hover:bg-gray-200 rounded px-8 py-6 text-base font-semibold w-full sm:w-auto">
                  Start Monitoring
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-900 rounded px-8 py-6 text-base font-semibold w-full sm:w-auto bg-transparent"
              >
                View Demo
              </Button>
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-900 rounded px-8 py-6 text-base font-semibold w-full sm:w-auto bg-transparent"
              >
                Connect Wallet
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12">
              {/* Portfolio Intelligence */}
              <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg p-6 text-left hover:border-gray-600/60 transition-colors">
                <div className="text-2xl mb-3">🔍</div>
                <h3 className="text-lg font-semibold text-white mb-2">Portfolio Intelligence Dashboard</h3>
                <p className="text-gray-400 text-sm">
                  Multi-account overview with real-time HBAR and token balances, risk scoring, and performance charts.
                </p>
              </div>

              {/* AI Analytics */}
              <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg p-6 text-left hover:border-gray-600/60 transition-colors">
                <div className="text-2xl mb-3">📊</div>
                <h3 className="text-lg font-semibold text-white mb-2">AI Analytics Center</h3>
                <p className="text-gray-400 text-sm">
                  Natural language queries, AI-generated insights, market sentiment analysis, and predictive models.
                </p>
              </div>

              {/* Alert System */}
              <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg p-6 text-left hover:border-gray-600/60 transition-colors">
                <div className="text-2xl mb-3">🚨</div>
                <h3 className="text-lg font-semibold text-white mb-2">Alert & Monitoring System</h3>
                <p className="text-gray-400 text-sm">
                  Real-time notifications, custom alert rules, curated news feed, and proactive risk warnings.
                </p>
              </div>

              {/* Visualization */}
              <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg p-6 text-left hover:border-gray-600/60 transition-colors">
                <div className="text-2xl mb-3">📈</div>
                <h3 className="text-lg font-semibold text-white mb-2">Visualization Suite</h3>
                <p className="text-gray-400 text-sm">
                  Interactive charts, network graphs, heat maps, and comparison tools for comprehensive analysis.
                </p>
              </div>
            </div>

            {/* Technical Features */}
            <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg p-8 mt-12 text-left">
              <h3 className="text-xl font-semibold text-white mb-6">🔄 A2A Communication Visualization</h3>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-300">Chat Agent: Processing user query...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span className="text-gray-300">Portfolio Agent: Calculating risk score...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-300">LLM Agent: Generating insights...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-300">Scanner Agent: Monitoring 5 accounts...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span className="text-gray-300">XTrend Agent: Analyzing sentiment...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-300">Graph Agent: Updating charts...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-300">Wallet Agent: Querying balances...</span>
                </div>
              </div>
            </div>

            {/* Hedera Integration */}
            <div className="bg-black/40 backdrop-blur-sm border border-gray-600/30 rounded-lg p-6 mt-6 mb-12">
              <h3 className="text-lg font-semibold text-white mb-4">🌐 Hedera Integration Status</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">Mainnet</div>
                  <p className="text-gray-400 text-sm">Network Status</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">5</div>
                  <p className="text-gray-400 text-sm">Connected Accounts</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">Live</div>
                  <p className="text-gray-400 text-sm">Transaction Monitoring</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <AtlasFooter />
      </div>
    </div>
  )
}
