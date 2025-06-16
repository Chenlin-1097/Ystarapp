const { WikiService } = require('../src/services/WikiService.js');

// 测试配置
const TEST_CONFIG = {
  // 要测试的知识库文档URL
  WIKI_DOCUMENT_URL: 'https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf',
  
  // 其他测试URL（可选）
  TEST_URLS: [
    'https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf',
    // 可以添加更多测试URL
  ]
};

// 测试URL解析功能
async function testUrlExtraction() {
  console.log('\n🔍 测试URL解析功能...');
  console.log('========================');
  
  const testUrls = [
    'https://rfwfcs43e0.feishu.cn/wiki/O20dw9tvficXm0kffTWc9qojnOf',
    'https://example.feishu.cn/wiki/space/spaceId123/nodeToken456',
    'https://test.feishu.cn/wiki/nodeToken789?param=value',
    'https://demo.feishu.cn/wiki/spaceId/nodeToken'
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n📋 测试URL: ${url}`);
      const result = WikiService.extractDocumentInfo(url);
      console.log('✅ 解析成功:', result);
    } catch (error) {
      console.log('❌ 解析失败:', error.message);
    }
  }
}

// 测试权限检查功能
async function testPermissionCheck() {
  console.log('\n🔐 测试权限检查功能...');
  console.log('========================');
  
  try {
    const permissions = await WikiService.checkPermissions();
    console.log('权限检查结果:', permissions);
    
    if (permissions.wiki) {
      console.log('✅ 具有知识库权限');
    } else {
      console.log('❌ 缺少知识库权限');
    }
    
    if (permissions.docx) {
      console.log('✅ 具有云文档权限');
    } else {
      console.log('❌ 缺少云文档权限');
    }
    
    if (permissions.drive) {
      console.log('✅ 具有云盘权限');
    } else {
      console.log('❌ 缺少云盘权限');
    }
    
    return permissions;
  } catch (error) {
    console.error('❌ 权限检查失败:', error.message);
    return null;
  }
}

// 测试知识库空间列表获取
async function testSpaceList() {
  console.log('\n📚 测试知识库空间列表获取...');
  console.log('============================');
  
  try {
    const spaceList = await WikiService.getSpaceList(5); // 获取前5个空间
    console.log('✅ 知识库空间列表获取成功');
    console.log(`   空间数量: ${spaceList.items.length}`);
    
    if (spaceList.items.length > 0) {
      console.log('   前几个空间:');
      spaceList.items.forEach((space, index) => {
        console.log(`   ${index + 1}. ${space.name} (ID: ${space.space_id})`);
      });
    }
    
    return spaceList;
  } catch (error) {
    console.error('❌ 知识库空间列表获取失败:', error.message);
    return null;
  }
}

// 测试文档访问功能
async function testDocumentAccess() {
  console.log('\n📄 测试文档访问功能...');
  console.log('======================');
  
  for (const url of TEST_CONFIG.TEST_URLS) {
    try {
      console.log(`\n📋 测试文档: ${url}`);
      const result = await WikiService.checkDocumentAccess(url);
      
      if (result.hasAccess) {
        console.log('✅ 文档访问成功');
        console.log(`   使用方法: ${result.method}`);
        console.log(`   节点令牌: ${result.nodeToken}`);
        if (result.spaceId) {
          console.log(`   空间ID: ${result.spaceId}`);
        }
        
        // 显示文档基本信息
        if (result.document) {
          console.log('   文档信息:');
          if (result.document.title) {
            console.log(`     标题: ${result.document.title}`);
          }
          if (result.document.obj_type) {
            console.log(`     类型: ${result.document.obj_type}`);
          }
          if (result.document.space_id) {
            console.log(`     所属空间: ${result.document.space_id}`);
          }
        }
      } else {
        console.log('❌ 文档访问失败');
        console.log(`   错误原因: ${result.error}`);
        console.log(`   节点令牌: ${result.nodeToken || '未提取'}`);
      }
    } catch (error) {
      console.error(`❌ 测试文档访问时发生错误: ${error.message}`);
    }
  }
}

// 测试搜索功能
async function testWikiSearch() {
  console.log('\n🔍 测试知识库搜索功能...');
  console.log('========================');
  
  const searchQueries = ['操作手册', '配置', '系统'];
  
  for (const query of searchQueries) {
    try {
      console.log(`\n📋 搜索关键词: "${query}"`);
      const searchResult = await WikiService.searchWiki(query, null, 3); // 搜索前3个结果
      
      if (searchResult.items && searchResult.items.length > 0) {
        console.log(`✅ 搜索成功，找到 ${searchResult.items.length} 个结果:`);
        searchResult.items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title || '无标题'} (${item.node_token})`);
        });
      } else {
        console.log('❌ 搜索无结果');
      }
    } catch (error) {
      console.error(`❌ 搜索失败: ${error.message}`);
    }
  }
}

// 生成测试报告
function generateTestReport(results) {
  console.log('\n📊 测试报告');
  console.log('============');
  
  const { permissions, spaceList, documentAccess } = results;
  
  console.log('\n1. 权限状态:');
  if (permissions) {
    console.log(`   - 知识库权限: ${permissions.wiki ? '✅' : '❌'}`);
    console.log(`   - 云文档权限: ${permissions.docx ? '✅' : '❌'}`);
    console.log(`   - 云盘权限: ${permissions.drive ? '✅' : '❌'}`);
  } else {
    console.log('   ❌ 权限检查失败');
  }
  
  console.log('\n2. 知识库访问:');
  if (spaceList) {
    console.log(`   ✅ 可访问 ${spaceList.items.length} 个知识库空间`);
  } else {
    console.log('   ❌ 无法获取知识库空间列表');
  }
  
  console.log('\n3. 文档访问:');
  if (documentAccess) {
    console.log(`   ✅ 目标文档可访问`);
  } else {
    console.log('   ❌ 目标文档无法访问');
  }
  
  console.log('\n4. 建议:');
  if (!permissions || !permissions.wiki) {
    console.log('   - 申请知识库权限 (wiki:wiki 或 wiki:wiki:readonly)');
  }
  if (!permissions || !permissions.docx) {
    console.log('   - 申请云文档权限 (docx:document 或 docx:document:readonly)');
  }
  if (!documentAccess) {
    console.log('   - 检查文档URL是否正确');
    console.log('   - 确认文档是否存在且有访问权限');
  }
  
  if (permissions && permissions.wiki && spaceList && documentAccess) {
    console.log('   🎉 所有功能正常，可以开始使用WikiService！');
  }
}

// 主测试函数
async function runTests() {
  try {
    console.log('🚀 WikiService 功能测试');
    console.log('========================');
    console.log(`测试时间: ${new Date().toLocaleString()}`);
    
    // 存储测试结果
    const results = {};
    
    // 1. 测试URL解析
    await testUrlExtraction();
    
    // 2. 测试权限检查
    results.permissions = await testPermissionCheck();
    
    // 3. 测试知识库空间列表
    results.spaceList = await testSpaceList();
    
    // 4. 测试文档访问
    results.documentAccess = await testDocumentAccess();
    
    // 5. 测试搜索功能（如果有权限）
    if (results.permissions && results.permissions.wiki) {
      await testWikiSearch();
    } else {
      console.log('\n⚠️  跳过搜索测试（缺少知识库权限）');
    }
    
    // 6. 生成测试报告
    generateTestReport(results);
    
    console.log('\n✅ 测试完成');
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    console.error('错误详情:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testUrlExtraction,
  testPermissionCheck,
  testSpaceList,
  testDocumentAccess,
  testWikiSearch,
  generateTestReport
}; 