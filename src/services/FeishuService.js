import axios from 'axios';
import { CONFIG } from '../config/config';

class FeishuService {
  constructor() {
    this.api = axios.create({
      baseURL: 'https://open.feishu.cn/open-apis',
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
    this.tokenExpireTime = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      console.log('正在获取访问令牌...');
      
      const response = await this.api.post('/auth/v3/tenant_access_token/internal', {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      });

      const data = response.data;
      
      if (data.code === 0) {
        this.accessToken = data.tenant_access_token;
        this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000; // 提前5分钟刷新
        console.log('✅ 访问令牌获取成功');
        return this.accessToken;
      } else {
        throw new Error(data.msg || '获取访问令牌失败');
      }
    } catch (error) {
      console.error('获取访问令牌错误:', error.message);
      throw error;
    }
  }

  // 检查并刷新访问令牌
  async ensureAccessToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpireTime) {
      await this.getAccessToken();
    }
    return this.accessToken;
  }

  // 检查连接
  async checkConnection() {
    try {
      console.log('检查飞书API连接...');
      console.log('应用ID:', CONFIG.FEISHU.APP_ID);
      
      await this.getAccessToken();
      console.log('✅ 飞书API连接正常');
      return true;
    } catch (error) {
      console.error('连接检查失败:', error.message);
      if (error.response) {
        console.error('HTTP状态:', error.response.status);
        console.error('响应数据:', error.response.data);
      }
      console.error('请求配置:', error.config);
      return false;
    }
  }

  // 用户登录验证
  async login(username, password) {
    try {
      const response = await this.api.get(`/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`, {
        headers: {
          'Authorization': `Bearer ${await this.ensureAccessToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === 0) {
        const users = response.data.data.items;
        const user = users.find(record => {
          const fields = record.fields;
          return fields[CONFIG.TABLES.USERS.FIELDS.USERNAME] === username &&
                 fields[CONFIG.TABLES.USERS.FIELDS.PASSWORD] === password;
        });

        if (user) {
          return {
            id: user.record_id,
            username: user.fields[CONFIG.TABLES.USERS.FIELDS.USERNAME],
            name: user.fields[CONFIG.TABLES.USERS.FIELDS.NAME],
            permissions: user.fields[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS] || []
          };
        }
      }
      return null;
    } catch (error) {
      console.error('登录验证失败:', error);
      throw error;
    }
  }

  // 获取表格数据
  async getTableData(appToken, tableId, pageSize = 100) {
    try {
      console.log(`正在获取表格数据 - App: ${appToken}, Table: ${tableId}`);
      const token = await this.ensureAccessToken();
      
      const response = await this.api.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page_size: pageSize
        }
      });

      console.log('表格数据响应状态:', response.status);
      console.log('表格数据响应:', response.data);

      if (response.data.code === 0) {
        return response.data.data.items || [];
      } else {
        throw new Error(`获取表格数据失败: ${response.data.msg}`);
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
      const response = await this.api.get(`/bitable/v1/apps/${CONFIG.TABLES.PRODUCTS.APP_TOKEN}/tables/${CONFIG.TABLES.PRODUCTS.TABLE_ID}/records`, {
        headers: {
          'Authorization': `Bearer ${await this.ensureAccessToken()}`,
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
      const token = await this.getAccessToken();
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