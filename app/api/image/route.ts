// API endpoint để tạo ảnh từ mô tả văn bản sử dụng TensorArt API
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // Tăng thời gian chờ lên 5 phút vì TensorArt có thể mất nhiều thời gian hơn

// Cấu hình mặc định cho TensorArt
const DEFAULT_CONFIG = {
  modelId: "770694094415489962", // Model ID cố định
  vaeId: "sdxl-vae-fp16-fix.safetensors", // VAE cố định
  loraItems: [
    { loraModel: "766419665653268679", weight: 0.7 },
    { loraModel: "777630084346589138", weight: 0.7 },
    { loraModel: "776587863287492519", weight: 0.7 }
  ],
  width: 512, // Giảm kích thước xuống 512x512 theo yêu cầu
  height: 512,
  steps: 20,
  cfgScale: 3,
  sampler: "Euler a",
  negativePrompt: "nsfw"
};

export async function POST(req: Request) {
  try {
    console.log("Image generation API route handler started with TensorArt");

    // Kiểm tra API key
    const apiKey = process.env.TENSORART_API_KEY;
    if (!apiKey) {
      console.error("TENSORART_API_KEY không được cấu hình");
      return NextResponse.json(
        { error: "API key không được cấu hình. Vui lòng kiểm tra biến môi trường." },
        { status: 500 }
      );
    }

    // Parse request body
    let prompt;
    let originalPrompt; // Lưu trữ prompt gốc tiếng Việt
    let width = DEFAULT_CONFIG.width;
    let height = DEFAULT_CONFIG.height;
    
    try {
      const body = await req.json();
      prompt = body.prompt;
      originalPrompt = body.originalPrompt || prompt; // Lấy prompt gốc nếu có, nếu không dùng prompt
      
      // Lấy kích thước từ request nếu có
      if (body.width && typeof body.width === "number") width = body.width;
      if (body.height && typeof body.height === "number") height = body.height;

      if (!prompt || typeof prompt !== "string") {
        console.error("Invalid request format: prompt is missing or not a string");
        return NextResponse.json(
          { error: "Định dạng yêu cầu không hợp lệ. Thiếu trường prompt hoặc không phải là chuỗi." },
          { status: 400 }
        );
      }

      console.log(`Received image generation prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}`);
      if (originalPrompt !== prompt) {
        console.log(`Original prompt (Vietnamese): ${originalPrompt.substring(0, 100)}${originalPrompt.length > 100 ? "..." : ""}`);
      }
    } catch (error) {
      console.error("Error parsing request body:", error);
      return NextResponse.json(
        { error: "Không thể phân tích nội dung yêu cầu" },
        { status: 400 }
      );
    }

    // Tạo ảnh sử dụng TensorArt API
    try {
      console.log("Generating image with TensorArt API");
      
      // Tạo request ID duy nhất dựa trên timestamp
      const requestId = crypto.createHash('md5').update(Date.now().toString()).digest('hex');
      
      // Tạo dữ liệu cho API request
      const txt2imgData = {
        request_id: requestId,
        stages: [
          {
            type: "INPUT_INITIALIZE",
            inputInitialize: {
              seed: -1,
              count: 1
            }
          },
          {
            type: "DIFFUSION",
            diffusion: {
              width: width,
              height: height,
              prompts: [
                {
                  text: prompt
                }
              ],
              negativePrompts: [
                {
                  text: DEFAULT_CONFIG.negativePrompt
                }
              ],
              sdModel: DEFAULT_CONFIG.modelId,
              sdVae: DEFAULT_CONFIG.vaeId,
              sampler: DEFAULT_CONFIG.sampler,
              steps: DEFAULT_CONFIG.steps,
              cfgScale: DEFAULT_CONFIG.cfgScale,
              clipSkip: 1,
              etaNoiseSeedDelta: 31337,
              lora: {
                items: DEFAULT_CONFIG.loraItems
              }
            }
          }
        ]
      };

      // Gọi API để tạo job
      console.log("Creating TensorArt job...");
      const createJobResponse = await fetch("https://ap-east-1.tensorart.cloud/v1/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(txt2imgData)
      });

      if (!createJobResponse.ok) {
        const errorText = await createJobResponse.text();
        throw new Error(`Error creating job: ${createJobResponse.status} - ${errorText}`);
      }

      const responseData = await createJobResponse.json();
      const jobId = responseData.job.id;
      console.log(`Job created. ID: ${jobId}`);

      // Poll job status until completion or timeout
      const startTime = Date.now();
      const timeout = 240000; // 4 phút timeout (giữ 1 phút cho xử lý khác)
      let imageUrl = null;

      while (Date.now() - startTime < timeout) {
        // Chờ 10 giây giữa các lần kiểm tra
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Kiểm tra trạng thái job
        const jobStatusResponse = await fetch(`https://ap-east-1.tensorart.cloud/v1/jobs/${jobId}`, {
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${apiKey}`
          }
        });

        if (!jobStatusResponse.ok) {
          const errorText = await jobStatusResponse.text();
          throw new Error(`Error checking job status: ${jobStatusResponse.status} - ${errorText}`);
        }

        const jobStatusData = await jobStatusResponse.json();
        const jobStatus = jobStatusData.job.status;
        console.log(`Job status: ${jobStatus}`);

        if (jobStatus === "SUCCESS") {
          if (jobStatusData.job.successInfo && jobStatusData.job.successInfo.images && jobStatusData.job.successInfo.images.length > 0) {
            imageUrl = jobStatusData.job.successInfo.images[0].url;
            console.log(`Job succeeded. Image URL: ${imageUrl}`);
            break;
          } else {
            throw new Error("Output is missing in the job response.");
          }
        } else if (jobStatus === "FAILED") {
          throw new Error("Job failed. Please try again with different settings.");
        }
        // Tiếp tục kiểm tra nếu job vẫn đang chạy
      }

      if (!imageUrl) {
        throw new Error(`Job timed out after ${timeout/1000} seconds.`);
      }

      // Trả về URL của ảnh đã tạo
      return NextResponse.json({
        success: true,
        imageUrl: imageUrl,
      });
    } catch (error: any) {
      console.error("Error generating image with TensorArt:", error);
      
      // Phân tích lỗi để cung cấp thông báo lỗi cụ thể
      let errorMessage = "Đã xảy ra lỗi khi tạo ảnh. Vui lòng thử lại sau.";
      let statusCode = 500;

      if (error.message) {
        if (error.message.includes("API key") || error.message.includes("Authorization") || error.message.includes("Bearer")) {
          errorMessage = "API key không hợp lệ hoặc đã hết hạn.";
          statusCode = 401;
        } else if (error.message.includes("timed out")) {
          errorMessage = "Yêu cầu đã hết thời gian chờ. Vui lòng thử lại sau.";
          statusCode = 504;
        } else if (error.message.includes("Job failed")) {
          errorMessage = "Không thể tạo ảnh. Vui lòng thử lại với mô tả khác.";
          statusCode = 400;
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error("Unexpected error in image generation API:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
