import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
// A browser event bus with no long-lived Node BroadcastChannel handle.
Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true})
Object.defineProperty(globalThis,'BroadcastChannel',{value:class extends EventTarget { postMessage(){} },configurable:true})
const repository = await import('../src/services/printRepository')
const { withPrintDpi } = await import('../src/services/printFiles')
const { readSharedBrief } = await import('../src/services/printShare')

test('订单 / 印花版本 / 审核 / 生产状态保持一致', async () => {
  const customer = await repository.saveCustomer({name:'测试客户',company:'测试公司',contact:'',note:''})
  const order = await repository.createOrder({customerId:customer.id,title:'测试印花订单',product:'短袖',quantity:2,dueDate:'',note:''})
  await assert.rejects(repository.createOrder({customerId:'missing',title:'无客户',product:'短袖',quantity:1,dueDate:'',note:''}),/客户不存在/)
  await assert.rejects(repository.transitionOrder(order.id,'producing'),/状态已变化/)
  const input = {orderId:order.id,spec:{width:30,height:40,dpi:300,transparent:true,name:'测试印花'},pixels:{width:3543,height:4724},source:{objects:[]},png:new Blob(['test'],{type:'image/png'}),preview:new Blob(['test'],{type:'image/png'}),warnings:[]}
  await assert.rejects(repository.submitDesign({...input,pixels:{width:100,height:100}}),/像素/)
  const first = await repository.submitDesign(input)
  assert.equal((await repository.getOrder(order.id))?.status,'pending_review')
  assert.equal(first.version,1)
  await assert.rejects(repository.submitDesign(input),/其他页面更新/)
  await assert.rejects(repository.transitionOrder(order.id,'approved','', 'stale-version'),/版本已变化/)
  await assert.rejects(repository.transitionOrder(order.id,'needs_revision',''),/填写原因/)
  await repository.transitionOrder(order.id,'needs_revision','请调整字号')
  const second = await repository.submitDesign({...input,expectedDesignId:first.id})
  assert.equal(second.version,2)
  assert.ok(await repository.getDesign(first.id),'旧版设计应保留')
  await repository.transitionOrder(order.id,'approved','',second.id)
  await assert.rejects(repository.submitDesign({...input,expectedDesignId:second.id}),/不能修改设计/)
  await repository.transitionOrder(order.id,'producing')
  await assert.rejects(repository.transitionOrder(order.id,'shipped'),/物流公司/)
  await repository.transitionOrder(order.id,'shipped','测试物流 TEST0001')
  await repository.transitionOrder(order.id,'completed')
  const result = await repository.getOrder(order.id)
  assert.equal(result?.status,'completed'); assert.equal(result?.tracking,'测试物流 TEST0001'); assert.equal(result?.designId,second.id)
})

test('不同页面重复点击提交仅允许同一预期版本成功一次', async()=>{
  const customer = await repository.saveCustomer({name:'并发测试',company:'',contact:'',note:''})
  const order = await repository.createOrder({customerId:customer.id,title:'并发测试订单',product:'帆布袋',quantity:1,dueDate:'',note:''})
  const input = {orderId:order.id,spec:{width:30,height:40,dpi:300,transparent:true,name:'设计'},pixels:{width:3543,height:4724},source:{objects:[]},png:new Blob(['test'],{type:'image/png'}),preview:new Blob(['test'],{type:'image/png'}),warnings:[]}
  const results = await Promise.allSettled([repository.submitDesign(input),repository.submitDesign(input)])
  assert.equal(results.filter(r=>r.status === 'fulfilled').length,1)
  assert.equal((await repository.getOrder(order.id))?.designVersion,1)
})

test('PNG 正确写入且不重复追加 300 DPI 的 pHYs 数据块', async()=>{
  const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=','base64')],{type:'image/png'})
  const output = await withPrintDpi(await withPrintDpi(png))
  const bytes = new Uint8Array(await output.arrayBuffer()); const view = new DataView(bytes.buffer)
  let physicalChunks = 0; let p = 8
  while(p < bytes.length){const length=view.getUint32(p);const name=new TextDecoder().decode(bytes.slice(p+4,p+8));if(name==='pHYs'){physicalChunks++;assert.equal(view.getUint32(p+8),11811);assert.equal(view.getUint32(p+12),11811);assert.equal(bytes[p+16],1)}p+=length+12}
  assert.equal(physicalChunks,1)
})

test('客户分享链接可恢复中文订单，并拒绝损坏数据',()=>{
  const brief={version:1,id:'TEST-1',title:'中文订单',product:'白色短袖',quantity:2,customer:'测试客户',dueDate:'',note:''}
  const hash='#brief='+Buffer.from(JSON.stringify(brief)).toString('base64url')
  assert.deepEqual(readSharedBrief(hash),brief)
  assert.throws(()=>readSharedBrief('#brief=broken'),/已损坏/)
  assert.throws(()=>readSharedBrief('#brief='+Buffer.from(JSON.stringify({...brief,quantity:-1})).toString('base64url')),/已损坏/)
})
