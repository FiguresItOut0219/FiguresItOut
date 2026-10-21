# 印作订单系统：前端演示

## 入口与演示流程

- 汇总首页 `/` → **印作 · 公司订单系统**，后台地址 `/company/orders`。
- 后台只保留 **工作概览、订单管理、客户管理、印花文件**。
- 首次打开预置 3 位虚构客户、4 笔示例订单，其中包括待客户设计、待审核与生产中，以及 2 份实际可预览/下载的示例印花。
- 在订单详情中点击 **复制链接** 或 **模拟客户打开**。分享链接携带简要订单信息，客户无需登录即可打开与编辑。
- 客户勾选设计确认后 **提交印花**，高清 PNG、缩略图、Fabric 源稿、尺寸、预检提示与版本号会一起保存，订单进入待审核。
- 后台支持退回修改、审核通过、开始生产、登记物流、确认完成。审核时须明确核对图稿，确认后禁止再改稿，避免生产版本变动。
- 每次重新提交创建新版本，保留旧版本；并发提交和审核会检查版本，避免覆盖新稿。
- 草稿按订单隔离；生产数量由订单决定，客户不能从编辑器改变。

## 演示边界

**没有服务端、账号体系、付款、真实生产或短信。** 所有数据与图稿保存在 IndexedDB，仅存在于当前浏览器与当前域名。

分享地址在 URL fragment 中保存订单简要信息，所以另一浏览器也能看到订单并体验提交；提交结果保存在该浏览器，不会跨设备实时同步。当前开发服务是 127.0.0.1，复制的地址仅能在本机访问。部署到可访问的静态域名后，可演示客户在其他设备打开链接的过程。

这些链接是演示数据载体，并非有访问控制的生产订单凭证。不要使用本演示存放真实客户隐私资料。不同来源端口的浏览器存储相互隔离，清除网站数据会移除全部演示设计。

## 源码与精简范围

上游：[Daymychen/art-design-pro](https://github.com/Daymychen/art-design-pro)，于 2026-10-20 下载 main 分支源码，原始归档位于本机 `vendor/art-design-pro-main.zip`，解压目录 `vendor/art-design-pro-main/`。这两个下载产物不进入应用构建与 Git；实际演示源码在 `src/components/company/`。

保留上游 MIT 许可于 `public/licenses/art-design-pro.txt`，页面页脚提供署名链接。`art/ArtStatsCard.vue` 与 `art/ArtTableHeader.vue` 从上游同名核心组件按订单场景简化。后台沿用其侧栏、内容区、统计卡片与 Element Plus 表格组织方式，并移除了 Tailwind、Pinia 配置、多语言、主题切换、权限路由生成、动态工作标签、ECharts、富文本、播放器、文章系统与各类示例页等依赖；现有网站共用 Vue 3、Router 与按需导入的 Element Plus。

## 代码边界

- `src/services/printRepository.ts`：IndexedDB、事务、状态与版本保护、测试数据。
- `src/services/printShare.ts`：可分享订单简报。
- `src/services/printFiles.ts`：高清文件下载与 PNG 300 DPI 元数据。
- `src/composables/useCompanyData.ts`：页面间与同域标签页的数据刷新。
- `src/composables/usePrintEditor.ts`：订单载入、Fabric 源稿恢复与印花提交。
- `src/components/company/`：后台各工作区、建单和订单详情。

## 验证

```sh
pnpm test:orders
pnpm build
```

将来若需要真实多人同步，只需以有鉴权的接口替换仓储模块，并为图稿增加文件存储；本次未实现服务端。
