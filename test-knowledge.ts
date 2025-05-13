import { searchDocuments, loadKnowledgeBase, getKnowledgeBaseStats } from "./lib/knowledge-enhanced";

async function testKnowledgeRetrieval() {
  console.log("=== KIỂM TRA HỆ THỐNG KNOWLEDGE LAYA CHATBOT ===\n");
  
  // Tải knowledge base
  console.log("Đang tải knowledge base...");
  await loadKnowledgeBase();
  
  // Hiển thị thông tin thống kê
  const stats = getKnowledgeBaseStats();
  console.log(`\nThống kê knowledge base:`);
  console.log(`- Tổng số chunks: ${stats.totalChunks}`);
  console.log(`- Phân loại theo danh mục:`);
  Object.entries(stats.categories).forEach(([category, count]) => {
    console.log(`  + ${category}: ${count} chunks`);
  });
  console.log(`- Phân loại theo nguồn:`);
  Object.entries(stats.sources).forEach(([source, count]) => {
    console.log(`  + ${source}: ${count} chunks`);
  });
  console.log(`- Cập nhật lần cuối: ${stats.lastUpdated.toLocaleString()}`);
  
  // Danh sách câu hỏi kiểm tra
  const testQueries = [
    "Chính sách hệ thống Laya là gì?",
    "Cấu trúc 5 cấp mentor trong hệ thống Laya?",
    "Giáo trình soi da bắt mệnh có những gì?",
    "Chính sách tạm khóa tài khoản mentor",
    "Cách nhận diện tính cách qua tình trạng da",
    "Các bước trị liệu Đông y của Laya",
    "Nốt ruồi ở môi có ý nghĩa gì?",
    "Làm thế nào để trở thành mentor 3 sao?"
  ];
  
  // Thực hiện kiểm tra từng câu hỏi
  for (const query of testQueries) {
    console.log(`\n\n=== Truy vấn: "${query}" ===`);
    
    const startTime = Date.now();
    const results = await searchDocuments(query);
    const endTime = Date.now();
    
    console.log(`Tìm thấy ${results.length} kết quả trong ${endTime - startTime}ms`);
    
    if (results.length > 0) {
      // Hiển thị top 3 kết quả
      results.slice(0, 3).forEach((doc, index) => {
        console.log(`\nKết quả #${index + 1}: ${doc.source}`);
        console.log(`Độ tương đồng: ${Math.round(doc.similarity * 100)}%`);
        console.log(`Trích đoạn: ${doc.content.substring(0, 200)}...`);
      });
    } else {
      console.log("Không tìm thấy kết quả nào phù hợp.");
    }
  }
}

// Chạy kiểm tra
testKnowledgeRetrieval().catch(error => {
  console.error("Lỗi khi kiểm tra knowledge base:", error);
});
