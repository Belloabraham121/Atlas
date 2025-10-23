"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dithering } from "@paper-design/shaders-react"


interface Chart {
  id: string
  title: string
  type: "line" | "bar" | "area"
  data: Array<{ name: string; value: number }>
}

export function ChartBuilder() {
  const [charts, setCharts] = useState<Chart[]>([
    {
      id: "1",
      title: "Portfolio Performance",
      type: "line",
      data: [
        { name: "Jan", value: 4000 },
        { name: "Feb", value: 3000 },
        { name: "Mar", value: 2000 },
        { name: "Apr", value: 2780 },
        { name: "May", value: 1890 },
        { name: "Jun", value: 2390 },
      ],
    },
  ])

  const [selectedChartId, setSelectedChartId] = useState<string | null>(charts[0]?.id || null)

  const addNewChart = () => {
    const newChart: Chart = {
      id: Date.now().toString(),
      title: "New Chart",
      type: "line",
      data: [
        { name: "Data 1", value: 100 },
        { name: "Data 2", value: 200 },
        { name: "Data 3", value: 150 },
      ],
    }
    setCharts([...charts, newChart])
    setSelectedChartId(newChart.id)
  }

  const updateChart = (id: string, updates: Partial<Chart>) => {
    setCharts(charts.map((chart) => (chart.id === id ? { ...chart, ...updates } : chart)))
  }

  const deleteChart = (id: string) => {
    const filtered = charts.filter((chart) => chart.id !== id)
    setCharts(filtered)
    if (selectedChartId === id) {
      setSelectedChartId(filtered[0]?.id || null)
    }
  }

  const selectedChart = charts.find((chart) => chart.id === selectedChartId)

  return (
    <div className="relative w-full min-h-screen bg-background">
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

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Chart Builder</h1>
          <p className="text-gray-400">Create and manage your portfolio visualization charts</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chart List Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-black/40 border-gray-600/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg">Charts</CardTitle>
                <CardDescription className="text-gray-400">Manage your charts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {charts.map((chart) => (
                  <div
                    key={chart.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedChartId === chart.id
                        ? "bg-white/10 border-white/50"
                        : "bg-black/30 border-gray-600/30 hover:border-gray-600/60"
                    }`}
                    onClick={() => setSelectedChartId(chart.id)}
                  >
                    <p className="text-white text-sm font-medium truncate">{chart.title}</p>
                    <p className="text-gray-400 text-xs">{chart.type}</p>
                  </div>
                ))}

                <Button onClick={addNewChart} className="w-full bg-white text-black hover:bg-gray-200 rounded mt-4">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Chart
                </Button>
              </CardContent>
            </Card>


          </div>

          {/* Chart Editor */}
          <div className="lg:col-span-3">
            {selectedChart ? (
              <Card className="bg-black/40 border-gray-600/30 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={selectedChart.title}
                        onChange={(e) => updateChart(selectedChart.id, { title: e.target.value })}
                        className="text-2xl font-bold text-white bg-transparent border-b border-gray-600/30 focus:border-white outline-none w-full mb-2"
                      />
                      <p className="text-gray-400 text-sm">Edit your chart details</p>
                    </div>
                    <Button
                      onClick={() => deleteChart(selectedChart.id)}
                      variant="outline"
                      className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Chart Type Selection */}
                  <div>
                    <label className="text-white text-sm font-medium mb-3 block">Chart Type</label>
                    <div className="flex gap-3">
                      {(["line", "bar", "area"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => updateChart(selectedChart.id, { type })}
                          className={`px-4 py-2 rounded capitalize transition-all ${
                            selectedChart.type === type
                              ? "bg-white text-black"
                              : "bg-black/30 border border-gray-600/30 text-gray-300 hover:border-gray-600/60"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Editor */}
                  <div>
                    <label className="text-white text-sm font-medium mb-3 block">Data Points</label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedChart.data.map((point, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={point.name}
                            onChange={(e) => {
                              const newData = [...selectedChart.data]
                              newData[index].name = e.target.value
                              updateChart(selectedChart.id, { data: newData })
                            }}
                            placeholder="Label"
                            className="flex-1 px-3 py-2 bg-black/50 border border-gray-600/30 text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-white"
                          />
                          <input
                            type="number"
                            value={point.value}
                            onChange={(e) => {
                              const newData = [...selectedChart.data]
                              newData[index].value = Number(e.target.value)
                              updateChart(selectedChart.id, { data: newData })
                            }}
                            placeholder="Value"
                            className="w-24 px-3 py-2 bg-black/50 border border-gray-600/30 text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-white"
                          />
                          <button
                            onClick={() => {
                              const newData = selectedChart.data.filter((_, i) => i !== index)
                              updateChart(selectedChart.id, { data: newData })
                            }}
                            className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => {
                        const newData = [
                          ...selectedChart.data,
                          { name: `Data ${selectedChart.data.length + 1}`, value: 100 },
                        ]
                        updateChart(selectedChart.id, { data: newData })
                      }}
                      variant="outline"
                      className="w-full mt-3 bg-transparent border-gray-600/30 text-gray-300 hover:bg-gray-900"
                    >
                      Add Data Point
                    </Button>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="text-white text-sm font-medium mb-3 block">Preview</label>
                    <div className="bg-black/50 border border-gray-600/30 rounded-lg p-6 h-64 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm mb-2">{selectedChart.type.toUpperCase()} Chart</p>
                        <p className="text-white font-semibold">{selectedChart.title}</p>
                        <p className="text-gray-400 text-xs mt-2">{selectedChart.data.length} data points</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-black/40 border-gray-600/30 backdrop-blur-sm flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-gray-400 mb-4">No charts yet</p>
                  <Button onClick={addNewChart} className="bg-white text-black hover:bg-gray-200 rounded">
                    Create Your First Chart
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
