import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, message, Card, Row, Col, Statistic, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';
import { CONFIG } from '../config/config';

const { Option } = Select;
const { confirm } = Modal;

const AdminUserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [tablesSummary, setTablesSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  // 获取飞书访问令牌
  const getAccessToken = async () => {
    try {
      const response = await axios.post('/feishu-api/auth/v3/tenant_access_token/internal', {
        app_id: CONFIG.FEISHU.APP_ID,
        app_secret: CONFIG.FEISHU.APP_SECRET
      });
      return response.data.tenant_access_token;
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      throw error;
    }
  };

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const { APP_TOKEN, TABLE_ID } = CONFIG.TABLES.USERS;
      
      const response = await axios.get(
        `/feishu-api/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            page_size: 100
          }
        }
      );

      const userData = response.data.data.items.map(item => ({
        id: item.record_id,
        internalId: item.fields[CONFIG.TABLES.USERS.FIELDS.INTERNAL_ID],
        username: item.fields[CONFIG.TABLES.USERS.FIELDS.USERNAME],
        password: item.fields[CONFIG.TABLES.USERS.FIELDS.PASSWORD],
        name: item.fields[CONFIG.TABLES.USERS.FIELDS.NAME],
        permissions: item.fields[CONFIG.TABLES.USERS.FIELDS.PERMISSIONS] || []
      }));

      setUsers(userData);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 获取表格汇总信息
  const fetchTablesSummary = async () => {
    setTablesLoading(true);
    try {
      const token = await getAccessToken();
      const summaryData = [];

      // 获取用户表信息
      const usersCount = await getTableRecordCount(token, CONFIG.TABLES.USERS.APP_TOKEN, CONFIG.TABLES.USERS.TABLE_ID);
      summaryData.push({
        id: 1,
        name: '用户表',
        tableId: CONFIG.TABLES.USERS.TABLE_ID,
        purpose: '用于用户登录验证和权限管理',
        fields: Object.values(CONFIG.TABLES.USERS.FIELDS).join(', '),
        permissions: '管理员可编辑',
        recordCount: usersCount
      });

      // 获取产品表信息
      const productsCount = await getTableRecordCount(token, CONFIG.TABLES.PRODUCTS.APP_TOKEN, CONFIG.TABLES.PRODUCTS.TABLE_ID);
      summaryData.push({
        id: 2,
        name: '产品表',
        tableId: CONFIG.TABLES.PRODUCTS.TABLE_ID,
        purpose: '存储产品信息和报工状态',
        fields: Object.values(CONFIG.TABLES.PRODUCTS.FIELDS).join(', '),
        permissions: '所有用户只读',
        recordCount: productsCount
      });

      // 获取报工历史表信息
      const historyCount = await getTableRecordCount(token, CONFIG.TABLES.WORK_HISTORY.APP_TOKEN, CONFIG.TABLES.WORK_HISTORY.TABLE_ID);
      summaryData.push({
        id: 3,
        name: '报工历史表',
        tableId: CONFIG.TABLES.WORK_HISTORY.TABLE_ID,
        purpose: '记录报工历史记录',
        fields: Object.values(CONFIG.TABLES.WORK_HISTORY.FIELDS).join(', '),
        permissions: '所有用户只读',
        recordCount: historyCount
      });

      setTablesSummary(summaryData);
    } catch (error) {
      console.error('获取表格汇总失败:', error);
      message.error('获取表格汇总失败，请检查网络连接');
    } finally {
      setTablesLoading(false);
    }
  };

  // 获取表格记录数量
  const getTableRecordCount = async (token, appToken, tableId) => {
    try {
      const response = await axios.get(
        `/feishu-api/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            page_size: 1
          }
        }
      );
      return response.data.data.total || 0;
    } catch (error) {
      console.error('获取表格记录数量失败:', error);
      return 0;
    }
  };

  // 添加或编辑用户
  const handleSaveUser = async (values) => {
    try {
      const token = await getAccessToken();
      const { APP_TOKEN, TABLE_ID } = CONFIG.TABLES.USERS;

      const recordData = {
        fields: {
          [CONFIG.TABLES.USERS.FIELDS.INTERNAL_ID]: values.internalId,
          [CONFIG.TABLES.USERS.FIELDS.USERNAME]: values.username,
          [CONFIG.TABLES.USERS.FIELDS.PASSWORD]: values.password,
          [CONFIG.TABLES.USERS.FIELDS.NAME]: values.name,
          [CONFIG.TABLES.USERS.FIELDS.PERMISSIONS]: values.permissions || []
        }
      };

      if (editingUser) {
        // 编辑用户
        await axios.put(
          `/feishu-api/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${editingUser.id}`,
          recordData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        message.success('用户信息更新成功');
      } else {
        // 添加新用户
        await axios.post(
          `/feishu-api/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
          recordData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        message.success('用户添加成功');
      }

      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      console.error('保存用户失败:', error);
      message.error('保存用户失败，请检查网络连接');
    }
  };

  // 删除用户
  const handleDeleteUser = (userId) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个用户吗？此操作不可恢复。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = await getAccessToken();
          const { APP_TOKEN, TABLE_ID } = CONFIG.TABLES.USERS;

          await axios.delete(
            `/feishu-api/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${userId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          message.success('用户删除成功');
          fetchUsers();
        } catch (error) {
          console.error('删除用户失败:', error);
          message.error('删除用户失败，请检查网络连接');
        }
      }
    });
  };

  // 编辑用户
  const handleEditUser = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      internalId: user.internalId,
      username: user.username,
      password: user.password,
      name: user.name,
      permissions: user.permissions
    });
    setModalVisible(true);
  };

  // 添加用户
  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  useEffect(() => {
    if (currentUser && currentUser.username === 'admin') {
      fetchUsers();
      fetchTablesSummary();
    }
  }, [currentUser]);

  // 用户表格列配置
  const userColumns = [
    {
      title: '内部编号',
      dataIndex: 'internalId',
      key: 'internalId',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '工序权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions) => (
        <span>
          {permissions && permissions.map(permission => (
            <Tag color="blue" key={permission}>
              {permission}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteUser(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 表格汇总列配置
  const tableColumns = [
    {
      title: '表格名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <span>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          {name}
        </span>
      ),
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
    },
    {
      title: '字段信息',
      dataIndex: 'fields',
      key: 'fields',
      ellipsis: true,
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions) => (
        <Tag color={permissions.includes('管理员') ? 'red' : 'green'}>
          {permissions}
        </Tag>
      ),
    },
    {
      title: '记录数量',
      dataIndex: 'recordCount',
      key: 'recordCount',
      render: (count) => (
        <Tag color="blue">{count}</Tag>
      ),
    },
  ];

  // 非管理员用户显示权限提示
  if (!currentUser || currentUser.username !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <h3>权限不足</h3>
        <p>只有管理员用户才能访问用户管理功能</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 数据表汇总 */}
      <Card title="数据表汇总" style={{ marginBottom: '24px' }}>
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={8}>
            <Statistic 
              title="用户表记录数" 
              value={tablesSummary.find(t => t.name === '用户表')?.recordCount || 0}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="产品表记录数" 
              value={tablesSummary.find(t => t.name === '产品表')?.recordCount || 0}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="报工历史记录数" 
              value={tablesSummary.find(t => t.name === '报工历史表')?.recordCount || 0}
              prefix={<DatabaseOutlined />}
            />
          </Col>
        </Row>
        <Table
          columns={tableColumns}
          dataSource={tablesSummary}
          loading={tablesLoading}
          pagination={false}
          size="small"
          rowKey="id"
        />
      </Card>

      {/* 用户管理 */}
      <Card 
        title="用户管理" 
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAddUser}
          >
            添加用户
          </Button>
        }
      >
        <Table
          columns={userColumns}
          dataSource={users}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
          }}
          rowKey="id"
        />
      </Card>

      {/* 添加/编辑用户模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveUser}
        >
          <Form.Item
            name="internalId"
            label="内部编号"
            rules={[{ required: true, message: '请输入内部编号' }]}
          >
            <Input placeholder="请输入内部编号" />
          </Form.Item>
          
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          
          <Form.Item
            name="permissions"
            label="工序权限"
          >
            <Select
              mode="multiple"
              placeholder="请选择工序权限"
              options={CONFIG.SYSTEM.WORK_TYPES.map(type => ({
                label: type,
                value: type
              }))}
            />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingUser(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminUserManagement; 