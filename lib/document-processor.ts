import { readFile } from "fs/promises"
import mammoth from "mammoth"
import { createEmbedding } from "./embeddings"

// Process different document types
export async function processDocument(filePath: string, fileName: string) {
  try {
    let text = ""

    if (fileName.endsWith(".txt")) {
      // Process text file
      const buffer = await readFile(filePath)
      text = buffer.toString("utf-8")
    } else if (fileName.endsWith(".doc") || fileName.endsWith(".docx")) {
      // Process Word document
      const buffer = await readFile(filePath)
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      throw new Error("Unsupported file format")
    }

    // Process the text for the knowledge base
    await processTextForKnowledgeBase(text, fileName)

    return { success: true }
  } catch (error) {
    console.error(`Error processing document ${fileName}:`, error)
    throw error
  }
}

// Process text and create embeddings for the knowledge base
async function processTextForKnowledgeBase(text: string, fileName: string) {
  try {
    // Split text into chunks
    const chunks = splitIntoChunks(text, 500)

    // Create embeddings for each chunk
    for (const chunk of chunks) {
      const embedding = await createEmbedding(chunk)

      // In a real implementation, you would store these embeddings
      // along with the text chunks in a database or vector store
      console.log(`Created embedding for chunk from ${fileName}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error processing text for knowledge base:", error)
    throw error
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
