const axios = require('axios');

// 飞书应用配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

// 获取访问令牌
async function getAccessToken() {
  try {
    const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/auth/v3/tenant_access_token/internal`, {
      app_id: FEISHU_CONFIG.APP_ID,
      app_secret: FEISHU_CONFIG.APP_SECRET
    });

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

// 创建多维表格
async function createBitable(accessToken, name, folderToken = '') {
  try {
    const payload = {
      name: name
    };
    
    if (folderToken) {
      payload.folder_token = folderToken;
    }

    const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/bitable/v1/apps`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.data.code === 0) {
      const app = response.data.data.app;
      console.log(`✅ 成功创建多维表格: ${name}`);
      console.log(`📋 App Token: ${app.app_token}`);
      console.log(`📊 默认表格ID: ${app.default_table_id}`);
      console.log(`🔗 访问链接: ${app.url}`);
      return {
        appToken: app.app_token,
        tableId: app.default_table_id,
        url: app.url,
        name: name
      };
    } else {
      throw new Error('创建多维表格失败: ' + response.data.msg);
    }
  } catch (error) {
    console.error('创建多维表格失败:', error);
    throw error;
  }
}

// 创建表格字段
async function createTableField(accessToken, appToken, tableId, fieldName, fieldType, properties = {}) {
  try {
    const payload = {
      field_name: fieldName,
      type: fieldType,
      ...properties
    };

    const response = await axios.post(
      `${FEISHU_CONFIG.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (response.data.code === 0) {
      console.log(`✅ 成功创建字段: ${fieldName} (${fieldType})`);
      return response.data.data.field;
    } else {
      throw new Error(`创建字段失败: ${response.data.msg}`);
    }
  } catch (error) {
    console.error(`创建字段失败 (${fieldName}):`, error);
    throw error;
  }
}

// 添加表格记录
async function addTableRecord(accessToken, appToken, tableId, fields) {
  try {
    const response = await axios.post(
      `${FEISHU_CONFIG.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      { fields },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (response.data.code === 0) {
      return response.data.data.record;
    } else {
      throw new Error(`添加记录失败: ${response.data.msg}`);
    }
  } catch (error) {
    console.error('添加记录失败:', error);
    throw error;
  }
}

// 创建用户表格
async function createUserTable() {
  console.log('🚀 开始创建用户表格...');
  
  const accessToken = await getAccessToken();
  
  // 创建用户多维表格
  const userTable = await createBitable(accessToken, '扫码报工系统-用户表');
  
  // 等待一下确保表格创建完成
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 创建用户表格字段
  const userFields = [
    { name: '用户名', type: 1 }, // 文本
    { name: '密码', type: 1 }, // 文本
    { name: '姓名', type: 1 }, // 文本
    { name: '工序权限', type: 1 } // 文本
  ];
  
  for (const field of userFields) {
    await createTableField(accessToken, userTable.appToken, userTable.tableId, field.name, field.type);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
  }
  
  // 添加测试用户数据
  const testUsers = [
    {
      '用户名': 'test',
      '密码': '123456',
      '姓名': '测试用户',
      '工序权限': '工序1,工序2,工序3,工序4'
    },
    {
      '用户名': 'admin',
      '密码': 'admin123',
      '姓名': '管理员',
      '工序权限': '工序1,工序2,工序3,工序4'
    },
    {
      '用户名': 'worker1',
      '密码': '123456',
      '姓名': '工人张三',
      '工序权限': '工序1,工序2'
    },
    {
      '用户名': 'worker2',
      '密码': '123456',
      '姓名': '工人李四',
      '工序权限': '工序3,工序4'
    }
  ];
  
  console.log('📝 添加测试用户数据...');
  for (const user of testUsers) {
    await addTableRecord(accessToken, userTable.appToken, userTable.tableId, user);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return userTable;
}

// 创建产品表格
async function createProductTable() {
  console.log('🚀 开始创建产品表格...');
  
  const accessToken = await getAccessToken();
  
  // 创建产品多维表格
  const productTable = await createBitable(accessToken, '扫码报工系统-产品表');
  
  // 等待一下确保表格创建完成
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 创建产品表格字段
  const productFields = [
    { name: '产品名称', type: 1 }, // 文本
    { name: '总数量', type: 2 }, // 数字
    { name: '已报工数量', type: 2 }, // 数字
    { name: '二维码', type: 1 }, // 文本
    { name: '工序1报工数', type: 2 }, // 数字
    { name: '工序2报工数', type: 2 }, // 数字
    { name: '工序3报工数', type: 2 }, // 数字
    { name: '工序4报工数', type: 2 } // 数字
  ];
  
  for (const field of productFields) {
    await createTableField(accessToken, productTable.appToken, productTable.tableId, field.name, field.type);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
  }
  
  // 添加测试产品数据
  const testProducts = [
    {
      '产品名称': 'iPhone 15 Pro',
      '总数量': 100,
      '已报工数量': 0,
      '二维码': 'PROD001',
      '工序1报工数': 0,
      '工序2报工数': 0,
      '工序3报工数': 0,
      '工序4报工数': 0
    },
    {
      '产品名称': 'MacBook Pro M3',
      '总数量': 50,
      '已报工数量': 0,
      '二维码': 'PROD002',
      '工序1报工数': 0,
      '工序2报工数': 0,
      '工序3报工数': 0,
      '工序4报工数': 0
    },
    {
      '产品名称': 'iPad Air',
      '总数量': 80,
      '已报工数量': 0,
      '二维码': 'PROD003',
      '工序1报工数': 0,
      '工序2报工数': 0,
      '工序3报工数': 0,
      '工序4报工数': 0
    },
    {
      '产品名称': 'Apple Watch',
      '总数量': 120,
      '已报工数量': 0,
      '二维码': 'PROD004',
      '工序1报工数': 0,
      '工序2报工数': 0,
      '工序3报工数': 0,
      '工序4报工数': 0
    }
  ];
  
  console.log('📝 添加测试产品数据...');
  for (const product of testProducts) {
    await addTableRecord(accessToken, productTable.appToken, productTable.tableId, product);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return productTable;
}

// 创建报工历史表格
async function createWorkHistoryTable() {
  console.log('🚀 开始创建报工历史表格...');
  
  const accessToken = await getAccessToken();
  
  // 创建报工历史多维表格
  const historyTable = await createBitable(accessToken, '扫码报工系统-报工历史');
  
  // 等待一下确保表格创建完成
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 创建报工历史表格字段
  const historyFields = [
    { name: '报工时间', type: 5 }, // 日期时间
    { name: '操作人', type: 1 }, // 文本
    { name: '产品名称', type: 1 }, // 文本
    { name: '工序类型', type: 1 }, // 文本
    { name: '二维码', type: 1 }, // 文本
    { name: '状态', type: 1 } // 文本
  ];
  
  for (const field of historyFields) {
    await createTableField(accessToken, historyTable.appToken, historyTable.tableId, field.name, field.type);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
  }
  
  return historyTable;
}

// 主函数：创建所有表格
async function createAllTables() {
  try {
    console.log('🎯 开始创建扫码报工系统所需的飞书多维表格...\n');
    
    // 创建用户表格
    const userTable = await createUserTable();
    console.log('\n');
    
    // 创建产品表格
    const productTable = await createProductTable();
    console.log('\n');
    
    // 创建报工历史表格
    const historyTable = await createWorkHistoryTable();
    console.log('\n');
    
    // 输出配置信息
    console.log('🎉 所有表格创建完成！请将以下配置信息复制到系统配置中：\n');
    
    console.log('📋 用户表格配置：');
    console.log(`App Token: ${userTable.appToken}`);
    console.log(`Table ID: ${userTable.tableId}`);
    console.log(`访问链接: ${userTable.url}\n`);
    
    console.log('📋 产品表格配置：');
    console.log(`App Token: ${productTable.appToken}`);
    console.log(`Table ID: ${productTable.tableId}`);
    console.log(`访问链接: ${productTable.url}\n`);
    
    console.log('📋 报工历史表格配置：');
    console.log(`App Token: ${historyTable.appToken}`);
    console.log(`Table ID: ${historyTable.tableId}`);
    console.log(`访问链接: ${historyTable.url}\n`);
    
    // 生成配置文件内容
    const configContent = `
// 自动生成的配置信息
export const GENERATED_CONFIG = {
  TABLES: {
    USERS: {
      APP_TOKEN: '${userTable.appToken}',
      TABLE_ID: '${userTable.tableId}',
      URL: '${userTable.url}'
    },
    PRODUCTS: {
      APP_TOKEN: '${productTable.appToken}',
      TABLE_ID: '${productTable.tableId}',
      URL: '${productTable.url}'
    },
    WORK_HISTORY: {
      APP_TOKEN: '${historyTable.appToken}',
      TABLE_ID: '${historyTable.tableId}',
      URL: '${historyTable.url}'
    }
  }
};
`;
    
    console.log('📄 配置文件内容：');
    console.log(configContent);
    
    return {
      userTable,
      productTable,
      historyTable,
      configContent
    };
    
  } catch (error) {
    console.error('❌ 创建表格失败:', error);
    throw error;
  }
}

// 运行脚本
if (require.main === module) {
  createAllTables().catch(console.error);
} 