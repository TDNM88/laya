/**
 * Service để phát hiện yêu cầu tạo ảnh từ văn bản và xử lý tạo ảnh tự động
 */

// Các từ khóa để phát hiện yêu cầu tạo ảnh
const IMAGE_GENERATION_KEYWORDS = [
  // Tiếng Việt
  "tạo ảnh", "tạo hình", "vẽ ảnh", "vẽ hình", "tạo một ảnh", "tạo một hình", 
  "tạo cho tôi ảnh", "tạo cho tôi hình", "tạo giúp tôi ảnh", "tạo giúp tôi hình",
  "tạo hộ tôi ảnh", "tạo hộ tôi hình", "vẽ cho tôi", "vẽ giúp tôi", "vẽ hộ tôi",
  "tạo ảnh về", "tạo hình về", "vẽ ảnh về", "vẽ hình về", "tạo ảnh của", "tạo hình của",
  "hãy tạo ảnh", "hãy tạo hình", "hãy vẽ ảnh", "hãy vẽ hình", 
  "xin tạo ảnh", "xin tạo hình", "xin vẽ ảnh", "xin vẽ hình",
  "tạo ảnh ai", "tạo hình ai", "vẽ ảnh ai", "vẽ hình ai",
  
  // Tiếng Anh
  "create image", "generate image", "draw image", "create a picture", "generate a picture",
  "create an image", "generate an image", "draw a picture", "draw an image",
  "make an image", "make a picture", "create picture", "generate picture"
];

// Các từ khóa loại trừ để tránh phát hiện sai
const EXCLUSION_KEYWORDS = [
  "không tạo ảnh", "đừng tạo ảnh", "không vẽ", "đừng vẽ",
  "don't create", "don't generate", "don't draw"
];

/**
 * Phát hiện yêu cầu tạo ảnh từ văn bản
 * @param text Văn bản cần phân tích
 * @returns Đối tượng chứa kết quả phát hiện và prompt nếu có
 */
