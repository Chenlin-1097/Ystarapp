import axios from 'axios';
import { CONFIG } from '../config/config';

class FeishuService {
  constructor() {
    // 检测环境：开发环境和生产环境使用不同的API方式
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = !isProduction;
    
    if (isDevelopment) {
      // 开发环境：直接调用飞书API（通过package.json的proxy配置解决CORS）
      this.api = axios.create({
        baseURL: '/open-apis', // 通过React的proxy配置代理到飞书API
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      this.isDevelopment = true;
    } else {
      // 生产环境：使用Netlify Functions
      this.api = axios.create({
        baseURL: '/.netlify/functions/feishu-api',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      this.isDevelopment = false;
    }

    // 添加请求拦截器
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🔄 发送请求: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ 请求错误:', error);
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.api.interceptors.response.use(
      (response) => {
        console.log(`✅ 响应成功: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`❌ 响应错误: ${error.response?.status || 'N/A'} ${error.config?.url} - ${error.message}`);
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
      console.log('🔍 检查飞书API连接...');
      
      // 尝试获取租户访问令牌来测试连接
      const response = await this.api.post('/auth/v3/tenant_access_token/internal', {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      });
      
      if (response.data && response.data.code === 0) {
        console.log(`✅ 飞书API连接正常（${this.isDevelopment ? '开发环境' : '生产环境'}）`);
        this.accessToken = response.data.tenant_access_token;
        return true;
      } else {
        console.log('❌ 飞书API连接失败:', response.data?.msg);
        return false;
      }
    } catch (error) {
      console.error('💥 连接检查失败:', error.message);
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

  // 检查token是否过期
  isTokenExpired() {
    // 简单的检查逻辑，如果没有token就认为过期
    // 也可以根据实际需要添加时间戳检查
    return !this.accessToken;
  }

  // 确保有有效的访问令牌
  async ensureAccessToken() {
    if (!this.accessToken || this.isTokenExpired()) {
      console.log('🔄 Token不存在或已过期，重新获取...');
      await this.getAccessToken();
    } else {
      console.log('✅ Token有效，继续使用当前token');
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

  // 获取多维表格信息
  async getBitableInfo(appToken) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get(`/bitable/v1/apps/${appToken}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.code === 0) {
        console.log('✅ 获取多维表格信息成功:', response.data.data.app);
        return response.data.data.app;
      } else {
        throw new Error(`获取多维表格信息失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取多维表格信息失败:', error);
      throw error;
    }
  }

  // 获取多维表格的所有工作表
  async getTables(appToken) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get(`/bitable/v1/apps/${appToken}/tables`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.code === 0) {
        console.log('✅ 获取工作表列表成功:', response.data.data.items);
        return response.data.data.items || [];
      } else {
        throw new Error(`获取工作表列表失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取工作表列表失败:', error);
      throw error;
    }
  }

  // 获取表格的字段信息
  async getTableFields(appToken, tableId) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.code === 0) {
        console.log('✅ 获取表格字段成功:', response.data.data.items);
        return response.data.data.items || [];
      } else {
        throw new Error(`获取表格字段失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取表格字段失败:', error);
      throw error;
    }
  }

  // 获取表格数据（带字段信息）
  async getTableDataWithFields(appToken, tableId, pageSize = 100) {
    try {
      console.log(`正在获取完整表格数据 - App: ${appToken}, Table: ${tableId}`);
      
      // 并行获取字段信息和数据
      const [fields, records] = await Promise.all([
        this.getTableFields(appToken, tableId),
        this.getTableData(appToken, tableId, pageSize)
      ]);

      // 构建字段映射
      const fieldMap = {};
      fields.forEach(field => {
        fieldMap[field.field_id] = {
          field_name: field.field_name,
          type: field.type,
          property: field.property
        };
      });

      return {
        fields: fields,
        fieldMap: fieldMap,
        records: records,
        tableInfo: {
          appToken,
          tableId,
          totalRecords: records.length
        }
      };
    } catch (error) {
      console.error('获取完整表格数据失败:', error);
      throw error;
    }
  }

  // 批量创建记录（用于上传订单数据）
  async batchCreateRecords(appToken, tableId, recordsData, batchSize = 500) {
    try {
      const token = await this.ensureAccessToken();
      const results = [];
      
      // 分批处理，避免单次请求过大
      for (let i = 0; i < recordsData.length; i += batchSize) {
        const batch = recordsData.slice(i, i + batchSize);
        
        const response = await this.api.post(
          `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
          { records: batch },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.code === 0) {
          results.push(...response.data.data.records);
          console.log(`✅ 批量创建记录成功 - 批次 ${Math.floor(i/batchSize) + 1}, 数量: ${batch.length}`);
        } else {
          throw new Error(`批量创建记录失败: ${response.data.msg}`);
        }

        // 添加延迟，避免API限流
        if (i + batchSize < recordsData.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results;
    } catch (error) {
      console.error('批量创建记录失败:', error);
      throw error;
    }
  }

  // 获取图片信息（如果单元格包含图片）
  async getCellAttachments(appToken, tableId, recordId, fieldId) {
    try {
      const token = await this.ensureAccessToken();
      
      // 先获取记录详情
      const record = await this.getRecord(appToken, tableId, recordId);
      const fieldValue = record.fields[fieldId];
      
      if (fieldValue && Array.isArray(fieldValue)) {
        // 处理附件字段
        const attachments = [];
        for (const attachment of fieldValue) {
          if (attachment.file_token) {
            // 获取文件下载链接
            const downloadUrl = await this.getFileDownloadUrl(attachment.file_token);
            attachments.push({
              ...attachment,
              downloadUrl
            });
          }
        }
        return attachments;
      }
      
      return [];
    } catch (error) {
      console.error('获取单元格附件失败:', error);
      throw error;
    }
  }

  // 获取文件下载链接
  async getFileDownloadUrl(fileToken) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get(`/drive/v1/medias/${fileToken}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.code === 0) {
        return response.data.data.download_url;
      } else {
        throw new Error(`获取文件下载链接失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取文件下载链接失败:', error);
      throw error;
    }
  }

  // 上传文件到飞书云空间（按照官方参考代码）
  async uploadFile(file, fileName = 'document.xlsx', parentNode = null) {
    try {
      console.log('📤 开始分片上传文件到飞书云空间...');
      console.log('文件详情:', {
        name: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type
      });

      // 统一使用分片上传，确保所有文件都能稳定上传
      const uploadResult = await this.uploadFileChunked(file, fileName, parentNode);
      return uploadResult.file_token;
    } catch (error) {
      console.error('❌ 分片上传文件失败:', error);
      throw error;
    }
  }

  // 分片上传实现
  async uploadFileChunked(file, fileName, parentNode = null) {
    try {
      // 1. 准备上传
      const prepareResult = await this.uploadFilePrepare(fileName, 'explorer', parentNode, file.size);
      const uploadId = prepareResult.upload_id;
      
      console.log('✅ 上传准备完成，upload_id:', uploadId);

      // 2. 分片上传
      const chunkSize = 4 * 1024 * 1024; // 4MB分片
      const totalChunks = Math.ceil(file.size / chunkSize);
      const etags = [];

      console.log(`📦 开始分片上传，总计 ${totalChunks} 个分片`);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // 上传单个分片
        const etag = await this.uploadFilePart(uploadId, i + 1, chunk);
        etags.push({ etag });
        
        console.log(`✅ 分片 ${i + 1}/${totalChunks} 上传成功`);
      }

      // 3. 完成上传
      const finishResult = await this.uploadFileFinish(uploadId, etags);
      console.log('✅ 分片上传完成，file_token:', finishResult.file_token);
      
      return finishResult;
    } catch (error) {
      console.error('❌ 分片上传失败:', error);
      throw error;
    }
  }

  // 上传单个分片
  async uploadFilePart(uploadId, seq, chunk) {
    try {
      const token = await this.ensureAccessToken();
      
      // 计算校验和 - 使用arrayBuffer而不是chunk.size
      const arrayBuffer = await chunk.arrayBuffer();
      const checksum = this.calculateChecksumFromBuffer(arrayBuffer);
      
      console.log(`📤 上传分片 ${seq}:`, {
        uploadId: uploadId,
        seq: seq - 1, // seq从0开始
        size: arrayBuffer.byteLength,
        checksum: checksum
      });
      
      const formData = new FormData();
      formData.append('upload_id', uploadId);
      formData.append('seq', (seq - 1).toString()); // 按照cURL示例，使用字符串
      formData.append('size', arrayBuffer.byteLength.toString()); // 按照cURL示例，使用字符串
      formData.append('checksum', checksum);
      
      // 按照官方示例，直接使用二进制数据作为文件内容
      // 注意：不指定文件名，就像cURL示例中的 --form 'file=@"/xxx/file binary"'
      formData.append('file', chunk);

      // 调试：打印FormData内容
      console.log('📋 FormData参数详情:');
      for (let [key, value] of formData.entries()) {
        if (key === 'file') {
          console.log(`  ${key}:`, {
            type: value.constructor.name,
            size: value.size,
            type_attr: value.type,
            name: value.name || '未知'
          });
        } else {
          console.log(`  ${key}:`, value, typeof value);
        }
      }

      const response = await this.api.post('/drive/v1/files/upload_part', formData, {
        headers: {
          'Authorization': `Bearer ${token}`
          // 关键：在浏览器中使用FormData时，绝对不能设置Content-Type
          // 浏览器会自动设置multipart/form-data和boundary
        }
      });

      if (response.data.code !== 0) {
        throw new Error(`分片${seq}上传失败: ${response.data.msg}`);
      }

      return response.data.data.etag;
    } catch (error) {
      console.error(`❌ 分片${seq}上传失败:`, error);
      throw error;
    }
  }

  // 完成分片上传
  async uploadFileFinish(uploadId, etags) {
    try {
      const token = await this.ensureAccessToken();
      
      const response = await this.api.post('/drive/v1/files/upload_finish', {
        upload_id: uploadId,
        block_infos: etags
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code !== 0) {
        throw new Error(`完成上传失败: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      console.error('❌ 完成上传失败:', error);
      throw error;
    }
  }

  // 计算校验和（简化版Adler32）
  async calculateChecksum(chunk) {
    const arrayBuffer = await chunk.arrayBuffer();
    return this.calculateChecksumFromBuffer(arrayBuffer);
  }

  // 从ArrayBuffer计算校验和
  calculateChecksumFromBuffer(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    
    const MOD_ADLER = 65521;
    let a = 1;
    let b = 0;
    
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % MOD_ADLER;
      b = (b + a) % MOD_ADLER;
    }
    
    // 确保返回无符号32位整数并转为字符串，与成功版本一致
    return (((b << 16) | a) >>> 0).toString();
  }

  // 将Base64图片转换为File对象并上传
  async uploadBase64Image(base64Data, fileName = 'image.png') {
    try {
      // 将Base64转换为Blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      // 创建File对象
      const file = new File([blob], fileName, { type: blob.type });
      
      // 上传文件
      return await this.uploadFile(file, fileName);
    } catch (error) {
      console.error('Base64图片上传失败:', error);
      throw error;
    }
  }

  // 从URL下载图片并上传到飞书
  async uploadImageFromUrl(imageUrl, fileName = 'image.png') {
    try {
      // 下载图片
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('图片下载失败');
      }
      
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });
      
      // 上传到飞书
      return await this.uploadFile(file, fileName);
    } catch (error) {
      console.error('URL图片上传失败:', error);
      throw error;
    }
  }

  // 轮询导入状态
  async pollImportStatus(ticket, token, maxAttempts = 30, interval = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 检查导入状态 (${attempt}/${maxAttempts})...`);
        
        const response = await this.api.get(`/drive/v1/import_tasks/${ticket}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.code === 0) {
          const result = response.data.data.result;
          
          switch (result.job_status) {
            case 0: // 初始化
              console.log('📋 导入任务初始化中...');
              break;
            case 1: // 导入中
              console.log('⏳ 正在导入中...');
              break;
            case 2: // 导入成功
              console.log('✅ 导入成功！');
              return {
                url: result.url,
                token: result.token,
                type: result.type,
                job_status: result.job_status,
                job_error_msg: result.job_error_msg
              };
            case 3: // 导入失败
              throw new Error(`导入失败: ${result.job_error_msg}`);
            default:
              console.log(`❓ 未知状态: ${result.job_status}`);
          }
        } else {
          throw new Error(`查询导入状态失败: ${response.data.msg}`);
        }

        // 等待下次检查
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        console.error(`导入状态检查失败 (尝试 ${attempt}):`, error);
        if (attempt === maxAttempts) {
          throw error;
        }
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    throw new Error('导入超时，请稍后查看飞书文档');
  }

  // 获取用户的云文档空间信息
  async getDriveSpaceInfo() {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.get('/drive/v1/files', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          page_size: 1
        }
      });

      if (response.data.code === 0) {
        return response.data.data;
      } else {
        throw new Error(`获取云文档信息失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('获取云文档信息失败:', error);
      throw error;
    }
  }

  // 创建文件夹（可选，用于组织导入的文档）
  async createFolder(folderName, parentToken = null) {
    try {
      const token = await this.ensureAccessToken();
      const response = await this.api.post('/drive/v1/files/create_folder', {
        name: folderName,
        parent_token: parentToken || 'root',
        folder_type: 'normal'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.code === 0) {
        console.log('✅ 文件夹创建成功:', response.data.data);
        return response.data.data.token;
      } else {
        throw new Error(`创建文件夹失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      throw error;
    }
  }

  // 改进的Excel导入方法，使用文件上传方式
  async importExcelAsDocumentImproved(file, fileName, folderToken = null) {
    try {
      console.log('📊 开始导入Excel文件作为在线文档（改进版本）...');
      console.log('文件信息:', {
        name: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type
      });

      // 1. 使用文件上传方式上传Excel文件到云空间
      const fileToken = await this.uploadFile(file, fileName, folderToken);
      console.log('✅ 文件上传完成，file_token:', fileToken);

      // 2. 创建导入任务
      console.log('📋 开始创建导入任务...');
      const token = await this.ensureAccessToken();
      
      // 从文件名获取扩展名
      const fileExtension = fileName.split('.').pop().toLowerCase();
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      
      // 按照参考代码的格式创建导入参数
      const importParams = {
        file_extension: fileExtension,
        file_token: fileToken,
        type: 'sheet', // 转换为在线电子表格
        file_name: fileNameWithoutExt,
        point: {
          mount_type: 1, // 1表示我的空间
          mount_key: folderToken || 'O20dw9tvficXm0kffTWc9qojnOf' // 存储位置
        }
      };

      console.log('📋 导入参数:', JSON.stringify(importParams, null, 2));

      // 创建导入任务
      const response = await this.api.post('/drive/v1/import_tasks', importParams, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      console.log('✅ 导入任务响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const result = response.data.data;
        const ticket = result.ticket;
        
        console.log('✅ 导入任务创建成功，开始轮询状态...');
        
        // 3. 轮询导入状态
        const finalResult = await this.pollImportStatus(ticket, token);
        
        return {
          success: true,
          ticket: ticket,
          url: finalResult.url,
          token: finalResult.token,
          type: finalResult.type,
          message: 'Excel文件已成功转换为在线表格'
        };
      } else {
        console.error('❌ 导入任务失败:', response.data);
        throw new Error(`导入失败: ${response.data.msg || '未知错误'} (code: ${response.data.code})`);
      }

    } catch (error) {
      console.error('❌ Excel导入失败:', error);
      throw error;
    }
  }

  // ================================
  // 知识库文档上传功能
  // ================================

  /**
   * 上传文件到知识库（完整流程）
   * @param {File} file - 文件对象
   * @param {string} fileName - 文件名
   * @param {string} spaceId - 知识库空间ID
   * @param {string} parentWikiToken - 知识库目标节点的node_token
   * @param {string} parentNode - 云空间的父节点（可选）
   * @returns {Object} 上传结果
   */
  async uploadFileToWiki(file, fileName, spaceId, parentWikiToken, parentNode = null) {
    try {
      console.log('📖 开始上传文件到知识库...');
      console.log('文件信息:', {
        name: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        spaceId: spaceId,
        parentWikiToken: parentWikiToken
      });

      // 步骤一：上传本地文件到云空间
      console.log('📤 步骤一：上传文件到云空间...');
      const fileToken = await this.uploadFile(file, fileName, parentNode);
      console.log('✅ 文件上传到云空间成功，file_token:', fileToken);

      // 步骤二：将云空间文件迁移到知识库
      console.log('🔄 步骤二：将文件迁移到知识库...');
      const wikiResult = await this.moveDocsToWiki(spaceId, parentWikiToken, fileToken, 'file');
      
      return {
        success: true,
        fileToken: fileToken,
        wikiResult: wikiResult,
        message: '文件已成功上传到知识库并转换为在线文档'
      };

    } catch (error) {
      console.error('❌ 上传文件到知识库失败:', error);
      throw error;
    }
  }

  /**
   * 将云空间中的文件移动到知识库
   * @param {string} spaceId - 知识库空间ID  
   * @param {string} parentWikiToken - 知识库目标节点的node_token
   * @param {string} objToken - 云空间中的文件token（file_token）
   * @param {string} objType - 对象类型，文件为'file'，文档为'doc'
   * @returns {Object} 移动结果
   */
  async moveDocsToWiki(spaceId, parentWikiToken, objToken, objType = 'file') {
    try {
      console.log('🔄 将文档移动到知识库...');
      console.log('移动参数:', {
        spaceId: spaceId,
        parentWikiToken: parentWikiToken,
        objToken: objToken,
        objType: objType
      });

      const token = await this.ensureAccessToken();

      const moveParams = {
        parent_wiki_token: parentWikiToken,
        obj_type: objType,
        obj_token: objToken
      };

      console.log('📋 移动参数:', JSON.stringify(moveParams, null, 2));

      // 调用知识库移动API
      const response = await this.api.post(`/wiki/v2/spaces/${spaceId}/nodes/move_docs_to_wiki`, moveParams, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ 知识库移动响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        console.log('✅ 文档已成功移动到知识库');
        return {
          success: true,
          nodeToken: response.data.data?.node_token,
          message: '文档已成功移动到知识库'
        };
      } else {
        console.error('❌ 移动到知识库失败:', response.data);
        throw new Error(`移动到知识库失败: ${response.data.msg || '未知错误'} (code: ${response.data.code})`);
      }

    } catch (error) {
      console.error('❌ 移动文档到知识库失败:', error);
      if (error.response) {
        console.error('HTTP错误详情:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data, null, 2)
        });
        throw new Error(`移动到知识库失败: ${error.response.data?.msg || `HTTP ${error.response.status} 错误`}`);
      } else {
        throw new Error(`移动到知识库失败: ${error.message}`);
      }
    }
  }

  /**
   * 分片上传文件预准备（用于大文件上传）
   * @param {string} fileName - 文件名
   * @param {string} parentType - 父类型，通常为'explorer'
   * @param {string} parentNode - 父节点token（可选）
   * @param {number} size - 文件大小
   * @returns {Object} 预上传结果
   */
  async uploadFilePrepare(fileName, parentType = 'explorer', parentNode = null, size) {
    try {
      console.log('📋 准备分片上传...');
      console.log('预上传参数:', {
        fileName: fileName,
        parentType: parentType,
        parentNode: parentNode,
        size: size
      });

      const token = await this.ensureAccessToken();

      const prepareParams = {
        file_name: fileName,
        parent_type: parentType,
        size: size
      };

      // 如果没有指定parentNode，使用一个默认的父节点
      // 这是从测试成功的代码中获取的值
      if (parentNode) {
        prepareParams.parent_node = parentNode;
      } else {
        prepareParams.parent_node = 'ShX6fAZyrlWEQvdaB5PcDsbcn6f';
      }

      console.log('📋 预上传参数:', JSON.stringify(prepareParams, null, 2));

      const response = await this.api.post('/drive/v1/files/upload_prepare', prepareParams, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ 预上传响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        console.log('✅ 预上传准备成功');
        return response.data.data;
      } else {
        console.error('❌ 预上传准备失败:', response.data);
        throw new Error(`预上传准备失败: ${response.data.msg || '未知错误'} (code: ${response.data.code})`);
      }

    } catch (error) {
      console.error('❌ 预上传准备失败:', error);
      throw error;
    }
  }

  /**
   * 批量上传多个文件到知识库
   * @param {Array} files - 文件数组，每个文件对象包含{file, fileName}
   * @param {string} spaceId - 知识库空间ID
   * @param {string} parentWikiToken - 知识库目标节点的node_token
   * @param {string} parentNode - 云空间的父节点（可选）
   * @returns {Array} 上传结果数组
   */
  async batchUploadFilesToWiki(files, spaceId, parentWikiToken, parentNode = null) {
    try {
      console.log(`📖 开始批量上传 ${files.length} 个文件到知识库...`);
      
      const results = [];
      
      for (let i = 0; i < files.length; i++) {
        const { file, fileName } = files[i];
        console.log(`📤 上传文件 ${i + 1}/${files.length}: ${fileName}`);
        
        try {
          const result = await this.uploadFileToWiki(file, fileName, spaceId, parentWikiToken, parentNode);
          results.push({
            fileName: fileName,
            success: true,
            result: result
          });
          console.log(`✅ 文件 ${fileName} 上传成功`);
        } catch (error) {
          console.error(`❌ 文件 ${fileName} 上传失败:`, error);
          results.push({
            fileName: fileName,
            success: false,
            error: error.message
          });
        }
        
        // 添加延迟避免请求过于频繁
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`📊 批量上传完成: ${successCount}/${files.length} 个文件成功`);
      
      return {
        success: successCount > 0,
        totalFiles: files.length,
        successCount: successCount,
        failureCount: files.length - successCount,
        results: results
      };
      
    } catch (error) {
      console.error('❌ 批量上传到知识库失败:', error);
      throw error;
    }
  }
}

// 创建并导出服务实例
const feishuServiceInstance = new FeishuService();
export { feishuServiceInstance as FeishuService }; 