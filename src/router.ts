import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LumaView from '@/views/LumaView.vue'
import NorthstarView from '@/views/NorthstarView.vue'
import SummitView from '@/views/SummitView.vue'
const router=createRouter({history:createWebHistory(),scrollBehavior(to){return to.hash?{el:to.hash,behavior:'smooth'}:{top:0}},routes:[
  {path:'/tools/home-cashflow',name:'home-cashflow',component:()=>import('@/views/HomeCashflowView.vue'),meta:{seo:{title:'买房现金流计算器 — FAN',description:'计算购房贷款、月度支出与家庭现金流。'},hideActionDock:true}},
  {path:'/game',name:'game',component:()=>import('@/views/GameView.vue'),meta:{seo:{title:'Game — FAN',description:'A dedicated space for browser games and playful experiments by FAN.'}}},
  {path:'/game/runner',name:'game-runner',component:()=>import('@/views/RunnerView.vue'),meta:{seo:{title:'奶蛙跑酷 — FAN Game',description:'在三条跑道间闪避障碍、跳跃和收集金币的 3D 奶蛙跑酷游戏。'}}},
  {path:'/',component:HomeView,meta:{seo:{title:'FAN — Frontend Development Partner',description:'Frontend development partner for creative and marketing agencies. Figma to polished, responsive websites with motion, forms and launch support.'}}},
  {path:'/work/luma',component:LumaView,meta:{seo:{title:'Luma — Premium Restaurant Website',description:'A luxury hospitality website demo designed around atmosphere, storytelling and reservations.',image:'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85'}}},
  {path:'/work/northstar',component:NorthstarView,meta:{seo:{title:'Northstar Studio — Creative Agency Website',description:'An editorial creative-agency website demo focused on project storytelling and subtle motion.',image:'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=85'}}},
  {path:'/work/summit',component:SummitView,meta:{seo:{title:'Summit Heating & Air — HVAC Landing Page',description:'A conversion-focused HVAC landing page demo for a trusted local service business.',image:'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85'}}},
]})
export default router
