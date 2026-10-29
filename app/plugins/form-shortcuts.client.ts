export default defineNuxtPlugin((nuxtApp) => {
  function submitForm(event: KeyboardEvent) {
    if (event.key !== 'Enter' || !event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.isComposing || event.repeat || event.defaultPrevented) return
    if (!(event.target instanceof Element)) return
    const form = event.target.closest('form')
    if (!form) return
    event.preventDefault()
    const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"], button:not([type])')
    if (submitter?.matches(':disabled, [aria-disabled="true"], [aria-busy="true"]')) return
    form.requestSubmit(submitter ?? undefined)
  }

  document.addEventListener('keydown', submitForm)
  nuxtApp.vueApp.onUnmount(() => document.removeEventListener('keydown', submitForm))
})
