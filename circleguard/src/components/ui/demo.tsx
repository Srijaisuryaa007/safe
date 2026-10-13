import SphereImageGrid, { ImageData } from "./img-sphere";
import React from 'react';

// ==========================================
// EASY CONFIGURATION - Edit these values to customize the component
// ==========================================

// Image data using project assets - duplicated to fill sphere better
const BASE_IMAGES: Omit<ImageData, 'id'>[] = [
  {
    src: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80",
    alt: "Image 1",
    title: "Mountain Landscape",
    description: "A beautiful landscape captured at golden hour with mountains in the background."
  },
  {
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80",
    alt: "Image 2",
    title: "Portrait Photography",
    description: "Stunning portrait photography showcasing natural lighting and composition."
  },
  {
    src: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80",
    alt: "Image 3",
    title: "Urban Architecture",
    description: "Modern architectural design featuring clean lines and geometric patterns."
  },
  {
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=80",
    alt: "Image 4",
    title: "Nature Scene",
    description: "Peaceful nature scene with vibrant colors and natural beauty."
  },
  {
    src: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300&q=80",
    alt: "Image 5",
    title: "Abstract Art",
    description: "Creative abstract composition with bold colors and unique patterns."
  },
  {
    src: "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=300&q=80",
    alt: "Image 6",
    title: "Mountain Sunset",
    description: "A beautiful landscape captured at golden hour with mountains in the background."
  },
  {
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80",
    alt: "Image 7",
    title: "Portrait Photography",
    description: "Stunning portrait photography showcasing natural lighting and composition."
  },
  {
    src: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=300&q=80",
    alt: "Image 8",
    title: "Urban Architecture",
    description: "Modern architectural design featuring clean lines and geometric patterns."
  },
  {
    src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=80",
    alt: "Image 9",
    title: "Nature Scene",
    description: "Peaceful nature scene with vibrant colors and natural beauty."
  },
  {
    src: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&q=80",
    alt: "Image 10",
    title: "Abstract Art",
    description: "Creative abstract composition with bold colors and unique patterns."
  },
  {
    src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80",
    alt: "Image 11",
    title: "Abstract Art",
    description: "Creative abstract composition with bold colors and unique patterns."
  },
  {
    src: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&q=80",
    alt: "Image 12",
    title: "Abstract Art",
    description: "Creative abstract composition with bold colors and unique patterns."
  }
];

// Generate more images by repeating the base set
export const SAMPLE_SPHERE_IMAGES: ImageData[] = [];
for (let i = 0; i < 60; i++) {
  const baseIndex = i % BASE_IMAGES.length;
  const baseImage = BASE_IMAGES[baseIndex];
  SAMPLE_SPHERE_IMAGES.push({
    id: `img-${i + 1}`,
    ...baseImage,
    alt: `${baseImage.alt} (${Math.floor(i / BASE_IMAGES.length) + 1})`
  });
}

// Component configuration - easily adjustable
export interface SphereConfig {
  containerSize: number;
  sphereRadius: number;
  dragSensitivity: number;
  momentumDecay: number;
  maxRotationSpeed: number;
  baseImageScale: number;
  hoverScale: number;
  perspective: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export const SPHERE_CONFIG: SphereConfig = {
  containerSize: 600,          // Container size in pixels
  sphereRadius: 200,           // Virtual sphere radius (increased for better spacing)
  dragSensitivity: 0.8,        // Mouse drag sensitivity (0.1 - 2.0)
  momentumDecay: 0.96,         // How fast momentum fades (0.8 - 0.99)
  maxRotationSpeed: 6,         // Maximum rotation speed (1 - 10)
  baseImageScale: 0.15,        // Base image size (reduced to minimize overlap)
  hoverScale: 1.3,             // Hover scale multiplier (1.0 - 2.0)
  perspective: 1000,           // CSS perspective value (500 - 2000)
  autoRotate: true,            // Enable/disable auto rotation
  autoRotateSpeed: 0.2         // Auto rotation speed (0.1 - 2.0, higher = faster)
};

export default function DemoOne() {
  return (
    <main className="w-full p-6 flex justify-center items-center min-h-screen">
      <SphereImageGrid
        images={SAMPLE_SPHERE_IMAGES}
        {...SPHERE_CONFIG}
      />
    </main>
  );
}
