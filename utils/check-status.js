const axios = require('axios');

async function checkReactServer() {
  try {
    const response = await axios.get('http://localhost:3000', { timeout: 5000 });
    console.log('✅ React服务器已启动，可以访问 http://localhost:3000');
    return true;
  } catch (error) {
    console.log('⏳ React服务器正在启动中...');
    return false;
  }
}

async function checkFeishuAPI() {
  try {
    const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: 'cli_a74001f855b0d00c',
      app_secret: 'UZ25c8rmqBfgkPU1ze8uicpG8cBATcXq'
    });
    
    if (response.data.code === 0) {
      console.log('✅ 飞书API连接正常');
      return true;
    } else {
      console.log('❌ 飞书API连接失败');
      return false;
    }
  } catch (error) {
    console.log('❌ 飞书API连接错误:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 检查系统状态...\n');
  
  const feishuOk = await checkFeishuAPI();
  const reactOk = await checkReactServer();
  
  console.log('\n📊 状态总结:');
  console.log(`飞书API: ${feishuOk ? '✅ 正常' : '❌ 异常'}`);
  console.log(`React服务器: ${reactOk ? '✅ 运行中' : '⏳ 启动中'}`);
  
  if (feishuOk && reactOk) {
    console.log('\n🎉 系统完全正常！');
    console.log('📝 使用说明:');
    console.log('1. 在浏览器中访问 http://localhost:3000');
    console.log('2. 使用测试账号登录：admin/123456');
    console.log('3. 选择工序类型');
    console.log('4. 输入二维码进行报工测试');
    console.log('\n🧪 测试数据:');
    console.log('- 测试用户: admin/123456, test/123456');
    console.log('- 测试二维码: PROD001, PROD002, PROD003, PROD004');
  } else if (feishuOk && !reactOk) {
    console.log('\n⏳ 飞书API正常，React服务器正在启动中...');
    console.log('请等待几秒钟后再次运行此脚本检查状态');
  } else {
    console.log('\n⚠️ 发现问题，请检查网络连接和配置');
  }
}

main().catch(console.error); 