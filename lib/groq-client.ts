import OpenAI from "openai"

// Cấu hình mô hình và tham số
export const MODEL_CONFIG = {
  // Sử dụng mô hình Llama 4 Scout từ Groq
  modelId: "meta-llama/llama-4-scout-17b-16e-instruct",
  // Fallback models nếu mô hình chính không khả dụng
  fallbackModels: [
    "llama3-70b-8192",
    "llama3-8b-8192"
  ],
  temperature: 0.7,
  maxTokens: 1000,
  timeout: 55000, // 55 giây timeout
  retryAttempts: 3,  // Số lần thử lại khi gặp lỗi
  retryDelay: 1000,  // Thời gian chờ giữa các lần thử lại (ms)
}

// Tạo Groq client
export function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error("GROQ_API_KEY không được cấu hình")
    throw new Error("GROQ_API_KEY không được cấu hình")
  }

  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: apiKey,
    dangerouslyAllowBrowser: false, // Không cho phép chạy trong môi trường browser
  });
}

// Thêm export createClient như một alias cho createGroqClient
export const createClient = createGroqClient

// Hàm kiểm tra kết nối với Groq
export async function testGroqConnection(): Promise<{ success: boolean; message: string; modelTested?: string }> {
  // Thử với mô hình chính trước
  let modelToTest = MODEL_CONFIG.modelId;
  let allModelsFailed = true;
  let lastError: Error | null = null;
  
  // Thử mô hình chính và các mô hình dự phòng
  const allModels = [MODEL_CONFIG.modelId, ...MODEL_CONFIG.fallbackModels];
  
  for (const model of allModels) {
    try {
      console.log(`Testing connection with model: ${model}`)
      const groq = createGroqClient()
      
      // Gửi một yêu cầu đơn giản để kiểm tra kết nối
      const response = await groq.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10,
        temperature: 0,
      });
      
      // Nếu không có lỗi, kết nối thành công
      console.log(`Connection test successful with model: ${model}`)
      return {
        success: true,
        message: `Kết nối thành công với mô hình ${model}`,
        modelTested: model
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Connection test failed with model: ${model}`, lastError)
      // Tiếp tục thử mô hình tiếp theo
    }
  }
  
  // Nếu tất cả các mô hình đều thất bại
  return {
    success: false,
    message: lastError ? `Không thể kết nối với Groq: ${lastError.message}` : "Không thể kết nối với Groq"
  }
}

// Hàm trợ giúp để gửi tin nhắn đến Groq với streaming
export async function sendChatCompletion(messages: any[], systemPrompt?: string) {
  // Thêm system prompt nếu có
  const formattedMessages = systemPrompt 
    ? [{ role: "system", content: systemPrompt }, ...messages] 
    : messages;

  console.log(
    "Sending request to Groq with messages:",
    JSON.stringify(
      formattedMessages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.substring(0, 50) + "..." : "[Complex content]",
      })),
    ),
  );

  const groq = createGroqClient();
  
  // Kiểm tra kết nối và xác định mô hình khả dụng
  let modelToUse = MODEL_CONFIG.modelId;
  try {
    const connectionTest = await testGroqConnection();
    if (connectionTest.success && connectionTest.modelTested) {
      modelToUse = connectionTest.modelTested;
    }
  } catch (error) {
    console.warn("Could not determine best model, using default", error);
  }

  try {
    const response = await groq.chat.completions.create({
      model: modelToUse,
      messages: formattedMessages,
      temperature: MODEL_CONFIG.temperature,
      max_tokens: MODEL_CONFIG.maxTokens,
      stream: true,
    });
    
    return response;
  } catch (error) {
    console.error("Error in sendChatCompletion:", error);
    
    // Nếu lỗi là do mô hình, thử với các mô hình dự phòng
    if (error instanceof Error && error.message.includes("model") && modelToUse === MODEL_CONFIG.modelId) {
      for (const fallbackModel of MODEL_CONFIG.fallbackModels) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`);
          const fallbackResponse = await groq.chat.completions.create({
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
  const formattedMessages = systemPrompt 
    ? [{ role: "system", content: systemPrompt }, ...messages] 
    : messages;

  console.log("Sending non-streaming request to Groq");

  const groq = createGroqClient();
  
  // Kiểm tra kết nối và xác định mô hình khả dụng
  let modelToUse = MODEL_CONFIG.modelId;
  try {
    const connectionTest = await testGroqConnection();
    if (connectionTest.success && connectionTest.modelTested) {
      modelToUse = connectionTest.modelTested;
    }
  } catch (error) {
    console.warn("Could not determine best model, using default", error);
  }
  
  try {
    const completion = await groq.chat.completions.create({
      model: modelToUse,
      messages: formattedMessages,
      temperature: MODEL_CONFIG.temperature,
      max_tokens: MODEL_CONFIG.maxTokens,
      stream: false,
    });
    
    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error("Error in sendChatCompletionNonStreaming:", error);
    
    // Nếu lỗi là do mô hình, thử với các mô hình dự phòng
    if (error instanceof Error && error.message.includes("model") && modelToUse === MODEL_CONFIG.modelId) {
      for (const fallbackModel of MODEL_CONFIG.fallbackModels) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`);
          const fallbackCompletion = await groq.chat.completions.create({
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
