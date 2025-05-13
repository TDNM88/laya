import fs from "fs/promises";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const OUTPUT_DIR = path.join(process.cwd(), "knowledge", "processed");

interface ProcessedFile {
  originalName: string;
  processedName: string;
  category: string;
  chunks: number;
  size: number;
}

async function convertKnowledgeFiles() {
  console.log("=== CHUYỂN ĐỔI FILE KNOWLEDGE LAYA CHATBOT ===\n");
  
  try {
    // Tạo thư mục đầu ra nếu chưa tồn tại
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Đọc danh sách file trong thư mục knowledge
    const files = await fs.readdir(KNOWLEDGE_DIR);
    const textFiles = files.filter(file => 
      file.endsWith('.txt') && 
      !path.relative(KNOWLEDGE_DIR, path.join(KNOWLEDGE_DIR, file)).includes(path.sep)
    );
    
    console.log(`Tìm thấy ${textFiles.length} file txt cần chuyển đổi.`);
    
    const processedFiles: ProcessedFile[] = [];
    
    // Xử lý từng file
    for (const file of textFiles) {
      console.log(`\nĐang xử lý file: ${file}`);
      const filePath = path.join(KNOWLEDGE_DIR, file);
      
      // Đọc nội dung file
      const content = await fs.readFile(filePath, "utf-8");
      
      // Phân loại file
      const category = categorizeFile(file);
      
      // Xử lý nội dung
      const processedContent = processContent(content, category);
      
      // Tạo tên file mới
      const processedFileName = `${category}_${file}`;
      const outputPath = path.join(OUTPUT_DIR, processedFileName);
      
      // Lưu file đã xử lý
      await fs.writeFile(outputPath, processedContent);
      
      // Thống kê
      const stats = {
        originalName: file,
        processedName: processedFileName,
        category,
        chunks: countChunks(processedContent),
        size: processedContent.length
      };
      
      processedFiles.push(stats);
      
      console.log(`  ✓ Đã chuyển đổi thành: ${processedFileName}`);
      console.log(`  ✓ Phân loại: ${category}`);
      console.log(`  ✓ Kích thước: ${stats.size} ký tự, ${stats.chunks} chunks`);
    }
    
    // Tạo file thống kê
    const statsPath = path.join(OUTPUT_DIR, "conversion_stats.json");
    await fs.writeFile(statsPath, JSON.stringify({
      totalFiles: processedFiles.length,
      totalChunks: processedFiles.reduce((sum, file) => sum + file.chunks, 0),
      totalSize: processedFiles.reduce((sum, file) => sum + file.size, 0),
      files: processedFiles,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log("\n=== CHUYỂN ĐỔI HOÀN TẤT ===");
    console.log(`Tổng số file đã xử lý: ${processedFiles.length}`);
    console.log(`Tổng số chunks: ${processedFiles.reduce((sum, file) => sum + file.chunks, 0)}`);
    console.log(`Thư mục chứa file đã xử lý: ${OUTPUT_DIR}`);
    console.log(`Thống kê chi tiết: ${statsPath}`);
    
  } catch (error) {
    console.error("Lỗi khi chuyển đổi file knowledge:", error);
  }
}

// Phân loại file dựa trên tên file
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

// Xử lý nội dung file
function processContent(content: string, category: string): string {
  // Loại bỏ khoảng trắng thừa
  let processed = content.replace(/\r\n/g, '\n')
                         .replace(/\n{3,}/g, '\n\n')
                         .replace(/[ \t]+\n/g, '\n')
                         .trim();
  
  // Chuẩn hóa tiêu đề
  const firstLine = processed.split('\n')[0];
  if (!firstLine.match(/^[A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\s]+$/)) {
    // Nếu dòng đầu tiên không phải là tiêu đề viết hoa, thêm tiêu đề từ tên file
    const titleFromFilename = extractTitleFromCategory(category);
    processed = `${titleFromFilename}\n\n${processed}`;
  }
  
  // Xử lý theo từng loại file
  if (category === "qa") {
    // Định dạng Q&A
    processed = formatQA(processed);
  } else if (category === "giao-trinh") {
    // Định dạng giáo trình
    processed = formatCurriculum(processed);
  } else if (category === "chinh-sach") {
    // Định dạng chính sách
    processed = formatPolicy(processed);
  }
  
  // Thêm metadata vào đầu file
  const metadata = `---
category: ${category}
date: ${new Date().toISOString()}
version: 1.0
---

`;
  
  return metadata + processed;
}

// Định dạng file Q&A
function formatQA(content: string): string {
  // Chuẩn hóa định dạng câu hỏi và câu trả lời
  let formatted = content.replace(/(\d+\s*\.\s*[^\n]+\?)(\s*)(→|\-\>|\-|–)?\s*Trả lời\s*:?/g, 
                              "$1\n→ Trả lời: ");
  
  // Đảm bảo mỗi cặp Q&A được phân tách rõ ràng
  formatted = formatted.replace(/(\n→ Trả lời:[^\n]+)(\n\d+\s*\.)/g, "$1\n\n$2");
  
  return formatted;
}

// Định dạng file giáo trình
function formatCurriculum(content: string): string {
  // Chuẩn hóa định dạng tiêu đề chương, mục
  let formatted = content.replace(/^(CHƯƠNG|PHẦN|MỤC)[ \t]*([IVXLCDM\d]+)[ \t]*[:\.\-]?[ \t]*/gm, 
                              (_, type, num) => `\n## ${type} ${num.trim()}: `);
  
  // Chuẩn hóa định dạng tiêu đề phụ
  formatted = formatted.replace(/^(\d+\.\d+)[ \t]*[:\.\-]?[ \t]*([^\n]+)/gm,
                             (_, num, title) => `\n### ${num} ${title}`);
  
  return formatted;
}

// Định dạng file chính sách
function formatPolicy(content: string): string {
  // Chuẩn hóa định dạng điều khoản
  let formatted = content.replace(/^(Điều|Khoản|Mục)[ \t]*(\d+)[:\.\-]?[ \t]*([^\n]+)/gm,
                              (_, type, num, title) => `\n## ${type} ${num}: ${title}`);
  
  // Chuẩn hóa định dạng các điểm
  formatted = formatted.replace(/^(\d+\.)[ \t]*([^\n]+)/gm,
                             (_, num, content) => `\n${num} ${content}`);
  
  return formatted;
}

// Trích xuất tiêu đề từ category
function extractTitleFromCategory(category: string): string {
  switch (category) {
    case "chinh-sach":
      return "CHÍNH SÁCH HỆ THỐNG LAYA";
    case "giao-trinh":
      return "GIÁO TRÌNH LAYA";
    case "qa":
      return "CÂU HỎI THƯỜNG GẶP LAYA";
    default:
      return "TÀI LIỆU LAYA";
  }
}

// Đếm số lượng chunks trong nội dung
function countChunks(content: string): number {
  // Chia nội dung thành các đoạn
  const paragraphs = content.split(/\n\s*\n/);
  
  // Đếm số đoạn có ý nghĩa (có nội dung)
  return paragraphs.filter(p => p.trim().length > 0).length;
}

// Chạy script
convertKnowledgeFiles().catch(error => {
  console.error("Lỗi khi chạy script chuyển đổi:", error);
});
