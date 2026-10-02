'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

export function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let particles: Particle[] = []
    const CONNECTION_DIST = 120
    const PARTICLE_COUNT = 50

    function resize() {
      canvas!.width = canvas!.offsetWidth * devicePixelRatio
      canvas!.height = canvas!.offsetHeight * devicePixelRatio
      ctx!.scale(devicePixelRatio, devicePixelRatio)
    }

    function initParticles() {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
      }))
    }

    function draw() {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      ctx!.clearRect(0, 0, w, h)

      const style = getComputedStyle(canvas!)
      const primary = style.getPropertyValue('--brand-500').trim() || 'hsl(172 77% 24%)'

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        p.x = Math.max(0, Math.min(w, p.x))
        p.y = Math.max(0, Math.min(h, p.y))
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const opacity = 0.08 * (1 - dist / CONNECTION_DIST)
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `${primary} / ${opacity})`
              .replace('hsl(', 'hsla(')
              .replace(' / ', ', ')
              .replace(/\)$/, ')')
            ctx!.strokeStyle = `hsla(230, 65%, 56%, ${opacity})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      for (const p of particles) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = 'hsla(230, 65%, 56%, 0.2)'
        ctx!.fill()
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    initParticles()
    draw()

    const handleResize = () => {
      resize()
      initParticles()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: 'none' }}
    />
  )
}
