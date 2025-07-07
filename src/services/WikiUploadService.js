import { FeishuService } from './FeishuService';

class WikiUploadService {
  constructor() {
    this.feishuService = FeishuService;
  }

  // 判断是否为Excel文件
  isExcelFile(fileName) {
    const excelExtensions = ['.xlsx', '.xls'];
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    return excelExtensions.includes(ext);
  }

  // 主上传到Wiki方法
  async uploadToWiki(file, spaceId, parentWikiToken, onProgress) {
    try {
      console.log(`🚀 开始上传文件到Wiki: ${file.name}`);
      
      if (onProgress) {
        onProgress({
          type: 'upload_start',
          fileName: file.name,
          fileSize: file.size
        });
      }

      // 如果是Excel文件，使用后端处理方案
      if (this.isExcelFile(file.name)) {
        console.log('📊 检测到Excel文件，使用后端处理方案...');
        
        if (onProgress) {
          onProgress({
            type: 'import_start',
            fileName: file.name
          });
        }
        
        // 将文件上传到后端进行处理
        const result = await this.uploadExcelViaBackend(file, spaceId, parentWikiToken, onProgress);
        
        return result;
      } else {
        // 其他文件类型，直接上传到Wiki
        console.log('📄 普通文件，直接上传到Wiki...');
        
        if (onProgress) {
          onProgress({
            type: 'file_upload_start'
          });
        }
        
        // 使用FeishuService的Wiki上传方法
        const wikiResult = await this.feishuService.uploadFileToWiki(
          file,
          file.name,
          spaceId,
          parentWikiToken
        );
        
        if (onProgress) {
          onProgress({
            type: 'wiki_upload_complete',
            wikiResult: wikiResult
          });
        }
        
        return {
          success: true,
          type: 'file_upload',
          wikiResult: wikiResult,
          message: '文件已成功上传到知识库'
        };
      }
    } catch (error) {
      console.error('❌ 上传到Wiki失败:', error);
      if (onProgress) {
        onProgress({
          type: 'error',
          error: error.message
        });
      }
      throw error;
    }
  }

  // 通过后端处理Excel文件
  async uploadExcelViaBackend(file, spaceId, parentWikiToken, onProgress) {
    try {
      // 创建FormData，将文件发送到后端
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('spaceId', spaceId);
      formData.append('parentWikiToken', parentWikiToken);

      if (onProgress) {
        onProgress({
          type: 'upload_to_backend',
          message: '正在上传文件到后端处理...'
        });
      }

      // 发送到Netlify Function
      const response = await fetch('/api/excel-upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`后端处理失败: ${response.status}`);
      }

      const result = await response.json();

      if (onProgress) {
        onProgress({
          type: 'backend_complete',
          message: '后端处理完成'
        });
      }

      return {
        success: true,
        type: 'excel_backend_upload',
        result: result,
        message: 'Excel文件已通过后端成功处理并上传到知识库'
      };

    } catch (error) {
      console.error('❌ 后端Excel处理失败:', error);
      
      // 如果后端处理失败，回退到前端处理
      console.log('🔄 后端处理失败，回退到前端分片上传...');
      
      if (onProgress) {
        onProgress({
          type: 'fallback_to_frontend',
          message: '回退到前端处理...'
        });
      }
      
      // 回退：尝试前端原有的处理方式
      const importResult = await this.feishuService.importExcelAsDocumentImproved(
        file, 
        file.name
      );
      
      if (onProgress) {
        onProgress({
          type: 'import_complete',
          token: importResult.token,
          url: importResult.url
        });
      }

      // 移动到Wiki
      console.log('📁 移动Excel文档到Wiki知识库...');
      
      if (onProgress) {
        onProgress({
          type: 'wiki_move_start'
        });
      }
      
      const wikiResult = await this.feishuService.moveDocsToWiki(
        spaceId, 
        parentWikiToken, 
        importResult.token, 
        'sheet'
      );
      
      if (onProgress) {
        onProgress({
          type: 'wiki_move_complete',
          wikiResult: wikiResult
        });
      }
      
      return {
        success: true,
        type: 'excel_import',
        originalToken: importResult.token,
        wikiResult: wikiResult,
        url: importResult.url,
        message: 'Excel文件已成功转换为在线表格并移动到知识库'
      };
    }
  }
}

export { WikiUploadService }; 