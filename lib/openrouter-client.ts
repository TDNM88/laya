import OpenAI from "openai"

// Cấu hình mô hình và tham số
export const MODEL_CONFIG = {
  // Sử dụng mô hình miễn phí từ OpenRouter
  modelId: "meta-llama/llama-4-scout:free",
  // Fallback models nếu mô hình chính không khả dụng
  fallbackModels: [
    "anthropic/claude-3-haiku:free",
    "google/gemini-1.5-pro:free",
    "mistralai/mistral-large:free"
  ],
  temperature: 0.7,
  maxTokens: 1000,
  timeout: 55000, // 55 giây timeout
  retryAttempts: 3,  // Số lần thử lại khi gặp lỗi
  retryDelay: 1000,  // Thời gian chờ giữa các lần thử lại (ms)
}

// Cập nhật hàm createOpenRouterClient với xử lý lỗi tốt hơn
export function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY không được cấu hình")
    throw new Error("OPENROUTER_API_KEY không được cấu hình")
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    dangerouslyAllowBrowser: false, // Không cho phép chạy trong môi trường browser
    defaultHeaders: {
      "HTTP-Referer": "https://laya.company",
      "X-Title": "Laya Assistant",
    },
    defaultQuery: {
      timeout: MODEL_CONFIG.timeout,
    },
    maxRetries: MODEL_CONFIG.retryAttempts,
  })
}

// Thêm export createClient như một alias cho createOpenRouterClient
export const createClient = createOpenRouterClient

// Hàm trợ giúp để gửi tin nhắn đến OpenRouter với streaming
export async function sendChatCompletion(messages: any[], systemPrompt?: string) {
  // Thêm system prompt nếu có
  const formattedMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages

  console.log(
    "Sending request to OpenRouter with messages:",
    JSON.stringify(
      formattedMessages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.substring(0, 50) + "..." : "[Complex content]",
      })),
    ),
  )

  const openai = createOpenRouterClient()
  
  // Kiểm tra kết nối và xác định mô hình khả dụng
  let modelToUse = MODEL_CONFIG.modelId;
  try {
    const connectionTest = await testOpenRouterConnection();
    if (connectionTest.success && connectionTest.modelTested) {
      modelToUse = connectionTest.modelTested;
    }
  } catch (error) {
    console.warn("Could not determine best model, using default", error);
  }

  // Thiết lập timeout cho yêu cầu
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_CONFIG.timeout);

  try {
    const response = await openai.chat.completions.create({
      model: modelToUse,
      messages: formattedMessages,
      temperature: MODEL_CONFIG.temperature,
      max_tokens: MODEL_CONFIG.maxTokens,
      stream: true,
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error in sendChatCompletion:", error);
    
    // Nếu lỗi là do mô hình, thử với các mô hình dự phòng
    if (error instanceof Error && error.message.includes("model") && modelToUse === MODEL_CONFIG.modelId) {
      for (const fallbackModel of MODEL_CONFIG.fallbackModels) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`);
          const fallbackResponse = await openai.chat.completions.create({
            model: fallbackModel,
            messages: formattedMessages,
            temperature: MODEL_CONFIG.temperature,
            max_tokens: MODEL_CONFIG.maxTokens,
            stream: true,
          });
          return fallbackResponse;
        } catch (fallbackError) {
          console.error(`Error with fallback model ${fallbackModel}:`, fallbackError);
        }
      }
    }
    
    throw error;
  }
}

// Hàm trợ giúp để gửi tin nhắn không streaming
export async function sendChatCompletionNonStreaming(messages: any[], systemPrompt?: string) {
  // Thêm system prompt nếu có
  const formattedMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages

  console.log("Sending non-streaming request to OpenRouter")

  const openai = createOpenRouterClient()
  
  // Kiểm tra kết nối và xác định mô hình khả dụng
  let modelToUse = MODEL_CONFIG.modelId;
  try {
    const connectionTest = await testOpenRouterConnection();
    if (connectionTest.success && connectionTest.modelTested) {
      modelToUse = connectionTest.modelTested;
    }
  } catch (error) {
    console.warn("Could not determine best model, using default", error);
  }
  
  // Thiết lập timeout cho yêu cầu
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_CONFIG.timeout);

  try {
    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: formattedMessages,
      temperature: MODEL_CONFIG.temperature,
      max_tokens: MODEL_CONFIG.maxTokens,
      stream: false,
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    return completion.choices[0].message.content || ""
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error in sendChatCompletionNonStreaming:", error);
    
    // Nếu lỗi là do mô hình, thử với các mô hình dự phòng
    if (error instanceof Error && error.message.includes("model") && modelToUse === MODEL_CONFIG.modelId) {
      for (const fallbackModel of MODEL_CONFIG.fallbackModels) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`);
          const fallbackCompletion = await openai.chat.completions.create({
            model: fallbackModel,
            messages: formattedMessages,
            temperature: MODEL_CONFIG.temperature,
            max_tokens: MODEL_CONFIG.maxTokens,
            stream: false,
          });
          return fallbackCompletion.choices[0].message.content || "";
        } catch (fallbackError) {
          console.error(`Error with fallback model ${fallbackModel}:`, fallbackError);
        }
      }
    }
    
    // Nếu tất cả đều thất bại, trả về thông báo lỗi
    throw error;
  }
}

// Hàm kiểm tra kết nối với OpenRouter
export async function testOpenRouterConnection(): Promise<{ success: boolean; message: string; modelTested?: string }> {
  // Thử với mô hình chính trước
  let modelToTest = MODEL_CONFIG.modelId;
  let allModelsFailed = true;
  let lastError: Error | null = null;
  
  // Thử mô hình chính và các mô hình dự phòng
  const allModels = [MODEL_CONFIG.modelId, ...MODEL_CONFIG.fallbackModels];
  
  for (const model of allModels) {
    try {
      console.log(`Testing connection with model: ${model}`)
      const openai = createOpenRouterClient()
      
      // Thiết lập timeout cho yêu cầu kiểm tra
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout cho kiểm tra
      
      // Gửi một yêu cầu đơn giản để kiểm tra kết nối
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
        stream: false,
      }, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      // Nếu thành công, cập nhật mô hình mặc định nếu khác với mô hình chính
      if (model !== MODEL_CONFIG.modelId) {
        console.log(`Primary model ${MODEL_CONFIG.modelId} unavailable, using ${model} instead`);
      }
      
      return {
        success: true,
        message: `Kết nối thành công với OpenRouter. Mô hình ${model} hoạt động bình thường.`,
        modelTested: model
      };
    } catch (error) {
      console.error(`Error testing OpenRouter connection with model ${model}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  // Nếu tất cả các mô hình đều thất bại
  let errorMessage = "Không thể kết nối đến OpenRouter với bất kỳ mô hình nào.";
  
  if (lastError) {
    if (lastError.message.includes("API key")) {
      errorMessage = "API key không hợp lệ hoặc đã hết hạn.";
    } else if (lastError.message.includes("rate limit")) {
      errorMessage = "Đã vượt quá giới hạn tốc độ API. Vui lòng thử lại sau.";
    } else if (lastError.name === "AbortError" || lastError.message.includes("timeout")) {
      errorMessage = "Yêu cầu kiểm tra đã hết thời gian chờ. Máy chủ có thể đang quá tải.";
    }
  }
  
  return {
    success: false,
    message: errorMessage,
  };
}
