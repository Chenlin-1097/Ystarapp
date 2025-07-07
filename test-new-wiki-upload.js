// 为了在Node.js中测试，我们需要直接使用原有的分片上传逻辑
const lark = require('@larksuiteoapi/node-sdk');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const adler32 = require('adler-32');
const path = require('path');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
};

// 测试配置
const TEST_CONFIG = {
  FILE_PATH: 'WSD2715线上款式明细.xlsx',
  SPACE_ID: '7368294892111626244',
  PARENT_WIKI_TOKEN: 'O20dw9tvficXm0kffTWc9qojnOf'
};

// 模拟File对象（Node.js环境）
class MockFile {
  constructor(filePath) {
    this.path = filePath;
    this.name = path.basename(filePath);
    this.size = fs.statSync(filePath).size;
    this.type = this.getContentType();
  }

  getContentType() {
    const ext = path.extname(this.name).toLowerCase();
    const mimeTypes = {
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async arrayBuffer() {
    const buffer = fs.readFileSync(this.path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
}

async function testNewWikiUpload() {
  console.log('🧪 测试新的Wiki上传功能...\n');

  try {
    // 检查测试文件是否存在
    if (!fs.existsSync(TEST_CONFIG.FILE_PATH)) {
      throw new Error(`测试文件不存在: ${TEST_CONFIG.FILE_PATH}`);
    }

    // 创建服务实例
    const wikiUploadService = new WikiUploadService(FEISHU_CONFIG);

    // 创建模拟File对象
    const mockFile = new MockFile(TEST_CONFIG.FILE_PATH);

    console.log('📄 文件信息:');
    console.log(`- 文件名: ${mockFile.name}`);
    console.log(`- 文件大小: ${(mockFile.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- 文件类型: ${mockFile.type}`);
    console.log(`- 是否Excel: ${wikiUploadService.isExcelFile(mockFile.name)}`);
    console.log('');

    // 进度回调
    const onProgress = (progressInfo) => {
      console.log(`📊 进度更新: ${progressInfo.percent}% - ${progressInfo.message}`);
    };

    // 执行上传
    console.log('🚀 开始上传到Wiki...');
    const result = await wikiUploadService.uploadToWiki(
      mockFile,
      mockFile.name,
      TEST_CONFIG.SPACE_ID,
      TEST_CONFIG.PARENT_WIKI_TOKEN,
      onProgress
    );

    console.log('\n✅ 上传成功！');
    console.log('📋 结果详情:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
if (require.main === module) {
  testNewWikiUpload().catch(console.error);
}

module.exports = { testNewWikiUpload }; 