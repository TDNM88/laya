"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react"

interface ConnectionStatus {
  openRouter: {
    status: "online" | "offline"
    message: string
  }
  knowledgeBase: {
    status: "available" | "unavailable"
    message: string
  }
  timestamp: string
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/status")

      if (!response.ok) {
        throw new Error(`Lỗi khi kiểm tra trạng thái: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error("Error checking status:", error)
      setError(error instanceof Error ? error.message : "Không thể kiểm tra trạng thái hệ thống")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  if (loading && !status) {
    return (
      <Alert className="mb-4 bg-gray-50">
        <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
        <AlertTitle>Đang kiểm tra trạng thái hệ thống</AlertTitle>
        <AlertDescription>Vui lòng đợi trong giây lát...</AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Lỗi khi kiểm tra trạng thái</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-2" onClick={checkStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Thử lại
        </Button>
      </Alert>
    )
  }

  if (!status) {
    return null
  }

  return (
    <Alert className={`mb-4 ${status.openRouter.status === "online" ? "bg-green-50" : "bg-yellow-50"}`}>
      {status.openRouter.status === "online" ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-yellow-500" />
      )}
      <AlertTitle>Trạng thái hệ thống: {status.openRouter.status === "online" ? "Hoạt động" : "Có vấn đề"}</AlertTitle>
      <AlertDescription>
        <div className="text-sm">
          <p>OpenRouter: {status.openRouter.message}</p>
          <p>Cơ sở kiến thức: {status.knowledgeBase.message}</p>
          <p className="text-xs text-gray-500 mt-1">
            Cập nhật lúc: {new Date(status.timestamp).toLocaleString("vi-VN")}
          </p>
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={checkStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </AlertDescription>
    </Alert>
  )
}
