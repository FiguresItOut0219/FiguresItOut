import { watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface SeoMeta {
  title: string
  description: string
  image?: string
}

const defaultImage = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=85'

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export function useSeo(route: RouteLocationNormalizedLoaded) {
  watch(
    () => route.fullPath,
    () => {
      const meta = route.meta.seo as SeoMeta | undefined
      if (!meta) return

      const image = meta.image ?? defaultImage
      const canonicalUrl = new URL(route.path, window.location.origin).href
      document.title = meta.title
      setMeta('meta[name="description"]', 'name', 'description', meta.description)
      setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title)
      setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
      setMeta('meta[property="og:image"]', 'property', 'og:image', image)
      setMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
      setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image)

      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.append(canonical)
      }
      canonical.href = canonicalUrl
    },
    { immediate: true },
  )
}
