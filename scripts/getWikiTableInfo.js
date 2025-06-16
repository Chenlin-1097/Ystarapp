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
const WIKI_INFO = {
  wiki_token: 'O20dw9tvficXm0kffTWc9qojnOf',
  tables: [
    { name: '数据表', table_id: 'tblMpF28247NLFfX', view_id: 'vewNxJliHD' },
    { name: '客户表', table_id: 'tblxbOsA83hEZShA', view_id: 'vewQQFToz7' },
    { name: '历史表', table_id: 'tbleX1cEZVzUvx2P', view_id: 'vewx9kUXoP' }
  ]
};

class WikiTableAnalyzer {
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

  // 获取知识库节点信息 - 使用正确的API
  async getWikiNodeInfo(wikiToken) {
    try {
      console.log(`📖 获取知识库节点信息: ${wikiToken}`);
      
      // 参考用户提供的示例，使用正确的API端点
      const response = await axios.get(`${CONFIG.FEISHU.BASE_URL}/wiki/v2/space/node`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          token: wikiToken,
          obj_type: 'wiki'
        }
      });

      if (response.data.code === 0) {
        const node = response.data.data.node;
        console.log('✅ 知识库节点信息获取成功');
        console.log(`   标题: ${node.title}`);
        console.log(`   类型: ${node.obj_type}`);
        console.log(`   节点token: ${node.node_token}`);
        console.log(`   对象token: ${node.obj_token}`);
        console.log(`   创建时间: ${node.obj_create_time}`);
        console.log(`   更新时间: ${node.obj_edit_time}`);
        
        // 如果是多维表格类型，使用obj_token作为app_token
        if (node.obj_type === 'bitable') {
          console.log('🎯 检测到多维表格类型');
          console.log(`📊 使用obj_token作为app_token: ${node.obj_token}`);
          
          const bitableInfo = await this.getBitableInfo(node.obj_token);
          if (bitableInfo) {
            console.log('✅ 成功获取多维表格信息');
            return bitableInfo;
          }
        } else {
          console.log(`📝 节点类型为: ${node.obj_type}，不是多维表格`);
        }
        
        return node;
      } else {
        console.log('❌ 获取知识库节点信息失败:', response.data.msg);
        console.log('错误代码:', response.data.code);
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

  // 尝试其他方法获取表格信息
  async tryAlternativeMethods(wikiToken, node) {
    console.log('\n🔄 尝试其他方法获取表格信息...');
    
    // 方法1: 尝试直接使用wiki_token作为app_token
    console.log('\n方法1: 直接使用wiki_token作为app_token');
    try {
      const bitableInfo = await this.getBitableInfo(wikiToken);
      if (bitableInfo) {
        console.log('✅ 方法1成功');
        return bitableInfo;
      }
    } catch (error) {
      console.log(`方法1失败: ${error.message}`);
    }

    // 方法2: 尝试从节点URL中提取app_token
    if (node.url) {
      console.log('\n方法2: 从节点URL中提取app_token');
      try {
        const urlMatch = node.url.match(/\/base\/([a-zA-Z0-9]+)/);
        if (urlMatch) {
          const extractedToken = urlMatch[1];
          console.log(`从URL提取的token: ${extractedToken}`);
          
          const bitableInfo = await this.getBitableInfo(extractedToken);
          if (bitableInfo) {
            console.log('✅ 方法2成功');
            return bitableInfo;
          }
        }
      } catch (error) {
        console.log(`方法2失败: ${error.message}`);
      }
    }

    // 方法3: 尝试获取知识库空间下的所有节点
    console.log('\n方法3: 获取知识库空间下的所有节点');
    try {
      const nodesResponse = await axios.get(`${CONFIG.FEISHU.BASE_URL}/wiki/v2/spaces/${wikiToken}/nodes`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (nodesResponse.data.code === 0) {
        const nodes = nodesResponse.data.data.items;
        console.log(`找到 ${nodes.length} 个子节点`);
        
        // 查找多维表格类型的节点
        for (const childNode of nodes) {
          if (childNode.obj_type === 'bitable') {
            console.log(`找到多维表格节点: ${childNode.title}`);
            const bitableInfo = await this.analyzeBitableNode(childNode);
            if (bitableInfo) {
              console.log('✅ 方法3成功');
              return bitableInfo;
            }
          }
        }
      }
    } catch (error) {
      console.log(`方法3失败: ${error.message}`);
    }

    // 方法4: 尝试使用预定义的表格ID直接访问
    console.log('\n方法4: 使用预定义的表格ID直接访问');
    for (const tableInfo of WIKI_INFO.tables) {
      try {
        console.log(`尝试访问表格: ${tableInfo.name} (${tableInfo.table_id})`);
        
        // 尝试不同的app_token组合
        const tokenCandidates = [
          wikiToken,
          node.obj_token,
          node.token
        ].filter(Boolean);
        
        for (const candidate of tokenCandidates) {
          try {
            const tableData = await this.getTableData(candidate, tableInfo.table_id, tableInfo.name, 1);
            if (tableData) {
              console.log(`✅ 找到有效的app_token: ${candidate}`);
              return await this.getBitableInfo(candidate);
            }
          } catch (error) {
            // 继续尝试下一个候选token
          }
        }
      } catch (error) {
        console.log(`表格 ${tableInfo.name} 访问失败: ${error.message}`);
      }
    }

    return null;
  }

  // 分析多维表格节点
  async analyzeBitableNode(node) {
    console.log('\n🎯 分析多维表格节点...');
    
    // 尝试从节点信息中获取app_token
    const appToken = node.obj_token || node.token || node.node_token;
    
    if (!appToken) {
      console.log('❌ 无法从节点信息中获取app_token');
      return null;
    }
    
    console.log(`使用app_token: ${appToken}`);
    
    return await this.getBitableInfo(appToken);
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

      if (tablesResponse.data.code === 0) {
        const tables = tablesResponse.data.data.items;
        console.log(`✅ 找到 ${tables.length} 个数据表`);
        
        const bitableInfo = {
          app_token: appToken,
          tables: []
        };

        // 分析每个数据表
        for (const table of tables) {
          console.log(`\n📋 分析数据表: ${table.name} (${table.table_id})`);
          
          const tableAnalysis = await this.analyzeTable(appToken, table.table_id, table.name);
          if (tableAnalysis) {
            bitableInfo.tables.push({
              ...table,
              ...tableAnalysis
            });
          }
        }

        return bitableInfo;
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

  // 获取表格列表信息
  async getTablesInfo(appToken) {
    try {
      console.log('📋 获取表格列表...');
      
      const response = await axios.get(`${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === 0) {
        const tables = response.data.data.items;
        console.log(`✅ 表格列表获取成功，共 ${tables.length} 个表格`);
        
        const tablesInfo = [];
        
        // 分析每个表格
        for (const table of tables) {
          console.log(`\n📊 分析表格: ${table.name}`);
          console.log(`   表格ID: ${table.table_id}`);
          
          const tableInfo = await this.analyzeTable(appToken, table.table_id, table.name);
          if (tableInfo) {
            tablesInfo.push({
              ...table,
              fields: tableInfo.fields,
              sampleData: tableInfo.sampleData
            });
          }
        }
        
        return tablesInfo;
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

  // 分析单个表格
  async analyzeTable(appToken, tableId, tableName) {
    try {
      console.log(`🔍 分析表格结构: ${tableName}`);
      
      const tableInfo = {
        fields: null,
        sampleData: null
      };

      // 获取字段信息
      const fields = await this.getTableFields(appToken, tableId, tableName);
      if (fields) {
        tableInfo.fields = fields;
      }

      // 获取样本数据
      const data = await this.getTableData(appToken, tableId, tableName, 3);
      if (data) {
        tableInfo.sampleData = data;
      }

      return tableInfo;
    } catch (error) {
      console.error(`❌ 分析表格失败: ${tableName}`, error.message);
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
  async getTableData(appToken, tableId, tableName, pageSize = 3) {
    try {
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            page_size: pageSize
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

  // 生成配置文件
  generateConfig(bitableInfo) {
    if (!bitableInfo || !bitableInfo.tables) {
      console.log('❌ 没有可用的表格信息来生成配置');
      return;
    }

    console.log('\n📝 生成配置信息...');
    console.log('='.repeat(60));
    
    const config = {
      FEISHU: CONFIG.FEISHU,
      TABLES: {}
    };

    // 从多维表格信息中提取app_token
    const appToken = bitableInfo.app_token;
    
    bitableInfo.tables.forEach(table => {
      if (table.fields && table.fields.length > 0) {
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

        // 生成字段映射
        table.fields.forEach(field => {
          const fieldKey = field.field_name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
          config.TABLES[configKey].FIELDS[fieldKey] = field.field_name;
        });
      }
    });

    console.log('生成的配置:');
    console.log(JSON.stringify(config, null, 2));
    
    return config;
  }

  // 运行完整分析
  async runAnalysis() {
    console.log('🚀 开始分析知识库表格信息...\n');
    
    if (!(await this.getAccessToken())) {
      console.log('❌ 无法获取访问令牌，分析终止');
      return;
    }

    // 获取知识库节点信息
    const nodeInfo = await this.getWikiNodeInfo(WIKI_INFO.wiki_token);
    
    if (nodeInfo && nodeInfo.app) {
      // 生成配置
      this.generateConfig(nodeInfo);
      
      console.log('\n🎉 分析完成！');
      console.log('\n💡 接下来的步骤:');
      console.log('1. 根据上面的配置信息更新 src/config/config.js');
      console.log('2. 确认字段映射是否正确');
      console.log('3. 重新启动应用进行测试');
    } else {
      console.log('\n❌ 未能获取到表格信息');
      console.log('\n🔍 可能的原因:');
      console.log('1. 知识库节点不是多维表格类型');
      console.log('2. 应用权限不足');
      console.log('3. 节点token不正确');
      
      console.log('\n💡 建议:');
      console.log('1. 确认知识库中的内容确实是多维表格');
      console.log('2. 检查飞书应用的权限配置');
      console.log('3. 尝试直接从多维表格URL中获取app_token');
    }
  }
}

// 运行分析
const analyzer = new WikiTableAnalyzer();
analyzer.runAnalysis().catch(console.error); 