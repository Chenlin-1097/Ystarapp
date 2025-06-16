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
      TABLE_ID: 'tblxbOsA83hEZShA',
      EXPECTED_FIELDS: ['用户名', '密码', '姓名', '工序权限']
    },
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblMpF28247NLFfX',
      EXPECTED_FIELDS: ['产品名称', '总数量', '已报工数量', '二维码', '工序1报工数', '工序2报工数', '工序3报工数', '工序4报工数']
    },
    WORK_HISTORY: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tbleX1cEZVzUvx2P',
      EXPECTED_FIELDS: ['报工时间', '操作人', '产品名称', '工序类型', '二维码', '状态']
    }
  }
};

class FieldChecker {
  constructor() {
    this.accessToken = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: CONFIG.FEISHU.APP_ID,
          app_secret: CONFIG.FEISHU.APP_SECRET
        }
      );

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        return true;
      }
      return false;
    } catch (error) {
      console.error('获取访问令牌失败:', error.message);
      return false;
    }
  }

  // 检查表格字段
  async checkTableFields(tableName, tableConfig) {
    try {
      console.log(`\n📋 检查${tableName}字段配置...`);
      console.log('='.repeat(50));
      
      const response = await axios.get(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${tableConfig.APP_TOKEN}/tables/${tableConfig.TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code === 0) {
        const records = response.data.data.items;
        console.log(`✅ 表格访问成功，共 ${records.length} 条记录`);
        
        if (records.length > 0) {
          const actualFields = Object.keys(records[0].fields);
          console.log(`\n实际字段 (${actualFields.length}个):`);
          actualFields.forEach((field, index) => {
            console.log(`  ${index + 1}. "${field}"`);
          });
          
          console.log(`\n期望字段 (${tableConfig.EXPECTED_FIELDS.length}个):`);
          tableConfig.EXPECTED_FIELDS.forEach((field, index) => {
            const exists = actualFields.includes(field);
            console.log(`  ${index + 1}. "${field}" ${exists ? '✅' : '❌'}`);
          });
          
          // 检查字段匹配情况
          const missingFields = tableConfig.EXPECTED_FIELDS.filter(field => !actualFields.includes(field));
          const extraFields = actualFields.filter(field => !tableConfig.EXPECTED_FIELDS.includes(field));
          
          if (missingFields.length > 0) {
            console.log(`\n❌ 缺少字段 (${missingFields.length}个):`);
            missingFields.forEach(field => console.log(`  - "${field}"`));
          }
          
          if (extraFields.length > 0) {
            console.log(`\n📝 额外字段 (${extraFields.length}个):`);
            extraFields.forEach(field => console.log(`  - "${field}"`));
          }
          
          if (missingFields.length === 0 && extraFields.length === 0) {
            console.log('\n🎉 所有字段完全匹配！');
          }
          
          // 显示样本数据
          console.log('\n📄 样本数据 (前3条记录):');
          records.slice(0, 3).forEach((record, index) => {
            console.log(`\n记录 ${index + 1}:`);
            for (const [field, value] of Object.entries(record.fields)) {
              console.log(`  ${field}: ${JSON.stringify(value)}`);
            }
          });
          
        } else {
          console.log('⚠️ 表格为空，无法检查字段');
        }
        
      } else {
        console.log('❌ 表格访问失败:', response.data.msg);
      }
      
    } catch (error) {
      console.error(`❌ 检查${tableName}失败:`, error.message);
      if (error.response && error.response.data) {
        console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  // 运行完整检查
  async runFullCheck() {
    console.log('🔍 开始字段配置检查...\n');
    
    if (await this.getAccessToken()) {
      console.log('✅ 访问令牌获取成功');
      
      await this.checkTableFields('用户表', CONFIG.TABLES.USERS);
      await this.checkTableFields('产品表', CONFIG.TABLES.PRODUCTS);
      await this.checkTableFields('报工历史表', CONFIG.TABLES.WORK_HISTORY);
      
      console.log('\n📋 检查完成！');
      console.log('\n💡 如果发现字段不匹配，请：');
      console.log('1. 检查飞书表格中的字段名是否正确');
      console.log('2. 更新 src/config/config.js 中的字段配置');
      console.log('3. 重新启动应用');
      
    } else {
      console.log('❌ 无法获取访问令牌，检查失败');
    }
  }
}

// 运行检查
async function main() {
  try {
    const checker = new FieldChecker();
    await checker.runFullCheck();
  } catch (error) {
    console.error('检查过程中出现错误:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = FieldChecker; 