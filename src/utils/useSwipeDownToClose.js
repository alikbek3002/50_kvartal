import { useRef } from 'react'

/**
 * Adds "swipe down to close" gesture for bottom-sheets/modals (best-effort on iOS).
 * Attach `targetRef` to the sheet element you want to move.
 * Spread `handleProps` onto a small "grabber" element (so we don't fight with scroll).
 */
export const useSwipeDownToClose = ({ onClose, enabled = true, threshold = 110 } = {}) => {
  const targetRef = useRef(null)
  const startYRef = useRef(null)
  const lastDyRef = useRef(0)
  const draggingRef = useRef(false)

  const resetTransform = () => {
    const el = targetRef.current
    if (!el) return
    el.style.transition = 'transform 180ms ease'
    el.style.transform = 'translateY(0px)'
    el.style.willChange = ''
  }

  const handlePointerDown = (e) => {
    if (!enabled) return
    // Mouse dragging on desktop is not intended here.
    if (e.pointerType === 'mouse') return

    draggingRef.current = true
    startYRef.current = e.clientY
    lastDyRef.current = 0

    const el = targetRef.current
    if (el) {
      el.style.willChange = 'transform'
      el.style.transition = 'none'
    }

    if (typeof e.currentTarget?.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return
    if (startYRef.current == null) return

    const dy = e.clientY - startYRef.current
    if (dy <= 0) return

    lastDyRef.current = dy
    const el = targetRef.current
    if (el) el.style.transform = `translateY(${dy}px)`
  }

  const finishDrag = () => {
    draggingRef.current = false
    startYRef.current = null
    const dy = lastDyRef.current
    lastDyRef.current = 0
    return dy
  }

  const handlePointerUp = () => {
    if (!draggingRef.current) return
    const dy = finishDrag()
    if (dy > threshold) {
      onClose?.()
      return
    }
    resetTransform()
  }

  const handlePointerCancel = () => {
    if (!draggingRef.current) return
    finishDrag()
    resetTransform()
  }

  return {
    targetRef,
    handleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  }
}


