import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Hàm trợ giúp để thử lại các yêu cầu fetch với backoff strategy
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000,
): Promise<Response> {
  let lastError: Error | null = null
  let retryDelay = initialDelay

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1}/${maxRetries} to fetch from ${url}`)
      const response = await fetch(url, options)
      return response
    } catch (error) {
      lastError = error as Error
      console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error)

      // Kiểm tra xem có nên thử lại không dựa trên loại lỗi
      if (
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("network") ||
          error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("Network request failed"))
      ) {
        console.log(`Waiting ${retryDelay}ms before retrying...`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        retryDelay = Math.min(retryDelay * 2, maxDelay) // Exponential backoff
        continue
      }

      // Nếu không phải lỗi tạm thời, ném lỗi ngay lập tức
      throw error
    }
  }

  // Nếu đã thử hết số lần mà vẫn thất bại
  throw lastError || new Error("Không thể kết nối sau nhiều lần thử")
}
