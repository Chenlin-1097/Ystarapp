import React, { useState, useEffect, useRef } from 'react';
import { 
  Layout, Card, Typography, Button, Select, Input, Table, 
  Space, Badge, message, Modal, Statistic, Row, Col, Tag, Tabs
} from 'antd';
import { 
  LogoutOutlined, ScanOutlined, ReloadOutlined, 
  HistoryOutlined, UndoOutlined, CheckCircleOutlined,
  SettingOutlined, WifiOutlined, DisconnectOutlined, UserOutlined
} from '@ant-design/icons';
import { FeishuService } from '../services/FeishuService';
import ConfigWizard from './ConfigWizard';
import AdminUserManagement from './AdminUserManagement';
import moment from 'moment';
import { CONFIG } from '../config/config.js';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const MainWorkspace = ({ user, networkStatus, onLogout, onNetworkRetry }) => {
  const [selectedWorkType, setSelectedWorkType] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [currentItem, setCurrentItem] = useState(null);
  const [workHistory, setWorkHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [lastScanCode, setLastScanCode] = useState('');
  const [configVisible, setConfigVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('workplace');
  
  const scanInputRef = useRef(null);

  // 监听扫码枪输入
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 如果是扫码枪输入（通常是快速连续的字符输入）
      if (event.target === scanInputRef.current) {
        return;
      }
      
      // 自动聚焦到扫码输入框
      if (scanInputRef.current && event.key.length === 1) {
        scanInputRef.current.focus();
        setScanInput(event.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 处理扫码输入
  const handleScanInput = async (value) => {
    if (!value || value.length < CONFIG.SYSTEM.QR_CODE_MIN_LENGTH) {
      return;
    }

    // 防重复扫描检查
    if (lastScanTime && Date.now() - lastScanTime < CONFIG.SYSTEM.DUPLICATE_SCAN_INTERVAL) {
      message.warning('扫描过于频繁，请稍后再试');
      return;
    }

    setLastScanTime(Date.now());
    setLoading(true);

    try {
      // 查找记录
      const record = await FeishuService.findRecordByCode(value);
      
      if (!record) {
        message.error('未找到对应的产品记录');
        return;
      }

      const fields = record.fields;
      const productName = fields[CONFIG.TABLES.PRODUCTS.FIELDS.PRODUCT_NAME];
      
      // 检查用户权限
      if (!user.permissions.includes(selectedWorkType)) {
        message.error(`您没有${selectedWorkType}的操作权限`);
        return;
      }

      // 执行报工
      const result = await FeishuService.reportWork(
        record.record_id,
        selectedWorkType,
        user.name,
        productName,
        value
      );

      if (result.success) {
        message.success(`${selectedWorkType}报工成功！`);
        
        // 添加到历史记录
        const newRecord = {
          id: Date.now().toString(),
          timestamp: result.timestamp,
          operator: result.operator,
          workType: selectedWorkType,
          productName: productName,
          qrCode: value,
          status: '正常'
        };
        
        setWorkHistory(prev => [newRecord, ...prev]);
        
        // 清空输入框
        setScanInput('');
      }
    } catch (error) {
      console.error('报工失败:', error);
      message.error('报工失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 撤销报工
  const handleUndoWork = (historyItem) => {
    Modal.confirm({
      title: '确认撤销',
      content: `确定要撤销 ${historyItem.productName} 的报工记录吗？`,
      onOk: async () => {
        try {
          // 调用撤销API
          await FeishuService.undoWork(
            historyItem.id, // 历史记录ID
            historyItem.recordId, // 产品记录ID  
            historyItem.workType
          );
          
          // 更新本地历史记录状态
          setWorkHistory(prev => 
            prev.map(item => 
              item.id === historyItem.id 
                ? { ...item, status: '已撤销' }
                : item
            )
          );
          
          message.success('撤销成功');
        } catch (error) {
          message.error('撤销失败: ' + error.message);
        }
      }
    });
  };

  // 保存配置
  const handleSaveConfig = async (config) => {
    try {
      // TODO: 保存配置到本地存储或配置文件
      console.log('保存配置:', config);
      message.success('配置保存成功！请重启应用以使配置生效。');
    } catch (error) {
      message.error('保存配置失败: ' + error.message);
    }
  };

  // 历史记录表格列配置
  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 150,
      render: (timestamp) => moment(timestamp).format('MM-DD HH:mm:ss')
    },
    {
      title: '产品',
      dataIndex: 'productName',
      key: 'productName',
      width: 120,
    },
    {
      title: '工序',
      dataIndex: 'workType',
      key: 'workType',
      width: 80,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 80,
    },
    {
      title: '二维码',
      dataIndex: 'qrCode',
      key: 'qrCode',
      width: 100,
      render: (code) => code ? code.substring(0, 8) + '...' : ''
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === '正常' ? 'green' : 'red'}>
          {status}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        record.status === '正常' ? (
          <Button 
            type="link" 
            size="small" 
            onClick={() => handleUndoWork(record)}
            icon={<UndoOutlined />}
          >
            撤销
          </Button>
        ) : null
      ),
    },
  ];

  const getNetworkStatusBadge = () => {
    switch (networkStatus) {
      case 'online':
        return <Badge status="success" text="网络正常" />;
      case 'offline':
        return <Badge status="error" text="网络断开" />;
      default:
        return <Badge status="processing" text="检查中..." />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            扫码报工系统
          </Title>
        </div>
        <Space size="large">
          <div>
            <Text strong>用户：</Text>
            <Text>{user.name}</Text>
            {user.username === 'admin' && <Tag color="red" style={{ marginLeft: 8 }}>管理员</Tag>}
          </div>
          <div>{getNetworkStatusBadge()}</div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={onNetworkRetry}
            size="small"
          >
            重连
          </Button>
          <Button 
            icon={<SettingOutlined />} 
            onClick={() => setConfigVisible(true)}
            size="small"
          >
            配置
          </Button>
          <Button 
            type="primary" 
            danger 
            icon={<LogoutOutlined />} 
            onClick={onLogout}
          >
            退出登录
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          size="large"
        >
          <TabPane 
            tab={
              <span>
                <ScanOutlined />
                报工工作台
              </span>
            } 
            key="workplace"
          >
            <Row gutter={[16, 16]}>
              {/* 扫码区域 */}
              <Col span={12}>
                <Card title="扫码报工" className="work-item-card">
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                      <Text strong>选择工序：</Text>
                      <Select
                        style={{ width: '100%', marginTop: 8 }}
                        placeholder="请选择工序类型"
                        value={selectedWorkType}
                        onChange={setSelectedWorkType}
                      >
                        {user.permissions.map(workType => (
                          <Option key={workType} value={workType}>
                            {workType}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <Text strong>扫码区域：</Text>
                      <Input
                        ref={scanInputRef}
                        className="scanner-input"
                        placeholder="请使用扫码枪扫描二维码..."
                        value={scanInput}
                        onChange={(e) => handleScanInput(e.target.value)}
                        prefix={<ScanOutlined />}
                        size="large"
                        style={{ marginTop: 8 }}
                        autoFocus
                      />
                    </div>

                    {loading && (
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary">处理中...</Text>
                      </div>
                    )}
                  </Space>
                </Card>
              </Col>

              {/* 当前条目信息 */}
              <Col span={12}>
                <Card title="当前条目信息" className="work-item-card">
                  {currentItem ? (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <div>
                        <Text strong>产品名称：</Text>
                        <Text>{currentItem.fields['产品名称']}</Text>
                      </div>
                      
                      <Row gutter={16}>
                        <Col span={12}>
                          <Statistic 
                            title="总数量" 
                            value={currentItem.fields['总数量']} 
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic 
                            title="已报工" 
                            value={currentItem.fields['已报工数量'] || 0} 
                            valueStyle={{ color: '#52c41a' }}
                            suffix={<CheckCircleOutlined />}
                          />
                        </Col>
                      </Row>

                      <div>
                        <Text type="secondary">
                          扫码时间：{moment(currentItem.scanTime).format('YYYY-MM-DD HH:mm:ss')}
                        </Text>
                      </div>
                    </Space>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Text type="secondary">请扫描二维码查看产品信息</Text>
                    </div>
                  )}
                </Card>
              </Col>

              {/* 报工历史 */}
              <Col span={24}>
                <Card 
                  title={
                    <Space>
                      <HistoryOutlined />
                      <span>报工历史</span>
                      <Badge count={workHistory.length} />
                    </Space>
                  }
                  className="history-table"
                >
                  <Table
                    columns={historyColumns}
                    dataSource={workHistory}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`,
                    }}
                    scroll={{ y: 300 }}
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>
          
          {/* 管理员用户管理标签页 */}
          {user.username === 'admin' && (
            <TabPane 
              tab={
                <span>
                  <UserOutlined />
                  用户管理
                </span>
              } 
              key="admin"
            >
              <AdminUserManagement user={user} />
            </TabPane>
          )}
        </Tabs>
      </Content>

      {/* 配置向导 */}
      <ConfigWizard
        visible={configVisible}
        onClose={() => setConfigVisible(false)}
        onSave={handleSaveConfig}
      />
    </Layout>
  );
};

export default MainWorkspace; 