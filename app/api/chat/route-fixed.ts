// Sử dụng Response API tiêu chuẩn của Next.js thay vì thư viện ai
// vì có thể có sự không tương thích giữa phiên bản
import { createClient, testGroqConnection, MODEL_CONFIG } from "@/lib/groq-client"
import { searchDocuments, getKnowledgeBaseStats, reloadKnowledgeBase } from "@/lib/knowledge-fixed"
import { detectImageGenerationRequest, translatePromptToEnglish } from "@/lib/image-detection"
import { v4 as uuidv4 } from "uuid"

export const runtime = "nodejs"
export const maxDuration = 60 // Giới hạn tối đa cho gói Hobby của Vercel

export async function POST(req: Request) {
  try {
    console.log("API route handler started")

    // Kiểm tra API key
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      console.error("GROQ_API_KEY không được cấu hình")
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
    
    // Tải lại knowledge base trước khi xử lý mỗi yêu cầu
    try {
      // Tải lại knowledge base với force=true để đảm bảo có dữ liệu mới nhất
      await reloadKnowledgeBase();
      console.log("Knowledge base reloaded successfully");
    } catch (error) {
      console.error("Error reloading knowledge base:", error);
    }

    // Phát hiện yêu cầu tạo ảnh
    const imageDetection = detectImageGenerationRequest(lastMessage)
    let shouldGenerateImage = false
    let translatedPrompt: string | null = null
    let imageGenerationNotification: string | null = null
    
    // Định nghĩa kiểu dữ liệu cho imageGenerationResponse
    interface ImageResponse {
      success: boolean;
      imageUrl: string;
      prompt: string;
    }
    
    // Khởi tạo với giá trị null
    let imageGenerationResponse: ImageResponse | null = null
    
    if (imageDetection.isImageRequest && imageDetection.prompt) {
      console.log("Image generation request detected:", imageDetection.prompt)
      shouldGenerateImage = true
      
      try {
        // Dịch prompt sang tiếng Anh để tạo ảnh chất lượng tốt hơn
        translatedPrompt = await translatePromptToEnglish(imageDetection.prompt)
        console.log("Translated prompt:", translatedPrompt)
        
        // Tạo thông báo để hiển thị trước khi tạo ảnh
        imageGenerationNotification = `Tôi đang tiến hành tạo ảnh từ mô tả của bạn: "${imageDetection.prompt}". Vui lòng đợi trong giây lát...`
      } catch (error) {
        console.error("Error translating prompt:", error)
      }
    }

    // Tìm kiếm thông tin liên quan từ cơ sở kiến thức
    let context = "";
    let relevantDocs: Array<{content: string; source: string; similarity: number}> = [];
    
    try {
      relevantDocs = await searchDocuments(lastMessage);
      console.log(`Found ${relevantDocs.length} relevant documents for query: "${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}"`);
    } catch (error) {
      console.error("Error searching documents:", error);
    }

    if (relevantDocs.length > 0) {
      // Sắp xếp tài liệu theo độ liên quan giảm dần
      const sortedDocs = [...relevantDocs].sort((a, b) => b.similarity - a.similarity);
      
      // Lưu thông tin nguồn để sử dụng trong quá trình xử lý nhưng không hiển thị cho người dùng
      const sourceInfo = sortedDocs.map((doc, index) => {
        const similarityScore = Math.round(doc.similarity * 100);
        return `Tài liệu ${index + 1}: ${doc.source} - Độ liên quan: ${similarityScore}%`;
      }).join("\n");
      
      console.log("Source information (internal only):\n" + sourceInfo);
      
      // Tạo context với định dạng rõ ràng hơn để ngăn va trộn thông tin
      context = "THÔNG TIN CHÍNH XÁC TỪ CƠ SỞ KIẾN THỨC (HÃY TRÍCH DẪN NGUYÊN VĂN VÀ KHÔNG THÊM BỚT THÔNG TIN):\n\n";
      
      // Thêm từng tài liệu với phân cách rõ ràng và thông tin nguồn chi tiết hơn
      sortedDocs.forEach((doc, index) => {
        // Giảm ngưỡng độ liên quan xuống 50% để có nhiều thông tin hơn
        // nhưng ưu tiên hiển thị các tài liệu có độ liên quan cao hơn
        if (doc.similarity >= 0.5) {
          // Trích xuất tên file từ đường dẫn nguồn để hiển thị dễ đọc hơn
          const sourceName = doc.source.split('/').pop() || doc.source;
          
          // Thêm phân cách rõ ràng giữa các tài liệu với độ tương đồng
          context += `--- THÔNG TIN ${index + 1} (${Math.round(doc.similarity * 100)}% LIÊN QUAN) ---\n${doc.content}\n\n`;
        }
      });
    }

    // Tạo system prompt với context cải tiến
    const systemPrompt = `Bạn là trợ lý AI của Laya, một hệ sinh thái trị liệu kết hợp Đông y, công nghệ và tâm trí học.
Hãy trả lời một cách chi tiết, đầy đủ và chính xác nhất có thể, tối đa hóa số lượng token cho phép (4000 token).
Nếu bạn không biết câu trả lời, hãy thừa nhận điều đó và đề nghị người dùng liên hệ trực tiếp với đội ngũ Laya.
Luôn sử dụng ngôn ngữ thân thiện, chuyên nghiệp và đầy cảm thông.

${context}

Khi trích dẫn thông tin từ cơ sở kiến thức, hãy đảm bảo:
1. Trích dẫn nguyên văn và chính xác
2. Không thêm bớt hoặc diễn giải lại thông tin
3. Nếu thông tin không đầy đủ, hãy nói rõ là bạn chỉ có thông tin hạn chế
4. Không bịa đặt thông tin không có trong nguồn

Nếu câu hỏi liên quan đến Đông y hoặc các phương pháp trị liệu, hãy nhấn mạnh rằng người dùng nên tham khảo ý kiến chuyên gia Laya trước khi áp dụng.`;

    // Tạo Groq client
    const groq = createClient()
    
    // Mô hình mặc định
    let modelToUse = MODEL_CONFIG.modelId
    
    try {
      // Tạo completion
      const response = await groq.chat.completions.create({
        model: modelToUse,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: MODEL_CONFIG.temperature,
        max_tokens: MODEL_CONFIG.maxTokens,
      })

      // Chúng ta sẽ không sử dụng imageAttachment ở đây nữa vì ảnh sẽ được tạo sau khi đã gửi thông báo
      const imageAttachment = null;
      
      // Chuyển đổi response thành ReadableStream
      // Vì OpenAI SDK trả về Stream<ChatCompletionChunk> mà không phải ReadableStream trực tiếp
      return new Response(
        new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            
            try {
              // Gửi thông báo trước khi tạo ảnh nếu có
              if (imageGenerationNotification) {
                const notificationChunk = `data: ${JSON.stringify({ 
                  text: imageGenerationNotification
                })}

`;
                controller.enqueue(encoder.encode(notificationChunk));
                
                // Bắt đầu tạo ảnh sau khi đã gửi thông báo
                if (shouldGenerateImage && translatedPrompt) {
                  try {
                    console.log("Starting image generation after notification was sent");
                    
                    // Đảm bảo imageDetection.prompt không phải là null (chúng ta đã kiểm tra ở điều kiện if trước đó)
                    const promptText = imageDetection.prompt || "";
                    
                    // Gọi API tạo ảnh với prompt đã dịch
                    const imageResponse = await fetch(new URL("/api/image", `${req.headers.get("origin") || "http://localhost:3000"}`).toString(), {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ 
                        prompt: translatedPrompt,
                        originalPrompt: promptText 
                      }),
                    });
                    
                    if (imageResponse.ok) {
                      const imageData = await imageResponse.json() as { success: boolean; imageUrl?: string; error?: string };
                      if (imageData.success && imageData.imageUrl) {
                        console.log("Successfully generated image:", imageData.imageUrl);
                        imageGenerationResponse = {
                          success: true,
                          imageUrl: imageData.imageUrl,
                          prompt: promptText
                        };
                        
                        // Tạo ảnh đính kèm sau khi tạo ảnh thành công
                        const imageAttachment = {
                          id: uuidv4(),
                          type: "image",
                          url: imageData.imageUrl,
                          name: `AI Image: ${promptText.substring(0, 30)}${promptText.length > 30 ? "..." : ""}`,
                          prompt: promptText
                        };
                        
                        // Gửi thông tin ảnh đã tạo
                        const imageAttachmentChunk = `data: ${JSON.stringify({ 
                          text: `Đã tạo ảnh từ mô tả: "${promptText}"`,
                          imageAttachment
                        })}

`;
                        controller.enqueue(encoder.encode(imageAttachmentChunk));
                        
                        // Không cần gửi phản hồi từ LLM nếu đây là yêu cầu tạo ảnh
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                        return;
                      }
                    }
                  } catch (error) {
                    console.error("Error generating image:", error);
                  }
                }
              }
              
              // Xử lý response stream từ Groq
              for await (const chunk of response) {
                // Kiểm tra xem chunk có chứa nội dung không
                if (chunk.choices && chunk.choices[0]?.delta?.content) {
                  const content = chunk.choices[0].delta.content;
                  
                  // Gửi chunk dữ liệu tới client
                  const dataChunk = `data: ${JSON.stringify({ text: content })}

`;
                  controller.enqueue(encoder.encode(dataChunk));
                }
              }
              
              // Kết thúc stream
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              console.error("Error processing stream:", error);
              
              // Gửi thông báo lỗi
              const errorChunk = `data: ${JSON.stringify({ 
                text: "Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau."
              })}

`;
              controller.enqueue(encoder.encode(errorChunk));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          }
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        }
      );
    } catch (error) {
      console.error("Error creating chat completion:", error)
      
      let errorMessage = "Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau."
      let statusCode = 500
      
      // Xử lý các loại lỗi cụ thể
      if (error instanceof Error) {
        if (error.message.includes("model")) {
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
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, 30000); // 30 giây timeout cho phương án dự phòng
        
        const fallbackResponse = await groq.chat.completions.create({
          model: fallbackModelToUse,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: false,
          temperature: MODEL_CONFIG.temperature,
          max_tokens: MODEL_CONFIG.maxTokens,
        }, { signal: abortController.signal });
        
        clearTimeout(timeoutId);
        
        if (fallbackResponse.choices && fallbackResponse.choices.length > 0) {
          const content = fallbackResponse.choices[0].message.content || "";
          console.log("Fallback response received successfully");
          
          // Sử dụng cách an toàn hơn để tránh lỗi TypeScript
          let imageAttachmentData = null;
          
          // Sử dụng type assertion để tránh lỗi TypeScript
          if (imageGenerationResponse && typeof imageGenerationResponse === 'object') {
            // Sử dụng type assertion để TypeScript hiểu đúng kiểu dữ liệu
            const typedResponse = imageGenerationResponse as { imageUrl?: string; prompt?: string };
            
            if (typedResponse.imageUrl && typedResponse.prompt) {
              const imgUrl = String(typedResponse.imageUrl);
              const imgPrompt = String(typedResponse.prompt);
              
              imageAttachmentData = {
                id: uuidv4(),
                type: "image" as const,
                url: imgUrl,
                name: `AI Image: ${imgPrompt.substring(0, 30)}${imgPrompt.length > 30 ? "..." : ""}`,
                prompt: imgPrompt
              };
            }
          }
          
          return new Response(
            JSON.stringify({ 
              text: content,
              imageAttachment: imageAttachmentData
            }),
            { 
              status: 200, 
              headers: { "Content-Type": "application/json" } 
            }
          );
        }
      } catch (fallbackError) {
        console.error("Fallback response also failed:", fallbackError)
      }
      
      // Trả về lỗi nếu cả phương án dự phòng cũng thất bại
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: statusCode, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Unhandled error in API route:", error)
    return new Response(JSON.stringify({ error: "Đã xảy ra lỗi không xác định" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

// Thêm endpoint để kiểm tra trạng thái API
export async function GET(req: Request) {
  try {
    // Kiểm tra API key
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          status: "error", 
          groq: { available: false, message: "API key không được cấu hình" },
          knowledge: { available: false, message: "Không thể kiểm tra vì Groq API không khả dụng" }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    // Định nghĩa kiểu dữ liệu cho groqStatus
    interface GroqStatus {
      available: boolean;
      message: string;
      model: string | null;
    }
    
    // Kiểm tra kết nối với Groq
    let groqStatus: GroqStatus = { available: false, message: "Không thể kết nối đến Groq API", model: null }
    try {
      const connectionTest = await testGroqConnection()
      groqStatus = { 
        available: connectionTest.success, 
        message: connectionTest.message,
        model: connectionTest.modelTested || null
      }
    } catch (error) {
      console.error("Error testing Groq connection:", error)
    }

    // Định nghĩa kiểu dữ liệu cho stats
    interface KnowledgeStats {
      totalChunks: number;
      categories: Record<string, number>;
      sourceCount: number;
      lastUpdated: Date;
    }
    
    // Kiểm tra knowledge base
    let knowledgeStatus: { available: boolean; message: string; stats: KnowledgeStats | null } = 
      { available: false, message: "Không thể tải knowledge base", stats: null }
      
    try {
      // Lấy thông tin thống kê từ knowledge base
      const stats = getKnowledgeBaseStats();
      
      knowledgeStatus = {
        available: stats.totalChunks > 0,
        message: stats.totalChunks > 0 
          ? `Đã tải ${stats.totalChunks} chunks từ ${Object.keys(stats.sources).length} tài liệu` 
          : "Knowledge base trống hoặc chưa được tải",
        stats: {
          totalChunks: stats.totalChunks,
          categories: stats.categories,
          sourceCount: Object.keys(stats.sources).length,
          lastUpdated: stats.lastUpdated
        }
      }
    } catch (error) {
      console.error("Error getting knowledge base stats:", error)
    }
    
    return new Response(
      JSON.stringify({ 
        status: "ok", 
        groq: groqStatus,
        knowledge: knowledgeStatus
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Error in health check:", error)
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: "Đã xảy ra lỗi khi kiểm tra trạng thái API"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
