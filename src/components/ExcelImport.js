import React, { useState } from 'react';
import { 
  Modal, Card, Button, Upload, Alert, 
  Progress, Typography, Space, Divider,
  message, Input, Switch, Tooltip
} from 'antd';
import { 
  UploadOutlined, InboxOutlined, FileExcelOutlined,
  LinkOutlined, FolderOutlined, CheckCircleOutlined,
  LoadingOutlined, CloudUploadOutlined
} from '@ant-design/icons';
import { FeishuService } from '../services/FeishuService';

const { Title, Text, Paragraph, Link } = Typography;
const { Dragger } = Upload;

const ExcelImport = ({ visible, onClose, onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('ready'); // ready, uploading, importing, completed
  const [importResult, setImportResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  const [createFolder, setCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  // 处理文件选择
  const handleFileSelect = (file) => {
    // 验证文件格式
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !['xlsx', 'xls'].includes(fileExtension)) {
      message.error('请选择有效的Excel文件（.xlsx 或 .xls）');
      return false;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB限制
      message.error('文件大小不能超过50MB');
      return false;
    }

    setSelectedFile(file);
    setCustomFileName(file.name.replace(/\.[^/.]+$/, '')); // 移除扩展名作为默认名称
    message.success(`文件已选择：${file.name}`);
    return false; // 阻止自动上传
  };

  // 开始导入
  const handleImport = async () => {
    if (!selectedFile) {
      message.error('请先选择Excel文件');
      return;
    }

    try {
      setLoading(true);
      setCurrentStep('uploading');
      setProgress(20);

      let folderToken = null;
      
      // 如果需要创建文件夹
      if (createFolder && folderName.trim()) {
        console.log('正在创建文件夹...');
        setCurrentStep('创建文件夹中...');
        folderToken = await FeishuService.createFolder(folderName.trim());
        setProgress(40);
      }

      setCurrentStep('importing');
      setProgress(60);

      // 执行导入（使用改进的方法）
      const fileName = customFileName.trim() || selectedFile.name;
      const finalFileName = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') 
        ? fileName 
        : `${fileName}.${selectedFile.name.split('.').pop()}`;

      const result = await FeishuService.importExcelAsDocumentImproved(
        selectedFile, 
        finalFileName, 
        folderToken
      );

      setProgress(100);
      setCurrentStep('completed');
      setImportResult(result);

      message.success('Excel文件已成功导入为飞书在线文档！');
      
      if (onImportSuccess) {
        onImportSuccess(result);
      }

    } catch (error) {
      console.error('导入失败:', error);
      message.error(`导入失败: ${error.message}`);
      setCurrentStep('ready');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // 重置状态
  const handleReset = () => {
    setSelectedFile(null);
    setCustomFileName('');
    setCreateFolder(false);
    setFolderName('');
    setCurrentStep('ready');
    setProgress(0);
    setImportResult(null);
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
    const stepMessages = {
      'ready': '准备就绪',
      'uploading': '正在上传文件...',
      'importing': '正在转换为在线文档...',
      'completed': '导入完成！'
    };

    return (
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          {loading && <LoadingOutlined style={{ marginRight: 8, color: '#1890ff' }} />}
          <Text strong>{stepMessages[currentStep]}</Text>
        </div>
        {loading && (
          <Progress 
            percent={progress} 
            status={currentStep === 'completed' ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <CloudUploadOutlined />
          Excel直接导入为在线文档
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={600}
      maskClosable={!loading}
      closable={!loading}
    >
      <div style={{ padding: '0 8px' }}>
        {/* 说明信息 */}
        <Alert
          message="功能说明"
          description={
            <div>
              <p>此功能将直接把Excel文件导入为飞书在线文档，保持原有格式和图片。</p>
              <p>✅ 支持 .xlsx 和 .xls 格式</p>
              <p>✅ 自动保留表格格式、公式和图片</p>
              <p>✅ 导入后可在飞书中在线编辑</p>
              <p>✅ 无需手动字段映射</p>
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
            {/* 文件上传区域 */}
            <Card title={<><FileExcelOutlined /> 选择Excel文件</>} style={{ marginBottom: 16 }}>
              <Dragger
                accept=".xlsx,.xls"
                beforeUpload={handleFileSelect}
                showUploadList={false}
                disabled={loading}
                style={{ 
                  padding: '20px',
                  background: selectedFile ? '#f6ffed' : undefined,
                  borderColor: selectedFile ? '#b7eb8f' : undefined
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ 
                    fontSize: '48px', 
                    color: selectedFile ? '#52c41a' : '#1890ff' 
                  }} />
                </p>
                <p className="ant-upload-text">
                  {selectedFile ? `已选择: ${selectedFile.name}` : '点击或拖拽Excel文件到此区域'}
                </p>
                <p className="ant-upload-hint">
                  支持 .xlsx 和 .xls 格式，最大50MB
                </p>
              </Dragger>
            </Card>

            {/* 导入设置 */}
            {selectedFile && (
              <Card title="导入设置" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>文档名称：</Text>
                    <Input
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder="请输入文档名称"
                      disabled={loading}
                      style={{ marginTop: 4 }}
                    />
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  <div>
                    <Space align="start">
                      <Switch
                        checked={createFolder}
                        onChange={setCreateFolder}
                        disabled={loading}
                      />
                      <div>
                        <Text strong>创建专用文件夹</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          在飞书云空间中创建新文件夹来存放导入的文档
                        </Text>
                      </div>
                    </Space>
                  </div>

                  {createFolder && (
                    <div style={{ marginLeft: 24 }}>
                      <Input
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        placeholder="请输入文件夹名称"
                        disabled={loading}
                        prefix={<FolderOutlined />}
                      />
                    </div>
                  )}
                </Space>
              </Card>
            )}

            {/* 操作按钮 */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Space>
                <Button onClick={handleClose} disabled={loading}>
                  取消
                </Button>
                <Button 
                  type="primary" 
                  onClick={handleImport}
                  loading={loading}
                  disabled={!selectedFile}
                  icon={<CloudUploadOutlined />}
                >
                  {loading ? '导入中...' : '开始导入'}
                </Button>
              </Space>
            </div>
          </>
        )}

        {/* 导入完成结果 */}
        {currentStep === 'completed' && importResult && (
          <Card 
            title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 导入成功!</>}
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="Excel文件已成功转换为飞书在线文档"
                type="success"
                showIcon
              />
              
              <div>
                <Text strong>文档信息：</Text>
                <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                  <p><Text strong>文件名：</Text>{importResult.fileName}</p>
                  <p><Text strong>文档类型：</Text>飞书在线表格</p>
                  <p><Text strong>文档Token：</Text><Text code>{importResult.token}</Text></p>
                </div>
              </div>

              {importResult.url && (
                <div>
                  <Button 
                    type="primary" 
                    icon={<LinkOutlined />}
                    onClick={() => window.open(importResult.url, '_blank')}
                    style={{ marginRight: 8 }}
                  >
                    打开在线文档
                  </Button>
                  <Button onClick={handleReset}>
                    继续导入其他文件
                  </Button>
                </div>
              )}
            </Space>
          </Card>
        )}

        {currentStep === 'completed' && (
          <div style={{ textAlign: 'center' }}>
            <Button type="default" onClick={handleClose}>
              关闭
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ExcelImport; 