import fs from "fs/promises"
import path from "path"

// Path to the knowledge base files
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge")

// Ensure the knowledge directory exists
export async function ensureKnowledgeDir() {
  try {
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true })
    return true
  } catch (error) {
    console.error("Error creating knowledge directory:", error)
    return false
  }
}

// List all files in the knowledge directory
export async function listKnowledgeFiles() {
  try {
    const files = await fs.readdir(KNOWLEDGE_DIR)

    // Get file stats for each file
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(KNOWLEDGE_DIR, file)
        const stats = await fs.stat(filePath)
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        }
      }),
    )

    return fileDetails
  } catch (error) {
    console.error("Error listing knowledge files:", error)
    return []
  }
}

// Cải thiện hàm deleteKnowledgeFile để xử lý lỗi tốt hơn và ghi log chi tiết

export async function deleteKnowledgeFile(fileName: string) {
  try {
    // Kiểm tra đường dẫn để đảm bảo không có ký tự đặc biệt
    if (fileName.includes("..") || fileName.includes("/")) {
      console.error(`Invalid file name: ${fileName}`)
      return false
    }

    const filePath = path.join(KNOWLEDGE_DIR, fileName)

    // Kiểm tra xem file có tồn tại không
    try {
      await fs.access(filePath)
    } catch (error) {
      console.error(`File does not exist: ${filePath}`)
      return false
    }

    // Thực hiện xóa file
    await fs.unlink(filePath)
    console.log(`Successfully deleted file: ${filePath}`)

    return true
  } catch (error) {
    console.error(`Error deleting file ${fileName}:`, error)
    return false
  }
}

// Check if a file exists in the knowledge directory
export async function fileExists(fileName: string) {
  try {
    const filePath = path.join(KNOWLEDGE_DIR, fileName)
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
