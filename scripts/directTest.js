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

class DirectTester {
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

  // 获取知识库节点信息
  async getWikiNodeInfo() {
    try {
      console.log(`📖 获取知识库节点信息: ${WIKI_TOKEN}`);
      
      const response = await axios.get(`${CONFIG.FEISHU.BASE_URL}/wiki/v2/space/node`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          token: WIKI_TOKEN
        }
      });

      console.log('📡 API响应状态:', response.status);
      console.log('📡 API响应头:', JSON.stringify(response.headers, null, 2));
      console.log('📡 API响应体:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const node = response.data.data.node;
        console.log('\n✅ 知识库节点信息获取成功');
        console.log(`   标题: ${node.title}`);
        console.log(`   类型: ${node.obj_type}`);
        console.log(`   节点token: ${node.node_token}`);
        console.log(`   对象token: ${node.obj_token}`);
        
        // 如果是多维表格类型，获取表格信息
        if (node.obj_type === 'bitable') {
          console.log('\n🎯 检测到多维表格类型，开始获取表格信息...');
          await this.getBitableInfo(node.obj_token);
        }
        
        return node;
      } else {
        console.log('❌ 获取知识库节点信息失败:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 获取知识库节点信息失败:', error.message);
      if (error.response) {
        console.log('HTTP状态码:', error.response.status);
        console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // 获取多维表格信息
  async getBitableInfo(appToken) {
    try {
      console.log(`\n📊 获取多维表格信息: ${appToken}`);
      
      // 获取多维表格的所有数据表
      const tablesResponse = await axios.get(`${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 表格列表API响应:', JSON.stringify(tablesResponse.data, null, 2));

      if (tablesResponse.data.code === 0) {
        const tables = tablesResponse.data.data.items;
        console.log(`✅ 找到 ${tables.length} 个数据表`);
        
        // 分析每个数据表
        for (const table of tables) {
          console.log(`\n📋 数据表: ${table.name} (${table.table_id})`);
          
          // 获取字段信息
          await this.getTableFields(appToken, table.table_id, table.name);
          
          // 获取样本数据
          await this.getTableData(appToken, table.table_id, table.name);
        }

        // 生成配置
        this.generateConfig(appToken, tables);
        
        return tables;
      } else {
        console.log('❌ 获取多维表格信息失败:', tablesResponse.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 获取多维表格信息失败:', error.message);
      if (error.response) {
        console.log('HTTP状态码:', error.response.status);
        console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // 获取表格字段信息
  async getTableFields(appToken, tableId, tableName) {
    try {
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
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
          console.log(`     ${index + 1}. ${field.field_name} (${this.getFieldTypeName(field.type)})`);
        });
        
        return fields;
      } else {
        console.log(`   ❌ 获取字段信息失败: ${response.data.msg}`);
        return null;
      }
    } catch (error) {
      console.log(`   ❌ 获取字段信息失败: ${error.message}`);
      return null;
    }
  }

  // 获取表格数据
  async getTableData(appToken, tableId, tableName) {
    try {
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
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
            console.log(`     记录 ${index + 1}:`);
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
        console.log(`   ❌ 获取数据失败: ${response.data.msg}`);
        return null;
      }
    } catch (error) {
      console.log(`   ❌ 获取数据失败: ${error.message}`);
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
  generateConfig(appToken, tables) {
    console.log('\n📝 生成配置信息...');
    console.log('='.repeat(60));
    
    const config = {
      FEISHU: CONFIG.FEISHU,
      TABLES: {}
    };

    tables.forEach(table => {
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
        APP_TOKEN: appToken,
        TABLE_ID: table.table_id,
        FIELDS: {}
      };
    });

    console.log('生成的配置:');
    console.log(JSON.stringify(config, null, 2));
    
    return config;
  }

  // 运行测试
  async runTest() {
    console.log('🚀 开始直接测试...\n');
    
    if (!(await this.getAccessToken())) {
      console.log('❌ 无法获取访问令牌，测试终止');
      return;
    }

    // 获取知识库节点信息
    await this.getWikiNodeInfo();
    
    console.log('\n🎉 测试完成！');
  }
}

// 运行测试
const tester = new DirectTester();
tester.runTest().catch(console.error); 