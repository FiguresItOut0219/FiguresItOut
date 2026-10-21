import { StaticCanvas, IText, Circle, Rect } from 'fabric'
import { withPrintDpi } from './printFiles'
export async function makeSampleDesign() {
  const canvas = new StaticCanvas(document.createElement('canvas'),{width:450,height:600})
  try {
    canvas.add(new IText('SLOW DAYS',{left:225,top:100,originX:'center',fontSize:48,fontFamily:'Georgia',fill:'#294d3e'}))
    canvas.add(new IText('TAKE A BREATH. GO OUTSIDE.',{left:225,top:162,originX:'center',fontSize:11,charSpacing:130,fill:'#294d3e'}))
    canvas.add(new Circle({left:225,top:300,originX:'center',originY:'center',radius:88,fill:'#d5ab67'}))
    canvas.add(new Rect({left:153,top:246,width:140,height:135,rx:60,fill:'#406a50'}))
    canvas.add(new IText('A LITTLE MORE NATURE\nA LITTLE LESS HURRY',{left:225,top:434,originX:'center',textAlign:'center',fontFamily:'Georgia',fontSize:20,fill:'#294d3e',lineHeight:1.4}))
    const toBlob = (el: HTMLCanvasElement) => new Promise<Blob>((resolve,reject)=>el.toBlob(blob=>blob?resolve(blob):reject(new Error('示例文件生成失败')),'image/png'))
    const source = canvas.toJSON() as Record<string,unknown>
    const png = await withPrintDpi(await toBlob(canvas.toCanvasElement(3543/450)),300)
    const preview = await toBlob(canvas.toCanvasElement(.6))
    return {source,png,preview,pixels:{width:3543,height:4724},spec:{width:30,height:40,dpi:300,transparent:true,name:'慢日子 · 自然系列'},warnings:[]}
  } finally { await canvas.dispose() }
}
