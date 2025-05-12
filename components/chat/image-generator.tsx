"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertCircle, ImageIcon, Loader2, RefreshCw, Send, Sparkles, X, Sliders } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useChatStore } from "@/lib/chat-store"
import { v4 as uuidv4 } from "uuid"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [width, setWidth] = useState(512) // Cập nhật kích thước mặc định thành 512
  const [height, setHeight] = useState(512) // Cập nhật kích thước mặc định thành 512
  const [showAdvanced, setShowAdvanced] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  
  const { sendMessage } = useChatStore()

  // Danh sách các tỷ lệ kích thước phổ biến (cập nhật cho kích thước 512x512)
  const aspectRatios = [
    { name: "1:1", width: 512, height: 512 },
    { name: "3:4", width: 384, height: 512 },
    { name: "4:3", width: 512, height: 384 },
    { name: "9:16", width: 288, height: 512 },
    { name: "16:9", width: 512, height: 288 },
  ]

  const handleAspectRatioChange = (width: number, height: number) => {
    setWidth(width)
    setHeight(height)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Vui lòng nhập mô tả cho hình ảnh bạn muốn tạo")
      return
    }

    setError(null)
    setIsGenerating(true)
    setGeneratedImage(null)

    try {
      // Hiển thị thông báo về thời gian chờ
      console.log("Tạo ảnh với TensorArt có thể mất từ 30 giây đến 2 phút...")
      
      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: prompt,
          width: width,
          height: height 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra khi tạo ảnh")
      }

      setGeneratedImage(data.imageUrl)
    } catch (err) {
      console.error("Error generating image:", err)
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi tạo ảnh")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendImage = async () => {
    if (!generatedImage) return

    try {
      // Tạo một attachment tùy chỉnh cho ảnh đã tạo
      // Lưu ý: Chúng ta không cần chuyển đổi thành File vì đã cập nhật store để chấp nhận cả any[]
      const attachment = {
        id: uuidv4(),
        type: "image" as const,
        url: generatedImage,
        name: `AI Image: ${prompt.substring(0, 30)}${prompt.length > 30 ? "..." : ""}`,
        prompt: prompt, // Lưu prompt vào metadata
      }

      // Gửi tin nhắn với ảnh đã tạo
      await sendMessage(`Đã tạo ảnh từ mô tả: "${prompt}"`, [attachment])
      
      // Đóng dialog và reset trạng thái
      setIsDialogOpen(false)
      setPrompt("")
      setGeneratedImage(null)
    } catch (error) {
      console.error("Error sending message with generated image:", error)
      setError("Không thể gửi ảnh đã tạo. Vui lòng thử lại.")
    }
  }

  const handleReset = () => {
    setPrompt("")
    setGeneratedImage(null)
    setError(null)
    
    // Focus vào input prompt
    setTimeout(() => {
      if (promptRef.current) {
        promptRef.current.focus()
      }
    }, 0)
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full hover:bg-primary/10 dark:hover:bg-primary/20"
          title="Tạo ảnh bằng AI"
        >
          <Sparkles className="h-5 w-5 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <span>Tạo ảnh bằng AI</span>
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Textarea
              ref={promptRef}
              placeholder="Mô tả chi tiết hình ảnh bạn muốn tạo..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isGenerating}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mô tả càng chi tiết, hình ảnh càng chính xác. Ví dụ: "Một khu vườn Đông y với các loại thảo mộc, ánh nắng chiều, phong cách tranh vẽ màu nước"
            </p>
          </div>
          
          {/* Tỷ lệ khung hình */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Tỷ lệ khung hình</Label>
            <div className="flex flex-wrap gap-2">
              {aspectRatios.map((ratio) => (
                <Button 
                  key={ratio.name}
                  type="button"
                  variant={width === ratio.width && height === ratio.height ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleAspectRatioChange(ratio.width, ratio.height)}
                  className="flex-1 min-w-[60px]"
                  disabled={isGenerating}
                >
                  {ratio.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Kích thước ảnh: {width} x {height} pixel
            </p>
          </div>

          {generatedImage && (
            <div className="relative rounded-md overflow-hidden border">
              <img 
                src={generatedImage} 
                alt={prompt} 
                className="w-full h-auto object-contain"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  onClick={handleReset}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline" disabled={isGenerating}>
              <X className="h-4 w-4 mr-2" />
              Hủy
            </Button>
          </DialogClose>
          <div className="flex gap-2">
            {!generatedImage ? (
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Tạo ảnh
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleSendImage}>
                <Send className="h-4 w-4 mr-2" />
                Gửi ảnh
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
