import React, { useState, useEffect } from 'react'

const BASE_FONT_SIZE = 18 // 18px base definida en index.css
const MIN_SCALE = 80
const MAX_SCALE = 130
const STEP = 10

export function UiScaleWidget() {
  const [scale, setScale] = useState(100)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('icpm_ui_scale')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
          setScale(parsed)
          applyScale(parsed)
        }
      }
    } catch (e) {
      console.error('Error reading scale preference:', e)
    }
  }, [])

  const applyScale = (newScale) => {
    const calculatedSize = (BASE_FONT_SIZE * (newScale / 100)).toFixed(1)
    document.documentElement.style.setProperty('--root-font-size', `${calculatedSize}px`)
    document.documentElement.style.fontSize = `${calculatedSize}px`
    try {
      localStorage.setItem('icpm_ui_scale', newScale.toString())
    } catch (e) {
      console.error('Error saving scale preference:', e)
    }
  }

  const handleDecrease = () => {
    if (scale > MIN_SCALE) {
      const next = Math.max(MIN_SCALE, scale - STEP)
      setScale(next)
      applyScale(next)
    }
  }

  const handleIncrease = () => {
    if (scale < MAX_SCALE) {
      const next = Math.min(MAX_SCALE, scale + STEP)
      setScale(next)
      applyScale(next)
    }
  }

  const handleReset = () => {
    setScale(100)
    applyScale(100)
  }

  return (
    <div className="ui-scale-widget" role="group" aria-label="Ajustar tamaño de la interfaz">
      <button
        type="button"
        className="ui-scale-btn"
        onClick={handleDecrease}
        disabled={scale <= MIN_SCALE}
        title="Disminuir tamaño (A-)"
        aria-label="Disminuir tamaño de la interfaz"
      >
        A-
      </button>

      <button
        type="button"
        className="ui-scale-indicator"
        onClick={handleReset}
        title={`Tamaño actual: ${scale}%. Clic para restablecer a 100%`}
        aria-label={`Tamaño actual: ${scale}%. Presiona para restablecer a 100%`}
      >
        {scale}%
      </button>

      <button
        type="button"
        className="ui-scale-btn"
        onClick={handleIncrease}
        disabled={scale >= MAX_SCALE}
        title="Aumentar tamaño (A+)"
        aria-label="Aumentar tamaño de la interfaz"
      >
        A+
      </button>
    </div>
  )
}

export default UiScaleWidget
