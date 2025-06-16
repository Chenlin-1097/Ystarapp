const axios = require('axios');

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  }
};

// 知识库信息
const WIKI_TOKEN = 'O20dw9tvficXm0kffTWc9qojnOf';

class WikiAPITester {
  constructor() {
    this.accessToken = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      console.log('🔑 获取访问令牌...');
      
      const response = await axios.post(`${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`, {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        console.log('✅ 访问令牌获取成功');
        console.log(`令牌: ${this.accessToken.substring(0, 20)}...`);
        return true;
      } else {
        console.log('❌ 获取访问令牌失败:', response.data.msg);
        return false;
      }
    } catch (error) {
      console.error('❌ 获取访问令牌失败:', error.message);
      return false;
    }
  }

  // 测试不同的API端点
  async testAPIEndpoints() {
    console.log('\n🧪 测试不同的API端点...');
    
    const endpoints = [
      {
        name: '获取知识库节点信息 (方法1)',
        url: `${CONFIG.FEISHU.BASE_URL}/wiki/v2/space/node`,
        method: 'GET',
        params: { token: WIKI_TOKEN }
      },
      {
        name: '获取知识库节点信息 (方法2)',
        url: `${CONFIG.FEISHU.BASE_URL}/wiki/v2/spaces/${WIKI_TOKEN}/node`,
        method: 'GET'
      },
      {
        name: '获取知识库空间信息',
        url: `${CONFIG.FEISHU.BASE_URL}/wiki/v2/spaces/${WIKI_TOKEN}`,
        method: 'GET'
      },
      {
        name: '获取知识库空间列表',
        url: `${CONFIG.FEISHU.BASE_URL}/wiki/v2/spaces`,
        method: 'GET'
      },
      {
        name: '尝试作为多维表格访问',
        url: `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${WIKI_TOKEN}`,
        method: 'GET'
      },
      {
        name: '尝试获取多维表格列表',
        url: `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${WIKI_TOKEN}/tables`,
        method: 'GET'
      }
    ];

    for (const endpoint of endpoints) {
      await this.testEndpoint(endpoint);
      console.log(''); // 空行分隔
    }
  }

  // 测试单个端点
  async testEndpoint(endpoint) {
    try {
      console.log(`📡 测试: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const config = {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (endpoint.params) {
        config.params = endpoint.params;
        console.log(`   参数: ${JSON.stringify(endpoint.params)}`);
      }

      const response = await axios.get(endpoint.url, config);
      
      if (response.data.code === 0) {
        console.log('✅ 成功');
        console.log(`   响应数据: ${JSON.stringify(response.data.data, null, 2).substring(0, 200)}...`);
      } else {
        console.log(`❌ 失败: ${response.data.msg} (代码: ${response.data.code})`);
      }
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
      if (error.response) {
        console.log(`   HTTP状态码: ${error.response.status}`);
        if (error.response.data) {
          console.log(`   错误详情: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
  }

  // 运行测试
  async runTest() {
    console.log('🚀 开始API端点测试...');
    
    // 获取访问令牌
    const tokenSuccess = await this.getAccessToken();
    if (!tokenSuccess) {
      console.log('❌ 无法获取访问令牌，测试终止');
      return;
    }

    // 测试各种API端点
    await this.testAPIEndpoints();
    
    console.log('🏁 测试完成');
  }
}

// 运行测试
const tester = new WikiAPITester();
tester.runTest().catch(console.error); 