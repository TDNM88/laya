// This is a simplified embedding function
// In a production environment, you would use a proper embedding model
// like OpenAI's text-embedding-ada-002 or a local embedding model

export async function createEmbedding(text: string): Promise<number[]> {
  // This is a very simple embedding function that creates a basic vector
  // In a real application, replace this with a call to a proper embedding API

  // For demonstration purposes, we'll create a simple hash-based embedding
  const embedding: number[] = new Array(128).fill(0)

  // Simple hash function to distribute values
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)
    const position = i % embedding.length
    embedding[position] += charCode / 255 // Normalize to 0-1 range
  }

  // Normalize the embedding vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map((val) => val / (magnitude || 1))
}
