import { useEffect, useRef } from 'react'
import { startStats } from '#engine/packages/sdk-browser/src/modules/stats/index.ts'
import { statsParts } from '#engine/packages/sdk-core/src/modules/stats/descriptor.ts'
import { fetchWords, statsWords } from '../../examples/kit/words.ts'
import { usePortal } from '../layout/PortalContext.ts'
import type { Session } from './session.ts'

/**
 * The engine's stats module (`startStats`), over the editor's view: the frames the world
 * drew per second, where the frame's time went, the shadows and the engine's counters, read four
 * times a second, in the portal's language (the kit's `statsPanel` words). A still scene draws
 * no frame, and the overlay then keeps its last reading.
 */
export function EditorStats({ session }: { session: Session }) {
  const host = useRef<HTMLDivElement>(null)
  const { locale } = usePortal().route
  useEffect(() => {
    const parent = host.current
    if (!parent) return
    let stop: (() => void) | undefined,
      stopped = false
    // A words file that does not load leaves the panel with the engine's English words.
    const loaded = fetchWords(locale).then(
      () => true,
      (error: unknown) => {
        console.error('The stats words did not load', error)
        return false
      },
    )
    void loaded.then((withWords) => {
      if (stopped) return
      const handle = startStats(session.world, {
        parent,
        parts: statsParts(undefined),
        words: withWords ? statsWords() : undefined,
      })
      handle.ready.catch((error: unknown) => console.error('The stats panel did not start', error))
      stop = handle.stop
    })
    return () => {
      stopped = true
      stop?.()
    }
  }, [session, locale])
  return <div ref={host} className="pointer-events-none absolute inset-0 z-10" />
}
