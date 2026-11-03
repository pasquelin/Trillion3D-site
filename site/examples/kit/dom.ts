/** An element of `tag` with `className`, its text `text`. */
export function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

/** Hands `text` to the person as the JSON file `name`. */
export function downloadJson(name: string, text: string) {
  const link = make('a')
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  link.download = name
  link.click()
  // Revoked on the next task: some browsers start the download after `click` returns.
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}
