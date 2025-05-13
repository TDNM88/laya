import fs from "fs/promises"
import path from "path"
import { createEmbedding } from "./embeddings"
import { v4 as uuidv4 } from 'uuid';

// Path to the knowledge base files
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge")

// Cấu trúc dữ liệu cải tiến cho knowledge cache
interface KnowledgeChunk {
  id: string;
  text: string;
  fullContent: string;
  embedding: number[];
  source: string;
  category: string; // Thêm trường category để phân loại thông tin
  metadata: {
    importance: number; // Độ quan trọng của chunk (1-10)
    timestamp: number;
    keywords: string[];
  };
}

// Simple in-memory cache for knowledge embeddings
const knowledgeCache: {
  chunks: KnowledgeChunk[];
  loaded: boolean;
  lastUpdated: Date;
} = {
  chunks: [],
  loaded: false,
  lastUpdated: new Date(0)
}

// Hàm phân loại file dựa trên tên file
function categorizeFile(filename: string): string {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes("chính sách") || lowerFilename.includes("chinh sach")) {
    return "chinh-sach";
  } else if (lowerFilename.includes("giáo trình") || lowerFilename.includes("giao trinh")) {
    return "giao-trinh";
  } else if (lowerFilename.includes("câu hỏi") || lowerFilename.includes("q&a") || lowerFilename.includes("qa")) {
    return "qa";
  } else {
    return "khac";
  }
}

// Trích xuất tiêu đề từ nội dung file
function extractTitleFromContent(content: string): string {
  // Tìm dòng đầu tiên có nội dung có ý nghĩa
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && trimmedLine.length > 5) {
      return trimmedLine;
    }
  }
  return "Không có tiêu đề";
}

// Load and process all knowledge files with enhanced processing
/**
 * Kiểm tra xem câu hỏi có liên quan đến giáo trình Soi Da Bắt Mệnh hay không
 * @param query Câu hỏi của người dùng
 * @returns true nếu câu hỏi liên quan đến Soi Da Bắt Mệnh
 */
function checkIfSoiDaQuery(query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  
  // Các từ khóa liên quan đến Soi Da Bắt Mệnh
  const soiDaKeywords = [
    "soi da", "bắt mệnh", "chẩn đoán", "tướng pháp", "tướng học", 
    "tạng phủ", "ngũ tạng", "lục phủ", "kinh mạch", "huyệt đạo",
    "cơ địa", "thể trạng", "bệnh cơ", "dấu hiệu", "triệu chứng", 
    "chẩn đoán", "phương pháp", "kỹ thuật", "cao cấp", "laya"
  ];
  
  // Kiểm tra xem câu hỏi có chứa các từ khóa liên quan không
  for (const keyword of soiDaKeywords) {
    if (normalizedQuery.includes(keyword)) {
      return true;
    }
  }
  
  // Kiểm tra các cụm từ đặc trưng
  const soiDaPhrases = [
    "giáo trình soi da", "soi da bắt mệnh", "phương pháp soi da", 
    "kỹ thuật soi da", "chẩn đoán qua da", "dấu hiệu trên da",
    "tướng pháp đông y", "lý thuyết đông y"
  ];
  
  for (const phrase of soiDaPhrases) {
    if (normalizedQuery.includes(phrase)) {
      return true;
    }
  }
  
  // Kiểm tra các câu hỏi trực tiếp về giáo trình
  if (normalizedQuery.includes("giáo trình") && 
      (normalizedQuery.includes("soi da") || normalizedQuery.includes("bắt mệnh") || normalizedQuery.includes("laya"))) {
    return true;
  }
  
  return false;
}

