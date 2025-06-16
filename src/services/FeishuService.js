import axios from 'axios';
import { CONFIG } from '../config/config';

class FeishuService {
  constructor() {
    // 根据环境使用不同的API基础地址
    const isProduction = process.env.NODE_ENV === 'production';
    const baseURL = isProduction 
      ? '/.netlify/functions/feishu-api'  // 生产环境使用Netlify Functions
      : '/.netlify/functions/feishu-api'; // 开发环境也可以使用Functions（如果本地运行netlify dev）

    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // 添加请求拦截器
    this.api.interceptors.request.use(
      (config) => {
        console.log('发送请求:', config.method.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('请求错误:', error);
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.api.interceptors.response.use(
      (response) => {
        console.log('响应成功:', response.status, response.config.url);
        return response;
      },
      (error) => {
        console.error('响应错误:', error.response?.status, error.config?.url, error.message);
        if (error.response?.data) {
          console.error('错误详情:', error.response.data);
        }
        return Promise.reject(error);
      }
    );

    this.accessToken = null;
  }

  // 检查连接
  async checkConnection() {
    try {
      console.log('检查飞书API连接...');
      
      // 尝试获取租户访问令牌来测试连接
      const response = await this.api.post('/auth/v3/tenant_access_token/internal', {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      });
      
      if (response.data && response.data.code === 0) {
        console.log('✅ 飞书API连接正常');
        this.accessToken = response.data.tenant_access_token;
        return true;
      } else {
        console.log('❌ 飞书API连接失败:', response.data?.msg);
        return false;
      }
    } catch (error) {
      console.error('连接检查失败:', error.message);
      return false;
    }
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      const response = await this.api.post('/auth/v3/tenant_access_token/internal', {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        return this.accessToken;
      } else {
        throw new Error(`获取访问令牌失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      throw error;
    }
  }

  // 确保有有效的访问令牌
  async ensureAccessToken() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }
    return this.accessToken;
  }

  // 获取表格数据
  async getTableData(appToken, tableId, pageSize = 100) {
    try {
      console.log(`正在获取表格数据 - App: ${appToken}, Table: ${tableId}`);
      
      const token = await this.ensureAccessToken();
      
      const response = await this.api.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          page_size: pageSize
        }
      });

      console.log('表格数据响应状态:', response.status);
      console.log('表格数据响应:', response.data);

      if (response.data && response.data.code === 0) {
        return response.data.data.items || [];
      } else {
        throw new Error(`获取表格数据失败: ${response.data?.msg || '未知错误'}`);
      }
    } catch (error) {
      console.error('获取表格数据错误:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      throw error;
    }
  }

  // 用户登录验证
  async login(username, password) {
    try {
      const token = await this.ensureAccessToken();
      
      const response = await this.api.get(
        `/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
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
          return {
            username: user[CONFIG.TABLES.USERS.FIELDS.USERNAME],
            name: user[CONFIG.TABLES.USERS.FIELDS.NAME],
            permissions: user[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]
          };
        }
      }
      return null;
    } catch (error) {
      console.error('登录验证失败:', error);
      throw error;
    }
  }

  // 更新记录
  async updateRecord(appToken, tableId, recordId, fields) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.put(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, 
        { fields: fields },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code === 0) {
        return response.data.data;
      } else {
        throw new Error(`更新记录失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('更新记录失败:', error);
      throw error;
    }
  }

  // 创建记录
  async createRecord(appToken, tableId, fields) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.post(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, 
        { fields: fields },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.code === 0) {
        return response.data.data;
      } else {
        throw new Error(`创建记录失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('创建记录失败:', error);
      throw error;
    }
  }

  // 根据产品编码查找记录
  async findRecordByCode(productCode) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get(`/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/records`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          filter: JSON.stringify({
            conditions: [{
              field_name: CONFIG.TABLES.PRODUCTS.FIELDS.CODE,
              operator: "is",
              value: [productCode]
            }]
          })
        }
      });

      if (response.data.code === 0 && response.data.data.items.length > 0) {
        return response.data.data.items[0];
      }
      return null;
    } catch (error) {
      console.error('查找产品记录失败:', error);
      throw error;
    }
  }

  // 报工
  async reportWork(productCode, workType, userId, userName) {
    try {
      const productRecord = await this.findRecordByCode(productCode);
      if (!productRecord) {
        throw new Error('找不到对应的产品记录');
      }

      const currentStatus = productRecord.fields[CONFIG.TABLES.PRODUCTS.FIELDS.STATUS];
      let newStatus;

      if (workType === 'start') {
        if (currentStatus === '未开始') {
          newStatus = '进行中';
        } else {
          throw new Error('产品状态不允许开始报工');
        }
      } else if (workType === 'complete') {
        if (currentStatus === '进行中') {
          newStatus = '已完成';
        } else {
          throw new Error('产品状态不允许完成报工');
        }
      }

      // 更新产品状态
      await this.updateRecord(
        CONFIG.TABLES.PRODUCTS.APP_TOKEN,
        CONFIG.TABLES.PRODUCTS.TABLE_ID,
        productRecord.record_id,
        {
          [CONFIG.TABLES.PRODUCTS.FIELDS.STATUS]: newStatus,
          [CONFIG.TABLES.PRODUCTS.FIELDS.OPERATOR]: userName,
          [CONFIG.TABLES.PRODUCTS.FIELDS.UPDATE_TIME]: new Date().toISOString()
        }
      );

      // 创建历史记录
      await this.createRecord(
        CONFIG.TABLES.WORK_HISTORY.APP_TOKEN,
        CONFIG.TABLES.WORK_HISTORY.TABLE_ID,
        {
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.PRODUCT_CODE]: productCode,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.PRODUCT_NAME]: productRecord.fields[CONFIG.TABLES.PRODUCTS.FIELDS.PRODUCT_NAME],
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.WORK_TYPE]: workType === 'start' ? '开始工作' : '完成工作',
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.OPERATOR]: userName,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.TIMESTAMP]: new Date().toISOString(),
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.STATUS]: newStatus
        }
      );

      return {
        productCode,
        productName: productRecord.fields[CONFIG.TABLES.PRODUCTS.FIELDS.PRODUCT_NAME],
        workType,
        newStatus
      };
    } catch (error) {
      console.error('报工失败:', error);
      throw error;
    }
  }

  // 获取单个记录
  async getRecord(appToken, tableId, recordId) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === 0) {
        return response.data.data.record;
      } else {
        throw new Error(`获取记录失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取记录失败:', error);
      throw error;
    }
  }

  // 撤销报工
  async undoWork(productCode, userId, userName) {
    try {
      const productRecord = await this.getRecord(
        CONFIG.TABLES.PRODUCTS.APP_TOKEN,
        CONFIG.TABLES.PRODUCTS.TABLE_ID,
        productCode
      );

      if (!productRecord) {
        throw new Error('找不到对应的产品记录');
      }

      const currentStatus = productRecord.fields[CONFIG.TABLES.PRODUCTS.FIELDS.STATUS];
      let newStatus;
      let workType;

      if (currentStatus === '进行中') {
        newStatus = '未开始';
        workType = '撤销开始';
      } else if (currentStatus === '已完成') {
        newStatus = '进行中';
        workType = '撤销完成';
      } else {
        throw new Error('当前状态不允许撤销操作');
      }

      // 更新产品状态
      await this.updateRecord(
        CONFIG.TABLES.PRODUCTS.APP_TOKEN,
        CONFIG.TABLES.PRODUCTS.TABLE_ID,
        productRecord.record_id,
        {
          [CONFIG.TABLES.PRODUCTS.FIELDS.STATUS]: newStatus,
          [CONFIG.TABLES.PRODUCTS.FIELDS.OPERATOR]: userName,
          [CONFIG.TABLES.PRODUCTS.FIELDS.UPDATE_TIME]: new Date().toISOString()
        }
      );

      // 创建历史记录
      await this.createRecord(
        CONFIG.TABLES.WORK_HISTORY.APP_TOKEN,
        CONFIG.TABLES.WORK_HISTORY.TABLE_ID,
        {
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.PRODUCT_CODE]: productCode,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.PRODUCT_NAME]: productRecord.fields[CONFIG.TABLES.PRODUCTS.FIELDS.PRODUCT_NAME],
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.WORK_TYPE]: workType,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.OPERATOR]: userName,
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.TIMESTAMP]: new Date().toISOString(),
          [CONFIG.TABLES.WORK_HISTORY.FIELDS.STATUS]: newStatus
        }
      );

      return {
        productCode,
        productName: productRecord.fields[CONFIG.TABLES.PRODUCTS.FIELDS.PRODUCT_NAME],
        workType,
        newStatus
      };
    } catch (error) {
      console.error('撤销报工失败:', error);
      throw error;
    }
  }
}

// 创建并导出服务实例
const feishuServiceInstance = new FeishuService();
export { feishuServiceInstance as FeishuService }; 