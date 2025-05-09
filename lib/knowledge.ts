import fs from "fs/promises"
import path from "path"
import { createEmbedding } from "./embeddings"

// Path to the knowledge base files
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge")

// Simple in-memory cache for knowledge embeddings
const knowledgeCache: {
  chunks: { text: string; embedding: number[]; source: string }[]
  loaded: boolean
} = {
  chunks: [],
  loaded: false,
}

// Load and process all knowledge files
export async function loadKnowledgeBase() {
  if (knowledgeCache.loaded) return

  try {
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

        // Split content into chunks
        const chunks = splitIntoChunks(content, 500)

        // Create embeddings for each chunk
        for (const chunk of chunks) {
          try {
            const embedding = await createEmbedding(chunk)
            knowledgeCache.chunks.push({ text: chunk, embedding, source: file })
          } catch (embeddingError) {
            console.error(`Error creating embedding for chunk in ${file}:`, embeddingError)
          }
        }

        console.log(`Processed file: ${file} - Added ${chunks.length} chunks`)
      } catch (error) {
        console.error(`Error processing file ${file}:`, error)
      }
    }

    knowledgeCache.loaded = true
  } catch (error) {
    console.error("Error loading knowledge base:", error)
    // Create the directory if it doesn't exist
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true })
  }
}

// Split text into chunks of roughly equal size
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  
  // Kiểm tra nếu văn bản có dạng Q&A với các câu hỏi và câu trả lời
  if (text.includes('→ Trả lời:') || text.includes('?')) {
    // Tách văn bản theo các câu hỏi và câu trả lời
    const qaPattern = /(\d+\.?\s*[^\n]+\?[\s\n]*→ Trả lời:[^\n]*(?:\n[^\d\n][^\n]*)*)/g;
    const matches = text.match(qaPattern);
    
    if (matches && matches.length > 0) {
      // Nếu tìm thấy các cặp Q&A, sử dụng chúng làm các chunk
      console.log(`Found ${matches.length} Q&A pairs in text`);
      return matches;
    }
  }
  
  // Nếu không phải dạng Q&A, sử dụng phương pháp tách câu thông thường
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    // Nếu thêm câu này sẽ vượt quá kích thước tối đa và chunk hiện tại không trống
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    currentChunk += (currentChunk ? " " : "") + sentence;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Calculate cosine similarity between two vectors
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

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Get relevant knowledge for a query
export async function getCompanyKnowledge(query: string): Promise<string> {
  await loadKnowledgeBase()

  // If no knowledge is loaded, return a default message
  if (knowledgeCache.chunks.length === 0) {
    return "Chưa có dữ liệu kiến thức nào được tải lên. Vui lòng thêm tệp kiến thức vào thư mục 'knowledge'."
  }

  // Create an embedding for the query
  const queryEmbedding = await createEmbedding(query)

  // Find the most relevant chunks
  const relevantChunks = knowledgeCache.chunks
    .map((chunk) => ({
      text: chunk.text,
      source: chunk.source,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3) // Get top 3 most relevant chunks

  // Return the relevant knowledge with source information
  return relevantChunks.map((chunk) => `[Nguồn: ${chunk.source}]\n${chunk.text}`).join("\n\n")
}

// Thêm searchDocuments như một alias cho getCompanyKnowledge
export async function searchDocuments(query: string): Promise<Array<{content: string; source: string; similarity: number}>> {
  await loadKnowledgeBase()

  // If no knowledge is loaded, return an empty array
  if (knowledgeCache.chunks.length === 0) {
    console.warn("No knowledge chunks available for search")
    return []
  }

  try {
    // Chuẩn hóa câu hỏi để tăng khả năng tìm kiếm
    const normalizedQuery = query.toLowerCase().trim();
    
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
    
    // Nếu không có kết quả chính xác, sử dụng embedding
    console.log("No exact matches found, using embeddings search");
    const queryEmbedding = await createEmbedding(query)

    // Giảm ngưỡng độ tương đồng tối thiểu để tăng khả năng tìm kiếm
    const MIN_SIMILARITY_THRESHOLD = 0.3;
    
    // Find the most relevant chunks
    const relevantChunks = knowledgeCache.chunks
      .map((chunk) => ({
        content: chunk.text,
        source: chunk.source,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
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
    
    return relevantChunks
  } catch (error) {
    console.error("Error searching knowledge base:", error)
    return [] // Return empty array in case of error
  }
}
