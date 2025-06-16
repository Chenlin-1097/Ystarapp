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
      FIELDS: {
        USERNAME: '用户名',
        PASSWORD: '密码',
        NAME: '姓名',
        PERMISSIONS: '工序权限'
      }
    }
  }
};

async function testLogin() {
  try {
    console.log('🧪 测试登录功能...\n');
    
    // 1. 获取访问令牌
    const tokenResponse = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      }
    );

    if (tokenResponse.data.code !== 0) {
      console.log('❌ 获取访问令牌失败');
      return;
    }
    
    const accessToken = tokenResponse.data.tenant_access_token;
    console.log('✅ 访问令牌获取成功');
    
    // 2. 获取用户数据
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.code === 0) {
      const records = response.data.data.items;
      
      // 过滤掉空记录
      const validRecords = records.filter(record => 
        record.fields && Object.keys(record.fields).length > 0
      );
      
      console.log(`📊 数据统计:`);
      console.log(`  总记录数: ${records.length}`);
      console.log(`  有效记录数: ${validRecords.length}`);
      console.log(`  空记录数: ${records.length - validRecords.length}`);
      
      console.log('\n👥 有效用户列表:');
      validRecords.forEach((record, index) => {
        const fields = record.fields;
        console.log(`  ${index + 1}. 用户名: ${fields[CONFIG.TABLES.USERS.FIELDS.USERNAME]}`);
        console.log(`     姓名: ${fields[CONFIG.TABLES.USERS.FIELDS.NAME]}`);
        console.log(`     权限: ${fields[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]}`);
        console.log('');
      });
      
      // 测试登录
      const testUsers = [
        { username: 'admin', password: 'admin123' },
        { username: 'test', password: '123456' },
        { username: 'worker1', password: '123456' },
        { username: 'invalid', password: 'wrong' }
      ];
      
      console.log('🔐 测试登录验证:');
      for (const testUser of testUsers) {
        const userRecord = validRecords.find(record => {
          const fields = record.fields;
          return fields[CONFIG.TABLES.USERS.FIELDS.USERNAME] === testUser.username && 
                 fields[CONFIG.TABLES.USERS.FIELDS.PASSWORD] === testUser.password;
        });
        
        if (userRecord) {
          const fields = userRecord.fields;
          console.log(`✅ ${testUser.username} 登录成功 - ${fields[CONFIG.TABLES.USERS.FIELDS.NAME]}`);
        } else {
          console.log(`❌ ${testUser.username} 登录失败`);
        }
      }
      
    } else {
      console.log('❌ 获取用户数据失败:', response.data.msg);
    }
    
  } catch (error) {
    console.error('测试过程中出现错误:', error.message);
  }
}

// 运行测试
testLogin(); 