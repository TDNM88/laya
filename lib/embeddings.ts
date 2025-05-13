import { createClient } from './groq-client';

// Cache để lưu trữ embedding đã tạo, giúp giảm số lượng API call
const embeddingCache = new Map<string, number[]>();

/**
 * Tạo embedding vector cho văn bản
 * Sử dụng thuật toán đơn giản thay vì gọi API vì Groq API không hỗ trợ các mô hình embedding
 */
export async function createEmbedding(text: string): Promise<number[]> {
  // Kiểm tra cache trước
  const cacheKey = text.substring(0, 100); // Sử dụng 100 ký tự đầu làm key
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }
  
  // Sử dụng thuật toán đơn giản thay vì gọi API
  // Điều này sẽ giúp tránh lỗi với Groq API không hỗ trợ các mô hình embedding
  const embedding = createSimpleEmbedding(text);
  
  // Lưu vào cache
  embeddingCache.set(cacheKey, embedding);
  
  return embedding;
}

/**
 * Thuật toán tạo embedding đơn giản làm fallback khi API không khả dụng
 */
function createSimpleEmbedding(text: string): number[] {
  // Tạo vector 128 chiều
  const embedding: number[] = new Array(128).fill(0);

  // Thuật toán hash cải tiến
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    
    // Tạo hash cho từng từ
    for (let j = 0; j < word.length; j++) {
      const charCode = word.charCodeAt(j);
      hash = ((hash << 5) - hash) + charCode;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Phân phối giá trị hash vào vector
    const position = Math.abs(hash) % embedding.length;
    embedding[position] += 1.0 / words.length;
    
    // Thêm trọng số cho từ ngữ quan trọng
    if (word.length > 5) {
      embedding[(position + 1) % embedding.length] += 0.5 / words.length;
    }
  }

  // Chuẩn hóa vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / (magnitude || 1));
}
