const axios = require('axios');

// 导入配置（模拟ES6导入）
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
        INTERNAL_ID: '内部编号',
        USERNAME: '用户名',
        PASSWORD: '密码',
        NAME: '姓名',
        PERMISSIONS: '工序权限'
      }
    },
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblMpF28247NLFfX',
      FIELDS: {
        CREATE_DATE: '创建日期',
        CREATOR: '创建人',
        ORDER_NUMBER: '订单编号',
        WORK_TYPE_1: '工序1',
        OPERATOR: '操作人',
        WORK_TYPE_1_COMPLETE_TIME: '工序1完成时间',
        ATTACHMENT: '附件'
      }
    },
    WORK_HISTORY: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tbleX1cEZVzUvx2P',
      FIELDS: {
        TIMESTAMP: '报工时间',
        OPERATOR: '操作人',
        ORDER_NUMBER: '订单编号',
        WORK_TYPE: '工序类型',
        STATUS: '状态'
      }
    }
  }
};

class ConfigTester {
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

  // 测试用户登录功能
  async testUserLogin(username, password) {
    try {
      console.log(`\n🔐 测试用户登录: ${username}`);
      
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            filter: `AND(CurrentValue.[${CONFIG.TABLES.USERS.FIELDS.USERNAME}]="${username}", CurrentValue.[${CONFIG.TABLES.USERS.FIELDS.PASSWORD}]="${password}")`,
            page_size: 1
          }
        }
      );

      if (response.data.code === 0) {
        const records = response.data.data.items;
        if (records && records.length > 0) {
          const user = records[0].fields;
          console.log('✅ 登录成功');
          console.log(`   姓名: ${user[CONFIG.TABLES.USERS.FIELDS.NAME]}`);
          console.log(`   权限: ${JSON.stringify(user[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS])}`);
          return user;
        } else {
          console.log('❌ 用户名或密码错误');
          return null;
        }
      } else {
        console.log('❌ 登录查询失败:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 登录测试失败:', error.message);
      return null;
    }
  }

  // 测试获取产品数据
  async testGetProducts() {
    try {
      console.log('\n📦 测试获取产品数据...');
      
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            page_size: 5
          }
        }
      );

      if (response.data.code === 0) {
        const records = response.data.data.items;
        console.log(`✅ 获取到 ${records.length} 条产品数据`);
        
        records.forEach((record, index) => {
          const product = record.fields;
          console.log(`\n   产品 ${index + 1}:`);
          console.log(`     订单编号: ${product[CONFIG.TABLES.PRODUCTS.FIELDS.ORDER_NUMBER]}`);
          console.log(`     创建人: ${product[CONFIG.TABLES.PRODUCTS.FIELDS.CREATOR]}`);
          console.log(`     工序1状态: ${product[CONFIG.TABLES.PRODUCTS.FIELDS.WORK_TYPE_1]}`);
          console.log(`     操作人: ${product[CONFIG.TABLES.PRODUCTS.FIELDS.OPERATOR]}`);
        });
        
        return records;
      } else {
        console.log('❌ 获取产品数据失败:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 产品数据测试失败:', error.message);
      return null;
    }
  }

  // 测试添加报工记录
  async testAddWorkRecord(orderNumber, operator, workType) {
    try {
      console.log(`\n📝 测试添加报工记录: ${orderNumber} - ${workType}`);
      
      const recordData = {
        fields: {
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.TIMESTAMP]: Date.now(),
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.OPERATOR]: operator,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.ORDER_NUMBER]: orderNumber,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.WORK_TYPE]: workType,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.STATUS]: '正常'
        }
      };

      const response = await axios.post(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.WORK_HISTORY.APP_TOKEN}/tables/${CONFIG.TABLES.WORK_HISTORY.TABLE_ID}/records`,
        recordData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code === 0) {
        console.log('✅ 报工记录添加成功');
        console.log(`   记录ID: ${response.data.data.record.record_id}`);
        return response.data.data.record;
      } else {
        console.log('❌ 添加报工记录失败:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 报工记录测试失败:', error.message);
      if (error.response) {
        console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  // 测试获取报工历史
  async testGetWorkHistory() {
    try {
      console.log('\n📊 测试获取报工历史...');
      
      const response = await axios.get(
        `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.WORK_HISTORY.APP_TOKEN}/tables/${CONFIG.TABLES.WORK_HISTORY.TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            page_size: 5
          }
        }
      );

      if (response.data.code === 0) {
        const records = response.data.data.items;
        console.log(`✅ 获取到 ${records.length} 条历史记录`);
        
        records.forEach((record, index) => {
          const history = record.fields;
          console.log(`\n   记录 ${index + 1}:`);
          console.log(`     订单编号: ${history[CONFIG.TABLES.WORK_HISTORY.FIELDS.ORDER_NUMBER] || '未知'}`);
          console.log(`     操作人: ${history[CONFIG.TABLES.WORK_HISTORY.FIELDS.OPERATOR] || '未知'}`);
          console.log(`     工序类型: ${history[CONFIG.TABLES.WORK_HISTORY.FIELDS.WORK_TYPE] || '未知'}`);
          console.log(`     状态: ${history[CONFIG.TABLES.WORK_HISTORY.FIELDS.STATUS] || '未知'}`);
          const timestamp = history[CONFIG.TABLES.WORK_HISTORY.FIELDS.TIMESTAMP];
          console.log(`     时间: ${timestamp ? new Date(timestamp).toLocaleString() : '未知'}`);
        });
        
        return records;
      } else {
        console.log('❌ 获取报工历史失败:', response.data.msg);
        return null;
      }
    } catch (error) {
      console.error('❌ 报工历史测试失败:', error.message);
      return null;
    }
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🚀 开始测试新配置...\n');
    
    if (!(await this.getAccessToken())) {
      console.log('❌ 无法获取访问令牌，测试终止');
      return;
    }

    // 测试用户登录
    await this.testUserLogin('admin', 'admin123456');
    await this.testUserLogin('test', '123456');
    await this.testUserLogin('invalid', 'invalid');

    // 测试获取产品数据
    await this.testGetProducts();

    // 测试添加报工记录
    await this.testAddWorkRecord('002', '测试员', '工序1');

    // 测试获取报工历史
    await this.testGetWorkHistory();
    
    console.log('\n🎉 所有测试完成！');
    console.log('\n💡 如果所有测试都通过，说明新配置工作正常，可以重新启动应用了。');
  }
}

// 运行测试
const tester = new ConfigTester();
tester.runAllTests().catch(console.error); 