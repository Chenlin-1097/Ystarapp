import React, { useState } from 'react';
import { 
  Card, Button, Steps, Select, Table, 
  Space, Alert, Divider, message, Modal, Typography,
  Row, Col, Spin, Tag, Upload, Form, Tooltip
} from 'antd';
import { 
  UploadOutlined, TableOutlined, CheckCircleOutlined, 
  InboxOutlined, EyeOutlined, FileExcelOutlined, PictureOutlined
} from '@ant-design/icons';
import { FeishuService } from '../services/FeishuService';
import { CONFIG } from '../config/config';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { Dragger } = Upload;

const OrderUpload = ({ visible, onClose, onUploadSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Excel文件相关状态
  const [excelFile, setExcelFile] = useState(null);
  const [worksheets, setWorksheets] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [headers, setHeaders] = useState([]);
  
  // 字段映射状态
  const [fieldMapping, setFieldMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);

  const steps = [
    {
      title: '上传Excel文件',
      description: '选择本地Excel文件',
      icon: <FileExcelOutlined />
    },
    {
      title: '选择工作表',
      description: '选择要导入的工作表',
      icon: <TableOutlined />
    },
    {
      title: '数据预览',
      description: '预览和确认数据',
      icon: <CheckCircleOutlined />
    }
  ];

  // 使用ExcelJS处理包含图片的Excel文件
  const handleExcelJSFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const sheets = [];
      workbook.eachSheet((worksheet, sheetId) => {
        // 统计行数（跳过空行）
        let rowCount = 0;
        worksheet.eachRow((row, rowNumber) => {
          if (row.hasValues) {
            rowCount++;
          }
        });
        
        sheets.push({
          name: worksheet.name,
          id: sheetId,
          worksheet: worksheet,
          data: [], // 为了兼容性添加空数组
          rowCount: rowCount // 添加行数统计
        });
      });
      
      setExcelFile(file);
      setWorksheets(sheets);
      setCurrentStep(1);
      
      message.success(`Excel文件解析成功！找到 ${sheets.length} 个工作表`);
      
      if (sheets.length > 0) {
        await processExcelJSWorksheet(sheets[0].worksheet);
        setSelectedWorksheet(sheets[0].name);
      }
      
      return sheets;
    } catch (error) {
      console.error('ExcelJS处理失败:', error);
      throw error;
    }
  };

  // 处理ExcelJS工作表并提取图片
  const processExcelJSWorksheet = async (worksheet) => {
    try {
      console.log('开始处理ExcelJS工作表...');
      const data = [];
      const imageMap = new Map(); // 存储图片数据
      
      // 提取工作表中的图片
      try {
        const images = worksheet.getImages();
        console.log('找到图片数量:', images.length);
        
        images.forEach(image => {
          try {
            const imageData = worksheet.workbook.model.media[image.imageId];
            if (imageData) {
              // 将图片数据转换为Base64
              const base64 = Buffer.from(imageData.buffer).toString('base64');
              const mimeType = imageData.extension === 'png' ? 'image/png' : 'image/jpeg';
              const dataUrl = `data:${mimeType};base64,${base64}`;
              
              // 根据图片的位置信息，确定它属于哪个单元格
              const range = image.range;
              if (range && range.tl) {
                const row = range.tl.nativeRow + 1; // ExcelJS使用0索引，转换为1索引
                const col = range.tl.nativeCol + 1;
                const cellAddress = `${String.fromCharCode(65 + col - 1)}${row}`;
                imageMap.set(cellAddress, dataUrl);
                console.log('图片映射:', cellAddress, '长度:', dataUrl.length);
              }
            }
          } catch (imgError) {
            console.warn('处理单个图片失败:', imgError);
          }
        });
      } catch (imageError) {
        console.warn('图片提取失败，继续处理文本数据:', imageError);
      }

      // 获取表格数据
      let headers = [];
      let rowIndex = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        
        row.eachCell((cell, colNumber) => {
          const cellAddress = `${String.fromCharCode(64 + colNumber)}${rowNumber}`;
          
          // 检查该单元格是否有图片
          if (imageMap.has(cellAddress)) {
            rowData[colNumber - 1] = {
              type: 'image',
              value: imageMap.get(cellAddress),
              text: cell.text || ''
            };
          } else {
            rowData[colNumber - 1] = cell.text || '';
          }
        });
        
        if (rowNumber === 1) {
          headers = rowData;
          console.log('表头:', headers);
        } else {
          data.push(rowData);
          rowIndex++;
        }
      });

      console.log('数据行数:', data.length);

      // 生成动态列配置
      const columns = headers.map((header, index) => ({
        title: mapHeaderField(header) || `列${index + 1}`,
        dataIndex: index,
        key: index,
        width: getColumnWidth(header),
        render: (value) => renderCellContent(value)
      }));

      setPreviewColumns(columns);
      setPreviewData(data.map((row, index) => ({
        key: index,
        ...row
      })));
      
      console.log('ExcelJS工作表处理完成');
    } catch (error) {
      console.error('processExcelJSWorksheet错误:', error);
      throw error;
    }
  };

  // 渲染单元格内容（支持图片显示）
  const renderCellContent = (value) => {
    if (value && typeof value === 'object' && value.type === 'image') {
      return (
        <div>
          <img 
            src={value.value} 
            alt="Excel图片" 
            style={{ maxWidth: '100px', maxHeight: '60px', objectFit: 'contain' }}
          />
          {value.text && <div style={{ fontSize: '12px', color: '#666' }}>{value.text}</div>}
        </div>
      );
    }
    
    if (typeof value === 'string' && value.length > 50) {
      return (
        <span title={value}>
          {value.substring(0, 50)}...
        </span>
      );
    }
    
    return value;
  };

  // 使用XLSX.js作为备用方案处理普通Excel文件
  const handleXLSXFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const sheets = workbook.SheetNames.map(name => ({
            name,
            data: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }),
            rowCount: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }).length // 添加行数统计
          }));
          
          setWorksheets(sheets);
          if (sheets.length > 0) {
            processXLSXWorksheet(sheets[0]);
            setSelectedWorksheet(sheets[0].name);
          }
          
          resolve(sheets);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // 处理XLSX.js工作表数据
  const processXLSXWorksheet = (sheet) => {
    const { data } = sheet;
    if (data.length === 0) return;

    const headers = data[0] || [];
    const rows = data.slice(1);

    const columns = headers.map((header, index) => ({
      title: mapHeaderField(header) || `列${index + 1}`,
      dataIndex: index,
      key: index,
      width: getColumnWidth(header),
      render: (value) => renderCellContent(value)
    }));

    setPreviewColumns(columns);
    setPreviewData(rows.map((row, index) => ({
      key: index,
      ...row
    })));
  };

  // 字段映射函数
  const mapHeaderField = (header) => {
    const headerStr = String(header).trim();
    
    switch(headerStr) {
      case '创建日期': case '创建时间': return '创建日期';
      case '创建人': case '创建者': return '创建人';
      case '单号': case '订单编号': case '工单号': return '单号';
      case '款号': case '款式编号': case '产品编号': return '款号';
      case '正面图': case '正面照片': case '正面': return '正面图';
      case '反面图': case '反面照片': case '反面': return '反面图';
      case '分解编号': case '分解号': return '分解编号';
      case '型号': case '规格': return '型号';
      case '姓名': case '工人姓名': case '操作员': return '姓名';
      case '球号': case '球编号': return '球号';
      case '数量': case '件数': case '个数': return '数量';
      case '二维码': case 'QR码': case '条码': return '二维码';
      case '做图': case '制图': case '设计': return '做图';
      default: return headerStr;
    }
  };

  // 获取列宽度
  const getColumnWidth = (header) => {
    const headerStr = String(header).trim();
    if (['正面图', '反面图'].includes(mapHeaderField(headerStr))) {
      return 120;
    }
    if (['创建日期', '分解编号', '二维码'].includes(mapHeaderField(headerStr))) {
      return 150;
    }
    if (['单号', '款号', '型号'].includes(mapHeaderField(headerStr))) {
      return 100;
    }
    return 80;
  };

  // 文件上传处理
  const handleFileUpload = async (file) => {
    try {
      setLoading(true);
      setExcelFile(file);
      
      console.log('开始处理文件:', file.name);
      
      // 首先尝试使用ExcelJS处理（支持图片）
      try {
        console.log('尝试使用ExcelJS处理...');
        await handleExcelJSFile(file);
        message.success('文件解析成功！支持嵌入图片提取。');
      } catch (excelJSError) {
        console.warn('ExcelJS处理失败，尝试使用XLSX.js:', excelJSError);
        // 如果ExcelJS失败，回退到XLSX.js
        try {
          await handleXLSXFile(file);
          message.warning('文件解析成功！注：嵌入图片将无法提取，请确保图片为链接格式。');
        } catch (xlsxError) {
          console.error('XLSX.js也处理失败:', xlsxError);
          throw new Error('文件格式不支持或文件损坏');
        }
      }
    } catch (error) {
      console.error('文件处理失败:', error);
      message.error('文件解析失败：' + error.message);
    } finally {
      setLoading(false);
    }
    
    return false; // 阻止默认上传行为
  };

  // 工作表切换
  const handleWorksheetChange = async (sheetName) => {
    try {
      setLoading(true);
      const sheet = worksheets.find(s => s.name === sheetName);
      if (sheet) {
        setSelectedWorksheet(sheetName);
        if (sheet.worksheet) {
          // ExcelJS工作表
          console.log('处理ExcelJS工作表:', sheetName);
          await processExcelJSWorksheet(sheet.worksheet);
        } else if (sheet.data) {
          // XLSX.js工作表
          console.log('处理XLSX工作表:', sheetName);
          processXLSXWorksheet(sheet);
        }
        // 处理完成后自动进入下一步
        setCurrentStep(2);
        message.success(`工作表 "${sheetName}" 解析完成`);
      }
    } catch (error) {
      console.error('工作表切换失败:', error);
      message.error('工作表解析失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 准备上传数据
  const prepareUploadData = async (data) => {
    console.log('开始准备上传数据...');
    console.log('原始预览数据:', data);
    console.log('预览列配置:', previewColumns);
    
    const processedData = [];
    
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      const record = { fields: {} }; // 飞书API需要 fields 对象包装
      
      for (let colIndex = 0; colIndex < previewColumns.length; colIndex++) {
        const col = previewColumns[colIndex];
        const value = row[colIndex];
        const fieldKey = getFieldKey(col.title);
        
        console.log(`处理行${rowIndex}列${colIndex}: 标题="${col.title}", 字段键="${fieldKey}", 值=`, value);
        
        if (fieldKey) {
          if (['正面图', '反面图'].includes(col.title)) {
            // 处理附件字段 - 飞书附件字段格式
            const attachments = [];
            
            if (value && typeof value === 'object' && value.type === 'image') {
              // 对于嵌入的图片，上传为附件
              try {
                console.log('正在上传嵌入图片...');
                const fileName = `${col.title}_${rowIndex}_${Date.now()}.png`;
                const fileToken = await FeishuService.uploadBase64Image(value.value, fileName);
                attachments.push({
                  file_token: fileToken,
                  name: fileName,
                  type: 'image'
                });
                console.log('✅ 嵌入图片上传成功:', fileToken);
              } catch (error) {
                console.error('❌ 嵌入图片上传失败:', error);
                // 上传失败时保持空数组
              }
            } else if (typeof value === 'string' && value.startsWith('http')) {
              // URL链接，下载并上传
              try {
                console.log('正在下载并上传URL图片...');
                const fileName = `${col.title}_${rowIndex}_${Date.now()}.jpg`;
                const fileToken = await FeishuService.uploadImageFromUrl(value, fileName);
                attachments.push({
                  file_token: fileToken,
                  name: fileName,
                  type: 'image'
                });
                console.log('✅ URL图片上传成功:', fileToken);
              } catch (error) {
                console.error('❌ URL图片上传失败:', error);
                // 上传失败时保持空数组
              }
            }
            
            record.fields[fieldKey] = attachments; // 附件字段是数组格式
          } else if (col.title === '数量') {
            // 数字字段
            record.fields[fieldKey] = Number(value) || 0;
          } else if (col.title === '创建日期') {
            // 日期字段 - 需要时间戳格式
            if (value) {
              const date = new Date(value);
              record.fields[fieldKey] = isNaN(date.getTime()) ? Date.now() : date.getTime();
            } else {
              record.fields[fieldKey] = Date.now(); // 默认当前时间
            }
          } else {
            // 文本字段
            record.fields[fieldKey] = String(value || '');
          }
        }
      }
      
      console.log(`行${rowIndex}处理结果:`, record);
      processedData.push(record);
    }
    
    return processedData;
  };

  // 获取字段键
  const getFieldKey = (title) => {
    const mapping = {
      '创建日期': 'CREATE_DATE',
      '创建人': 'CREATOR', 
      '单号': 'ORDER_NUMBER',
      '款号': 'STYLE_NUMBER',
      '正面图': 'FRONT_IMAGE',
      '反面图': 'BACK_IMAGE',
      '分解编号': 'DECOMPOSE_NUMBER',
      '型号': 'MODEL',
      '姓名': 'NAME',
      '球号': 'BALL_NUMBER',
      '数量': 'QUANTITY',
      '二维码': 'QR_CODE',
      '做图': 'DESIGN'
    };
    
    return CONFIG.TABLES.PRODUCTS.FIELDS[mapping[title]];
  };

  // 完成上传
  const handleFinish = async () => {
    try {
      setLoading(true);
      
      console.log('=== 开始上传流程 ===');
      console.log('配置信息:', {
        appToken: CONFIG.TABLES.PRODUCTS.APP_TOKEN,
        tableId: CONFIG.TABLES.PRODUCTS.TABLE_ID,
        fields: CONFIG.TABLES.PRODUCTS.FIELDS
      });
      
      // 将Excel数据转换为报工系统需要的格式
      const uploadData = await prepareUploadData(previewData);

      console.log('准备上传的数据:', uploadData);
      console.log('数据条数:', uploadData.length);
      
      // 只上传前3条数据进行测试
      const testData = uploadData.slice(0, 3);
      console.log('测试数据（前3条）:', testData);
      
      // 批量创建记录到产品表
      const result = await FeishuService.batchCreateRecords(
        CONFIG.TABLES.PRODUCTS.APP_TOKEN,
        CONFIG.TABLES.PRODUCTS.TABLE_ID,
        testData
      );

      message.success(`订单上传成功！共导入 ${result.length} 条记录`);
      onUploadSuccess && onUploadSuccess(result);
      onClose();
      
    } catch (error) {
      console.error('=== 上传失败详情 ===');
      console.error('错误信息:', error.message);
      console.error('错误详情:', error.response?.data);
      console.error('请求配置:', error.config);
      message.error('上传失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setExcelFile(null);
    setWorksheets([]);
    setSelectedWorksheet(null);
    setExcelData([]);
    setHeaders([]);
    setPreviewData([]);
    setFieldMapping({});
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card>
            <Title level={4}>
              <FileExcelOutlined /> 上传Excel文件
            </Title>
            <Alert
              message="文件要求"
              description="支持 .xlsx, .xls 格式的Excel文件，确保第二行为表头，第三行开始为数据"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Dragger
              accept=".xlsx,.xls"
              beforeUpload={handleFileUpload}
              showUploadList={false}
              style={{ padding: '20px' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽Excel文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 .xlsx 和 .xls 格式文件
              </p>
            </Dragger>
            
            <Paragraph type="secondary" style={{ marginTop: 16 }}>
              <CheckCircleOutlined /> 请确保Excel文件格式正确：第一行可以是标题，第二行为表头，第三行开始为数据。
            </Paragraph>
          </Card>
        );
        
      case 1:
        return (
          <Card>
            <Title level={4}>
              <TableOutlined /> 选择工作表
            </Title>
            
            <Alert
              message={`文件: ${excelFile?.name}`}
              description={`共找到 ${worksheets.length} 个工作表`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ marginBottom: 16 }}>
              <Text strong>选择要导入的工作表：</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                点击工作表卡片即可解析数据并进入预览步骤
              </Text>
            </div>
            
            <Row gutter={[16, 16]}>
              {worksheets.map(worksheet => (
                <Col span={8} key={worksheet.name}>
                  <Card 
                    hoverable
                    size="small"
                    onClick={() => handleWorksheetChange(worksheet.name)}
                    style={{ 
                      cursor: 'pointer',
                      border: selectedWorksheet === worksheet.name ? '2px solid #1890ff' : '1px solid #d9d9d9'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <TableOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                      <div style={{ marginTop: 8 }}>
                        <Text strong>{worksheet.name}</Text>
                        <br />
                        <Tag color="blue">
                          {worksheet.rowCount || worksheet.data?.length || 0} 行
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        );
        
      case 2:
        return (
          <Card>
            <Title level={4}>
              <EyeOutlined /> 上传数据预览
            </Title>
            
            <Alert
              message={`工作表: ${selectedWorksheet}`}
              description={`共 ${previewData.length} 行数据，预览实际上传内容（已完成字段映射）`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Divider orientation="left">实际上传的数据内容</Divider>
            <Table
              dataSource={previewData}
              size="small"
              scroll={{ x: true, y: 400 }}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
                pageSize: 20
              }}
              columns={previewColumns}
            />

            <Alert
              message="字段映射说明"
              description="✅ 已完成字段映射：Excel表头已自动映射到系统对应字段。正面图和反面图为附件字段，支持自动上传嵌入图片和URL图片到飞书。"
              type="success"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Card>
        );
        
      default:
        return null;
    }
  };

  return (
    <Modal
      title="上传订单数据"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map((step, index) => (
          <Step
            key={index}
            title={step.title}
            description={step.description}
            icon={step.icon}
          />
        ))}
      </Steps>

      <Spin spinning={loading}>
        {renderStepContent()}
      </Spin>

      <Divider />

      <div style={{ textAlign: 'right' }}>
        <Space>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>
              上一步
            </Button>
          )}
          
          {currentStep === 0 && (
            <Button onClick={handleReset}>
              重新选择文件
            </Button>
          )}
          
          {currentStep === 2 && (
            <Button type="primary" onClick={handleFinish} loading={loading}>
              <UploadOutlined /> 确认上传
            </Button>
          )}
          
          <Button onClick={onClose}>
            取消
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default OrderUpload; 