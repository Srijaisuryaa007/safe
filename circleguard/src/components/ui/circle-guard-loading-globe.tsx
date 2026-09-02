"use client"

import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import * as topojson from "topojson-client"

interface CircleGuardLoaderProps {
  size?: number
  className?: string
  loadingLabel?: string
}

export default function CircleGuardLoader({
  size = 220,
  className = "",
  loadingLabel = "Securing your Circle",
}: CircleGuardLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const containerWidth = size
    const containerHeight = size
    const radius = containerWidth / 2.52

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)

    const path = d3.geoPath().projection(projection).context(context)

    let landGeo: any = null
    const countryDots: [number, number][] = []

    function buildCountryDots(features: any) {
      const dots: [number, number][] = []
      const step = 4.5

      for (let lng = -180; lng <= 180; lng += step) {
        for (let lat = -85; lat <= 85; lat += step) {
          const pt: [number, number] = [lng, lat]
          if (d3.geoContains(features, pt)) {
            dots.push(pt)
          }
        }
      }
      return dots
    }

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)
      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius

      // 1. Globe Base — deep midnight
      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      context.fillStyle = "#0B0D10"
      context.fill()

      // 2. Atmospheric Gold Ring
      context.strokeStyle = "#D4AF37"
      context.lineWidth = 1.6 * scaleFactor
      context.globalAlpha = 0.7
      context.stroke()
      context.globalAlpha = 1.0

      // 3. Coordinate Graticule (Parallels & Meridians)
      const graticule = d3.geoGraticule().step([20, 20])
      context.beginPath()
      path(graticule())
      context.strokeStyle = "#A16207"
      context.lineWidth = 0.5 * scaleFactor
      context.globalAlpha = 0.16
      context.stroke()
      context.globalAlpha = 1.0

      if (landGeo) {
        // 4. Continent Mass Fill
        context.beginPath()
        path(landGeo)
        context.fillStyle = "#14171E"
        context.globalAlpha = 0.9
        context.fill()
        context.globalAlpha = 1.0

        // 5. Authentic Country Coastlines
        context.beginPath()
        path(landGeo)
        context.strokeStyle = "#D4AF37"
        context.lineWidth = 0.85 * scaleFactor
        context.globalAlpha = 0.65
        context.stroke()
        context.globalAlpha = 1.0

        // 6. Geographic Country Dots
        countryDots.forEach((pt) => {
          const coords = projection(pt)
          if (
            coords &&
            coords[0] >= 0 && coords[0] <= containerWidth &&
            coords[1] >= 0 && coords[1] <= containerHeight
          ) {
            context.beginPath()
            context.arc(coords[0], coords[1], 0.95 * scaleFactor, 0, 2 * Math.PI)
            context.fillStyle = "#F59E0B"
            context.globalAlpha = 0.85
            context.fill()
          }
        })
        context.globalAlpha = 1.0
      }
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
        if (!response.ok) throw new Error("Failed to load world map")
        const world: any = await response.json()
        landGeo = topojson.feature(world, world.objects.land)
        const dots = buildCountryDots(landGeo)
        dots.forEach((d) => countryDots.push(d))
        render()
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load world geography")
        setIsLoading(false)
      }
    }

    // Auto-rotation with 18 deg Earth axial tilt
    const rotation: [number, number] = [0, -18]
    const rotationSpeed = 0.75

    const rotate = () => {
      rotation[0] += rotationSpeed
      projection.rotate(rotation)
      render()
    }

    const rotationTimer = d3.timer(rotate)
    loadWorldData()

    return () => rotationTimer.stop()
  }, [size])

  if (error) {
    return (
      <div className={`dark flex items-center justify-center bg-background rounded-full p-8 ${className}`}>
        <p className="text-destructive text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={`dark relative flex flex-col items-center justify-center gap-6 ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="rounded-full"
          style={{ filter: "drop-shadow(0 0 24px rgba(212,175,55,0.4))" }}
        />
        {/* Pulsing ring overlay for the "guardian radar" brand motif */}
        <div className="absolute inset-0 rounded-full border border-[#D4AF37]/40 animate-ping" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[#D4AF37] text-sm tracking-[0.3em] uppercase font-medium">
          Circle Guard
        </span>
        <span className="text-muted-foreground text-xs tracking-wide">
          {isLoading ? "Initializing…" : loadingLabel}
        </span>
      </div>
    </div>
  )
}
