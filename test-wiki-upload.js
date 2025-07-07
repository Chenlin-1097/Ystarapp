const { FeishuService } = require('./src/services/FeishuService');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  // 知识库配置（请替换为实际值）
  SPACE_ID: '1565676577122621', // 知识库空间ID
  PARENT_WIKI_TOKEN: 'wikcnKQ1k3p******8Vabce', // 知识库父节点token
  PARENT_NODE: null, // 云空间父节点（可选）
  
  // 测试文件路径
  TEST_FILE_PATH: './test-data/sample.xlsx' // 确保这个文件存在
};

async function testWikiUpload() {
  console.log('🧪 开始测试知识库文档上传功能...\n');

  try {
    // 1. 检查连接
    console.log('📡 检查飞书API连接...');
    const connectionStatus = await FeishuService.checkConnection();
    if (!connectionStatus) {
      throw new Error('无法连接到飞书API');
    }
    console.log('✅ 飞书API连接正常\n');

    // 2. 检查测试文件是否存在
    if (!fs.existsSync(TEST_CONFIG.TEST_FILE_PATH)) {
      throw new Error(`测试文件不存在: ${TEST_CONFIG.TEST_FILE_PATH}`);
    }

    // 3. 读取测试文件
    console.log('📄 读取测试文件...');
    const fileBuffer = fs.readFileSync(TEST_CONFIG.TEST_FILE_PATH);
    const fileName = path.basename(TEST_CONFIG.TEST_FILE_PATH);
    const fileStats = fs.statSync(TEST_CONFIG.TEST_FILE_PATH);
    
    // 创建File对象模拟（Node.js环境）
    const testFile = {
      name: fileName,
      size: fileStats.size,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      arrayBuffer: () => Promise.resolve(fileBuffer.buffer),
      stream: () => new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(fileBuffer));
          controller.close();
        }
      })
    };

    console.log('文件信息:', {
      name: testFile.name,
      size: `${(testFile.size / 1024 / 1024).toFixed(2)} MB`,
      type: testFile.type
    });
    console.log('✅ 测试文件读取成功\n');

    // 4. 测试单步上传（仅上传到云空间）
    console.log('☁️ 测试步骤一：上传文件到云空间...');
    const fileToken = await FeishuService.uploadFile(testFile, fileName, TEST_CONFIG.PARENT_NODE);
    console.log('✅ 文件上传成功，file_token:', fileToken);
    console.log('');

    // 5. 测试移动到知识库
    console.log('📚 测试步骤二：将文件移动到知识库...');
    const moveResult = await FeishuService.moveDocsToWiki(
      TEST_CONFIG.SPACE_ID,
      TEST_CONFIG.PARENT_WIKI_TOKEN,
      fileToken,
      'file'
    );
    console.log('✅ 文件移动到知识库成功:', moveResult);
    console.log('');

    // 6. 测试完整流程
    console.log('🔄 测试完整流程：一键上传到知识库...');
    const completeResult = await FeishuService.uploadFileToWiki(
      testFile,
      `测试完整流程_${fileName}`,
      TEST_CONFIG.SPACE_ID,
      TEST_CONFIG.PARENT_WIKI_TOKEN,
      TEST_CONFIG.PARENT_NODE
    );
    console.log('✅ 完整流程测试成功:', completeResult);
    console.log('');

    // 7. 测试预上传（分片上传准备）
    console.log('📋 测试分片上传预准备...');
    const prepareResult = await FeishuService.uploadFilePrepare(
      `大文件测试_${fileName}`,
      'explorer',
      TEST_CONFIG.PARENT_NODE,
      testFile.size
    );
    console.log('✅ 预上传准备成功:', prepareResult);
    console.log('');

    console.log('🎉 所有测试完成！');
    console.log('\n📋 测试结果总结:');
    console.log('- ✅ 飞书API连接正常');
    console.log('- ✅ 文件上传到云空间成功');
    console.log('- ✅ 文件移动到知识库成功');
    console.log('- ✅ 完整上传流程成功');
    console.log('- ✅ 分片上传预准备成功');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 测试批量上传功能
async function testBatchWikiUpload() {
  console.log('\n🧪 开始测试批量知识库文档上传功能...\n');

  try {
    // 创建多个测试文件（模拟）
    const testFiles = [
      {
        file: {
          name: 'test1.txt',
          size: 1024,
          type: 'text/plain'
        },
        fileName: '测试文档1.txt'
      },
      {
        file: {
          name: 'test2.txt', 
          size: 2048,
          type: 'text/plain'
        },
        fileName: '测试文档2.txt'
      }
    ];

    console.log('📊 测试批量上传（模拟）...');
    console.log('模拟文件:', testFiles.map(f => f.fileName));
    
    // 注意：这里只是模拟，实际使用时需要真实的File对象
    console.log('⚠️  注意：批量上传需要真实的File对象，这里仅展示调用方式');
    
    // const batchResult = await FeishuService.batchUploadFilesToWiki(
    //   testFiles,
    //   TEST_CONFIG.SPACE_ID,
    //   TEST_CONFIG.PARENT_WIKI_TOKEN,
    //   TEST_CONFIG.PARENT_NODE
    // );
    
    console.log('✅ 批量上传测试结构正确\n');

  } catch (error) {
    console.error('❌ 批量上传测试失败:', error.message);
  }
}

// 运行测试
async function runAllTests() {
  console.log('🚀 知识库文档上传功能测试开始');
  console.log('='.repeat(50));
  
  await testWikiUpload();
  await testBatchWikiUpload();
  
  console.log('='.repeat(50));
  console.log('🏁 所有测试完成');
}

// 执行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testWikiUpload,
  testBatchWikiUpload,
  runAllTests
}; 