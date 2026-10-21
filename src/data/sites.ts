export type SiteCategory = '实用工具' | '游戏休闲' | '网站作品'
export interface SiteEntry {
  id: string
  name: string
  subtitle: string
  description: string
  path: string
  category: SiteCategory
  icon: 'print' | 'calculator' | 'game' | 'portfolio' | 'restaurant' | 'studio' | 'service'
  tags: string[]
}
export const siteCategories: SiteCategory[] = ['实用工具', '游戏休闲', '网站作品']
export const siteEntries: SiteEntry[] = [
  { id: 'company', name: '印作 · 公司订单系统', subtitle: 'PRINT OPERATIONS', description: '分享客户设计入口，关联印花文件，轻量管理定制订单与生产进度。', path: '/company/orders', category: '实用工具', icon: 'portfolio', tags: ['订单后台', '客户 DIY 联动', '前端演示'] },
  { id: 'print', name: '印花设计工作台', subtitle: 'PRINT STUDIO', description: '上传图片、自由排版，将灵感导出为高清印花文件。', path: '/tools/print-studio', category: '实用工具', icon: 'print', tags: ['在线设计', '高清导出', '订单资料'] },
  { id: 'cashflow', name: '买房现金流计算器', subtitle: 'HOME CASHFLOW', description: '算清购房贷款、月度支出与家庭现金流，做更从容的决定。', path: '/tools/home-cashflow', category: '实用工具', icon: 'calculator', tags: ['购房规划', '贷款测算'] },
  { id: 'runner', name: '奶蛙跑酷', subtitle: 'MILK FROG RUNNER', description: '闪避障碍，收集金币。给自己留一点轻松的游戏时间。', path: '/game/runner', category: '游戏休闲', icon: 'game', tags: ['3D 跑酷', '浏览器游戏'] },
  { id: 'portfolio', name: 'FAN · 前端作品集', subtitle: 'FRONTEND PARTNER', description: '浏览前端开发服务、精选项目与合作方式。', path: '/portfolio', category: '网站作品', icon: 'portfolio', tags: ['作品集', '开发服务'] },
  { id: 'northstar', name: 'Northstar Studio', subtitle: 'CREATIVE STUDIO', description: '以项目叙事与编辑式布局呈现创意工作室。', path: '/work/northstar', category: '网站作品', icon: 'studio', tags: ['创意机构', '网站演示'] },
  { id: 'luma', name: 'Luma', subtitle: 'RESTAURANT EXPERIENCE', description: '围绕餐饮氛围、品牌故事与预约体验的餐厅网站。', path: '/work/luma', category: '网站作品', icon: 'restaurant', tags: ['餐饮品牌', '网站演示'] },
  { id: 'summit', name: 'Summit Heating & Air', subtitle: 'LOCAL SERVICES', description: '面向本地暖通服务的品牌展示与咨询网站。', path: '/work/summit', category: '网站作品', icon: 'service', tags: ['本地服务', '网站演示'] },
]
