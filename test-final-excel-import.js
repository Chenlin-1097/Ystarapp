const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 飞书应用配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
  BASE_URL: 'https://open.feishu.cn/open-apis'
};

const CONFIG = {
  TABLES: {
    PRODUCTS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd'
    }
  }
};

class FinalExcelImportTester {
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

  // 模拟前端的uploadFile方法
  async uploadFile(file, fileName) {
    try {
      console.log('📤 开始上传文件到飞书...');
      console.log('文件详情:', {
        name: fileName,
        size: file.size
      });
      
      const token = await this.getAccessToken();
      
      // 创建FormData，上传到多维表格中（临时存储用于导入）
      const formData = new FormData();
      formData.append('file_name', fileName);
      formData.append('parent_type', 'bitable'); // 上传到多维表格
      formData.append('parent_node', CONFIG.TABLES.PRODUCTS.APP_TOKEN); // 使用多维表格的app_token
      formData.append('size', file.size.toString());
      formData.append('file', fs.createReadStream(file.path));

      console.log('📋 上传参数:', {
        file_name: fileName,
        parent_type: 'bitable',
        parent_node: CONFIG.TABLES.PRODUCTS.APP_TOKEN,
        size: file.size
      });

      // 使用正确的飞书API路径：/open-apis/drive/v1/files/upload_all
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

  // 模拟前端的importExcelAsDocument方法
  async importExcelAsDocument(file, fileName) {
    try {
      console.log('📊 开始导入Excel文件作为在线文档...');
      console.log('文件信息:', {
        name: fileName,
        size: file.size
      });

      // 1. 先上传Excel文件到飞书获取file_token (这只是临时存储)
      const fileToken = await this.uploadFile(file, fileName);
      console.log('✅ 文件上传完成，file_token:', fileToken);

      // 2. 创建导入任务，将Excel转换为在线表格并存储在指定位置
      console.log('📋 开始创建导入任务，将Excel转换为在线表格...');
      const token = await this.getAccessToken();
      
      // 从文件名获取扩展名和不带扩展名的名称
      const fileExtension = fileName.split('.').pop().toLowerCase();
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      
      console.log('文件处理信息:', {
        originalFileName: fileName,
        fileNameWithoutExt: fileNameWithoutExt,
        fileExtension: fileExtension
      });

      // 按照飞书官方SDK示例格式，将Excel转换为在线表格
      const importParams = {
        file_extension: fileExtension,
        file_token: fileToken,
        type: 'sheet', // 转换为在线电子表格
        file_name: fileNameWithoutExt,
        point: {
          mount_type: 1, // 1表示我的空间
          mount_key: 'O20dw9tvficXm0kffTWc9qojnOf' // 在线表格最终存储在这个wiki节点下
        }
      };

      console.log('📋 导入参数 (将Excel转换为在线表格):', JSON.stringify(importParams, null, 2));

      // 使用导入任务API，将Excel转换为在线表格
      const response = await axios.post(`${FEISHU_CONFIG.BASE_URL}/drive/v1/import_tasks`, importParams, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60秒超时
      });

      console.log('✅ 导入任务响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code === 0) {
        console.log('✅ Excel文件已成功转换为在线表格！');
        const result = response.data.data;
        return {
          success: true,
          ticket: result.ticket,
          url: result.url || null,
          message: 'Excel文件已成功转换为在线表格，存储在指定位置'
        };
      } else {
        console.error('❌ 导入任务失败:', response.data);
        throw new Error(`导入失败: ${response.data.msg || '未知错误'} (code: ${response.data.code})`);
      }

    } catch (error) {
      console.error('❌ Excel转换为在线表格失败:', error);
      
      if (error.response) {
        const { status, data } = error.response;
        console.error('HTTP错误详情:', {
          status,
          statusText: error.response.statusText,
          data: JSON.stringify(data, null, 2)
        });
        
        if (status === 400) {
          console.error('🔍 400错误分析:');
          console.error('- 可能原因1: file_token无效或已过期');
          console.error('- 可能原因2: file_extension格式不正确');
          console.error('- 可能原因3: mount_key无效');
          console.error('- 可能原因4: 权限不足');
          console.error('建议检查file_token和mount_key是否正确');
        }
        
        throw new Error(`导入失败: ${data?.msg || `HTTP ${status} 错误`}`);
      } else {
        throw new Error(`导入失败: ${error.message}`);
      }
    }
  }

  // 运行完整测试
  async runFullTest() {
    try {
      console.log('🚀 开始完整的Excel导入测试...\n');
      
      // 创建测试Excel文件
      const testFileContent = 'Name,Age,City,Department\nJohn Smith,25,New York,Engineering\nJane Doe,30,London,Marketing\nBob Johnson,35,Paris,Sales\nAlice Brown,28,Tokyo,Design';
      fs.writeFileSync('complete-test.csv', testFileContent);
      
      const fileName = 'complete-test.xlsx';
      const file = {
        path: 'complete-test.csv',
        size: fs.statSync('complete-test.csv').size
      };
      
      // 执行完整的导入流程
      const result = await this.importExcelAsDocument(file, fileName);
      
      console.log('\n🎉 完整测试成功！');
      console.log('结果:', result);
      console.log('\n📱 请在飞书知识库中查看新创建的在线表格文档');
      
    } catch (error) {
      console.error('\n💥 完整测试失败:', error.message);
    } finally {
      // 清理测试文件
      if (fs.existsSync('complete-test.csv')) {
        fs.unlinkSync('complete-test.csv');
      }
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new FinalExcelImportTester();
  tester.runFullTest();
}

module.exports = FinalExcelImportTester; 