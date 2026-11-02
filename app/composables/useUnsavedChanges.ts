import { onBeforeRouteLeave } from 'vue-router'

export function useUnsavedChanges(dirty: () => boolean) {
  onBeforeRouteLeave(() => !dirty() || window.confirm('Quitter cette page sans enregistrer les modifications ?'))
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!dirty()) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
}
