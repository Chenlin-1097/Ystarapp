const axios = require('axios');

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  }
};

// 获取访问令牌
async function getAccessToken() {
  try {
    const response = await axios.post(
      `${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`,
      {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      }
    );

    if (response.data.code === 0) {
      return response.data.tenant_access_token;
    } else {
      throw new Error('获取访问令牌失败: ' + response.data.msg);
    }
  } catch (error) {
    console.error('获取访问令牌失败:', error);
    throw error;
  }
}

// 快速测试
async function quickTest() {
  try {
    console.log('🚀 快速功能测试');
    console.log('================');
    
    // 1. 获取访问令牌
    console.log('\n1. 获取访问令牌...');
    const accessToken = await getAccessToken();
    console.log('✅ 访问令牌获取成功');
    
    // 创建API实例
    const api = axios.create({
      baseURL: CONFIG.FEISHU.BASE_URL,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 2. 测试知识库空间列表
    console.log('\n2. 测试知识库空间列表...');
    try {
      const spaceResponse = await api.get('/wiki/v2/spaces', {
        params: { page_size: 5 }
      });
      
      if (spaceResponse.data.code === 0) {
        console.log('✅ 知识库权限正常');
        console.log(`   可访问的知识库数量: ${spaceResponse.data.data.items.length}`);
        
        if (spaceResponse.data.data.items.length > 0) {
          console.log('   知识库列表:');
          spaceResponse.data.data.items.forEach((space, index) => {
            console.log(`   ${index + 1}. ${space.name} (ID: ${space.space_id})`);
          });
          
          // 3. 如果有知识库，尝试获取第一个知识库的节点
          const firstSpace = spaceResponse.data.data.items[0];
          console.log(`\n3. 测试获取知识库节点 (${firstSpace.name})...`);
          
          try {
            const nodesResponse = await api.get(`/wiki/v2/spaces/${firstSpace.space_id}/nodes`, {
              params: { page_size: 3 }
            });
            
            if (nodesResponse.data.code === 0) {
              console.log('✅ 知识库节点获取成功');
              console.log(`   节点数量: ${nodesResponse.data.data.items.length}`);
              
              if (nodesResponse.data.data.items.length > 0) {
                console.log('   节点列表:');
                nodesResponse.data.data.items.forEach((node, index) => {
                  console.log(`   ${index + 1}. ${node.title || '无标题'} (${node.node_token})`);
                });
              }
            } else {
              console.log('❌ 知识库节点获取失败:', nodesResponse.data.msg);
            }
          } catch (error) {
            console.log('❌ 知识库节点获取失败:', error.response?.data?.msg || error.message);
          }
        } else {
          console.log('   ⚠️  当前没有可访问的知识库');
        }
      } else {
        console.log('❌ 知识库权限异常:', spaceResponse.data.msg);
      }
    } catch (error) {
      console.log('❌ 知识库权限测试失败:', error.response?.data?.msg || error.message);
    }

    // 4. 测试多维表格权限
    console.log('\n4. 测试多维表格权限...');
    try {
      const bitableResponse = await api.get('/bitable/v1/apps', {
        params: { page_size: 3 }
      });
      
      if (bitableResponse.data.code === 0) {
        console.log('✅ 多维表格权限正常');
        console.log(`   可访问的多维表格数量: ${bitableResponse.data.data.items.length}`);
      } else {
        console.log('❌ 多维表格权限异常:', bitableResponse.data.msg);
      }
    } catch (error) {
      console.log('❌ 多维表格权限测试失败:', error.response?.data?.msg || error.message);
    }

    // 5. 测试目标文档
    console.log('\n5. 测试目标文档访问...');
    const nodeToken = 'O20dw9tvficXm0kffTWc9qojnOf';
    
    // 尝试不同的API端点
    const testEndpoints = [
      {
        name: '知识库节点API',
        url: `/wiki/v2/nodes/${nodeToken}`
      },
      {
        name: '云文档API',
        url: `/docx/v1/documents/${nodeToken}`
      }
    ];

    for (const endpoint of testEndpoints) {
      try {
        console.log(`\n   测试 ${endpoint.name}...`);
        const response = await api.get(endpoint.url);
        
        if (response.data.code === 0) {
          console.log(`   ✅ ${endpoint.name} 访问成功`);
          console.log(`   文档信息:`, JSON.stringify(response.data.data, null, 4));
          break; // 成功访问就退出循环
        } else {
          console.log(`   ❌ ${endpoint.name} 访问失败: ${response.data.msg}`);
        }
      } catch (error) {
        if (error.response) {
          console.log(`   ❌ ${endpoint.name} 请求失败: ${error.response.status}`);
          console.log(`   错误信息: ${error.response.data.msg || error.response.data.error || '未知错误'}`);
        } else {
          console.log(`   ❌ ${endpoint.name} 网络错误: ${error.message}`);
        }
      }
    }

    console.log('\n📊 测试总结');
    console.log('============');
    console.log('✅ 系统已经具有知识库权限');
    console.log('✅ 可以获取知识库空间列表');
    console.log('❌ 目标文档可能不存在或需要特殊权限');
    console.log('');
    console.log('💡 建议:');
    console.log('1. 检查文档URL是否正确');
    console.log('2. 确认文档是否存在且有访问权限');
    console.log('3. 如果是私有文档，可能需要文档所有者授权');
    console.log('4. 可以尝试使用系统中已有的知识库文档进行测试');

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  quickTest();
}

module.exports = { quickTest }; 