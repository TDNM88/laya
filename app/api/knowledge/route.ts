import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { processDocument } from "@/lib/document-processor"
import { listKnowledgeFiles } from "@/lib/file-utils"
import * as fs from "fs/promises"

// Knowledge directory path
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge")

// Ensure the knowledge directory exists
async function ensureKnowledgeDir() {
  try {
    if (!existsSync(KNOWLEDGE_DIR)) {
      await mkdir(KNOWLEDGE_DIR, { recursive: true })
    }
  } catch (error) {
    console.error("Error creating knowledge directory:", error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 400 })
    }

    // Check file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith(".txt") && !fileName.endsWith(".doc") && !fileName.endsWith(".docx")) {
      return NextResponse.json({ error: "Chỉ hỗ trợ tệp .txt, .doc, và .docx" }, { status: 400 })
    }

    // Ensure knowledge directory exists
    await ensureKnowledgeDir()

    // Save the file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const filePath = path.join(KNOWLEDGE_DIR, fileName)
    await writeFile(filePath, buffer)

    // Process the document for the knowledge base
    await processDocument(filePath, fileName)

    return NextResponse.json({
      success: true,
      message: "Tệp đã được tải lên thành công",
      fileName,
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json({ error: "Đã xảy ra lỗi khi tải lên tệp" }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Get actual files from the knowledge directory
    const files = await listKnowledgeFiles()
    return NextResponse.json({ files })
  } catch (error) {
    console.error("Error getting knowledge files:", error)
    return NextResponse.json({ error: "Đã xảy ra lỗi khi lấy danh sách tệp" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json()
    const { fileName } = data

    console.log("Attempting to delete file:", fileName)

    if (!fileName) {
      console.error("No fileName provided in request")
      return NextResponse.json({ error: "Tên tệp không được cung cấp" }, { status: 400 })
    }

    // Kiểm tra xem file có tồn tại không trước khi xóa
    const filePath = path.join(KNOWLEDGE_DIR, fileName)
    let fileExists = false

    try {
      await fs.access(filePath)
      fileExists = true
    } catch (error) {
      console.error(`File does not exist: ${filePath}`)
      return NextResponse.json({ error: `Tệp ${fileName} không tồn tại` }, { status: 404 })
    }

    if (fileExists) {
      // Xóa file
      try {
        await fs.unlink(filePath)
        console.log(`Successfully deleted file: ${filePath}`)

        return NextResponse.json({
          success: true,
          message: `Đã xóa tệp ${fileName}`,
        })
      } catch (error) {
        console.error(`Error deleting file: ${filePath}`, error)
        return NextResponse.json(
          { error: `Không thể xóa tệp ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}` },
          { status: 500 },
        )
      }
    }
  } catch (error) {
    console.error("Error in DELETE handler:", error)
    return NextResponse.json({ error: "Đã xảy ra lỗi khi xóa tệp" }, { status: 500 })
  }
}
