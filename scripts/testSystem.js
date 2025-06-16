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

// 获取访问令牌
async function getAccessToken() {
  try {
    const response = await axios.post(`${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`, {
      app_id: CONFIG.FEISHU.APP_ID,
      app_secret: CONFIG.FEISHU.APP_SECRET
    });

    if (response.data.code === 0) {
      return response.data.tenant_access_token;
    } else {
      throw new Error('获取访问令牌失败: ' + response.data.msg);
    }
  } catch (error) {
    console.error('获取访问令牌失败:', error.message);
    throw error;
  }
}

// 测试表格访问
async function testTableAccess(accessToken, appToken, tableId, tableName) {
  try {
    console.log(`\n测试 ${tableName} 表格访问...`);
    console.log(`App Token: ${appToken}`);
    console.log(`Table ID: ${tableId}`);
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      console.log(`✅ ${tableName} 表格访问成功，共 ${records.length} 条记录`);
      
      // 显示前3条记录的字段信息
      if (records.length > 0) {
        console.log('字段信息:');
        const firstRecord = records[0];
        Object.keys(firstRecord.fields).forEach(field => {
          console.log(`  - ${field}: ${firstRecord.fields[field]}`);
        });
      }
      
      return true;
    } else {
      console.log(`❌ ${tableName} 表格访问失败: ${response.data.msg}`);
      console.log('响应详情:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ ${tableName} 表格访问失败: ${error.message}`);
    if (error.response) {
      console.log('错误状态码:', error.response.status);
      console.log('错误响应:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// 测试用户登录
async function testUserLogin(accessToken) {
  try {
    console.log('\n测试用户登录功能...');
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      console.log('可用的测试用户:');
      
      records.forEach((record, index) => {
        const fields = record.fields;
        console.log(`  ${index + 1}. 用户名: ${fields['用户名']}, 姓名: ${fields['姓名']}, 权限: ${fields['工序权限']}`);
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.log(`❌ 用户登录测试失败: ${error.message}`);
    return false;
  }
}

// 测试产品查找
async function testProductSearch(accessToken) {
  try {
    console.log('\n测试产品查找功能...');
    
    const response = await axios.get(
      `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (response.data.code === 0) {
      const records = response.data.data.items;
      console.log('可用的测试产品:');
      
      records.forEach((record, index) => {
        const fields = record.fields;
        console.log(`  ${index + 1}. 订单编号: ${fields['订单编号']}, 创建人: ${fields['创建人']}, 工序1状态: ${fields['工序1']}, 操作人: ${fields['操作人']}`);
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.log(`❌ 产品查找测试失败: ${error.message}`);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始系统测试...\n');
  
  try {
    // 1. 测试访问令牌获取
    console.log('1. 测试访问令牌获取...');
    const accessToken = await getAccessToken();
    console.log('✅ 访问令牌获取成功');
    
    // 2. 测试各表格访问
    console.log('\n2. 测试表格访问权限...');
    const userTableOk = await testTableAccess(accessToken, CONFIG.TABLES.USERS.APP_TOKEN, CONFIG.TABLES.USERS.TABLE_ID, '用户表');
    const productTableOk = await testTableAccess(accessToken, CONFIG.TABLES.PRODUCTS.APP_TOKEN, CONFIG.TABLES.PRODUCTS.TABLE_ID, '产品表');
    const historyTableOk = await testTableAccess(accessToken, CONFIG.TABLES.WORK_HISTORY.APP_TOKEN, CONFIG.TABLES.WORK_HISTORY.TABLE_ID, '报工历史表');
    
    // 3. 测试业务功能
    if (userTableOk) {
      await testUserLogin(accessToken);
    }
    
    if (productTableOk) {
      await testProductSearch(accessToken);
    }
    
    // 4. 总结
    console.log('\n📊 测试结果总结:');
    console.log(`用户表访问: ${userTableOk ? '✅ 正常' : '❌ 失败'}`);
    console.log(`产品表访问: ${productTableOk ? '✅ 正常' : '❌ 失败'}`);
    console.log(`历史表访问: ${historyTableOk ? '✅ 正常' : '❌ 失败'}`);
    
    if (userTableOk && productTableOk && historyTableOk) {
      console.log('\n🎉 所有测试通过！系统可以正常使用。');
      console.log('\n📝 使用说明:');
      console.log('1. 运行 npm run electron-dev 启动应用');
      console.log('2. 使用上面显示的测试用户登录');
      console.log('3. 选择工序类型后，输入上面显示的二维码进行测试');
    } else {
      console.log('\n⚠️  部分测试失败，请检查配置和权限设置。');
    }
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
  }
}

// 运行测试
runTests(); 