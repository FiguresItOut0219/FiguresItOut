import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LumaView from '@/views/LumaView.vue'
import NorthstarView from '@/views/NorthstarView.vue'
import SummitView from '@/views/SummitView.vue'
const router=createRouter({history:createWebHistory(),scrollBehavior(to){return to.hash?{el:to.hash,behavior:'smooth'}:{top:0}},routes:[
  {path:'/',component:HomeView,meta:{seo:{title:'Alex Mercer — Frontend Development Partner',description:'Frontend development partner for creative and marketing agencies. Figma to Vue, responsive implementation, motion and launch support.'}}},
  {path:'/work/luma',component:LumaView,meta:{seo:{title:'Luma — Premium Restaurant Website',description:'A luxury hospitality website demo designed around atmosphere, storytelling and reservations.',image:'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85'}}},
  {path:'/work/northstar',component:NorthstarView,meta:{seo:{title:'Northstar Studio — Creative Agency Website',description:'An editorial creative-agency website demo focused on project storytelling and subtle motion.',image:'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=85'}}},
  {path:'/work/summit',component:SummitView,meta:{seo:{title:'Summit Heating & Air — HVAC Landing Page',description:'A conversion-focused HVAC landing page demo for a trusted local service business.',image:'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85'}}},
]})
export default router
