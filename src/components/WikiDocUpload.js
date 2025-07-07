import React, { useState } from 'react';
import { 
  Modal, Card, Button, Upload, Alert, 
  Progress, Typography, Space, Divider,
  message, Input, Form, Select, Tooltip,
  List, Tag, Row, Col
} from 'antd';
import { 
  UploadOutlined, InboxOutlined, FileOutlined,
  LinkOutlined, BookOutlined, CheckCircleOutlined,
  LoadingOutlined, CloudUploadOutlined, InfoCircleOutlined,
  FileTextOutlined, FilePdfOutlined, FileWordOutlined
} from '@ant-design/icons';
import { FeishuService } from '../services/FeishuService';

const { Title, Text, Paragraph, Link } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

const WikiDocUpload = ({ visible, onClose, onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('ready'); // ready, uploading, moving, completed
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [form] = Form.useForm();
  const [batchMode, setBatchMode] = useState(false);

  // 支持的文件类型
  const supportedFileTypes = {
    'docx': { icon: <FileWordOutlined />, color: '#1890ff', name: 'Word文档' },
    'doc': { icon: <FileWordOutlined />, color: '#1890ff', name: 'Word文档' },
    'pdf': { icon: <FilePdfOutlined />, color: '#ff4d4f', name: 'PDF文档' },
    'txt': { icon: <FileTextOutlined />, color: '#52c41a', name: '文本文件' },
    'md': { icon: <FileTextOutlined />, color: '#722ed1', name: 'Markdown文档' },
    'xlsx': { icon: <FileOutlined />, color: '#13c2c2', name: 'Excel表格' },
    'xls': { icon: <FileOutlined />, color: '#13c2c2', name: 'Excel表格' },
    'pptx': { icon: <FileOutlined />, color: '#fa541c', name: 'PowerPoint' },
    'ppt': { icon: <FileOutlined />, color: '#fa541c', name: 'PowerPoint' }
  };

  // 验证文件类型
  const validateFile = (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!supportedFileTypes[fileExtension]) {
      message.error(`不支持的文件类型：${fileExtension}。支持的格式：docx, pdf, txt, xlsx, pptx, md 等`);
      return false;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB限制
      message.error('文件大小不能超过100MB');
      return false;
    }

    return true;
  };

  // 处理文件选择
  const handleFileSelect = (file) => {
    if (!validateFile(file)) {
      return false;
    }

    // 检查是否已选择相同文件
    const existingFile = selectedFiles.find(f => f.name === file.name && f.size === file.size);
    if (existingFile) {
      message.warning('文件已存在');
      return false;
    }

    const fileWithId = {
      ...file,
      id: Date.now() + Math.random(),
      customName: file.name.replace(/\.[^/.]+$/, '') // 移除扩展名作为默认名称
    };

    setSelectedFiles(prev => [...prev, fileWithId]);
    message.success(`文件已添加：${file.name}`);
    return false; // 阻止自动上传
  };

  // 移除文件
  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 更新文件自定义名称
  const updateFileName = (fileId, newName) => {
    setSelectedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, customName: newName } : f
    ));
  };

  // 开始上传
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      message.error('请先选择要上传的文件');
      return;
    }

    try {
      const values = await form.validateFields();
      const { spaceId, parentWikiToken, parentNode } = values;

      setLoading(true);
      setCurrentStep('uploading');
      setProgress(10);

      if (selectedFiles.length === 1) {
        // 单文件上传
        const file = selectedFiles[0];
        const fileName = file.customName.trim() || file.name;
        const finalFileName = fileName.includes('.') ? fileName : `${fileName}.${file.name.split('.').pop()}`;

        setCurrentStep('uploading');
        setProgress(30);

        const result = await FeishuService.uploadFileToWiki(
          file, 
          finalFileName, 
          spaceId, 
          parentWikiToken, 
          parentNode
        );

        setProgress(100);
        setCurrentStep('completed');
        setUploadResult(result);

        message.success('文件已成功上传到知识库！');
      } else {
        // 批量上传
        setCurrentStep('uploading');
        
        const filesWithNames = selectedFiles.map(file => ({
          file: file,
          fileName: file.customName.includes('.') ? file.customName : `${file.customName}.${file.name.split('.').pop()}`
        }));

        const result = await FeishuService.batchUploadFilesToWiki(
          filesWithNames,
          spaceId,
          parentWikiToken,
          parentNode
        );

        setProgress(100);
        setCurrentStep('completed');
        setUploadResult(result);

        message.success(`批量上传完成：${result.successCount}/${result.totalFiles} 个文件成功`);
      }

      if (onUploadSuccess) {
        onUploadSuccess(uploadResult || result);
      }

    } catch (error) {
      console.error('上传失败:', error);
      message.error(`上传失败: ${error.message}`);
      setCurrentStep('ready');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // 重置状态
  const handleReset = () => {
    setSelectedFiles([]);
    form.resetFields();
    setCurrentStep('ready');
    setProgress(0);
    setUploadResult(null);
    setBatchMode(false);
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
      'uploading': '正在上传文件到云空间...',
      'moving': '正在移动到知识库...',
      'completed': '上传完成！'
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

  // 渲染文件列表
  const renderFileList = () => {
    if (selectedFiles.length === 0) return null;

    return (
      <Card title="已选择的文件" size="small" style={{ marginTop: 16 }}>
        <List
          size="small"
          dataSource={selectedFiles}
          renderItem={file => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            const fileType = supportedFileTypes[fileExtension];
            
            return (
              <List.Item
                actions={[
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => removeFile(file.id)}
                    disabled={loading}
                  >
                    移除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <span style={{ color: fileType?.color }}>
                      {fileType?.icon || <FileOutlined />}
                    </span>
                  }
                  title={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text strong>{file.name}</Text>
                      <Input
                        size="small"
                        placeholder="自定义文件名（可选）"
                        value={file.customName}
                        onChange={(e) => updateFileName(file.id, e.target.value)}
                        disabled={loading}
                        style={{ width: '300px' }}
                      />
                    </Space>
                  }
                  description={
                    <Space>
                      <Tag color={fileType?.color}>{fileType?.name || '其他'}</Tag>
                      <Text type="secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    );
  };

  // 渲染上传结果
  const renderUploadResult = () => {
    if (!uploadResult || currentStep !== 'completed') return null;

    if (uploadResult.totalFiles) {
      // 批量上传结果
      return (
        <Card title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 批量上传结果</>} style={{ marginTop: 16 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: '#52c41a', fontWeight: 'bold' }}>
                  {uploadResult.successCount}
                </div>
                <div>成功</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: '#ff4d4f', fontWeight: 'bold' }}>
                  {uploadResult.failureCount}
                </div>
                <div>失败</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', color: '#1890ff', fontWeight: 'bold' }}>
                  {uploadResult.totalFiles}
                </div>
                <div>总计</div>
              </div>
            </Col>
          </Row>
          
          <List
            size="small"
            dataSource={uploadResult.results}
            renderItem={result => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    result.success ? 
                      <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                      <span style={{ color: '#ff4d4f' }}>✗</span>
                  }
                  title={result.fileName}
                  description={result.success ? '上传成功' : result.error}
                />
              </List.Item>
            )}
          />
        </Card>
      );
    } else {
      // 单文件上传结果
      return (
        <Card title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 上传成功</>} style={{ marginTop: 16 }}>
          <Paragraph>
            <Text strong>文件已成功上传到知识库并转换为在线文档！</Text>
          </Paragraph>
          <Paragraph>
            <Text type="secondary">您可以在飞书知识库中查看和编辑该文档。</Text>
          </Paragraph>
        </Card>
      );
    }
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
            disabled={selectedFiles.length === 0}
          >
            开始上传
          </Button>
        )
      ]}
      width={800}
      maskClosable={!loading}
      closable={!loading}
    >
      <div style={{ padding: '0 8px' }}>
        {/* 说明信息 */}
        <Alert
          message="知识库文档上传"
          description={
            <div>
              <p>将本地文档上传到飞书知识库，自动转换为在线文档格式。</p>
              <p>✅ 支持格式：docx, pdf, txt, xlsx, pptx, md 等</p>
              <p>✅ 自动转换为在线可编辑文档</p>
              <p>✅ 支持单文件和批量上传</p>
              <p>✅ 自动组织到指定知识库位置</p>
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
            {/* 知识库配置 */}
            <Card title={<><BookOutlined /> 知识库配置</>} style={{ marginBottom: 16 }}>
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          知识库空间ID
                          <Tooltip title="知识库的space_id，可在知识库URL中找到">
                            <InfoCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name="spaceId"
                      rules={[{ required: true, message: '请输入知识库空间ID' }]}
                    >
                      <Input placeholder="例如：1565676577122621" disabled={loading} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          父节点Token
                          <Tooltip title="知识库中要存放文档的位置节点token">
                            <InfoCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name="parentWikiToken"
                      rules={[{ required: true, message: '请输入父节点Token' }]}
                    >
                      <Input placeholder="例如：wikcnKQ1k3p******8Vabce" disabled={loading} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item
                      label={
                        <Space>
                          云空间父节点（可选）
                          <Tooltip title="云空间中的父节点，留空则存储在默认位置">
                            <InfoCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name="parentNode"
                    >
                      <Input placeholder="可选：云空间父节点token" disabled={loading} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* 文件上传区域 */}
            <Card title={<><FileOutlined /> 选择要上传的文档</>} style={{ marginBottom: 16 }}>
              <Dragger
                accept=".docx,.doc,.pdf,.txt,.md,.xlsx,.xls,.pptx,.ppt"
                beforeUpload={handleFileSelect}
                showUploadList={false}
                disabled={loading}
                multiple={true}
                style={{ 
                  padding: '40px 20px',
                  background: '#fafafa',
                  border: '2px dashed #d9d9d9',
                  borderRadius: '6px'
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">
                  <Text strong>点击或拖拽文件到此区域上传</Text>
                </p>
                <p className="ant-upload-hint">
                  支持单个或批量上传。支持 docx, pdf, txt, xlsx, pptx, md 等格式
                </p>
              </Dragger>
              
              {renderFileList()}
            </Card>
          </>
        )}

        {/* 上传结果 */}
        {renderUploadResult()}
      </div>
    </Modal>
  );
};

export default WikiDocUpload; 