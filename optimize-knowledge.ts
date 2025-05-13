import fs from "fs/promises";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const OPTIMIZED_DIR = path.join(process.cwd(), "knowledge", "optimized");

// Cấu trúc metadata cho file knowledge
interface KnowledgeMetadata {
  title: string;
  category: string;
  source: string;
  lastUpdated: string;
  sections: Array<{
    title: string;
    startIndex: number;
  }>;
}

async function optimizeKnowledgeFiles() {
  console.log("=== TỐI ƯU HÓA FILE KNOWLEDGE LAYA CHATBOT ===\n");
  
  try {
    // Tạo thư mục optimized nếu chưa tồn tại
    await fs.mkdir(OPTIMIZED_DIR, { recursive: true });
    
    // Đọc danh sách file trong thư mục knowledge
    const files = await fs.readdir(KNOWLEDGE_DIR);
    const textFiles = files.filter(file => 
      file.endsWith('.txt') && 
      !path.relative(KNOWLEDGE_DIR, path.join(KNOWLEDGE_DIR, file)).startsWith('optimized')
    );
    
    console.log(`Tìm thấy ${textFiles.length} file txt cần tối ưu hóa.`);
    
    // Xử lý từng file
    for (const file of textFiles) {
      console.log(`\nĐang xử lý file: ${file}`);
      const filePath = path.join(KNOWLEDGE_DIR, file);
      
      // Đọc nội dung file
      const content = await fs.readFile(filePath, "utf-8");
      
      // Tối ưu hóa nội dung
      const optimizedContent = await optimizeContent(content, file);
      
      // Tạo metadata
      const metadata = createMetadata(optimizedContent, file);
      
      // Lưu file tối ưu hóa
      const optimizedFileName = path.join(OPTIMIZED_DIR, `optimized_${file}`);
      await fs.writeFile(optimizedFileName, optimizedContent);
      
      // Lưu metadata
      const metadataFileName = path.join(OPTIMIZED_DIR, `metadata_${file.replace('.txt', '.json')}`);
      await fs.writeFile(metadataFileName, JSON.stringify(metadata, null, 2));
      
      console.log(`  ✓ Đã tối ưu hóa và lưu vào: ${optimizedFileName}`);
      console.log(`  ✓ Đã tạo metadata và lưu vào: ${metadataFileName}`);
    }
    
    console.log("\n=== TỐI ƯU HÓA HOÀN TẤT ===");
    console.log(`Tổng số file đã xử lý: ${textFiles.length}`);
    console.log(`Thư mục chứa file đã tối ưu: ${OPTIMIZED_DIR}`);
    
  } catch (error) {
    console.error("Lỗi khi tối ưu hóa file knowledge:", error);
  }
}

// Hàm tối ưu hóa nội dung
async function optimizeContent(content: string, fileName: string): Promise<string> {
  // Loại bỏ khoảng trắng thừa
  let optimized = content.replace(/\r\n/g, '\n')
                         .replace(/\n{3,}/g, '\n\n')
                         .replace(/[ \t]+\n/g, '\n')
                         .trim();
  
  // Chuẩn hóa định dạng tiêu đề
  optimized = optimized.replace(/^(CHƯƠNG|PHẦN|MỤC)[ \t]*([IVXLCDM\d]+)[ \t]*[:\.\-]?[ \t]*/gm, 
                              (_, type, num) => `${type} ${num.trim()}: `);
  
  // Chuẩn hóa định dạng Q&A nếu là file câu hỏi
  if (fileName.toLowerCase().includes("câu hỏi") || fileName.toLowerCase().includes("qa")) {
    optimized = optimized.replace(/(\d+\s*\.\s*[^\n]+\?)(\s*)(→|\-\>|\-|–)?\s*Trả lời\s*:?/g, 
                                "$1\n→ Trả lời: ");
  }
  
  // Thêm tiêu đề nếu không có
  if (!optimized.match(/^[A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\s]+$/m)) {
    const title = extractTitleFromFileName(fileName);
    optimized = `${title}\n\n${optimized}`;
  }
  
  return optimized;
}

// Tạo metadata cho file
function createMetadata(content: string, fileName: string): KnowledgeMetadata {
  // Trích xuất tiêu đề từ nội dung hoặc tên file
  const titleMatch = content.match(/^([A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\s]+)(?:\n|\r\n)/);
  const title = titleMatch ? titleMatch[1].trim() : extractTitleFromFileName(fileName);
  
  // Xác định category
  let category = "khac";
  if (fileName.toLowerCase().includes("chính sách") || fileName.toLowerCase().includes("chinh sach")) {
    category = "chinh-sach";
  } else if (fileName.toLowerCase().includes("giáo trình") || fileName.toLowerCase().includes("giao trinh")) {
    category = "giao-trinh";
  } else if (fileName.toLowerCase().includes("câu hỏi") || fileName.toLowerCase().includes("q&a") || fileName.toLowerCase().includes("qa")) {
    category = "qa";
  }
  
  // Tìm các section trong nội dung
  const sections: Array<{title: string; startIndex: number}> = [];
  const sectionRegex = /(?:^|\n)((?:CHƯƠNG|PHẦN|MỤC)[ \t]*(?:[IVXLCDM\d]+)[ \t]*:[ \t]*[^\n]+)/g;
  
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push({
      title: match[1].trim(),
      startIndex: match.index
    });
  }
  
  // Nếu là file Q&A, tìm các câu hỏi
  if (category === "qa") {
    const qaRegex = /(?:^|\n)(\d+\s*\.\s*[^\n]+\?)/g;
    while ((match = qaRegex.exec(content)) !== null) {
      sections.push({
        title: match[1].trim(),
        startIndex: match.index
      });
    }
  }
  
  return {
    title,
    category,
    source: fileName,
    lastUpdated: new Date().toISOString(),
    sections
  };
}

// Trích xuất tiêu đề từ tên file
function extractTitleFromFileName(fileName: string): string {
  // Loại bỏ phần mở rộng
  let title = fileName.replace(/\.txt$/, '');
  
  // Chuyển đổi thành tiêu đề
  title = title.toUpperCase();
  
  return title;
}

// Chạy script
optimizeKnowledgeFiles().catch(error => {
  console.error("Lỗi khi chạy script tối ưu hóa:", error);
});
