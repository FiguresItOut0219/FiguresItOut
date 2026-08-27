<script setup lang="ts">
import { useContactForm } from '@/composables/useContactForm'
import SelectMenu from '@/components/SelectMenu.vue'

const serviceOptions = ['Landing Page', 'Marketing Website', 'Figma to Frontend', 'Website Updates', 'Ongoing Frontend Support', 'Something Else']
const { form, errors, status, isSubmitting, clearError, submit } = useContactForm()
</script>

<template>
  <section id="contact" class="section contact">
    <div class="pitch">
      <p class="eyebrow">Start a project</p>
      <h2>Have a design that needs to be built?</h2>
      <p>Send me the design or project brief and I’ll tell you how I can help.</p>
      <a href="mailto:hello@alexmercer.dev">hello@alexmercer.dev</a>
      <small>Usually replies within 24 hours.</small>
    </div>

    <form class="contact-form" novalidate @submit.prevent="submit">
      <p class="form-intro">A few details is all I need to get started.</p>
      <div class="two">
        <label class="field" :class="{ 'has-error': errors.name }">Name<input v-model="form.name" required autocomplete="name" placeholder="Your name" :aria-invalid="Boolean(errors.name)" :aria-describedby="errors.name ? 'name-error' : undefined" @input="clearError('name')" /><small v-if="errors.name" id="name-error" class="field-error">{{ errors.name }}</small></label>
        <label class="field" :class="{ 'has-error': errors.email }">Email<input v-model="form.email" required type="email" autocomplete="email" placeholder="you@agency.com" :aria-invalid="Boolean(errors.email)" :aria-describedby="errors.email ? 'email-error' : undefined" @input="clearError('email')" /><small v-if="errors.email" id="email-error" class="field-error">{{ errors.email }}</small></label>
      </div>
      <label class="field">Agency / Company<input v-model="form.company" autocomplete="organization" placeholder="Your studio or company" /></label>
      <label class="field select-field" :class="{ 'has-error': errors.need }">What do you need?
        <SelectMenu v-model="form.need" label="What do you need?" placeholder="Choose a service" :options="serviceOptions" tone="dark" :invalid="Boolean(errors.need)" :described-by="errors.need ? 'need-error' : undefined" @update:model-value="clearError('need')" />
        <small v-if="errors.need" id="need-error" class="field-error">{{ errors.need }}</small>
      </label>
      <label class="field" :class="{ 'has-error': errors.message }">Message<textarea v-model="form.message" required rows="4" placeholder="A quick outline of the project, timeline and anything useful to know." :aria-invalid="Boolean(errors.message)" :aria-describedby="errors.message ? 'message-error' : undefined" @input="clearError('message')"></textarea><small v-if="errors.message" id="message-error" class="field-error">{{ errors.message }}</small></label>
      <label class="field" :class="{ 'has-error': errors.link }">Optional Project Link<input v-model="form.link" type="url" inputmode="url" placeholder="https://figma.com / brief link" :aria-invalid="Boolean(errors.link)" :aria-describedby="errors.link ? 'link-error' : undefined" @input="clearError('link')" /><small v-if="errors.link" id="link-error" class="field-error">{{ errors.link }}</small></label>
      <button class="submit-button" type="submit" :disabled="isSubmitting"><span>{{ isSubmitting ? 'Sending project details…' : 'Send project details' }}</span><span aria-hidden="true">{{ isSubmitting ? '· · ·' : '↗' }}</span></button>
      <p v-if="status === 'success'" class="success" role="status">Thanks — I’ll get back to you shortly.</p>
      <p v-else-if="status === 'error' && !Object.keys(errors).length" class="error-summary" role="alert">Please review the highlighted fields and try again.</p>
    </form>
  </section>
</template>

<style scoped>
.contact { display: grid; grid-template-columns: 1.1fr 1fr; gap: clamp(4rem, 10vw, 12rem); background: #111; color: #f7f7f5; }
.pitch h2 { max-width: 11ch; font: 500 clamp(3.35rem, 6.3vw, 6.8rem)/.95 var(--display); letter-spacing: -.045em; margin: 2.2rem 0 2rem; }
.pitch > p:not(.eyebrow) { color: #b8b8b2; max-width: 30rem; }
.pitch a { display: inline-block; color: var(--acid); margin-top: 3rem; font-weight: 700; text-underline-offset: .35rem; }
.pitch small { display: block; color: #999; margin-top: 1rem; }
.contact-form { display: flex; flex-direction: column; gap: 1rem; padding: clamp(1.35rem, 2.5vw, 2.4rem); border: 1px solid #41413d; background: #181817; box-shadow: inset 0 1px #ffffff0a; }
.form-intro { margin: 0 0 .8rem; color: #9e9e98; font-size: .84rem; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field { display: block; color: #f1f1ed; font: 700 .66rem/1.2 var(--sans); text-transform: uppercase; letter-spacing: .1em; }
.field input, .field textarea { display: block; width: 100%; margin-top: .65rem; border: 1px solid #555550; border-radius: 2px; background: #20201e; color: #fff; outline: none; font: 500 .9rem/1.35 var(--sans); letter-spacing: 0; text-transform: none; transition: border-color .18s ease, background .18s ease, box-shadow .18s ease; }
.field input { min-height: 48px; padding: .8rem .9rem; }
.field textarea { min-height: 118px; padding: .85rem .9rem; resize: vertical; }
.field input::placeholder, .field textarea::placeholder { color: #969690; opacity: 1; }
.field input:hover, .field textarea:hover { border-color: #85857e; background: #242422; }
.field input:focus, .field textarea:focus { border-color: var(--acid); background: #262623; box-shadow: 0 0 0 3px #c8ff3d29; }
.has-error input, .has-error textarea { border-color: #ff7a74; }
.field-error { display: block; margin-top: .45rem; color: #ff9d98; font-size: .72rem; letter-spacing: 0; text-transform: none; }
.submit-button { min-height: 50px; display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: .7rem; padding: .8rem 1rem; border: 1px solid var(--acid); background: var(--acid); color: #111; font: 700 .78rem var(--sans); transition: background .18s ease, transform .18s ease; }
.submit-button:hover:not(:disabled) { background: #f7f7f5; transform: translateY(-2px); }
.submit-button:disabled { cursor: wait; opacity: .78; }
.success { margin: .25rem 0 0; padding: .9rem 1rem; border: 1px solid var(--acid); color: var(--acid); font-size: .85rem; }
.error-summary { margin: .25rem 0 0; color: #ff9d98; font-size: .85rem; }
@media (max-width: 800px) { .contact { grid-template-columns: 1fr; }.pitch h2 { max-width: 13ch; }.two { grid-template-columns: 1fr; } }
@media (max-width: 420px) { .pitch h2 { font-size: 3.15rem; }.contact-form { padding: 1.1rem; } }
</style>
