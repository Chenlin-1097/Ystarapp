// 简单的表格检查脚本
const axios = require('axios');

const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
  },
  TABLES: {
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblMpF28247NLFfX'
    }
  }
};

async function inspectTable() {
  try {
    console.log('🔍 开始检查数据表结构...\n');
    
    // 1. 获取访问令牌
    console.log('1. 获取访问令牌...');
    const tokenResponse = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: CONFIG.FEISHU.APP_ID,
      app_secret: CONFIG.FEISHU.APP_SECRET
    });
    
    if (tokenResponse.data.code !== 0) {
      throw new Error('获取访问令牌失败: ' + tokenResponse.data.msg);
    }
    
    const accessToken = tokenResponse.data.tenant_access_token;
    console.log('✅ 访问令牌获取成功\n');
    
    // 2. 获取多维表格信息
    console.log('2. 获取多维表格信息...');
    const appResponse = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (appResponse.data.code === 0) {
      const appInfo = appResponse.data.data.app;
      console.log(`表格名称: ${appInfo.name}`);
      console.log(`表格类型: ${appInfo.is_advanced ? '高级' : '普通'}`);
      console.log(`时区: ${appInfo.time_zone}\n`);
    }
    
    // 3. 获取所有工作表
    console.log('3. 获取工作表列表...');
    const tablesResponse = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (tablesResponse.data.code === 0) {
      const tables = tablesResponse.data.data.items;
      console.log(`找到 ${tables.length} 个工作表:`);
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.name} (ID: ${table.table_id})`);
      });
      console.log('');
      
      // 4. 检查产品数据表的字段
      const productTable = tables.find(t => t.table_id === CONFIG.TABLES.PRODUCTS.TABLE_ID);
      if (productTable) {
        console.log(`4. 检查产品数据表 "${productTable.name}" 的字段信息...`);
        
        const fieldsResponse = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/fields`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (fieldsResponse.data.code === 0) {
          const fields = fieldsResponse.data.data.items;
          console.log(`\n找到 ${fields.length} 个字段:`);
          fields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field.field_name} (类型: ${getFieldTypeText(field.type)}, ID: ${field.field_id})`);
          });
          
          // 5. 获取部分数据查看实际内容
          console.log('\n5. 获取前3行数据预览...');
          const dataResponse = await axios.get(`https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/records`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { page_size: 3 }
          });
          
          if (dataResponse.data.code === 0) {
            const records = dataResponse.data.data.items;
            console.log(`\n数据预览 (共 ${records.length} 行):`);
            
            records.forEach((record, index) => {
              console.log(`\n记录 ${index + 1}:`);
              Object.entries(record.fields).forEach(([fieldId, value]) => {
                const field = fields.find(f => f.field_id === fieldId);
                if (field) {
                  const displayValue = formatValue(value, field.type);
                  console.log(`  ${field.field_name}: ${displayValue}`);
                }
              });
            });
          }
        }
      } else {
        console.log('❌ 未找到指定的产品数据表');
      }
    }
    
    console.log('\n✅ 表格检查完成！');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    if (error.response?.data) {
      console.error('错误详情:', error.response.data);
    }
  }
}

// 字段类型映射
function getFieldTypeText(type) {
  const typeMap = {
    1: '文本',
    2: '数字',
    3: '单选',
    4: '多选',
    5: '日期',
    7: '复选框',
    11: '人员',
    15: '图片',
    17: '链接',
    18: '附件',
    19: '关联',
    1001: '创建时间',
    1002: '修改时间',
    1003: '创建人',
    1004: '修改人'
  };
  return typeMap[type] || `未知(${type})`;
}

// 格式化值
function formatValue(value, fieldType) {
  if (value === null || value === undefined) return '(空)';
  
  if (fieldType === 15 || fieldType === 18) { // 图片或附件
    if (Array.isArray(value)) {
      return `[${value.length}个文件]`;
    }
  }
  
  if (fieldType === 4) { // 多选
    if (Array.isArray(value)) {
      return value.join(', ');
    }
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

// 运行检查
inspectTable(); 