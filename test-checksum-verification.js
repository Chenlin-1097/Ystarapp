const fs = require('fs');
const adler32 = require('adler-32');

// 我们自己的Adler32实现（从FeishuService.js复制）
function calculateChecksumFromBuffer(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  
  // 确保返回无符号32位整数并转为字符串，与成功版本一致
  return (((b << 16) | a) >>> 0).toString();
}

// 标准库的实现（用于对比）
function calculateChecksumWithLibrary(buffer) {
  return (adler32.buf(buffer) >>> 0).toString();
}

async function testChecksumImplementation() {
  console.log('🧪 测试Adler32校验和实现...\n');

  // 测试1: 简单字符串
  console.log('📝 测试1: 简单字符串');
  const testString = 'hello world';
  const testBuffer = Buffer.from(testString);
  
  const ourResult1 = calculateChecksumFromBuffer(testBuffer.buffer.slice(testBuffer.byteOffset, testBuffer.byteOffset + testBuffer.byteLength));
  const libResult1 = calculateChecksumWithLibrary(testBuffer);
  
  console.log(`字符串: "${testString}"`);
  console.log(`我们的实现: ${ourResult1}`);
  console.log(`标准库结果: ${libResult1}`);
  console.log(`是否一致: ${ourResult1 === libResult1 ? '✅' : '❌'}\n`);

  // 测试2: 空数据
  console.log('📝 测试2: 空数据');
  const emptyBuffer = Buffer.alloc(0);
  const ourResult2 = calculateChecksumFromBuffer(emptyBuffer.buffer);
  const libResult2 = calculateChecksumWithLibrary(emptyBuffer);
  
  console.log(`我们的实现: ${ourResult2}`);
  console.log(`标准库结果: ${libResult2}`);
  console.log(`是否一致: ${ourResult2 === libResult2 ? '✅' : '❌'}\n`);

  // 测试3: 大文件第一个分片
  console.log('📝 测试3: 实际Excel文件的第一个分片');
  if (fs.existsSync('WSD2715线上款式明细.xlsx')) {
    const fileBuffer = fs.readFileSync('WSD2715线上款式明细.xlsx');
    const chunkSize = 4 * 1024 * 1024; // 4MB
    const firstChunk = fileBuffer.slice(0, Math.min(chunkSize, fileBuffer.length));
    
    console.log(`分片大小: ${firstChunk.length} 字节`);
    
    const startTime = Date.now();
    const ourResult3 = calculateChecksumFromBuffer(firstChunk.buffer.slice(firstChunk.byteOffset, firstChunk.byteOffset + firstChunk.byteLength));
    const ourTime = Date.now() - startTime;
    
    const startTime2 = Date.now();
    const libResult3 = calculateChecksumWithLibrary(firstChunk);
    const libTime = Date.now() - startTime2;
    
    console.log(`我们的实现: ${ourResult3} (耗时: ${ourTime}ms)`);
    console.log(`标准库结果: ${libResult3} (耗时: ${libTime}ms)`);
    console.log(`是否一致: ${ourResult3 === libResult3 ? '✅' : '❌'}`);
    console.log(`性能对比: 我们的实现${ourTime <= libTime ? '更快' : '较慢'} ${Math.abs(ourTime - libTime)}ms\n`);
  } else {
    console.log('❌ 测试文件不存在，跳过此测试\n');
  }

  // 测试4: 多个小数据块
  console.log('📝 测试4: 多个测试数据');
  const testCases = [
    'a',
    'abc',
    '123456789',
    Buffer.alloc(1000, 0x42), // 1000个B字符
    Buffer.from([0, 1, 2, 3, 4, 5, 255, 254, 253]) // 各种字节值
  ];

  let allMatch = true;
  for (let i = 0; i < testCases.length; i++) {
    const testData = testCases[i];
    const buffer = Buffer.isBuffer(testData) ? testData : Buffer.from(testData);
    
    const ourResult = calculateChecksumFromBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const libResult = calculateChecksumWithLibrary(buffer);
    
    const match = ourResult === libResult;
    console.log(`测试${i + 1}: ${match ? '✅' : '❌'} (我们的: ${ourResult}, 标准库: ${libResult})`);
    
    if (!match) {
      allMatch = false;
    }
  }

  console.log(`\n📊 总结:`);
  console.log(`所有测试${allMatch ? '✅ 通过' : '❌ 失败'}`);
  
  if (allMatch) {
    console.log('🎉 我们的Adler32实现与标准库完全一致！');
  } else {
    console.log('⚠️ 我们的实现存在问题，需要修复');
  }
}

// 运行测试
testChecksumImplementation().catch(console.error); 