export async function loadKnowledgeBase(forceReload = false) {
  // Nếu đã tải và không yêu cầu tải lại, return ngay
  if (knowledgeCache.loaded && !forceReload) return;

  try {
    // Reset cache nếu tải lại
    if (forceReload) {
      knowledgeCache.chunks = [];
    }

    // Create the directory if it doesn't exist
    try {
      await fs.mkdir(KNOWLEDGE_DIR, { recursive: true })
    } catch (error) {
      // Directory might already exist, ignore error
      console.log("Knowledge directory already exists or could not be created")
    }

    // Get the list of files that actually exist in the directory
    let files: string[] = []
    try {
      files = await fs.readdir(KNOWLEDGE_DIR)
      console.log(`Found ${files.length} files in knowledge directory:`, files)
    } catch (error) {
      console.error("Error reading knowledge directory:", error)
    }

    // If no files found, log a warning
    if (files.length === 0) {
      console.warn("No knowledge files found in directory. Knowledge base will be empty.")
    }

    // Process each file in the knowledge directory
    for (const file of files) {
      try {
        const filePath = path.join(KNOWLEDGE_DIR, file)
        const content = await fs.readFile(filePath, "utf-8")

        // Phân loại file
        const category = categorizeFile(file)

        // Xác định độ quan trọng dựa trên danh mục
        let importance = 5 // Mức trung bình mặc định
        if (category === "giao-trinh") {
          importance = 9 // Giáo trình có độ quan trọng cao
        } else if (category === "chinh-sach") {
          importance = 8 // Chính sách cũng quan trọng
        } else if (category === "qa") {
          importance = 7
        }

        // Chia nội dung thành các chunk
        const chunks = chunkContent(content, file)

        // Tạo embedding cho từng chunk
        for (const chunk of chunks) {
          try {
            // Tạo embedding cho chunk
            const embedding = await createEmbedding(chunk.text)

            // Trích xuất các từ khóa từ nội dung chunk
            const keywords = extractKeywordsFromContent(chunk.text)

            knowledgeCache.chunks.push({
              id: `${file}-${uuidv4()}`,
              text: chunk.text,
              fullContent: chunk.fullContent || chunk.text,
              embedding,
              source: file,
              category,
              metadata: {
                importance,
                timestamp: Date.now(),
                keywords,
              },
            })
          } catch (chunkError) {
            console.error(`Error processing chunk from file ${file}:`, chunkError)
          }
        }

        console.log(`Processed file: ${file} - Added ${chunks.length} chunks in category: ${category}`)
      } catch (error) {
        console.error(`Error processing file ${file}:`, error)
      }
    }

    knowledgeCache.loaded = true
    knowledgeCache.lastUpdated = new Date();
    console.log(`Knowledge base loaded with ${knowledgeCache.chunks.length} total chunks`);
  } catch (error) {
    console.error("Error loading knowledge base:", error)
    // Create the directory if it doesn't exist
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true })
  }
}

// Chia nội dung thành các chunk
function chunkContent(content: string, filename: string): { text: string; fullContent: string }[] {
  // Tách nội dung thành các đoạn văn
  const paragraphs = content.split(/\n\s*\n/);

  const chunks: { text: string; fullContent: string }[] = [];

  for (const paragraph of paragraphs) {
    // Nếu đoạn văn quá dài, chia nhỏ hơn nữa
    if (paragraph.length > 500) {
      const subChunks = splitTextByParagraphs(paragraph, 500);
      chunks.push(...subChunks.map(subChunk => ({ text: subChunk, fullContent: content })));
    } else {
      chunks.push({ text: paragraph, fullContent: content });
    }
  }

  return chunks;
}

// Chia văn bản thành các đoạn
function splitTextByParagraphs(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/); // Tách theo đoạn văn
  
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    // Nếu đoạn văn này thêm vào sẽ vượt quá kích thước tối đa và chunk hiện tại không trống
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
    
    // Nếu một đoạn văn đơn lẻ đã vượt quá kích thước tối đa
    if (paragraph.length > maxChunkSize) {
      // Nếu chunk hiện tại không trống, lưu lại trước
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      
      // Chia đoạn văn dài thành các câu
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = "";
        }
        
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Trích xuất từ khóa từ nội dung
function extractKeywordsFromContent(content: string): string[] {
  // Danh sách các từ dừng (stop words) tiếng Việt
  const stopWords = [
    "và", "của", "là", "để", "trong", "có", "không", "với", "các", "lên", "về", "cho", "bị", "lúc", "ra", "tại", "vừa", "một", "như", "còn", "lại", 
    "vời", "các", "bị", "làm", "nên", "theo", "tạo", "thì", "hay", "trên", "vào", "bạn", "tôi", "anh", "chị", "em", "họ", "cô", "chú", "bác", "chúng", "ta", "mình", "cái", "này", "nào", "thế", "mà", "rằng", "thì", "làm", "sao", "vậy", "nên", "khi", "phải", "cần", "muốn", "gì", "còn"
  ];
  
  // Chuẩn hóa nội dung
  const normalizedContent = content.toLowerCase().trim();
  
  // Tách các từ trong nội dung
  const words = normalizedContent.split(/\s+/);
  
  // Loại bỏ các từ dừng
  const filteredWords = words.filter(word => {
    // Loại bỏ các từ quá ngắn
    if (word.length < 2) return false;
    
    // Loại bỏ các từ dừng
    if (stopWords.includes(word)) return false;
    
    return true;
  });
  
  // Trả về các từ khóa duy nhất
  return [...new Set(filteredWords)];
}

