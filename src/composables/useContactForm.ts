import { computed, reactive, shallowRef } from 'vue'

export interface ContactPayload {
  name: string
  email: string
  company: string
  need: string
  message: string
  link: string
}

type Field = keyof ContactPayload
type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

function validate(payload: ContactPayload) {
  const errors: Partial<Record<Field, string>> = {}
  if (!payload.name.trim()) errors.name = 'Please add your name.'
  if (!/^\S+@\S+\.\S+$/.test(payload.email)) errors.email = 'Enter a valid email address.'
  if (!payload.need) errors.need = 'Choose the kind of support you need.'
  if (!payload.message.trim()) errors.message = 'Tell me a little about the project.'
  if (payload.link && !/^https?:\/\/.+/.test(payload.link)) errors.link = 'Use a full URL starting with https://.'
  return errors
}

async function deliver(payload: ContactPayload) {
  const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined
  if (!endpoint) {
    await new Promise(resolve => window.setTimeout(resolve, 550))
    return
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('The request could not be sent.')
}

export function useContactForm() {
  const form = reactive<ContactPayload>({ name: '', email: '', company: '', need: '', message: '', link: '' })
  const errors = reactive<Partial<Record<Field, string>>>({})
  const status = shallowRef<FormStatus>('idle')
  const isSubmitting = computed(() => status.value === 'submitting')

  function clearError(field: Field) {
    delete errors[field]
    if (status.value !== 'submitting') status.value = 'idle'
  }

  async function submit() {
    const nextErrors = validate(form)
    Object.keys(errors).forEach(key => delete errors[key as Field])
    Object.assign(errors, nextErrors)
    if (Object.keys(nextErrors).length) {
      status.value = 'error'
      return false
    }
    status.value = 'submitting'
    try {
      await deliver({ ...form })
      status.value = 'success'
      return true
    } catch {
      status.value = 'error'
      errors.message = 'Your details are safe here, but the form could not send. Please email me directly.'
      return false
    }
  }

  return { form, errors, status, isSubmitting, clearError, submit }
}
