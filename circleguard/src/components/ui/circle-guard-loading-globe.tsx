"use client"

import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

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
  const [dotCount, setDotCount] = useState(0)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const containerWidth = size
    const containerHeight = size
    const radius = containerWidth / 2.6

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

    const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
      const [x, y] = point
      let inside = false
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }
      return inside
    }

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const geometry = feature.geometry
      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates
        if (!pointInPolygon(point, coordinates[0])) return false
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) return false
        }
        return true
      } else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
          if (pointInPolygon(point, polygon[0])) {
            let inHole = false
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) { inHole = true; break }
            }
            if (!inHole) return true
          }
        }
        return false
      }
      return false
    }

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = []
      const bounds = d3.geoBounds(feature)
      const [[minLng, minLat], [maxLng, maxLat]] = bounds
      const stepSize = dotSpacing * 0.1 // fewer dots — lighter, faster render for a loader

      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat]
          if (pointInFeature(point, feature)) dots.push(point)
        }
      }
      return dots
    }

    interface DotData { lng: number; lat: number }
    const allDots: DotData[] = []
    let landFeatures: any

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)
      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius

      // Globe base — near-black to match app background
      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      context.fillStyle = "#0B0D10"
      context.fill()
      context.strokeStyle = "#A16207" // gold ring
      context.lineWidth = 1.5 * scaleFactor
      context.globalAlpha = 0.6
      context.stroke()
      context.globalAlpha = 1

      if (landFeatures) {
        // Graticule — faint gold
        const graticule = d3.geoGraticule()
        context.beginPath()
        path(graticule())
        context.strokeStyle = "#A16207"
        context.lineWidth = 0.5 * scaleFactor
        context.globalAlpha = 0.15
        context.stroke()
        context.globalAlpha = 1

        // Land outline — soft gold
        context.beginPath()
        landFeatures.features.forEach((feature: any) => path(feature))
        context.strokeStyle = "#A16207"
        context.lineWidth = 0.8 * scaleFactor
        context.globalAlpha = 0.5
        context.stroke()
        context.globalAlpha = 1

        // Dots — bright gold, pulsing brightness handled via CSS overlay
        allDots.forEach((dot) => {
          const projected = projection([dot.lng, dot.lat])
          if (
            projected &&
            projected[0] >= 0 && projected[0] <= containerWidth &&
            projected[1] >= 0 && projected[1] <= containerHeight
          ) {
            context.beginPath()
            context.arc(projected[0], projected[1], 1.1 * scaleFactor, 0, 2 * Math.PI)
            context.fillStyle = "#D4AF37"
            context.fill()
          }
        })
      }
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json"
        )
        if (!response.ok) throw new Error("Failed to load land data")
        landFeatures = await response.json()

        let total = 0
        landFeatures.features.forEach((feature: any) => {
          generateDotsInPolygon(feature, 16).forEach(([lng, lat]) => {
            allDots.push({ lng, lat })
            total++
          })
        })
        setDotCount(total)
        render()
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load loading animation")
        setIsLoading(false)
      }
    }

    // Auto-rotate only — no drag/zoom, this is a passive loading screen
    const rotation = [0, 15] // slight tilt for a more dynamic "guardian" look
    const rotationSpeed = 0.8 // slightly faster — feels alive during short load times

    const rotate = () => {
      rotation[0] += rotationSpeed
      projection.rotate(rotation as [number, number])
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
          style={{ filter: "drop-shadow(0 0 24px rgba(161,98,7,0.35))" }}
        />
        {/* Pulsing ring overlay for the "guardian radar" brand motif */}
        <div className="absolute inset-0 rounded-full border border-[#A16207]/40 animate-ping" />
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
