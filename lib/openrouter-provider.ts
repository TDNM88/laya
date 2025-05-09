import type { AIStreamCallbacksAndOptions } from "ai"

export function OpenRouterProvider(options: {
  apiKey: string
  model: string
  baseURL?: string
}) {
  const baseURL = options.baseURL || "https://openrouter.ai/api/v1"

  // Validate API key
  if (!options.apiKey || options.apiKey.trim() === "") {
    console.error("OpenRouter API key is missing or empty")
  }

  // Helper function to create headers
  const createHeaders = () => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      "HTTP-Referer": "https://laya.company",
      "X-Title": "Laya Company Assistant",
    }
  }

  // Hàm trợ giúp để thử lại các yêu cầu fetch với backoff strategy
  async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`OpenRouter API attempt ${attempt + 1}/${maxRetries}`)

        // Thêm timeout để tránh chờ quá lâu
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 giây timeout cho môi trường sản xuất

        const fetchOptions = {
          ...options,
          signal: controller.signal,
        }

        const response = await fetch(url, fetchOptions)
        clearTimeout(timeoutId)

        console.log(`OpenRouter API attempt ${attempt + 1} succeeded with status ${response.status}`)
        return response
      } catch (error) {
        lastError = error as Error
        console.error(`OpenRouter API attempt ${attempt + 1}/${maxRetries} failed:`, error)

        // Exponential backoff: chờ thời gian tăng dần theo cấp số nhân
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000) // Tối đa 10 giây
        console.log(`Retrying in ${backoffTime}ms...`)
        await new Promise((resolve) => setTimeout(resolve, backoffTime))
      }
    }

    // Nếu đã thử hết số lần mà vẫn thất bại
    throw lastError || new Error("Không thể kết nối đến OpenRouter API sau nhiều lần thử")
  }

  return {
    id: "openrouter",
    generateText: async ({ prompt, system }: { prompt: string; system?: string }) => {
      console.log("Generating text with OpenRouter, API Key present:", !!options.apiKey)

      try {
        // Chuẩn bị dữ liệu yêu cầu
        const requestBody = JSON.stringify({
          model: options.model,
          messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
          temperature: 0.7, // Thêm tham số temperature để kiểm soát độ sáng tạo
          max_tokens: 2000, // Giới hạn độ dài phản hồi
        })

        console.log("OpenRouter request payload size:", requestBody.length, "bytes")

        const response = await fetchWithRetry(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: createHeaders(),
          body: requestBody,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("OpenRouter API error response:", errorText)

          let errorJson
          try {
            errorJson = JSON.parse(errorText)
          } catch (e) {
            // If not JSON, use the text directly
          }

          throw new Error(
            `OpenRouter API error: ${response.status} ${response.statusText}${
              errorJson ? `: ${JSON.stringify(errorJson)}` : `: ${errorText}`
            }`,
          )
        }

        const data = await response.json()
        return { text: data.choices[0]?.message?.content || "" }
      } catch (error) {
        console.error("OpenRouter generateText error:", error)
        throw error
      }
    },
    streamText: async ({
      prompt,
      system,
      callbacks,
    }: {
      prompt: string
      system?: string
      callbacks?: AIStreamCallbacksAndOptions
    }) => {
      console.log("Streaming text with OpenRouter, API Key present:", !!options.apiKey)

      try {
        // Chuẩn bị dữ liệu yêu cầu
        const requestBody = JSON.stringify({
          model: options.model,
          messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
          stream: true,
          temperature: 0.7, // Thêm tham số temperature để kiểm soát độ sáng tạo
          max_tokens: 2000, // Giới hạn độ dài phản hồi
        })

        console.log("OpenRouter stream request payload size:", requestBody.length, "bytes")

        const response = await fetchWithRetry(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: createHeaders(),
          body: requestBody,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("OpenRouter API stream error response:", errorText)

          let errorJson
          try {
            errorJson = JSON.parse(errorText)
          } catch (e) {
            // If not JSON, use the text directly
          }

          throw new Error(
            `OpenRouter API error: ${response.status} ${response.statusText}${
              errorJson ? `: ${JSON.stringify(errorJson)}` : `: ${errorText}`
            }`,
          )
        }

        // Import these dynamically to avoid the error
        const { AIStream, StreamingTextResponse } = await import("ai")
        const stream = AIStream(response, {
          onStart: callbacks?.onStart,
          onToken: callbacks?.onToken,
          onCompletion: callbacks?.onCompletion,
        })

        return {
          textStream: new StreamingTextResponse(stream),
          text: new Promise<string>((resolve) => {
            let text = ""
            const onToken = callbacks?.onToken
            callbacks = {
              ...callbacks,
              onToken: (token) => {
                text += token
                onToken?.(token)
              },
              onCompletion: (completion) => {
                callbacks?.onCompletion?.(completion)
                resolve(completion)
              },
            }
          }),
        }
      } catch (error) {
        console.error("OpenRouter streamText error:", error)
        throw error
      }
    },
  }
}
