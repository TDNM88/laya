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
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)

  let currentChunk = ""

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = ""
    }

    currentChunk += (currentChunk ? " " : "") + sentence
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
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
    // Create an embedding for the query
    const queryEmbedding = await createEmbedding(query)

    // Find the most relevant chunks
    const relevantChunks = knowledgeCache.chunks
      .map((chunk) => ({
        content: chunk.text,
        source: chunk.source,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3) // Get top 3 most relevant chunks
    
    console.log(`Found ${relevantChunks.length} relevant chunks for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`)
    return relevantChunks
  } catch (error) {
    console.error("Error searching knowledge base:", error)
    return [] // Return empty array in case of error
  }
}
