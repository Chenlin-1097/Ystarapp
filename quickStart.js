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
          console.log('✅ 系统检查通过，准备启动应用...\n');
          return true;
        } else {
          console.log('❌ 表格访问权限异常');
          return false;
        }
      } catch (error) {
        if (error.response && error.response.data.code === 99991672) {
          console.log('❌ 缺少必要的应用权限');
          console.log('📋 请按照以下步骤配置权限：');
          console.log('1. 访问：https://open.feishu.cn/app/cli_a74001f855b0d00c/auth');
          console.log('2. 申请 bitable:app 权限');
          console.log('3. 等待审核通过后重新运行');
          console.log('4. 详细说明请查看：docs/权限配置指南.md\n');
          return false;
        } else {
          console.log('❌ 表格访问测试失败:', error.message);
          return false;
        }
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

// 启动应用
function startApplication() {
  console.log('🚀 启动扫码报工系统...\n');
  
  const electronProcess = spawn('npm', ['run', 'electron-dev'], {
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('close', (code) => {
    console.log(`\n应用已退出，退出码: ${code}`);
  });

  electronProcess.on('error', (error) => {
    console.error('启动应用时发生错误:', error);
  });
}

// 显示使用说明
function showUsageInstructions() {
  console.log('📖 使用说明：');
  console.log('1. 使用测试账号登录：admin/123456');
  console.log('2. 选择工序类型');
  console.log('3. 扫描或输入二维码进行报工');
  console.log('4. 查看报工历史和统计信息');
  console.log('\n💡 提示：');
  console.log('- 确保扫码枪设置为键盘输入模式');
  console.log('- 系统会自动防止2秒内的重复扫码');
  console.log('- 可以在设置中查看和修改配置信息\n');
}

// 主函数
async function main() {
  console.log('🎯 扫码报工系统 - 快速启动\n');
  console.log('=' .repeat(50));
  
  // 检查系统状态
  const systemOk = await checkSystemStatus();
  
  if (systemOk) {
    // 显示使用说明
    showUsageInstructions();
    
    // 启动应用
    startApplication();
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