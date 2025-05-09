import { testOpenRouterConnection } from "@/lib/openrouter-client"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"

export async function GET() {
  try {
    // Kiểm tra kết nối với OpenRouter
    const openRouterStatus = await testOpenRouterConnection()

    // Kiểm tra kết nối với cơ sở dữ liệu kiến thức
    let knowledgeStatus = { success: false, message: "Chưa kiểm tra" }
    try {
      // Đơn giản hóa: chỉ kiểm tra xem thư mục knowledge có tồn tại không
      const knowledgeDir = path.join(process.cwd(), "knowledge")

      if (fs.existsSync(knowledgeDir)) {
        const files = fs.readdirSync(knowledgeDir)
        knowledgeStatus = {
          success: true,
          message: `Đã tìm thấy ${files.length} tệp trong thư mục knowledge`,
        }
      } else {
        knowledgeStatus = {
          success: false,
          message: "Thư mục knowledge không tồn tại",
        }
      }
    } catch (error) {
      knowledgeStatus = {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi không xác định",
      }
    }

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        openRouter: {
          status: openRouterStatus.success ? "online" : "offline",
          message: openRouterStatus.message,
        },
        knowledgeBase: {
          status: knowledgeStatus.success ? "available" : "unavailable",
          message: knowledgeStatus.message,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || "development",
          hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Không thể kiểm tra trạng thái hệ thống",
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
