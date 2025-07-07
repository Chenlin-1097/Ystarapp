const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 飞书应用配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

class ImprovedExcelImportTester {
  constructor() {
    this.accessToken = null;
  }

  // 获取访问令牌
  async getAccessToken() {
    try {
      if (this.accessToken) return this.accessToken;
      
      console.log('🔑 获取访问令牌...');
      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/auth/v3/tenant_access_token/internal`, {
        app_id: FEISHU_CONFIG.APP_ID,
        app_secret: FEISHU_CONFIG.APP_SECRET
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        console.log('✅ 访问令牌获取成功');
        return this.accessToken;
      } else {
        throw new Error(`获取访问令牌失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 获取访问令牌失败:', error.message);
      throw error;
    }
  }

  // 文件上传方法（按照官方参考代码）
  async uploadFile(file, fileName, parentNode = null) {
    try {
      console.log('📤 开始上传文件到飞书云空间...');
      console.log('文件详情:', {
        name: fileName,
        size: file.size
      });
      
      const token = await this.getAccessToken();
      
      // 按照测试成功的方案创建FormData
      const formData = new FormData();
      formData.append('file_name', fileName);
      formData.append('parent_type', 'explorer'); // 按照参考代码使用explorer
      formData.append('size', file.size.toString());
      formData.append('file', fs.createReadStream(file.path));
      
      // 只有明确指定了parentNode才添加parent_node参数
      if (parentNode) {
        formData.append('parent_node', parentNode);
      }

      console.log('📋 文件上传参数:', {
        file_name: fileName,
        parent_type: 'explorer',
        parent_node: parentNode || '默认位置',
        size: file.size
      });

      // 使用正确的文件上传API
      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/drive/v1/files/upload_all`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        },
        timeout: 30000, // 30秒超时
      });

      console.log('📤 文件上传响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const fileToken = response.data.data.file_token;
        console.log('✅ 文件上传成功，file_token:', fileToken);
        return fileToken;
      } else {
        console.error('❌ 文件上传失败:', response.data);
        throw new Error(`文件上传失败: ${response.data.msg || '未知错误'}`);
      }
    } catch (error) {
      console.error('❌ 上传文件出错:', error);
      
      if (error.response) {
        console.error('HTTP错误详情:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data, null, 2)
        });
        throw new Error(`文件上传失败: ${error.response.data?.msg || `HTTP ${error.response.status} 错误`}`);
      } else {
        throw new Error(`文件上传失败: ${error.message}`);
      }
    }
  }

  // 创建导入任务
  async createImportTask(fileToken, fileName) {
    try {
      console.log('📋 开始创建导入任务...');
      const token = await this.getAccessToken();
      
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
          mount_key: 'O20dw9tvficXm0kffTWc9qojnOf' // 存储位置
        }
      };

      console.log('📋 导入参数:', JSON.stringify(importParams, null, 2));

      // 创建导入任务
      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/drive/v1/import_tasks`, importParams, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      console.log('✅ 导入任务响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const result = response.data.data;
        console.log('✅ 导入任务创建成功，ticket:', result.ticket);
        return result.ticket;
      } else {
        console.error('❌ 导入任务失败:', response.data);
        throw new Error(`导入失败: ${response.data.msg || '未知错误'} (code: ${response.data.code})`);
      }
    } catch (error) {
      console.error('❌ 创建导入任务失败:', error);
      throw error;
    }
  }

  // 查询导入结果
  async queryImportResult(ticket) {
    try {
      console.log('🔍 查询导入结果...');
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${FEISHU_CONFIG.BASE_URL}/drive/v1/import_tasks/${ticket}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📋 导入结果响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        const result = response.data.data.result;
        console.log('🔍 完整的导入结果结构:', JSON.stringify(result, null, 2));
        return result;
      } else {
        throw new Error(`查询导入状态失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 查询导入结果失败:', error);
      throw error;
    }
  }

  // 轮询导入状态
  async pollImportStatus(ticket, maxAttempts = 30, interval = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 检查导入状态 (${attempt}/${maxAttempts})...`);
        
        const result = await this.queryImportResult(ticket);
        
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

  // 完整的导入流程测试
  async runImprovedImportTest() {
    try {
      console.log('🚀 开始修正版Excel导入流程测试...');
      
      // 使用真实的Excel文件
      const testFilePath = './WSD2715线上款式明细.xlsx';
      
      // 检查文件是否存在
      if (!fs.existsSync(testFilePath)) {
        throw new Error(`测试文件不存在: ${testFilePath}`);
      }
      
      const stats = fs.statSync(testFilePath);
      const file = {
        path: testFilePath,
        size: stats.size
      };
      const fileName = 'WSD2715-online-style-details.xlsx'; // 使用英文文件名避免编码问题
      
      console.log('📄 测试文件信息:', {
        path: testFilePath,
        size: file.size,
        fileName: fileName
      });

      // 步骤1：上传文件到云空间
      console.log('\n🔸 步骤1：上传文件到云空间');
      const fileToken = await this.uploadFile(file, fileName);
      
      // 步骤2：创建导入任务
      console.log('\n🔸 步骤2：创建导入任务');
      const ticket = await this.createImportTask(fileToken, fileName);
      
      // 步骤3：轮询导入状态
      console.log('\n🔸 步骤3：轮询导入状态');
      const result = await this.pollImportStatus(ticket);
      
      console.log('\n🎉 导入完成！结果:', {
        url: result.url,
        token: result.token,
        type: result.type,
        status: result.job_status
      });

      return result;
      
    } catch (error) {
      console.error('💥 修正版导入测试失败:', error.message);
      throw error;
    }
  }
}

// 运行测试
async function main() {
  try {
    const tester = new ImprovedExcelImportTester();
    await tester.runImprovedImportTest();
    console.log('✅ 所有测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = ImprovedExcelImportTester; 