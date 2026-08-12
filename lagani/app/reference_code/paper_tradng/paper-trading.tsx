"use client"

import { useState } from "react"
import {
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Search,
  Plus,
  Clock,
  Wallet,
  PieChart,
  LineChart,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"

export default function PaperTrading() {
  const [activeTab, setActiveTab] = useState("portfolio")
  const [timeRange, setTimeRange] = useState("1d")

  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="flex justify-between items-center p-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src="/placeholder.svg?height=40&width=40" alt="User" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" className="rounded-full bg-zinc-100 border-zinc-200">
            <Search className="h-5 w-5 text-zinc-700" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full bg-zinc-100 border-zinc-200">
            <Clock className="h-5 w-5 text-zinc-700" />
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1 px-4 pb-24">
        {/* Virtual Balance Card */}
        <Card className="w-full mb-4 bg-gradient-to-b from-purple-200 to-purple-50 text-black rounded-3xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-zinc-600 text-lg font-medium">Virtual Balance</p>
                <h2 className="text-4xl font-bold mt-1">$100,000.00</h2>
              </div>
              <Button variant="outline" size="sm" className="rounded-full border-zinc-400 text-zinc-700">
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Value Card */}
        <Card className="w-full mb-4 bg-white rounded-3xl border border-zinc-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-medium text-zinc-700">Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex justify-between items-center">
              <h1 className="text-4xl font-bold">$126,482.59</h1>
              <div className="flex items-center text-green-400">
                <ArrowUp className="h-4 w-4 mr-1" />
                <span className="font-medium">2.4%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div>
                <p className="text-zinc-500 text-sm">Invested</p>
                <p className="font-medium">$100,000.00</p>
              </div>
              <div>
                <p className="text-zinc-500 text-sm">Current</p>
                <p className="font-medium">$126,482.59</p>
              </div>
              <div>
                <p className="text-zinc-500 text-sm">Total P/L</p>
                <p className="font-medium text-green-400">+$26,482.59</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart Section */}
        <Card className="w-full mb-4 bg-white rounded-3xl border border-zinc-200">
          <CardContent className="p-4">
            <div className="h-64 w-full relative">
              {/* Chart placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 400 150" className="w-full h-full">
                  <path
                    d="M0,150 L20,145 L40,140 L60,138 L80,130 L100,125 L120,115 L140,110 L160,100 L180,85 L200,75 L220,60 L240,55 L260,65 L280,60 L300,40 L320,35 L340,30 L360,25 L380,20 L400,10"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                  <circle cx="380" cy="20" r="4" fill="#22c55e" />
                  <text x="385" y="20" fontSize="12" fill="#22c55e">
                    +$26,482.59
                  </text>
                </svg>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              {["1d", "1w", "1m", "3m", "1y", "All"].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full ${
                    timeRange === range
                      ? "bg-green-500 hover:bg-green-600 text-black"
                      : "bg-zinc-800 border-none text-zinc-400 hover:text-white"
                  }`}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* P/L Section */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className="bg-white rounded-3xl border border-zinc-200">
            <CardContent className="p-4">
              <p className="text-zinc-600 text-sm">Realized P/L</p>
              <p className="text-2xl font-bold text-green-400">+$12,345.67</p>
              <div className="flex items-center text-green-400 text-sm mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                <span>+18% Today</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 rounded-3xl border-none">
            <CardContent className="p-4">
              <p className="text-zinc-500 text-sm">Unrealized P/L</p>
              <p className="text-2xl font-bold text-green-400">+$14,136.92</p>
              <div className="flex items-center text-red-400 text-sm mt-1">
                <ArrowDown className="h-3 w-3 mr-1" />
                <span>-2.3% Today</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Portfolio and History */}
        <Tabs defaultValue="portfolio" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 bg-zinc-100 rounded-xl mb-4">
            <TabsTrigger
              value="portfolio"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900"
            >
              Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900"
            >
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="mt-0">
            <Card className="bg-white rounded-3xl border border-zinc-200">
              <CardContent className="p-0">
                {["AAPL", "TSLA", "MSFT", "AMZN", "GOOGL"].map((stock, index) => (
                  <div
                    key={stock}
                    className={`flex items-center justify-between p-4 ${index !== 4 ? "border-b border-zinc-100" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        {stock.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{stock}</p>
                        <p className="text-sm text-zinc-500">10 shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$2,450.00</p>
                      <p className={`text-sm ${index % 2 === 0 ? "text-green-400" : "text-red-400"}`}>
                        {index % 2 === 0 ? "+2.4%" : "-1.2%"}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="bg-zinc-900 rounded-3xl border-none">
              <CardContent className="p-0">
                {[
                  { type: "Buy", stock: "AAPL", shares: 5, price: "$182.50", time: "10:32 AM" },
                  { type: "Sell", stock: "TSLA", shares: 2, price: "$242.10", time: "Yesterday" },
                  { type: "Buy", stock: "MSFT", shares: 3, price: "$415.75", time: "Yesterday" },
                  { type: "Buy", stock: "GOOGL", shares: 2, price: "$175.20", time: "Apr 3" },
                  { type: "Sell", stock: "AMZN", shares: 1, price: "$182.35", time: "Apr 2" },
                ].map((transaction, index, arr) => (
                  <div
                    key={`${transaction.stock}-${index}`}
                    className={`flex items-center justify-between p-4 ${
                      index !== arr.length - 1 ? "border-b border-zinc-800" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${
                          transaction.type === "Buy" ? "bg-green-900" : "bg-red-900"
                        } flex items-center justify-center`}
                      >
                        {transaction.type === "Buy" ? "B" : "S"}
                      </div>
                      <div>
                        <p className="font-medium">
                          {transaction.type} {transaction.stock}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {transaction.shares} shares • {transaction.time}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{transaction.price}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ScrollArea>

      {/* Floating Action Button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button className="absolute bottom-24 right-6 h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-black shadow-lg">
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Trade Stocks</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Buy/Sell Toggle */}
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <Button
                variant="ghost"
                className="flex-1 rounded-lg py-2 data-[state=active]:bg-green-500 data-[state=active]:text-black"
                data-state="active"
              >
                Buy
              </Button>
              <Button
                variant="ghost"
                className="flex-1 rounded-lg py-2 data-[state=active]:bg-red-500 data-[state=active]:text-black"
              >
                Sell
              </Button>
            </div>

            {/* Stock Search with Autocomplete */}
            <div className="space-y-2">
              <Label htmlFor="stock-search">Stock Symbol</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  id="stock-search"
                  placeholder="Search for a stock (e.g. AAPL)"
                  className="pl-9 bg-zinc-100 border-zinc-200 rounded-xl text-zinc-900"
                />
              </div>

              {/* Autocomplete Dropdown */}
              <div className="bg-zinc-100 rounded-xl overflow-hidden">
                {["AAPL", "AMZN", "GOOGL"].map((stock) => (
                  <div key={stock} className="flex items-center p-3 hover:bg-zinc-200 cursor-pointer text-zinc-900">
                    <div className="w-8 h-8 rounded-full bg-zinc-300 flex items-center justify-center mr-3 text-zinc-900">
                      {stock.charAt(0)}
                    </div>
                    <span>{stock}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Number of Shares */}
            <div className="space-y-2">
              <Label htmlFor="shares">Number of Shares</Label>
              <Input
                id="shares"
                type="number"
                placeholder="Enter quantity"
                className="bg-zinc-100 border-zinc-200 rounded-xl text-zinc-900"
                min="1"
              />
            </div>

            {/* Order Summary */}
            <div className="bg-zinc-100 p-4 rounded-xl space-y-2 text-zinc-900">
              <div className="flex justify-between">
                <span className="text-zinc-400">Estimated Cost</span>
                <span>$1,825.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Available Balance</span>
                <span>$100,000.00</span>
              </div>
            </div>

            {/* Confirm Button */}
            <Button className="w-full bg-green-500 hover:bg-green-600 text-black rounded-xl py-6">
              Confirm Buy Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-zinc-200 flex items-center justify-around px-6">
        <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto">
          <Wallet className="h-5 w-5" />
          <span className="text-xs">Home</span>
        </Button>
        <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto">
          <LineChart className="h-5 w-5 text-green-500" />
          <span className="text-xs text-green-500">Trade</span>
        </Button>
        <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto">
          <PieChart className="h-5 w-5" />
          <span className="text-xs">Portfolio</span>
        </Button>
        <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto">
          <BarChart3 className="h-5 w-5" />
          <span className="text-xs">Stats</span>
        </Button>
      </div>
    </div>
  )
}