// Tìm kiếm thông tin từ knowledge base với độ chính xác cao
export async function searchDocuments(query: string, extractFullContent: boolean = false): Promise<Array<{content: string; source: string; similarity: number; fullContent?: string}>> {
  await loadKnowledgeBase();

  // If no knowledge is loaded, return an empty array
  if (knowledgeCache.chunks.length === 0) {
    console.warn("No knowledge chunks available for search");
    return [];
  }
  
  // Kiểm tra xem câu hỏi có liên quan đến giáo trình Soi Da Bắt Mệnh hay không
  const isSoiDaQuery = checkIfSoiDaQuery(query);
  
  try {
    // Tạo embedding cho câu hỏi
    const queryEmbedding = await createEmbedding(query);
    
    // Nếu câu hỏi liên quan đến Soi Da Bắt Mệnh, ưu tiên tìm kiếm trong giáo trình này
    let searchChunks = knowledgeCache.chunks;
    if (isSoiDaQuery) {
      const soiDaChunks = knowledgeCache.chunks.filter(chunk => 
        chunk.source.toLowerCase().includes("soi da") || 
        chunk.source.toLowerCase().includes("bắt mệnh")
      );
      
      if (soiDaChunks.length > 0) {
        searchChunks = soiDaChunks;
        console.log(`Found ${soiDaChunks.length} chunks related to Soi Da Bắt Mệnh, prioritizing these results.`);
      }
    }
  
    // Find the most relevant chunks
    const relevantChunks = searchChunks
      .map((chunk) => {
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding) * (0.7 + 0.3 * chunk.metadata.importance / 10);
        return {
          content: chunk.text,
          source: chunk.source,
          similarity,
          fullContent: extractFullContent ? chunk.fullContent || chunk.text : undefined
        };
      })
      // Lọc các kết quả có độ tương đồng thấp
      .filter(chunk => chunk.similarity >= 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 7); // Tăng lên 7 kết quả để có thêm bối cảnh
    
    // Nếu không có kết quả nào đạt ngưỡng, trả về 5 kết quả tốt nhất
    if (relevantChunks.length === 0) {
      console.log("No chunks above threshold, returning top 5 results regardless of similarity");
      return searchChunks
        .map((chunk) => ({
          content: chunk.text,
          source: chunk.source,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
          fullContent: extractFullContent ? chunk.fullContent || chunk.text : undefined
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
    }
    
    return relevantChunks;
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    return []; // Return empty array in case of error
  }
}

// Tính độ tương đồng cosine giữa hai vector với các cải tiến để tăng độ chính xác
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions do not match: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  let nonZeroElements = 0;

  for (let i = 0; i < a.length; i++) {
    // Chỉ tính toán trên các phần tử khác 0 để giảm nhiễu
    if (a[i] !== 0 || b[i] !== 0) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
      nonZeroElements++;
    }
  }

  // Nếu không có phần tử nào khác 0, trả về 0
  if (nonZeroElements === 0) {
    return 0;
  }

  // Tính toán độ tương đồng cosine
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  
  // Xử lý các trường hợp đặc biệt (NaN, Infinity)
  if (isNaN(similarity) || !isFinite(similarity)) {
    return 0;
  }
  
  // Áp dụng hàm sigmoid để tăng độ tương phản giữa các kết quả
  // Giúp phân biệt rõ ràng hơn giữa các kết quả tốt và kém
  const enhancedSimilarity = 1 / (1 + Math.exp(-10 * (similarity - 0.5)));
  
  return enhancedSimilarity;
}