export function detectImageGenerationRequest(text: string): { isImageRequest: boolean; prompt: string | null } {
  // Chuyển text về chữ thường để dễ so sánh
  const lowerText = text.toLowerCase();
  
  // Kiểm tra các từ khóa loại trừ trước
  for (const keyword of EXCLUSION_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return { isImageRequest: false, prompt: null };
    }
  }
  
  // Kiểm tra các từ khóa tạo ảnh
  for (const keyword of IMAGE_GENERATION_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      // Tìm prompt sau từ khóa
      const keywordIndex = lowerText.indexOf(keyword);
      const promptStart = keywordIndex + keyword.length;
      
      // Lấy phần còn lại của văn bản làm prompt
      let prompt = text.slice(promptStart).trim();
      
      // Loại bỏ các ký tự đặc biệt ở đầu prompt nếu có
      prompt = prompt.replace(/^[.,;:!?'"]+/, '').trim();
      
      // Nếu prompt quá ngắn, sử dụng toàn bộ văn bản
      if (prompt.length < 5) {
        // Loại bỏ từ khóa tạo ảnh và sử dụng phần còn lại
        prompt = text.replace(new RegExp(keyword, 'i'), '').trim();
        prompt = prompt.replace(/^[.,;:!?'"]+/, '').trim();
      }
      
      return { 
        isImageRequest: true, 
        prompt: prompt.length > 0 ? prompt : null 
      };
    }
  }
  
  return { isImageRequest: false, prompt: null };
}

import { createClient } from "@/lib/groq-client";

/**
 * Dịch prompt từ tiếng Việt sang tiếng Anh sử dụng LLM (Groq)
 * @param prompt Prompt tiếng Việt cần dịch
 * @returns Prompt đã dịch sang tiếng Anh
 */
export async function translatePromptToEnglish(prompt: string): Promise<string> {
  try {
    console.log("Translating prompt using LLM:", prompt);
    
    // Sử dụng Groq LLM để dịch
    const groq = createClient();
    
    // Tạo system prompt hướng dẫn dịch thuật
    const systemPrompt = `You are a professional translator specializing in Vietnamese to English translation. 
    Your task is to translate the given Vietnamese text into English accurately, maintaining the meaning and context. 
    Focus specifically on translating text that will be used as a prompt for image generation. 
    Add appropriate descriptive terms to enhance the quality of the generated image. 
    Do not include any explanations or notes - only provide the translated text.`;
    
    // Gọi API Groq để dịch
    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // Sử dụng mô hình có khả năng dịch tốt
      messages: [
        { 
          role: "system", 
          content: systemPrompt 
        },
        { 
          role: "user", 
          content: `Translate this Vietnamese text to English for image generation: "${prompt}". 
          Make sure to add appropriate descriptive terms to enhance the quality of the generated image.` 
        }
      ],
      temperature: 0.3, // Nhiệt độ thấp để đảm bảo tính chính xác
      max_tokens: 200,
    });
    
    // Lấy kết quả dịch
    const translatedText = response.choices[0]?.message?.content?.trim() || "";
    
    // Kiểm tra kết quả dịch
    if (translatedText) {
      console.log("LLM translation successful:", translatedText);
      
      // Thêm các từ khóa chất lượng nếu chưa có
      const qualityKeywords = "high quality, detailed, professional";
      const hasQualityKeywords = qualityKeywords.split(", ").some(keyword => 
        translatedText.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // Thêm các từ khóa chất lượng nếu chưa có
      return hasQualityKeywords ? translatedText : `${translatedText}, ${qualityKeywords}`;
    }
  } catch (error) {
    console.error("Error using LLM for translation:", error);
  }
  
  // Nếu có lỗi hoặc không có kết quả, sử dụng phương pháp dự phòng
  console.log("Falling back to basic translation method");
  
  // Bảng dịch các từ và cụm từ thông dụng trong tiếng Việt
  const commonTranslations: Record<string, string> = {
    // Các từ mô tả cơ bản
    "màu đỏ": "red color",
    "màu xanh lá": "green color",
    "màu xanh dương": "blue color",
    "màu vàng": "yellow color",
    "màu tím": "purple color",
    "màu cam": "orange color",
    "màu hồng": "pink color",
    "màu nâu": "brown color",
    "màu xám": "gray color",
    "màu đen": "black color",
    "màu trắng": "white color",
    
    // Các từ về phong cách
    "phong cách": "style",
    "hoạt hình": "cartoon",
    "châu Á": "Asian",
    "châu Âu": "European",
    "cổ điển": "classic",
    "hiện đại": "modern",
    "tương lai": "futuristic",
    "trừa tượng": "abstract",
    "thực tế": "realistic",
    "hoàng hôn": "sunset",
    "bình minh": "sunrise",
    "tranh vẽ": "painting",
    "nhiếp ảnh": "photography",
    "3D": "3D",
    "màu nước": "watercolor",
    "sơn dầu": "oil painting",
    "bút chì": "pencil drawing",
    "kỹ thuật số": "digital art",
    
    // Các từ về Đông y và thảo mộc
    "Đông y": "Traditional Eastern medicine",
    "thảo mộc": "herbs",
    "dược liệu": "medicinal herbs",
    "cây thuốc": "medicinal plants",
    "vườn thảo mộc": "herb garden",
    "trầm hương": "incense",
    "tinh dầu": "essential oil",
    "trà thảo mộc": "herbal tea",
    "châm cứu": "acupuncture",
    "bấm huyệt": "acupressure",
    "thiền": "meditation",
    "yoga": "yoga",
  };
  
  // Phương pháp dự phòng: dịch thủ công sử dụng bảng dịch
  let translatedPrompt = prompt;
  
  // Thay thế các cụm từ thông dụng
  Object.entries(commonTranslations).forEach(([vietnamese, english]) => {
    // Sử dụng RegExp với cờ i để không phân biệt hoa thường
    const regex = new RegExp(vietnamese, 'gi');
    translatedPrompt = translatedPrompt.replace(regex, english);
  });
  
  // Thêm chỉ dẫn để tạo ảnh chất lượng cao
  translatedPrompt += ", high quality, detailed, professional";
  
  return translatedPrompt;
}

/**
 * Tạo ảnh từ prompt
 * @param prompt Mô tả ảnh cần tạo
 * @param width Chiều rộng ảnh (tùy chọn)
 * @param height Chiều cao ảnh (tùy chọn)
 * @returns URL của ảnh đã tạo hoặc null nếu có lỗi
 */
export async function generateImage(prompt: string, width = 512, height = 512): Promise<string | null> {
  try {
    // Dịch prompt sang tiếng Anh trước khi tạo ảnh
    const translatedPrompt = await translatePromptToEnglish(prompt);
    console.log(`Translated prompt: "${prompt}" -> "${translatedPrompt}"`);
    
    const response = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        prompt: translatedPrompt, // Sử dụng prompt đã dịch
        originalPrompt: prompt,   // Gửi cả prompt gốc để lưu trữ
        width, 
        height 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Lỗi khi tạo ảnh");
    }

    const data = await response.json();
    return data.imageUrl || null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}
