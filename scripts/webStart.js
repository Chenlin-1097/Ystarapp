const { spawn } = require('child_process');
const axios = require('axios');

// 配置信息
const CONFIG = {
  FEISHU: {
    APP_ID: 'cli_a74001f855b0d00c',
    APP_SECRET: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq',
    BASE_URL: 'https://open.feishu.cn/open-apis'
  },
  TABLES: {
    USERS: {
      APP_TOKEN: 'RQj7bH20uaeNegsdERUclgcInAd',
      TABLE_ID: 'tblxbOsA83hEZShA'
    }
  }
};

// 检查系统状态
async function checkSystemStatus() {
  console.log('🔍 正在检查系统状态...\n');
  
  try {
    // 1. 检查访问令牌
    console.log('1. 检查飞书API连接...');
    const response = await axios.post(`${CONFIG.FEISHU.BASE_URL}/auth/v3/tenant_access_token/internal`, {
      app_id: CONFIG.FEISHU.APP_ID,
      app_secret: CONFIG.FEISHU.APP_SECRET
    });

    if (response.data.code === 0) {
      console.log('✅ 飞书API连接正常');
      
      // 2. 检查表格权限
      console.log('2. 检查表格访问权限...');
      const accessToken = response.data.tenant_access_token;
      
      try {
        const tableResponse = await axios.get(
          `${CONFIG.FEISHU.BASE_URL}/bitable/v1/apps/${CONFIG.TABLES.USERS.APP_TOKEN}/tables/${CONFIG.TABLES.USERS.TABLE_ID}/records`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (tableResponse.data.code === 0) {
          console.log('✅ 表格访问权限正常');
          console.log('✅ 系统检查通过，准备启动Web版本...\n');
          return true;
        } else {
          console.log('❌ 表格访问权限异常');
          return false;
        }
      } catch (error) {
        console.log('❌ 表格访问测试失败:', error.message);
        return false;
      }
    } else {
      console.log('❌ 飞书API连接失败:', response.data.msg);
      return false;
    }
  } catch (error) {
    console.log('❌ 系统检查失败:', error.message);
    return false;
  }
}

// 启动Web版本
function startWebApplication() {
  console.log('🌐 启动Web版本扫码报工系统...\n');
  
  const reactProcess = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true
  });

  console.log('📖 使用说明：');
  console.log('1. 等待React开发服务器启动');
  console.log('2. 在浏览器中访问 http://localhost:3000');
  console.log('3. 使用测试账号登录：admin/123456');
  console.log('4. 选择工序类型');
  console.log('5. 输入二维码进行报工测试');
  console.log('\n💡 提示：');
  console.log('- 这是Web版本，功能与桌面版完全相同');
  console.log('- 所有数据都会同步到飞书多维表格');
  console.log('- 可以在多个浏览器标签页中同时使用\n');

  reactProcess.on('close', (code) => {
    console.log(`\nWeb应用已退出，退出码: ${code}`);
  });

  reactProcess.on('error', (error) => {
    console.error('启动Web应用时发生错误:', error);
  });
}

// 主函数
async function main() {
  console.log('🎯 扫码报工系统 - Web版本启动\n');
  console.log('=' .repeat(50));
  
  // 检查系统状态
  const systemOk = await checkSystemStatus();
  
  if (systemOk) {
    // 启动Web版本
    startWebApplication();
  } else {
    console.log('⚠️  系统检查未通过，请解决上述问题后重新运行。');
    console.log('\n🔧 故障排除：');
    console.log('1. 运行 node scripts/testSystem.js 进行详细诊断');
    console.log('2. 查看 docs/权限配置指南.md 了解权限配置');
    console.log('3. 确认网络连接正常');
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('启动过程中发生错误:', error);
  process.exit(1);
}); 