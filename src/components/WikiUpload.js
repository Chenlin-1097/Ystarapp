import React, { useState } from 'react';
import { 
  Modal, Card, Button, Upload, Alert, 
  Progress, Typography, Space,
  message, List, Tag
} from 'antd';
import { 
  InboxOutlined, BookOutlined, CheckCircleOutlined,
  LoadingOutlined, FileOutlined,
  FileTextOutlined, FilePdfOutlined, FileWordOutlined,
  FileExcelOutlined, FilePptOutlined
} from '@ant-design/icons';
import { CONFIG } from '../config/config';
import { WikiUploadService } from '../services/WikiUploadService';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const WikiUpload = ({ visible, onClose, onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('ready');
  const [progressMessage, setProgressMessage] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // 支持的文件类型图标映射
  const fileTypeIcons = {
    'docx': <FileWordOutlined style={{ color: '#1890ff' }} />,
    'doc': <FileWordOutlined style={{ color: '#1890ff' }} />,
    'pdf': <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
    'txt': <FileTextOutlined style={{ color: '#52c41a' }} />,
    'md': <FileTextOutlined style={{ color: '#722ed1' }} />,
    'xlsx': <FileExcelOutlined style={{ color: '#13c2c2' }} />,
    'xls': <FileExcelOutlined style={{ color: '#13c2c2' }} />,
    'pptx': <FilePptOutlined style={{ color: '#fa541c' }} />,
    'ppt': <FilePptOutlined style={{ color: '#fa541c' }} />
  };

  // 获取文件类型图标
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return fileTypeIcons[ext] || <FileOutlined />;
  };

  // 获取文件类型名称
  const getFileTypeName = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const typeNames = {
      'docx': 'Word文档', 'doc': 'Word文档',
      'pdf': 'PDF文档',
      'txt': '文本文件', 'md': 'Markdown文档',
      'xlsx': 'Excel表格', 'xls': 'Excel表格',
      'pptx': 'PowerPoint', 'ppt': 'PowerPoint'
    };
    return typeNames[ext] || '其他文件';
  };

  // 文件选择处理
  const handleFileSelect = (file) => {
    // 基本验证
    if (file.size > 500 * 1024 * 1024) { // 500MB限制
      message.error('文件大小不能超过500MB');
      return false;
    }

    setSelectedFile(file);
    message.success(`文件已选择：${file.name}`);
    return false; // 阻止自动上传
  };

  // 移除文件
  const removeFile = () => {
    setSelectedFile(null);
  };

  // 进度回调处理
  const handleProgress = (progressInfo) => {
    setProgress(progressInfo.percent);
    setProgressMessage(progressInfo.message);

    // 根据进度类型设置当前步骤
    switch (progressInfo.type) {
      case 'start':
      case 'prepare_complete':
        setCurrentStep('uploading');
        break;
      case 'chunk_upload':
        setCurrentStep('uploading');
        break;
      case 'upload_finish':
        setCurrentStep('processing');
        break;
      case 'import_task':
      case 'import_status':
        setCurrentStep('importing');
        break;
      case 'move_to_wiki':
        setCurrentStep('moving');
        break;
      case 'completed':
        setCurrentStep('completed');
        break;
      case 'error':
        setCurrentStep('error');
        break;
    }
  };

  // 开始上传
  const handleUpload = async () => {
    if (!selectedFile) {
      message.error('请先选择文件');
      return;
    }

    try {
      setLoading(true);
      setProgress(0);
      setCurrentStep('uploading');
      setProgressMessage('开始上传...');

      // 创建Wiki上传服务实例
      const wikiUploadService = new WikiUploadService();

      // 执行上传，使用配置文件中的知识库信息
      const result = await wikiUploadService.uploadToWiki(
        selectedFile,
        CONFIG.WIKI.SPACE_ID,
        CONFIG.WIKI.PARENT_NODE_TOKEN,
        handleProgress
      );

      setUploadResult(result);
      setCurrentStep('completed');
      message.success('文件已成功上传到知识库！');

      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

    } catch (error) {
      console.error('上传失败:', error);
      message.error(`上传失败: ${error.message}`);
      setCurrentStep('error');
    } finally {
      setLoading(false);
    }
  };

  // 重置状态
  const handleReset = () => {
    setSelectedFile(null);
    setCurrentStep('ready');
    setProgress(0);
    setProgressMessage('');
    setUploadResult(null);
  };

  // 关闭弹窗
  const handleClose = () => {
    if (!loading) {
      handleReset();
      onClose();
    }
  };

  // 渲染进度信息
  const renderProgressInfo = () => {
    if (currentStep === 'ready') return null;

    const stepMessages = {
      'uploading': '正在分片上传文件...',
      'processing': '正在处理文件...',
      'importing': '正在转换为在线文档...',
      'moving': '正在移动到知识库...',
      'completed': '上传完成！',
      'error': '上传失败'
    };

    const stepMessage = stepMessages[currentStep] || '处理中...';

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            {loading && <LoadingOutlined style={{ marginRight: 8, color: '#1890ff' }} />}
            <Text strong>{stepMessage}</Text>
          </div>
          {progressMessage && (
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">{progressMessage}</Text>
            </div>
          )}
          <Progress 
            percent={progress} 
            status={currentStep === 'completed' ? 'success' : currentStep === 'error' ? 'exception' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            showInfo={true}
          />
        </div>
      </Card>
    );
  };

  // 渲染文件信息
  const renderFileInfo = () => {
    if (!selectedFile) return null;

    return (
      <Card title="已选择的文件" size="small" style={{ marginTop: 16 }}>
        <List.Item
          actions={[
            <Button 
              type="link" 
              size="small" 
              onClick={removeFile}
              disabled={loading}
            >
              移除
            </Button>
          ]}
        >
          <List.Item.Meta
            avatar={getFileIcon(selectedFile.name)}
            title={<Text strong>{selectedFile.name}</Text>}
            description={
              <Space>
                <Tag color="blue">{getFileTypeName(selectedFile.name)}</Tag>
                <Text type="secondary">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</Text>
              </Space>
            }
          />
        </List.Item>
      </Card>
    );
  };

  // 渲染上传结果
  const renderUploadResult = () => {
    if (!uploadResult || currentStep !== 'completed') return null;

    return (
      <Card 
        title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 上传成功</>} 
        style={{ marginTop: 16 }}
      >
        <Paragraph>
          <Text strong>{uploadResult.message}</Text>
        </Paragraph>
        
        {uploadResult.type === 'excel_import' && (
          <div>
            <Paragraph>
              <Text type="secondary">Excel文件已转换为飞书在线表格，您可以在知识库中直接编辑。</Text>
            </Paragraph>
            {uploadResult.url && (
              <Paragraph>
                <Text>文档链接：</Text>
                <a href={uploadResult.url} target="_blank" rel="noopener noreferrer">
                  {uploadResult.url}
                </a>
              </Paragraph>
            )}
          </div>
        )}
        
        {uploadResult.type === 'file_upload' && (
          <Paragraph>
            <Text type="secondary">文件已上传到知识库，您可以在知识库中查看和管理。</Text>
          </Paragraph>
        )}
      </Card>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <BookOutlined />
          上传文档到知识库
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={loading}>
          {currentStep === 'completed' ? '关闭' : '取消'}
        </Button>,
        currentStep !== 'completed' && (
          <Button key="reset" onClick={handleReset} disabled={loading}>
            重置
          </Button>
        ),
        currentStep !== 'completed' && (
          <Button 
            key="upload" 
            type="primary" 
            onClick={handleUpload} 
            loading={loading}
            disabled={!selectedFile}
          >
            开始上传
          </Button>
        )
      ]}
      width={700}
      maskClosable={!loading}
      closable={!loading}
    >
      <div style={{ padding: '0 8px' }}>
        {/* 功能说明 */}
        <Alert
          message="智能Wiki上传"
          description={
            <div>
              <p>📋 支持各种文档格式，自动使用分片上传技术确保稳定性</p>
              <p>📊 Excel文件将自动转换为在线表格，其他文件保持原格式</p>
              <p>🚀 大文件分片传输，小文件也享受同等稳定性</p>
              <p>📚 文件将自动上传到系统配置的知识库位置</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 进度显示 */}
        {renderProgressInfo()}

        {currentStep !== 'completed' && (
          <>
            {/* 文件选择区域 */}
            <Card title="选择要上传的文档" style={{ marginBottom: 16 }}>
              <Dragger
                beforeUpload={handleFileSelect}
                showUploadList={false}
                disabled={loading}
                style={{ 
                  padding: '40px 20px',
                  background: selectedFile ? '#f6ffed' : '#fafafa',
                  border: selectedFile ? '2px dashed #b7eb8f' : '2px dashed #d9d9d9',
                  borderRadius: '6px'
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ 
                    fontSize: '48px', 
                    color: selectedFile ? '#52c41a' : '#1890ff' 
                  }} />
                </p>
                <p className="ant-upload-text">
                  {selectedFile ? 
                    <Text strong>已选择: {selectedFile.name}</Text> : 
                    <Text strong>点击或拖拽文件到此区域</Text>
                  }
                </p>
                <p className="ant-upload-hint">
                  支持 docx, pdf, txt, xlsx, pptx, md 等格式，最大500MB
                </p>
              </Dragger>
              
              {renderFileInfo()}
            </Card>
          </>
        )}

        {/* 上传结果 */}
        {renderUploadResult()}
      </div>
    </Modal>
  );
};

export default WikiUpload; 