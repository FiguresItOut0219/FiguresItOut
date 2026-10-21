import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LumaView from '@/views/LumaView.vue'
import NorthstarView from '@/views/NorthstarView.vue'
import SummitView from '@/views/SummitView.vue'
const router=createRouter({history:createWebHistory(),scrollBehavior(to){return /^#[a-zA-Z][\w-]*$/.test(to.hash)?{el:to.hash,behavior:'smooth'}:{top:0}},routes:[
  {path:'/tools/sample-annotation',component:()=>import('@/views/SampleAnnotationView.vue'),meta:{hideActionDock:true,seo:{title:'样品标注室 — FAN',description:'AI 识别样品材料、颜色与样式，校对并导出编号标注。'}}},
  {path:'/company',component:()=>import('@/components/company/CompanyShell.vue'),meta:{hideActionDock:true,seo:{title:'印作 — 公司订单系统',description:'订单、客户与印花文件的轻量管理后台。'}},children:[
    {path:'',redirect:'/company/orders'},
    {path:'overview',component:()=>import('@/components/company/CompanyOverview.vue')},
    {path:'orders',component:()=>import('@/components/company/OrderWorkspace.vue')},
    {path:'customers',component:()=>import('@/components/company/CustomerWorkspace.vue')},
    {path:'designs',component:()=>import('@/components/company/DesignWorkspace.vue')},
  ]},
  {path:'/tools/print-studio',name:'print-studio',component:()=>import('@/views/PrintEditorView.vue'),meta:{seo:{title:'印作 — 在线印花设计工作台',description:'自主排版与高清印花文件导出'},hideActionDock:true}},
  {path:'/tools/home-cashflow',name:'home-cashflow',component:()=>import('@/views/HomeCashflowView.vue'),meta:{seo:{title:'买房现金流计算器 — FAN',description:'计算购房贷款、月度支出与家庭现金流。'},hideActionDock:true}},
  {path:'/game',name:'game',component:()=>import('@/views/GameView.vue'),meta:{seo:{title:'Game — FAN',description:'A dedicated space for browser games and playful experiments by FAN.'}}},
  {path:'/game/runner',name:'game-runner',component:()=>import('@/views/RunnerView.vue'),meta:{seo:{title:'奶蛙跑酷 — FAN Game',description:'在三条跑道间闪避障碍、跳跃和收集金币的 3D 奶蛙跑酷游戏。'}}},
  {path:'/',name:'home',component:HomeView,meta:{hideActionDock:true,seo:{title:'FAN — 功能导航',description:'在线印花设计、买房现金流计算、浏览器游戏与精选网站作品，一个入口直达。'}}},
  {path:'/portfolio',name:'portfolio',component:()=>import('@/views/PortfolioView.vue'),meta:{seo:{title:'FAN — Frontend Development Partner',description:'Frontend development partner for creative and marketing agencies.'}}},
  {path:'/work/luma',component:LumaView,meta:{seo:{title:'Luma — Premium Restaurant Website',description:'A luxury hospitality website demo designed around atmosphere, storytelling and reservations.',image:'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85'}}},
  {path:'/work/northstar',component:NorthstarView,meta:{seo:{title:'Northstar Studio — Creative Agency Website',description:'An editorial creative-agency website demo focused on project storytelling and subtle motion.',image:'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=85'}}},
  {path:'/work/summit',component:SummitView,meta:{seo:{title:'Summit Heating & Air — HVAC Landing Page',description:'A conversion-focused HVAC landing page demo for a trusted local service business.',image:'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85'}}},
]})
export default router

