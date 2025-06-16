import axios from 'axios';
import { CONFIG } from '../config/config';

class FeishuService {
  constructor() {
    // 使用本地后端API
    this.api = axios.create({
      baseURL: 'http://localhost:3001/api',
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
      console.log('检查后端API连接...');
      
      const response = await this.api.get('/status');
      
      if (response.data && response.data.status === 'running') {
        console.log('✅ 后端API连接正常');
        return true;
      } else {
        console.log('❌ 后端API状态异常');
        return false;
      }
    } catch (error) {
      console.error('连接检查失败:', error.message);
      return false;
    }
  }

  // 用户登录验证 - 使用后端API
  async login(username, password) {
    try {
      const response = await this.api.post('/login', {
        username,
        password
      });

      if (response.data && response.data.success) {
        return {
          token: response.data.token,
          user: response.data.user
        };
      }
      return null;
    } catch (error) {
      console.error('登录验证失败:', error);
      throw error;
    }
  }

  // 获取表格数据 - 使用后端API
  async getTableData(appToken, tableId, pageSize = 100) {
    try {
      console.log(`正在获取表格数据 - App: ${appToken}, Table: ${tableId}`);
      
      // 根据表格类型调用不同的后端端点
      let endpoint = '/products';
      if (tableId === CONFIG.TABLES.USERS.TABLE_ID) {
        endpoint = '/users';
      } else if (tableId === CONFIG.TABLES.WORK_HISTORY.TABLE_ID) {
        endpoint = '/work-history';
      }
      
      const response = await this.api.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        params: {
          page_size: pageSize
        }
      });

      console.log('表格数据响应状态:', response.status);
      console.log('表格数据响应:', response.data);

      if (response.data) {
        return response.data;
      } else {
        throw new Error('获取表格数据失败');
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
          'Authorization': `Bearer ${this.accessToken}`,
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