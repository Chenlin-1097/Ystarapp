const { WikiService } = require('./src/services/WikiService');
const { FeishuService } = require('./src/services/FeishuService');
const { ExcelImporter } = require('./src/services/ExcelImportService');
const config = require('./src/config/config');

async function main() {
  try {
    // 初始化服务
    const feishuService = new FeishuService(config.feishu);
    const wikiService = new WikiService(feishuService.client);
    const excelImporter = new ExcelImporter(feishuService.client);

    // 1. 上传并导入Excel
    const filePath = 'WSD2715线上款式明细.xlsx';
    console.log('🚀 第一步：上传并导入Excel文件...');
    const importResult = await excelImporter.importFile(filePath);
    console.log('✅ Excel导入成功！');
    console.log('文档Token:', importResult.token);
    console.log('文档链接:', importResult.url);

    // 2. 将文档导入到知识库节点
    console.log('\n🚀 第二步：导入文档到知识库节点...');
    const spaceId = '7368294892111626244';  // 知识库ID
    const parentNodeToken = 'O20dw9tvficXm0kffTWc9qojnOf';  // 父节点token
    
    const result = await wikiService.importDocToWiki(spaceId, parentNodeToken, importResult.token);
    console.log('✅ 导入完成:', result);
  } catch (error) {
    console.error('❌ 流程执行失败:', error.message);
    process.exit(1);
  }
}

main(); 