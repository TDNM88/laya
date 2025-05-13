import fs from "fs/promises"
import path from "path"
import { createEmbedding } from "./embeddings"

// Path to the knowledge base files
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge")

// Cấu trúc dữ liệu cải tiến cho knowledge cache
interface KnowledgeChunk {
  text: string;
  embedding: number[];
  source: string;
  category: string; // Thêm trường category để phân loại thông tin
  metadata: {
    title: string;
    section: string;
    importance: number; // Độ quan trọng của chunk (1-10)
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
    let availableFiles: string[] = []
    try {
      availableFiles = await fs.readdir(KNOWLEDGE_DIR)
      console.log(`Found ${availableFiles.length} files in knowledge directory:`, availableFiles)
    } catch (error) {
      console.error("Error reading knowledge directory:", error)
    }

    // If no files found, log a warning
    if (availableFiles.length === 0) {
      console.warn("No knowledge files found in directory. Knowledge base will be empty.")
    }

    // Process each available file
    for (const file of availableFiles) {
      try {
        const filePath = path.join(KNOWLEDGE_DIR, file)

        // Skip directories or non-text files
        try {
          const stats = await fs.stat(filePath)
          if (stats.isDirectory()) {
            console.log(`Skipping directory: ${file}`)
            continue
          }
          
          // Simple check for text files - could be improved
          if (!file.endsWith('.txt') && !file.endsWith('.md')) {
            console.log(`Skipping non-text file: ${file}`)
            continue
          }
        } catch (error) {
          console.error(`Error checking file ${file}:`, error)
          continue
        }

        // Read and process the file
        const content = await fs.readFile(filePath, "utf-8")
        
        // Trích xuất tiêu đề từ nội dung
        const title = extractTitleFromContent(content);
        
        // Phân loại file
        const category = categorizeFile(file);

        // Split content into chunks with improved chunking
        const chunks = splitIntoChunks(content, 500)

        // Create embeddings for each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          try {
            const embedding = await createEmbedding(chunk)
            
            // Tính toán độ quan trọng của chunk
            // Chunks ở đầu file thường quan trọng hơn (tiêu đề, giới thiệu)
            // Chunks có nhiều từ khóa quan trọng sẽ có trọng số cao hơn
            const importance = calculateChunkImportance(chunk, i, chunks.length);
            
            knowledgeCache.chunks.push({
              text: chunk, 
              embedding, 
              source: file,
              category,
              metadata: {
                title,
                section: extractSectionFromChunk(chunk),
                importance
              }
            })
          } catch (embeddingError) {
            console.error(`Error creating embedding for chunk in ${file}:`, embeddingError)
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

// Tính toán độ quan trọng của chunk
function calculateChunkImportance(chunk: string, index: number, totalChunks: number): number {
  // Chunks ở đầu file thường quan trọng hơn (tiêu đề, giới thiệu)
  const positionScore = Math.max(1, 10 - Math.floor((index / totalChunks) * 10));
  
  // Kiểm tra các từ khóa quan trọng
  const importantKeywords = [
    "chính sách", "quy định", "hướng dẫn", "bắt buộc", "quan trọng", 
    "lưu ý", "cảnh báo", "yêu cầu", "tiêu chuẩn", "cấp độ", "mentor"
  ];
  
  let keywordScore = 0;
  const lowerChunk = chunk.toLowerCase();
  
  for (const keyword of importantKeywords) {
    if (lowerChunk.includes(keyword)) {
      keywordScore += 1;
    }
  }
  
  // Điều chỉnh keywordScore để không vượt quá 5
  keywordScore = Math.min(5, keywordScore);
  
  // Tổng hợp điểm (tối đa là 10)
  return Math.min(10, positionScore + keywordScore);
}

// Trích xuất thông tin phần/mục từ chunk
function extractSectionFromChunk(chunk: string): string {
  // Tìm các pattern như "CHƯƠNG 1", "PHẦN I", "MỤC 1.2", etc.
  const sectionPatterns = [
    /CHƯƠNG\s+[\dIVXLC]+/i,
    /PHẦN\s+[\dIVXLC]+/i,
    /MỤC\s+[\d\.]+/i,
    /[IVX]+\.\s+[A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ]/
  ];
  
  for (const pattern of sectionPatterns) {
    const match = chunk.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return "Không xác định";
}

// Split text into chunks with improved chunking strategy
export function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  
  // Kiểm tra nếu văn bản có dạng Q&A với các câu hỏi và câu trả lời
  if (text.includes('→ Trả lời:') || text.includes('?')) {
    // Tách văn bản theo các câu hỏi và câu trả lời
    const qaPattern = /(\d+\.?\s*[^\n]+\?[\s\n]*→ Trả lời:[^\n]*(?:\n[^\d\n][^\n]*)*)\n?/g;
    const matches = text.match(qaPattern);
    
    if (matches && matches.length > 0) {
      console.log(`Found ${matches.length} Q&A pairs in text`);
      return matches;
    }
  }
  
  // Tìm các đoạn văn bản có cấu trúc rõ ràng (tiêu đề, mục, chương)
  const sectionPattern = /(?:^|\n)(?:CHƯƠNG|PHẦN|MỤC|[IVX]+\.)[\s\d\.]+[A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ][^\n]*(?:\n(?![A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ])[^\n]*)*/g;
  const sections = text.match(sectionPattern);
  
  if (sections && sections.length > 0) {
    // Nếu tìm thấy các phần có cấu trúc, sử dụng chúng làm các chunk
    console.log(`Found ${sections.length} structured sections in text`);
    
    for (const section of sections) {
      // Nếu phần quá dài, chia nhỏ hơn nữa
      if (section.length > maxChunkSize * 2) {
        const subChunks = splitTextByParagraphs(section, maxChunkSize);
        chunks.push(...subChunks);
      } else {
        chunks.push(section);
      }
    }
    
    return chunks;
  }
  
  // Nếu không tìm thấy cấu trúc rõ ràng, chia theo đoạn văn
  return splitTextByParagraphs(text, maxChunkSize);
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

// Calculate cosine similarity between two vectors with improved precision
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  
  // Xử lý các trường hợp đặc biệt (NaN, Infinity)
  if (isNaN(similarity) || !isFinite(similarity)) {
    return 0;
  }
  
  return similarity;
}

// Hàm trích xuất từ khóa từ câu hỏi
function extractKeywords(query: string): string[] {
  // Danh sách các từ dừng (stop words) tiếng Việt
  const stopWords = [
    "và", "của", "là", "để", "trong", "có", "không", "với", "các", "lên", "về", "cho", "bị", "lúc", "ra", "tại", "vừa", "một", "như", "còn", "lại", 
    "vời", "các", "bị", "làm", "nên", "theo", "tạo", "thì", "hay", "trên", "vào", "bạn", "tôi", "anh", "chị", "em", "họ", "cô", "chú", "bác", "chúng", "ta", "mình", "cái", "này", "nào", "thế", "mà", "rằng", "thì", "làm", "sao", "vậy", "nên", "khi", "phải", "cần", "muốn", "gì", "còn"
  ];
  
  // Chuẩn hóa câu hỏi
  const normalizedQuery = query.toLowerCase().trim();
  
  // Tách các từ trong câu hỏi
  const words = normalizedQuery.split(/\s+/);
  
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
export async function searchDocuments(query: string): Promise<Array<{content: string; source: string; similarity: number}>> {
  await loadKnowledgeBase();

  // If no knowledge is loaded, return an empty array
  if (knowledgeCache.chunks.length === 0) {
    console.warn("No knowledge chunks available for search");
    return [];
  }

  try {
    // Chuẩn hóa câu hỏi để tăng khả năng tìm kiếm
    const normalizedQuery = query.toLowerCase().trim();
    
    // Phân tích từ khóa quan trọng trong câu hỏi
  const keywords = extractKeywords(normalizedQuery);
  
  // Tìm kiếm chính xác trước (exact match)
  const exactMatches = knowledgeCache.chunks.filter(chunk => {
    const normalizedText = chunk.text.toLowerCase();
    return normalizedText.includes(normalizedQuery) || 
           normalizedQuery.includes(normalizedText.substring(0, Math.min(normalizedText.length, 30)));
  });
  
  if (exactMatches.length > 0) {
    console.log(`Found ${exactMatches.length} exact matches for query: "${query}"`);
    return exactMatches.map(chunk => ({
      content: chunk.text,
      source: chunk.source,
      similarity: 1.0 // Đặt độ tương đồng cao nhất cho kết quả chính xác
    }));
  }
  
  // Tìm kiếm dựa trên từ khóa
  if (keywords.length > 0) {
    const keywordMatches = knowledgeCache.chunks.filter(chunk => {
      const normalizedText = chunk.text.toLowerCase();
      // Chunk phải chứa ít nhất 50% số từ khóa quan trọng
      const matchedKeywords = keywords.filter(keyword => normalizedText.includes(keyword));
      return matchedKeywords.length >= Math.ceil(keywords.length * 0.5);
    });
    
    if (keywordMatches.length > 0) {
      console.log(`Found ${keywordMatches.length} keyword matches for query: "${query}"`);
      
      // Sắp xếp theo độ quan trọng của chunk và số lượng từ khóa khớp
      return keywordMatches.map(chunk => {
        const normalizedText = chunk.text.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => normalizedText.includes(keyword));
        const keywordScore = matchedKeywords.length / keywords.length;
        
        // Kết hợp điểm từ khóa và độ quan trọng của chunk
        const combinedScore = 0.7 * keywordScore + 0.3 * (chunk.metadata.importance / 10);
        
        return {
          content: chunk.text,
          source: chunk.source,
          similarity: combinedScore
        };
      }).sort((a, b) => b.similarity - a.similarity);
    }
  }
  
  // Nếu không có kết quả chính xác, sử dụng embedding
  console.log("No exact or keyword matches found, using embeddings search");
  const queryEmbedding = await createEmbedding(query)

  // Giảm ngưỡng độ tương đồng tối thiểu để tăng khả năng tìm kiếm
  const MIN_SIMILARITY_THRESHOLD = 0.3;
  
  // Find the most relevant chunks
  const relevantChunks = knowledgeCache.chunks
    .map((chunk) => ({
      content: chunk.text,
      source: chunk.source,
      // Kết hợp độ tương đồng vector và độ quan trọng của chunk
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding) * (0.7 + 0.3 * chunk.metadata.importance / 10),
    }))
    // Lọc các kết quả có độ tương đồng thấp
    .filter(chunk => chunk.similarity >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 7) // Tăng lên 7 kết quả để có nhiều thông tin hơn
  
  console.log(`Found ${relevantChunks.length} relevant chunks for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  
  // Nếu vẫn không tìm thấy kết quả, trả về top 5 kết quả gần nhất bất kể độ tương đồng
  if (relevantChunks.length === 0) {
    console.log("No chunks above threshold, returning top 5 results regardless of similarity");
    return knowledgeCache.chunks
      .map((chunk) => ({
        content: chunk.text,
        source: chunk.source,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
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
