const axios = require('axios');

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  },
  TABLES: {
    USERS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblxbOsA83hEZShA'
    },
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblMpF28247NLFfX'
    },
    WORK_HISTORY: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tbleX1cEZVzUvx2P'
    }
  }
};

// 网络诊断工具
class NetworkDiagnosis {
  constructor() {
    this.results = {
      基本网络连接: false,
      飞书API访问: false,
      访问令牌获取: false,
      用户表访问: false,
      产品表访问: false,
      历史表访问: false
    };
  }

  // 基本网络连接测试
  async testBasicConnection() {
    try {
      console.log('🌐 测试基本网络连接...');
      const response = await axios.get('https://www.baidu.com', { timeout: 5000 });
      this.results.基本网络连接 = response.status === 200;
      console.log(this.results.基本网络连接 ? '✅ 基本网络连接正常' : '❌ 基本网络连接失败');
    } catch (error) {
      console.log('❌ 基本网络连接失败:', error.message);
      this.results.基本网络连接 = false;
    }
  }

  // 测试飞书API连接
  async testFeishuAPIAccess() {
    try {
      console.log('🔑 测试飞书API访问...');
      const response = await axios.get('https://open.feishu.cn', { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      this.results.飞书API访问 = response.status === 200;
      console.log(this.results.飞书API访问 ? '✅ 飞书API访问正常' : '❌ 飞书API访问失败');
    } catch (error) {
      console.log('❌ 飞书API访问失败:', error.message);
      if (error.code === 'ENOTFOUND') {
        console.log('   - DNS解析失败，请检查网络设置');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('   - 连接被拒绝，可能是防火墙或代理问题');
      } else if (error.code === 'ECONNABORTED') {
        console.log('   - 连接超时，请检查网络速度');
      }
      this.results.飞书API访问 = false;
    }
  }

  // 测试访问令牌获取
  async testAccessToken() {
    try {
      console.log('🎫 测试访问令牌获取...');
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: CONFIG.FEISHU.APP_ID,
          app_secret: CONFIG.FEISHU.APP_SECRET
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ScanWorkReportSystem/1.0'
          }
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        this.results.访问令牌获取 = true;
        console.log('✅ 访问令牌获取成功');
      } else {
        console.log('❌ 访问令牌获取失败:', response.data.msg);
        this.results.访问令牌获取 = false;
      }
    } catch (error) {
      console.log('❌ 访问令牌获取失败:', error.message);
      this.results.访问令牌获取 = false;
    }
  }

  // 测试表格访问
  async testTableAccess(tableConfig, tableName) {
    try {
      if (!this.accessToken) {
        console.log(`❌ ${tableName} - 无访问令牌，跳过测试`);
        return false;
      }

      console.log(`📋 测试${tableName}访问...`);
      const response = await axios.get(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.APP_TOKEN}/tables/${tableConfig.TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.code === 0) {
        console.log(`✅ ${tableName}访问成功 - 共${response.data.data.items.length}条记录`);
        
        // 显示一些字段信息以便调试
        if (response.data.data.items.length > 0) {
          const firstRecord = response.data.data.items[0];
          console.log(`   样本字段: ${Object.keys(firstRecord.fields).join(', ')}`);
        }
        
        return true;
      } else {
        console.log(`❌ ${tableName}访问失败:`, response.data.msg);
        if (response.data.code === 99991672) {
          console.log('   - 权限不足，请检查飞书应用权限配置');
        }
        return false;
      }
    } catch (error) {
      console.log(`❌ ${tableName}访问失败:`, error.message);
      if (error.response) {
        console.log(`   - HTTP状态码: ${error.response.status}`);
        if (error.response.data) {
          console.log(`   - 错误详情: ${JSON.stringify(error.response.data)}`);
        }
      }
      return false;
    }
  }

  // 生成诊断报告
  generateReport() {
    console.log('\n📊 网络诊断报告');
    console.log('='.repeat(50));
    
    for (const [test, result] of Object.entries(this.results)) {
      console.log(`${result ? '✅' : '❌'} ${test}: ${result ? '正常' : '异常'}`);
    }

    console.log('\n🔧 问题分析与建议:');
    
    if (!this.results.基本网络连接) {
      console.log('1. 基本网络连接异常 - 请检查网络设置');
    }
    
    if (!this.results.飞书API访问) {
      console.log('2. 飞书API访问异常 - 可能是防火墙或代理问题');
      console.log('   建议: 检查企业网络是否限制外网访问');
    }
    
    if (!this.results.访问令牌获取) {
      console.log('3. 访问令牌获取失败 - 请检查APP_ID和APP_SECRET');
    }
    
    if (!this.results.用户表访问 || !this.results.产品表访问 || !this.results.历史表访问) {
      console.log('4. 表格访问异常 - 请检查权限配置');
      console.log('   解决方案:');
      console.log('   - 访问: https://open.feishu.cn/app/cli_a74001f855b0d00c/auth');
      console.log('   - 申请 bitable:app 权限');
      console.log('   - 等待审核通过');
    }

    const allPassed = Object.values(this.results).every(result => result);
    console.log(`\n${allPassed ? '🎉' : '⚠️'} 总体状态: ${allPassed ? '系统正常' : '存在问题'}`);
    
    if (allPassed) {
      console.log('\n✨ 建议解决方案:');
      console.log('1. 重新启动应用: npm run electron-dev');
      console.log('2. 清除浏览器缓存并刷新页面');
      console.log('3. 检查开发者工具中的控制台错误信息');
    }
  }

  // 运行完整诊断
  async runFullDiagnosis() {
    console.log('🚀 开始网络连接诊断...\n');
    
    await this.testBasicConnection();
    await this.testFeishuAPIAccess();
    await this.testAccessToken();
    
    if (this.accessToken) {
      this.results.用户表访问 = await this.testTableAccess(CONFIG.TABLES.USERS, '用户表');
      this.results.产品表访问 = await this.testTableAccess(CONFIG.TABLES.PRODUCTS, '产品表');
      this.results.历史表访问 = await this.testTableAccess(CONFIG.TABLES.WORK_HISTORY, '历史表');
    }
    
    this.generateReport();
  }
}

// 运行诊断
async function main() {
  try {
    const diagnosis = new NetworkDiagnosis();
    await diagnosis.runFullDiagnosis();
  } catch (error) {
    console.error('诊断过程中出现错误:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = NetworkDiagnosis; 