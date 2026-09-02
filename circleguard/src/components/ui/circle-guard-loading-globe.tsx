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
    const radius = containerWidth / 2.5
    const cx = containerWidth / 2
    const cy = containerHeight / 2

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([cx, cy])
      .clipAngle(90)

    const path = d3.geoPath().projection(projection).context(context)

    let landGeo: any = null
    let countriesGeo: any = null
    const countryDots: [number, number][] = []

    const majorHubs = [
      { name: "London", lat: 51.5074, lng: -0.1278 },
      { name: "Paris", lat: 48.8566, lng: 2.3522 },
      { name: "New York", lat: 40.7128, lng: -74.006 },
      { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
      { name: "Mumbai", lat: 19.076, lng: 72.8777 },
      { name: "Delhi", lat: 28.6139, lng: 77.209 },
      { name: "Singapore", lat: 1.3521, lng: 103.8198 },
      { name: "Dubai", lat: 25.2048, lng: 55.2708 },
      { name: "Sydney", lat: -33.8688, lng: 151.2093 },
      { name: "Cairo", lat: 30.0444, lng: 31.2357 },
      { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
      { name: "Johannesburg", lat: -26.2041, lng: 28.0473 },
    ]

    function buildCountryDots(features: any) {
      const dots: [number, number][] = []
      const step = 3.2

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

    let pulseTick = 0

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)
      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius

      const rot = projection.rotate()
      const center: [number, number] = [-rot[0], -rot[1]]

      // 1. Deep Midnight Ocean Base
      const oceanGrad = context.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.1,
        cx,
        cy,
        currentScale
      )
      oceanGrad.addColorStop(0, "#0F1318")
      oceanGrad.addColorStop(0.7, "#080A0D")
      oceanGrad.addColorStop(1, "#040507")

      context.beginPath()
      context.arc(cx, cy, currentScale, 0, 2 * Math.PI)
      context.fillStyle = oceanGrad
      context.fill()

      // 2. Globe Sphere Border
      context.strokeStyle = "#D4AF37"
      context.lineWidth = 1.6 * scaleFactor
      context.globalAlpha = 0.85
      context.stroke()
      context.globalAlpha = 1.0

      // 3. Graticule
      const graticule = d3.geoGraticule().step([20, 20])
      context.beginPath()
      path(graticule())
      context.strokeStyle = "#A16207"
      context.lineWidth = 0.5 * scaleFactor
      context.globalAlpha = 0.18
      context.stroke()
      context.globalAlpha = 1.0

      if (landGeo) {
        // 4. Continent Land Mass Fill
        context.beginPath()
        path(landGeo)
        context.fillStyle = "#141C17"
        context.globalAlpha = 0.95
        context.fill()
        context.globalAlpha = 1.0

        // 5. Individual Country Borders
        if (countriesGeo) {
          context.beginPath()
          path(countriesGeo)
          context.strokeStyle = "#D4AF37"
          context.lineWidth = 0.55 * scaleFactor
          context.globalAlpha = 0.45
          context.stroke()
          context.globalAlpha = 1.0
        }

        // 6. Prominent Coastlines
        context.beginPath()
        path(landGeo)
        context.strokeStyle = "#F3E5AB"
        context.lineWidth = 1.1 * scaleFactor
        context.globalAlpha = 0.85
        context.stroke()
        context.globalAlpha = 1.0

        // 7. STRICT CANVAS LAND CLIPPING: Dots are locked strictly inside land boundaries
        context.save()
        context.beginPath()
        path(landGeo)
        context.clip()

        countryDots.forEach((pt) => {
          if (d3.geoDistance(center, pt) <= Math.PI / 2 - 0.02) {
            const coords = projection(pt)
            if (coords) {
              const dx = coords[0] - cx
              const dy = coords[1] - cy
              const distFromCenter = Math.sqrt(dx * dx + dy * dy)
              const sphereFactor = Math.max(0.3, 1 - (distFromCenter / currentScale) * 0.65)

              context.beginPath()
              context.arc(coords[0], coords[1], 1.15 * scaleFactor * sphereFactor, 0, 2 * Math.PI)
              context.fillStyle = "#F59E0B"
              context.globalAlpha = 0.8 * sphereFactor
              context.fill()
            }
          }
        })

        context.restore()

        // 8. Capital / Safety Hub Beacons
        const beaconSize = (1 + Math.sin(pulseTick) * 0.35) * scaleFactor
        majorHubs.forEach((hub) => {
          const pt: [number, number] = [hub.lng, hub.lat]
          if (d3.geoDistance(center, pt) <= Math.PI / 2 - 0.05) {
            const coords = projection(pt)
            if (coords) {
              context.beginPath()
              context.arc(coords[0], coords[1], 3.5 * beaconSize, 0, 2 * Math.PI)
              context.fillStyle = "#F59E0B"
              context.globalAlpha = 0.25
              context.fill()

              context.beginPath()
              context.arc(coords[0], coords[1], 1.6 * scaleFactor, 0, 2 * Math.PI)
              context.fillStyle = "#FFFBEB"
              context.globalAlpha = 0.95
              context.fill()
            }
          }
        })
        context.globalAlpha = 1.0
      }

      // 9. 3D Spherical Shading Overlay
      const shadowGrad = context.createRadialGradient(
        cx - radius * 0.4,
        cy - radius * 0.4,
        radius * 0.2,
        cx,
        cy,
        currentScale
      )
      shadowGrad.addColorStop(0, "rgba(243, 229, 171, 0.12)")
      shadowGrad.addColorStop(0.65, "rgba(0, 0, 0, 0)")
      shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0.65)")

      context.beginPath()
      context.arc(cx, cy, currentScale, 0, 2 * Math.PI)
      context.fillStyle = shadowGrad
      context.fill()
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        if (!response.ok) throw new Error("Failed to load countries")
        const world: any = await response.json()
        landGeo = topojson.feature(world, world.objects.land)
        countriesGeo = topojson.feature(world, world.objects.countries)
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
      pulseTick += 0.06
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
          style={{ filter: "drop-shadow(0 0 24px rgba(212,175,55,0.45))" }}
        />
        {/* Pulsing radar ring */}
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
