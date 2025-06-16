import React, { useState } from 'react';
import { 
  Modal, Form, Input, Button, Steps, Card, Typography, 
  Space, Alert, Divider 
} from 'antd';
import { SettingOutlined, TableOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const ConfigWizard = ({ visible, onClose, onSave }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const steps = [
    {
      title: '用户表格配置',
      description: '配置用户登录验证表格',
      icon: <TableOutlined />
    },
    {
      title: '产品表格配置',
      description: '配置产品数据表格',
      icon: <TableOutlined />
    },
    {
      title: '完成配置',
      description: '确认并保存配置',
      icon: <CheckCircleOutlined />
    }
  ];

  const handleNext = () => {
    form.validateFields().then(() => {
      setCurrentStep(currentStep + 1);
    });
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      const config = {
        users: {
          appToken: values.userAppToken,
          tableId: values.userTableId
        },
        products: {
          appToken: values.productAppToken,
          tableId: values.productTableId
        },
        workHistory: {
          appToken: values.historyAppToken || values.productAppToken,
          tableId: values.historyTableId || ''
        }
      };
      
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('保存配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card>
            <Title level={4}>用户表格配置</Title>
            <Paragraph>
              请配置用于用户登录验证的飞书多维表格信息。该表格应包含以下字段：
            </Paragraph>
            <ul>
              <li><Text code>用户名</Text> - 用户登录名</li>
              <li><Text code>密码</Text> - 用户密码</li>
              <li><Text code>姓名</Text> - 用户真实姓名</li>
              <li><Text code>工序权限</Text> - 用户可操作的工序（如：工序1,工序2）</li>
            </ul>
            
            <Divider />
            
            <Form.Item
              name="userAppToken"
              label="用户表格 App Token"
              rules={[{ required: true, message: '请输入用户表格的App Token' }]}
            >
              <Input placeholder="例如：bascnCMII2ORzjyIDTr57nu2n2d" />
            </Form.Item>
            
            <Form.Item
              name="userTableId"
              label="用户表格 Table ID"
              rules={[{ required: true, message: '请输入用户表格的Table ID' }]}
            >
              <Input placeholder="例如：tblsRc9GRRXKqhvW" />
            </Form.Item>
          </Card>
        );
        
      case 1:
        return (
          <Card>
            <Title level={4}>产品表格配置</Title>
            <Paragraph>
              请配置产品数据表格信息。该表格应包含以下字段：
            </Paragraph>
            <ul>
              <li><Text code>产品名称</Text> - 产品的名称</li>
              <li><Text code>总数量</Text> - 产品总数量</li>
              <li><Text code>已报工数量</Text> - 已完成报工的数量</li>
              <li><Text code>二维码</Text> - 产品对应的二维码内容</li>
              <li><Text code>工序1报工数</Text> - 各工序的报工数量</li>
            </ul>
            
            <Divider />
            
            <Form.Item
              name="productAppToken"
              label="产品表格 App Token"
              rules={[{ required: true, message: '请输入产品表格的App Token' }]}
            >
              <Input placeholder="例如：bascnCMII2ORzjyIDTr57nu2n2d" />
            </Form.Item>
            
            <Form.Item
              name="productTableId"
              label="产品表格 Table ID"
              rules={[{ required: true, message: '请输入产品表格的Table ID' }]}
            >
              <Input placeholder="例如：tblsRc9GRRXKqhvW" />
            </Form.Item>

            <Title level={5}>报工历史表格（可选）</Title>
            <Paragraph type="secondary">
              如果需要单独的报工历史记录表格，请填写以下信息。否则将使用产品表格记录历史。
            </Paragraph>
            
            <Form.Item
              name="historyAppToken"
              label="历史表格 App Token"
            >
              <Input placeholder="可选：单独的历史记录表格" />
            </Form.Item>
            
            <Form.Item
              name="historyTableId"
              label="历史表格 Table ID"
            >
              <Input placeholder="可选：历史记录表格ID" />
            </Form.Item>
          </Card>
        );
        
      case 2:
        return (
          <Card>
            <Title level={4}>配置完成</Title>
            <Alert
              message="配置信息确认"
              description="请确认以下配置信息无误，点击完成后将保存配置并重启应用。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>用户表格：</Text>
                <br />
                <Text code>{form.getFieldValue('userAppToken')}</Text>
                <br />
                <Text code>{form.getFieldValue('userTableId')}</Text>
              </div>
              
              <div>
                <Text strong>产品表格：</Text>
                <br />
                <Text code>{form.getFieldValue('productAppToken')}</Text>
                <br />
                <Text code>{form.getFieldValue('productTableId')}</Text>
              </div>
              
              {form.getFieldValue('historyAppToken') && (
                <div>
                  <Text strong>历史表格：</Text>
                  <br />
                  <Text code>{form.getFieldValue('historyAppToken')}</Text>
                  <br />
                  <Text code>{form.getFieldValue('historyTableId')}</Text>
                </div>
              )}
            </Space>
          </Card>
        );
        
      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          <span>系统配置向导</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
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

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
      >
        {renderStepContent()}

        <Divider />

        <div style={{ textAlign: 'right' }}>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev}>
                上一步
              </Button>
            )}
            
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={handleNext}>
                下一步
              </Button>
            )}
            
            {currentStep === steps.length - 1 && (
              <Button 
                type="primary" 
                htmlType="submit"
                loading={loading}
              >
                完成配置
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default ConfigWizard; 