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
 * Đã được cải tiến để xử lý tốt hơn các thuật ngữ Đông y và từ ngữ chuyên ngành
 */
function createSimpleEmbedding(text: string): number[] {
  // Tạo vector 256 chiều để tăng độ phân giải
  const embedding: number[] = new Array(256).fill(0);

  // Chuẩn hóa văn bản
  const normalizedText = text.toLowerCase()
    .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ") // Loại bỏ dấu câu
    .replace(/\s+/g, " ")                         // Loại bỏ khoảng trắng thừa
    .trim();

  // Tách thành từ và cụm từ (n-grams)
  const words = normalizedText.split(/\s+/);
  const bigrams = [];
  const trigrams = [];
  
  // Tạo bigrams và trigrams để bắt các cụm từ đặc trưng
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
    if (i < words.length - 2) {
      trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }
  
  // Danh sách các từ và cụm từ quan trọng trong lĩnh vực Đông y
  const importantTerms = [
    "soi da", "bắt mệnh", "đông y", "lâm sàng", "chẩn đoán", "tri liệu", "cơ địa", "kinh lạc",
    "huyệt đạo", "tạng phủ", "ngũ tạng", "lục phủ", "tâm pháp", "tạng phủ", "kinh mạch", 
    "chẩn đoán", "bệnh cơ", "phương thuốc", "bài thuốc", "dược liệu", "thảo dược",
    "laya", "cao cấp", "giáo trình", "học viên", "mentor", "chứng chỉ", "khóa học"
  ];
  
  // Xử lý từng từ đơn
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
    embedding[position] += 1.0;
    
    // Tăng trọng số cho các từ dài (thường là các thuật ngữ quan trọng)
    if (word.length > 5) {
      embedding[(position + 1) % embedding.length] += 0.8;
    }
    
    // Tăng trọng số cho các từ đầu và cuối đoạn (thường chứa thông tin quan trọng)
    if (i === 0 || i === words.length - 1) {
      embedding[(position + 2) % embedding.length] += 1.2;
    }
  }
  
  // Xử lý các cụm từ (bigrams)
  for (const bigram of bigrams) {
    let hash = 0;
    for (let j = 0; j < bigram.length; j++) {
      const charCode = bigram.charCodeAt(j);
      hash = ((hash << 5) - hash) + charCode;
      hash = hash & hash;
    }
    
    const position = Math.abs(hash) % embedding.length;
    embedding[position] += 0.8; // Trọng số cho bigrams
    
    // Tăng trọng số cho các cụm từ quan trọng trong lĩnh vực Đông y
    if (importantTerms.some(term => bigram.includes(term))) {
      embedding[(position + 3) % embedding.length] += 2.0;
    }
  }
  
  // Xử lý các cụm từ (trigrams) - có thể bắt các khái niệm phức tạp hơn
  for (const trigram of trigrams) {
    let hash = 0;
    for (let j = 0; j < trigram.length; j++) {
      const charCode = trigram.charCodeAt(j);
      hash = ((hash << 5) - hash) + charCode;
      hash = hash & hash;
    }
    
    const position = Math.abs(hash) % embedding.length;
    embedding[position] += 0.6; // Trọng số cho trigrams
  }

  // Chuẩn hóa vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / (magnitude || 1));
}
