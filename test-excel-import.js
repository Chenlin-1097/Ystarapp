const FileUploader = require('./test-wiki-upload-chunked').FileUploader;
const lark = require('@larksuiteoapi/node-sdk');
const path = require('path');

// 飞书配置
const FEISHU_CONFIG = {
  APP_ID: 'cli_a74001f855b0d00c',
  APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
};

// 测试配置
const TEST_CONFIG = {
  FILE_PATH: 'WSD2715线上款式明细.xlsx',
  FOLDER_TOKEN: 'ShX6fAZyrlWEQvdaB5PcDsbcn6f' // 目标文件夹的token
};

class ExcelImporter {
  constructor(config) {
    // 创建飞书客户端
    this.client = new lark.Client({
      appId: config.APP_ID,
      appSecret: config.APP_SECRET,
      disableTokenCache: false
    });

    // 创建文件上传器
    this.uploader = new FileUploader();
  }

  // 创建导入任务
  async createImportTask(fileToken, fileName, folderToken = '') {
    try {
      console.log('📋 创建导入任务...');
      const response = await this.client.drive.v1.importTask.create({
        data: {
          file_extension: 'xlsx',
          file_token: fileToken,
          type: 'sheet',
          file_name: fileName,
          point: {
            mount_type: 1,  // 挂载到云空间
            mount_key: folderToken  // 空字符串表示根目录
          }
        }
      });

      if (response.code !== 0) {
        throw new Error(`创建导入任务失败: ${response.msg}`);
      }

      console.log('✅ 导入任务创建成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 导入任务创建失败:', error.message);
      throw error;
    }
  }

  // 查询导入任务状态
  async checkImportTaskStatus(ticket) {
    try {
      console.log('🔍 查询导入任务状态...');
      const response = await this.client.drive.v1.importTask.get({
        path: {
          ticket: ticket
        }
      });

      if (response.code !== 0) {
        throw new Error(`查询导入任务状态失败: ${response.msg}`);
      }

      const result = response.data.result;
      console.log('📊 导入任务响应:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('❌ 查询导入任务状态失败:', error.message);
      throw error;
    }
  }

  // 执行完整的导入流程
  async importFile(filePath, folderToken = '') {
    try {
      console.log('🚀 开始导入文件:', filePath);
      
      // 1. 使用分片上传获取文件token
      console.log('📤 开始上传文件...');
      const uploadResult = await this.uploader.upload(filePath);
      const fileToken = uploadResult.file_token;
      console.log('✅ 文件上传成功，获取到token:', fileToken);
      
      // 2. 创建导入任务
      const fileName = path.basename(filePath);
      const importTask = await this.createImportTask(fileToken, fileName, folderToken);
      const ticket = importTask.ticket;
      console.log('✅ 导入任务创建成功，ticket:', ticket);
      
      // 3. 轮询检查导入状态
      let maxAttempts = 20; // 最多尝试20次
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        
        try {
          const taskStatus = await this.checkImportTaskStatus(ticket);
          
          // 根据job_status判断状态
          switch (taskStatus.job_status) {
            case 0: // 导入成功
              console.log('✅ 导入任务完成！');
              console.log('📎 文档链接:', taskStatus.url);
              // 检查是否有内容被截断
              if (taskStatus.extra && taskStatus.extra.length > 0) {
                console.log('⚠️ 注意：部分内容可能被截断，系统返回以下提示：', taskStatus.extra);
              }
              return taskStatus;
            
            case 1: // 初始化
              console.log(`⏳ 任务初始化中... (${attempts}/${maxAttempts})`);
              break;
            
            case 2: // 处理中
              console.log(`⏳ 导入任务处理中... (${attempts}/${maxAttempts})`);
              console.log('📄 当前状态:', {
                文档类型: taskStatus.type,
                文档链接: taskStatus.url
              });
              break;
            
            default: // 3及以上都是错误状态
              // 获取错误描述
              const errorMessages = {
                3: '内部错误',
                100: '导入文档已加密',
                101: '内部错误',
                102: '内部错误',
                103: '内部错误',
                104: '租户容量不足',
                105: '文件夹节点太多',
                106: '内部错误',
                108: '处理超时',
                109: '内部错误',
                110: '无权限',
                112: '格式不支持',
                113: 'office格式不支持',
                114: '内部错误',
                115: '导入文件过大',
                116: '当前身份无导入至该文件夹的权限',
                117: '目录已删除',
                118: '导入文件和任务指定后缀不匹配',
                119: '目录不存在',
                120: '导入文件和任务指定文件类型不匹配',
                121: '导入文件已过期',
                122: '创建副本中禁止导出',
                129: '文件格式损坏，请另存为新文件后导入',
                5000: '内部错误',
                7000: 'docx block 数量超过系统上限',
                7001: 'docx block 层级超过系统上限',
                7002: 'docx block 大小超过系统上限'
              };
              const errorMsg = errorMessages[taskStatus.job_status] || '未知错误';
              throw new Error(`导入失败 (状态码: ${taskStatus.job_status}): ${errorMsg}`);
          }
          
          // 如果是初始化或处理中状态，继续等待
          continue;
          
        } catch (error) {
          if (attempts === maxAttempts) {
            throw error;
          }
          console.warn(`⚠️ 第${attempts}次查询失败: ${error.message}`);
        }
      }
      
      throw new Error(`导入任务状态查询超时（${maxAttempts}次尝试后），请手动检查文件是否导入成功`);
    } catch (error) {
      console.error('❌ 文件导入失败:', error.message);
      throw error;
    }
  }
}

// 执行测试
async function main() {
  try {
    const importer = new ExcelImporter(FEISHU_CONFIG);
    const result = await importer.importFile(TEST_CONFIG.FILE_PATH, TEST_CONFIG.FOLDER_TOKEN);
    console.log('导入结果:', result);
  } catch (error) {
    console.error('导入失败:', error);
  }
}

main(); 