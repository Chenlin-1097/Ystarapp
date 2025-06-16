const axios = require('axios');

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  }
};

// 从用户成功响应中获取的信息
const KNOWN_INFO = {
  wiki_token: 'O20dw9tvficXm0kffTWc9qojnOf',
  app_token: 'RQj7bH20uaeNegsdERUclgcInAd', // 从obj_token获取
  title: '在线扫码报工系统',
  obj_type: 'bitable'
};

// 预定义的表格ID（从URL中提取）
const TABLE_IDS = [
  { name: '数据表', table_id: 'tblMpF28247NLFfX', view_id: 'vewNxJliHD' },
  { name: '客户表', table_id: 'tblxbOsA83hEZShA', view_id: 'vewQQFToz7' },
  { name: '历史表', table_id: 'tbleX1cEZVzUvx2P', view_id: 'vewx9kUXoP' }
];

class KnownTokenTester {
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

  // 获取多维表格的所有表格列表
  async getBitableTables() {
    try {
      console.log(`\n📊 获取多维表格的表格列表...`);
      console.log(`使用app_token: ${KNOWN_INFO.app_token}`);
      
      const response = await axios.get(`${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${KNOWN_INFO.app_token}/tables`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 API响应状态:', response.status);
      console.log('📡 API响应体:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const tables = response.data.data.items;
        console.log(`✅ 找到 ${tables.length} 个数据表`);
        
        // 分析每个数据表
        for (const table of tables) {
          console.log(`\n📋 数据表: ${table.name} (${table.table_id})`);
          
          // 获取字段信息
          await this.getTableFields(table.table_id, table.name);
          
          // 获取样本数据
          await this.getTableData(table.table_id, table.name);
        }

        // 生成配置
        this.generateConfig(tables);
        
        return tables;
      } else {
        console.log('❌ 获取表格列表失败:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 获取表格列表失败:', error.message);
      if (error.response) {
        console.log('HTTP状态码:', error.response.status);
        console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // 测试预定义的表格ID
  async testPredefinedTables() {
    console.log('\n🧪 测试预定义的表格ID...');
    
    for (const tableInfo of TABLE_IDS) {
      console.log(`\n📋 测试表格: ${tableInfo.name} (${tableInfo.table_id})`);
      
      // 获取字段信息
      await this.getTableFields(tableInfo.table_id, tableInfo.name);
      
      // 获取样本数据
      await this.getTableData(tableInfo.table_id, tableInfo.name);
    }
  }

  // 获取表格字段信息
  async getTableFields(tableId, tableName) {
    try {
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${KNOWN_INFO.app_token}/tables/${tableId}/fields`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code === 0) {
        const fields = response.data.data.items;
        console.log(`   ✅ 字段信息: ${fields.length} 个字段`);
        
        fields.forEach((field, index) => {
          console.log(`     ${index + 1}. ${field.field_name} (${this.getFieldTypeName(field.type)}) - ID: ${field.field_id}`);
        });
        
        return fields;
      } else {
        console.log(`   ❌ 获取字段信息失败: ${response.data.msg} (代码: ${response.data.code})`);
        return null;
      }
    } catch (error) {
      console.log(`   ❌ 获取字段信息失败: ${error.message}`);
      if (error.response) {
        console.log(`   HTTP状态码: ${error.response.status}`);
        console.log(`   错误详情: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

  // 获取表格数据
  async getTableData(tableId, tableName) {
    try {
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${KNOWN_INFO.app_token}/tables/${tableId}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            page_size: 3
          }
        }
      );

      if (response.data.code === 0) {
        const records = response.data.data.items;
        console.log(`   ✅ 数据获取: ${records.length} 条记录`);
        
        if (records.length > 0) {
          console.log('   样本数据:');
          records.slice(0, 2).forEach((record, index) => {
            console.log(`     记录 ${index + 1} (ID: ${record.record_id}):`);
            for (const [fieldName, value] of Object.entries(record.fields)) {
              const displayValue = typeof value === 'string' && value.length > 50 
                ? value.substring(0, 50) + '...' 
                : JSON.stringify(value);
              console.log(`       ${fieldName}: ${displayValue}`);
            }
          });
        }
        
        return records;
      } else {
        console.log(`   ❌ 获取数据失败: ${response.data.msg} (代码: ${response.data.code})`);
        return null;
      }
    } catch (error) {
      console.log(`   ❌ 获取数据失败: ${error.message}`);
      if (error.response) {
        console.log(`   HTTP状态码: ${error.response.status}`);
        console.log(`   错误详情: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

  // 获取字段类型名称
  getFieldTypeName(type) {
    const typeMap = {
      1: '文本',
      2: '数字', 
      3: '单选',
      4: '多选',
      5: '日期',
      7: '复选框',
      11: '人员',
      13: '电话号码',
      15: '超链接',
      17: '附件',
      18: '单向关联',
      19: '查找引用',
      20: '公式',
      21: '双向关联',
      22: '地理位置',
      23: '群组',
      1001: '创建时间',
      1002: '最后更新时间',
      1003: '创建人',
      1004: '修改人'
    };
    return typeMap[type] || `未知类型(${type})`;
  }

  // 生成配置
  generateConfig(tables) {
    console.log('\n📝 生成配置信息...');
    console.log('='.repeat(60));
    
    const config = {
      FEISHU: CONFIG.FEISHU,
      TABLES: {}
    };

    // 如果没有从API获取到表格列表，使用预定义的表格信息
    const tablesToProcess = tables && tables.length > 0 ? tables : TABLE_IDS;

    tablesToProcess.forEach(table => {
      // 根据表格名称生成配置键
      let configKey = '';
      if (table.name.includes('数据') || table.name.includes('产品')) {
        configKey = 'PRODUCTS';
      } else if (table.name.includes('客户') || table.name.includes('用户')) {
        configKey = 'USERS';  
      } else if (table.name.includes('历史') || table.name.includes('记录')) {
        configKey = 'WORK_HISTORY';
      } else {
        configKey = table.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      }
      
      config.TABLES[configKey] = {
        APP_TOKEN: KNOWN_INFO.app_token,
        TABLE_ID: table.table_id,
        FIELDS: {}
      };
    });

    console.log('生成的配置:');
    console.log(JSON.stringify(config, null, 2));
    
    console.log('\n💡 接下来的步骤:');
    console.log('1. 将上面的配置信息更新到 src/config/config.js 文件中');
    console.log('2. 根据实际的字段信息更新 FIELDS 映射');
    console.log('3. 重新启动应用进行测试');
    
    return config;
  }

  // 运行测试
  async runTest() {
    console.log('🚀 开始使用已知token测试...\n');
    console.log(`📋 多维表格标题: ${KNOWN_INFO.title}`);
    console.log(`📋 App Token: ${KNOWN_INFO.app_token}`);
    console.log(`📋 类型: ${KNOWN_INFO.obj_type}`);
    
    if (!(await this.getAccessToken())) {
      console.log('❌ 无法获取访问令牌，测试终止');
      return;
    }

    // 方法1: 尝试获取表格列表
    console.log('\n🔍 方法1: 获取多维表格的表格列表');
    const tables = await this.getBitableTables();
    
    // 方法2: 测试预定义的表格ID
    console.log('\n🔍 方法2: 测试预定义的表格ID');
    await this.testPredefinedTables();
    
    console.log('\n🎉 测试完成！');
  }
}

// 运行测试
const tester = new KnownTokenTester();
tester.runTest().catch(console.error); 