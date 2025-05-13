// Sử dụng Response API tiêu chuẩn của Next.js thay vì thư viện ai
// vì có thể có sự không tương thích giữa phiên bản
import { createClient, testGroqConnection, MODEL_CONFIG } from "@/lib/groq-client"
import { searchDocuments, getKnowledgeBaseStats } from "@/lib/knowledge-enhanced"
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
    
    // Phát hiện yêu cầu tạo ảnh
    const imageDetection = detectImageGenerationRequest(lastMessage)
    let shouldGenerateImage = false
    let translatedPrompt = null
    let imageGenerationNotification = null
    let imageGenerationResponse = null
    
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
        // Nếu không dịch được, sử dụng prompt gốc
        translatedPrompt = imageDetection.prompt
      }
    }

    // Tìm kiếm tài liệu liên quan nếu không phải là yêu cầu tạo ảnh
    let relevantDocs: Array<{content: string; source: string; similarity: number}> = []
    if (!imageDetection.isImageRequest) {
      try {
        // Sử dụng hàm searchDocuments cải tiến từ knowledge-enhanced.ts
        relevantDocs = await searchDocuments(lastMessage)
        console.log(`Found ${relevantDocs.length} relevant documents`)
        
        // Hiển thị thông tin chi tiết về các tài liệu tìm thấy
        if (relevantDocs.length > 0) {
          console.log("Top relevant documents:")
          relevantDocs.slice(0, 3).forEach((doc, index) => {
            console.log(`${index + 1}. Source: ${doc.source}, Similarity: ${Math.round(doc.similarity * 100)}%`)
            console.log(`   Preview: ${doc.content.substring(0, 100)}...`)
          })
        }
      } catch (error) {
        console.error("Error searching documents:", error)
        // Tiếp tục xử lý mà không có tài liệu liên quan
      }
    }

    // Tạo context từ các tài liệu liên quan với cấu trúc cải tiến
    let context = ""
    if (relevantDocs.length > 0) {
      // Sắp xếp tài liệu theo độ liên quan giảm dần
      const sortedDocs = [...relevantDocs].sort((a, b) => b.similarity - a.similarity);
      
      // Lưu thông tin nguồn để sử dụng trong quá trình xử lý nhưng không hiển thị cho người dùng
      const sourceInfo = sortedDocs.map((doc, index) => {
        const similarityScore = Math.round(doc.similarity * 100);
        return `Tài liệu ${index + 1}: ${doc.source} - Độ liên quan: ${similarityScore}%`;
      }).join("\n");
      
      console.log("Source information (internal only):\n" + sourceInfo);
      
      // Tạo context với định dạng cải tiến để ngăn va trộn thông tin
      context = "THÔNG TIN CHÍNH XÁC TỪ CƠ SỞ KIẾN THỨC (HÃY TRÍCH DẪN NGUYÊN VĂN VÀ KHÔNG THÊM BỚT THÔNG TIN):\n\n";
      
      // Thêm từng tài liệu với phân cách rõ ràng và thông tin nguồn chi tiết hơn
      sortedDocs.forEach((doc, index) => {
        // Cải tiến: Giảm ngưỡng độ liên quan xuống 50% để có nhiều thông tin hơn
        // nhưng ưu tiên hiển thị các tài liệu có độ liên quan cao hơn
        if (doc.similarity >= 0.5) {
          // Trích xuất tên file từ đường dẫn nguồn để hiển thị dễ đọc hơn
          const sourceName = doc.source.split('/').pop() || doc.source;
          
          // Thêm phân cách rõ ràng giữa các tài liệu
          context += `--- THÔNG TIN ${index + 1} (${Math.round(doc.similarity * 100)}% LIÊN QUAN) ---\n${doc.content}\n\n`;
        }
      });
    }

    // Tạo system prompt với context cải tiến
    const systemPrompt = `Bạn là trợ lý AI của Laya, một hệ sinh thái trị liệu kết hợp Đông y, công nghệ và tâm trí học.
    
    ${context ? context : "Không tìm thấy thông tin liên quan trong cơ sở kiến thức."}
    
    HƯỚNG DẪN BẮT BUỘC:
    1. TRẢ LỜI ĐẦY ĐỦ VÀ CHI TIẾT NHẤT CÓ THỂ, sử dụng tối đa số lượng token cho phép (4000 token) để cung cấp thông tin đầy đủ và hữu ích.
    2. TRÍCH DẪN NGUYÊN VĂN các phần liên quan từ cơ sở kiến thức, đảm bảo tính chính xác tuyệt đối. KHÔNG ĐƯỢC thêm hoặc bớt thông tin.
    3. TỔ CHỨC THÔNG TIN MỘT CÁCH RÕ RÀNG với các tiêu đề, đề mục và phân đoạn hợp lý để dễ đọc và hiểu.
    4. KHÔNG ĐƯỢC trích dẫn nguồn trong câu trả lời. Hãy trả lời như thể thông tin đó là của bạn.
    5. Nếu không có thông tin liên quan trong cơ sở kiến thức, hãy nói rằng bạn không có thông tin về vấn đề đó và đề nghị người dùng liên hệ với Mentor Laya để được hỗ trợ.
    6. KHÔNG ĐƯỢC tạo ra các thông tin sai lệch hoặc không có trong cơ sở kiến thức.
    7. Sử dụng chính xác các từ ngữ và cụm từ trong tài liệu, không tự ý thay đổi cách diễn đạt.
    8. TRÁNH VA TRỘN thông tin giữa các nguồn khác nhau, giữ rõ ràng ranh giới giữa các nội dung.
    9. LUÔN SỬ DỤNG TỐI ĐA SỐ LƯỢNG TOKEN (4000) để cung cấp thông tin chi tiết và đầy đủ nhất có thể.
    10. Khi trả lời các câu hỏi về Đông y, hãy đảm bảo giải thích các khái niệm một cách dễ hiểu và đầy đủ.
    11. Khi trả lời các câu hỏi về chính sách, hãy nêu rõ các quy định và điều kiện áp dụng.
    
    Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. Sử dụng emoji 🌿 khi nói về sản phẩm Laya và ✨ khi nói về hệ thống Mentor.`

    // Kiểm tra kết nối với Groq trước khi gửi yêu cầu chính
    let modelToUse = MODEL_CONFIG.modelId;
    
    try {
      console.log("Testing Groq connection")
      const connectionTest = await testGroqConnection()

      if (!connectionTest.success) {
        console.warn("Groq connection test failed:", connectionTest.message)
        // Không trả về lỗi ngay lập tức, thay vào đó sẽ thử tiếp tục với mô hình mặc định
        // hoặc mô hình dự phòng trong hàm createChatCompletion
      } else {
        console.log("Groq connection test successful")
        // Sử dụng mô hình đã kiểm tra thành công
        if (connectionTest.modelTested) {
          modelToUse = connectionTest.modelTested;
          console.log(`Using tested model: ${modelToUse}`);
        }
      }
    } catch (error) {
      console.error("Error testing Groq connection:", error)
      // Tiếp tục xử lý mặc dù kiểm tra kết nối thất bại
    }

    console.log("Creating Groq client")
    const groq = createClient()

    // Tạo stream response
    try {
      console.log(`Creating chat completion with model: ${modelToUse}`)
      
      const response = await groq.chat.completions.create({
        model: modelToUse,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: MODEL_CONFIG.temperature,
        max_tokens: MODEL_CONFIG.maxTokens,
      })

      console.log("Stream created successfully")

      // Trả về streaming response sử dụng Response API tiêu chuẩn
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
                        const imageChunk = `data: ${JSON.stringify({ 
                          imageAttachment,
                          text: `Đã tạo ảnh từ mô tả: "${promptText}"

` 
                        })}

`;
                        controller.enqueue(encoder.encode(imageChunk));
                        
                        // Kết thúc stream sau khi gửi ảnh
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                        return; // Kết thúc luồng xử lý sau khi gửi ảnh
                      }
                    } else {
                      const errorData = await imageResponse.json();
                      console.error("Error generating image:", errorData);
                      
                      // Gửi thông báo lỗi
                      const errorChunk = `data: ${JSON.stringify({ 
                        text: `Rất tiếc, tôi không thể tạo ảnh từ mô tả của bạn. Lỗi: ${errorData.error || "Không xác định"}`
                      })}

`;
                      controller.enqueue(encoder.encode(errorChunk));
                      
                      // Tiếp tục với phản hồi văn bản thông thường
                    }
                  } catch (imageError) {
                    console.error("Error in image generation process:", imageError);
                    
                    // Gửi thông báo lỗi
                    const errorChunk = `data: ${JSON.stringify({ 
                      text: "Rất tiếc, đã xảy ra lỗi khi tạo ảnh. Vui lòng thử lại sau."
                    })}

`;
                    controller.enqueue(encoder.encode(errorChunk));
                    
                    // Tiếp tục với phản hồi văn bản thông thường
                  }
                }
              }
              
              // Xử lý stream từ Groq API
              let responseText = "";
              
              // Nếu đã gửi ảnh thành công, không cần gửi phản hồi văn bản
              if (imageGenerationResponse && imageGenerationResponse.success) {
                console.log("Image was generated successfully, skipping text response");
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }
              
              // Xử lý stream từ Groq API
              for await (const chunk of response) {
                // Lấy nội dung từ chunk
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                  responseText += content;
                  
                  // Gửi chunk đến client
                  const dataChunk = `data: ${JSON.stringify({ text: content })}

`;
                  controller.enqueue(encoder.encode(dataChunk));
                }
              }
              
              console.log("Stream completed");
              console.log("Total response length:", responseText.length);
              
              // Kết thúc stream
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (streamError) {
              console.error("Error processing stream:", streamError);
              
              // Gửi thông báo lỗi
              const errorChunk = `data: ${JSON.stringify({ 
                text: "Rất tiếc, đã xảy ra lỗi khi xử lý phản hồi. Vui lòng thử lại sau."
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
      
      // Trả về lỗi dưới dạng stream để client có thể hiển thị
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const errorMessage = `data: ${JSON.stringify({ 
              text: "Rất tiếc, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau."
            })}

`;
            controller.enqueue(encoder.encode(errorMessage));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
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

    // Kiểm tra kết nối với Groq
    let groqStatus = { available: false, message: "Không thể kết nối đến Groq API", model: null }
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

    // Kiểm tra knowledge base
    let knowledgeStatus = { available: false, message: "Không thể tải knowledge base", stats: null }
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
      console.error("Error checking knowledge base:", error)
    }

    // Kiểm tra TensorArt API
    let tensorartStatus = { available: false, message: "API key không được cấu hình" }
    const tensorartApiKey = process.env.TENSORART_API_KEY
    if (tensorartApiKey) {
      tensorartStatus = { available: true, message: "API key đã được cấu hình" }
    }

    return new Response(
      JSON.stringify({ 
        status: "success", 
        groq: groqStatus,
        knowledge: knowledgeStatus,
        tensorart: tensorartStatus
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
