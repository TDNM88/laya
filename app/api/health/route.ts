import { NextResponse } from "next/server";
import { createClient, testGroqConnection } from "@/lib/groq-client";

export const runtime = "nodejs";

/**
 * API endpoint để kiểm tra trạng thái kết nối của các dịch vụ
 * @returns Thông tin trạng thái kết nối
 */
export async function GET() {
  try {
    // Kiểm tra kết nối đến Groq API
    const groqConnectionResult = await testGroqConnection();
    
    // Kiểm tra xem TensorArt API key có được cấu hình hay không
    const tensorArtConfigured = !!process.env.TENSORART_API_KEY;

    // Trả về trạng thái của các dịch vụ
    return NextResponse.json({
      status: "ok",
      services: {
        groq: {
          status: groqConnectionResult.success ? "connected" : "disconnected",
          message: groqConnectionResult.message,
          modelTested: groqConnectionResult.modelTested
        },
        tensorArt: {
          status: tensorArtConfigured ? "configured" : "not_configured"
        }
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
