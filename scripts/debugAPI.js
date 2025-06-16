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
    }
  }
};

async function debugAPI() {
  try {
    console.log('🔍 开始API调试...\n');
    
    // 1. 获取访问令牌
    console.log('1. 获取访问令牌...');
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      }
    );

    console.log('令牌响应状态:', tokenResponse.status);
    console.log('令牌响应数据:', JSON.stringify(tokenResponse.data, null, 2));
    
    if (tokenResponse.data.code !== 0) {
      console.log('❌ 获取访问令牌失败');
      return;
    }
    
    const accessToken = tokenResponse.data.tenant_access_token;
    console.log('✅ 访问令牌获取成功');
    
    // 2. 测试表格访问
    console.log('\n2. 测试表格访问...');
    const tableResponse = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('表格响应状态:', tableResponse.status);
    console.log('表格响应数据:', JSON.stringify(tableResponse.data, null, 2));
    
    if (tableResponse.data.code === 0) {
      console.log('\n✅ 表格访问成功');
      console.log('记录数量:', tableResponse.data.data.items.length);
      
      if (tableResponse.data.data.items.length > 0) {
        console.log('\n第一条记录结构:');
        console.log(JSON.stringify(tableResponse.data.data.items[0], null, 2));
      }
    } else {
      console.log('❌ 表格访问失败:', tableResponse.data.msg);
    }
    
    // 3. 尝试获取表格字段信息
    console.log('\n3. 获取表格字段信息...');
    try {
      const fieldsResponse = await axios.get(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/fields`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('字段响应状态:', fieldsResponse.status);
      console.log('字段响应数据:', JSON.stringify(fieldsResponse.data, null, 2));
    } catch (error) {
      console.log('获取字段信息失败:', error.message);
      if (error.response) {
        console.log('错误响应:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('调试过程中出现错误:', error.message);
    if (error.response) {
      console.log('错误响应状态:', error.response.status);
      console.log('错误响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 运行调试
debugAPI(); 