// Sử dụng Response API tiêu chuẩn của Next.js thay vì thư viện ai
// vì có thể có sự không tương thích giữa phiên bản
import { createClient, testOpenRouterConnection, MODEL_CONFIG } from "@/lib/openrouter-client"
import { searchDocuments } from "@/lib/knowledge"

export const runtime = "nodejs"
export const maxDuration = 60 // Giới hạn tối đa cho gói Hobby của Vercel

export async function POST(req: Request) {
  try {
    console.log("API route handler started")

    // Kiểm tra API key
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY không được cấu hình")
      return new Response(
        JSON.stringify({ error: "API key không được cấu hình. Vui lòng kiểm tra biến môi trường." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }

    // Parse request body
    let messages
    try {
      const body = await req.json()
      messages = body.messages

      if (!messages || !Array.isArray(messages)) {
        console.error("Invalid request format: messages is missing or not an array")
        return new Response(
          JSON.stringify({ error: "Định dạng yêu cầu không hợp lệ. Thiếu trường messages hoặc không phải là mảng." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        )
      }

      console.log(`Received ${messages.length} messages`)
    } catch (error) {
      console.error("Error parsing request body:", error)
      return new Response(JSON.stringify({ error: "Không thể phân tích nội dung yêu cầu" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Lấy tin nhắn cuối cùng
    const lastMessage = messages[messages.length - 1].content
    console.log("Last message:", lastMessage.substring(0, 100) + (lastMessage.length > 100 ? "..." : ""))

    // Tìm kiếm thông tin liên quan từ cơ sở kiến thức
    let relevantDocs: Array<{content: string; source: string; similarity: number}> = []
    try {
      relevantDocs = await searchDocuments(lastMessage)
      console.log(`Found ${relevantDocs.length} relevant documents`)
    } catch (error) {
      console.error("Error searching documents:", error)
      // Tiếp tục xử lý mà không có tài liệu liên quan
    }

    // Tạo context từ các tài liệu liên quan với thông tin nguồn chi tiết hơn
    let context = ""
    if (relevantDocs.length > 0) {
      context = "Thông tin từ cơ sở kiến thức (HÃY SỬ DỤNG THÔNG TIN NÀY ĐỂ TRẢ LỜI):\n\n" + 
        relevantDocs.map((doc, index) => {
          // Tính điểm tương đồng theo thang 100
          const similarityScore = Math.round(doc.similarity * 100);
          return `[TÀI LIỆU ${index + 1} - Nguồn: ${doc.source} - Độ liên quan: ${similarityScore}%]\n${doc.content}`;
        }).join("\n\n")
    }

    // Tạo system prompt với context
    const systemPrompt = `Bạn là trợ lý AI của Laya, một hệ sinh thái trị liệu kết hợp Đông y, công nghệ và tâm trí học.
    
    ${context ? context : "Không tìm thấy thông tin liên quan trong cơ sở kiến thức."}
    
    HƯỚNG DẪN BẮT BUỘC:
    1. Nếu có thông tin từ cơ sở kiến thức, BẮT BUỘC phải sử dụng chính xác thông tin đó để trả lời. KHÔNG ĐƯỢC tự ý thêm thông tin hoặc sáng tạo nội dung không có trong tài liệu.
    2. Trích dẫn rõ ràng nguồn thông tin khi trả lời (ví dụ: "Theo tài liệu [tên tài liệu]...").
    3. Nếu không có thông tin liên quan trong cơ sở kiến thức, hãy nói rằng bạn không có thông tin về vấn đề đó và đề nghị người dùng liên hệ với Mentor Laya để được hỗ trợ.
    4. KHÔNG ĐƯỢC tạo ra các thông tin sai lệch hoặc không có trong cơ sở kiến thức.
    
    Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. Sử dụng emoji 🌿 khi nói về sản phẩm Laya và ✨ khi nói về hệ thống Mentor.`

    // Kiểm tra kết nối với OpenRouter trước khi gửi yêu cầu chính
    let modelToUse = MODEL_CONFIG.modelId;
    
    try {
      console.log("Testing OpenRouter connection")
      const connectionTest = await testOpenRouterConnection()

      if (!connectionTest.success) {
        console.warn("OpenRouter connection test failed:", connectionTest.message)
        // Không trả về lỗi ngay lập tức, thay vào đó sẽ thử tiếp tục với mô hình mặc định
        // hoặc mô hình dự phòng trong hàm createChatCompletion
      } else {
        console.log("OpenRouter connection test successful")
        // Sử dụng mô hình đã kiểm tra thành công
        if (connectionTest.modelTested) {
          modelToUse = connectionTest.modelTested;
          console.log(`Using tested model: ${modelToUse}`);
        }
      }
    } catch (error) {
      console.error("Error testing OpenRouter connection:", error)
      // Tiếp tục xử lý mặc dù kiểm tra kết nối thất bại
    }

    console.log("Creating OpenRouter client")
    const openai = createClient()

    // Tạo stream response
    try {
      console.log(`Creating chat completion with model: ${modelToUse}`)
      
      // Thiết lập timeout cho yêu cầu
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MODEL_CONFIG.timeout);
      
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: MODEL_CONFIG.temperature,
        max_tokens: MODEL_CONFIG.maxTokens,
      }, { signal: controller.signal })
      
      clearTimeout(timeoutId);

      console.log("Stream created successfully")

      // Trả về streaming response sử dụng Response API tiêu chuẩn
      // Chuyển đổi response thành ReadableStream
      // Vì OpenAI SDK trả về Stream<ChatCompletionChunk> mà không phải ReadableStream trực tiếp
      return new Response(
        new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            
            try {
              // Xử lý từng chunk từ stream của OpenAI
              for await (const chunk of response) {
                // Lấy nội dung văn bản từ chunk
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) {
                  // Định dạng theo chuẩn SSE (Server-Sent Events)
                  const formattedChunk = `data: ${JSON.stringify({ text })}

`;
                  controller.enqueue(encoder.encode(formattedChunk));
                }
              }
              // Kết thúc stream
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              console.error('Error processing stream:', error);
              controller.error(error);
            }
          }
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        }
      )
    } catch (error) {
      console.error("Error creating chat completion:", error)

      // Phân tích lỗi để cung cấp thông báo lỗi cụ thể
      let errorMessage = "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau."
      let statusCode = 500

      if (error instanceof Error) {
        if (error.message.includes("API key")) {
          errorMessage = "API key không hợp lệ hoặc đã hết hạn."
          statusCode = 401
        } else if (error.message.includes("model")) {
          errorMessage = `Mô hình ${MODEL_CONFIG.modelId} không khả dụng hoặc không được hỗ trợ.`
          statusCode = 400
        } else if (error.message.includes("rate limit")) {
          errorMessage = "Đã vượt quá giới hạn tốc độ API. Vui lòng thử lại sau."
          statusCode = 429
        } else if (error.message.includes("timeout")) {
          errorMessage = "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại sau."
          statusCode = 504
        }
      }

      // Thử phương án dự phòng - trả về phản hồi không streaming
      try {
        console.log("Attempting fallback to non-streaming response")
        
        // Thử với các mô hình dự phòng nếu lỗi liên quan đến mô hình
        let fallbackModelToUse = modelToUse;
        if (error instanceof Error && error.message.includes("model") && modelToUse === MODEL_CONFIG.modelId) {
          // Thử với mô hình dự phòng đầu tiên
          if (MODEL_CONFIG.fallbackModels && MODEL_CONFIG.fallbackModels.length > 0) {
            fallbackModelToUse = MODEL_CONFIG.fallbackModels[0];
            console.log(`Trying fallback model: ${fallbackModelToUse}`);
          }
        }
        
        // Thiết lập timeout cho yêu cầu dự phòng
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 30000); // 30s timeout cho phương án dự phòng

        // Tạo phản hồi không streaming
        const fallbackResponse = await openai.chat.completions.create({
          model: fallbackModelToUse,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: false,
          temperature: MODEL_CONFIG.temperature,
          max_tokens: MODEL_CONFIG.maxTokens / 2, // Giảm xuống để tránh timeout
        }, { signal: fallbackController.signal })
        
        clearTimeout(fallbackTimeoutId);

        const content = fallbackResponse.choices[0]?.message?.content || "Xin lỗi, tôi không thể trả lời ngay bây giờ."
        console.log("Fallback response generated successfully")

        return new Response(JSON.stringify({ text: content }), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (fallbackError) {
        console.error("Fallback response also failed:", fallbackError)

        // Nếu cả hai phương án đều thất bại, trả về thông báo lỗi
        return new Response(
          JSON.stringify({
            error: errorMessage,
            details: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: statusCode,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
    }
  } catch (error) {
    console.error("Unhandled error in chat API:", error)
    return new Response(
      JSON.stringify({
        error: "Đã xảy ra lỗi không xác định khi xử lý yêu cầu",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// Thêm endpoint để kiểm tra trạng thái API
export async function GET() {
  try {
    const connectionTest = await testOpenRouterConnection()

    // Kiểm tra các tệp kiến thức
    let knowledgeStatus = "unknown";
    let knowledgeFiles: string[] = [];
    let knowledgeError: string | null = null;
    
    try {
      // Import động để tránh lỗi circular dependency
      const { loadKnowledgeBase } = await import("@/lib/knowledge");
      await loadKnowledgeBase();
      knowledgeStatus = "ok";
      
      // Thử lấy danh sách tệp trong thư mục knowledge
      // Sử dụng fs/promises thay vì require
      const fs = await import('fs/promises');
      const path = await import('path');
      const knowledgeDir = path.join(process.cwd(), "knowledge");
      
      try {
        const files = await fs.readdir(knowledgeDir);
        knowledgeFiles = files;
      } catch (fsError) {
        console.error("Error reading knowledge directory:", fsError);
      }
    } catch (knowledgeErr) {
      knowledgeStatus = "error";
      knowledgeError = knowledgeErr instanceof Error ? knowledgeErr.message : String(knowledgeErr);
    }

    return new Response(
      JSON.stringify({
        status: connectionTest.success ? "ok" : "error",
        message: connectionTest.message,
        model: connectionTest.modelTested || MODEL_CONFIG.modelId,
        fallbackModels: MODEL_CONFIG.fallbackModels,
        knowledge: {
          status: knowledgeStatus,
          files: knowledgeFiles,
          error: knowledgeError
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Không thể kiểm tra kết nối đến OpenRouter",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
