// Tạo một API route giả lập để kiểm tra kết nối
export async function GET() {
  return new Response(JSON.stringify({ status: "ok", message: "Mock API is working" }), {
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages } = body

    // Tạo phản hồi giả lập
    const lastMessage = messages[messages.length - 1].content
    const mockResponse = {
      text: `Đây là phản hồi giả lập cho tin nhắn: "${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? "..." : ""}". Tôi là trợ lý Laya 🌿 và tôi đang chạy trong chế độ giả lập.`,
    }

    // Trì hoãn phản hồi để mô phỏng độ trễ mạng
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return new Response(JSON.stringify(mockResponse), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error in mock API:", error)
    return new Response(JSON.stringify({ error: "Lỗi xử lý yêu cầu giả lập" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
