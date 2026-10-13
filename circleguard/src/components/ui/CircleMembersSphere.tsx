import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { ImageData } from './img-sphere';
import { SAMPLE_SPHERE_IMAGES } from './demo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CircleMembersSphereProps {
  members?: any[];
  containerSize?: number;
  sphereRadius?: number;
  autoRotate?: boolean;
  onSelectMember?: (member: any) => void;
  isDark?: boolean;
}

export default function CircleMembersSphere({
  members = [],
  containerSize = Math.min(SCREEN_WIDTH - 32, 420),
  sphereRadius = Math.min((SCREEN_WIDTH - 32) * 0.38, 160),
  autoRotate = true,
  onSelectMember,
  isDark = true,
}: CircleMembersSphereProps) {
  // Construct image list blending real circle members with high-res sphere assets
  const sphereImages: ImageData[] = useMemo(() => {
    const list: ImageData[] = [];

    // 1. Add real circle members first
    members.forEach((m, idx) => {
      const name = m.profile?.full_name || 'Family Member';
      const avatar = m.profile?.avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80`;
      const role = m.role === 'owner' ? 'Circle Leader' : m.role === 'guardian' ? 'Guardian' : 'Member';
      list.push({
        id: `member-${m.user_id || m.id || idx}`,
        src: avatar,
        alt: name,
        title: name,
        description: `${role} • Active in Circle`,
      });
    });

    // 2. Pad up to 48 nodes with sample images to create dense 3D Fibonacci sphere
    const targetCount = 48;
    let sampleIdx = 0;
    while (list.length < targetCount) {
      const sample = SAMPLE_SPHERE_IMAGES[sampleIdx % SAMPLE_SPHERE_IMAGES.length];
      list.push({
        ...sample,
        id: `sphere-img-${list.length + 1}`,
      });
      sampleIdx++;
    }

    return list;
  }, [members]);

  // If running on Web, dynamically render the React DOM component
  if (Platform.OS === 'web') {
    try {
      const SphereImageGrid = require('./img-sphere').default;
      return (
        <View style={[styles.container, { width: containerSize, height: containerSize }]}>
          <SphereImageGrid
            images={sphereImages}
            containerSize={containerSize}
            sphereRadius={sphereRadius}
            autoRotate={autoRotate}
            dragSensitivity={0.8}
            momentumDecay={0.96}
            maxRotationSpeed={6}
            baseImageScale={0.14}
            hoverScale={1.3}
            perspective={1000}
            autoRotateSpeed={0.25}
          />
        </View>
      );
    } catch (_) {
      // Fallback to webview if web bundling issue
    }
  }

  // Mobile Native (iOS / Android): Render ultra-smooth hardware-accelerated 3D Sphere in WebView
  const htmlContent = useMemo(() => {
    const imagesJson = JSON.stringify(sphereImages);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: transparent;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }
    #sphere-root {
      position: relative;
      width: ${containerSize}px;
      height: ${containerSize}px;
      perspective: 1000px;
      cursor: grab;
      touch-action: none;
    }
    #sphere-root:active { cursor: grabbing; }
    .node-img {
      position: absolute;
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      border: 2px solid ${isDark ? 'rgba(58, 223, 171, 0.4)' : 'rgba(255,255,255,0.7)'};
      transition: transform 0.15s ease-out;
      transform-origin: center center;
    }
    .node-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      pointer-events: none;
    }
    #modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    #modal.active { display: flex; animation: fadeIn 0.25s ease-out; }
    #modal-card {
      background: ${isDark ? '#1C2621' : '#FFFFFF'};
      border: 1px solid ${isDark ? '#2B3D34' : '#E5E7EB'};
      border-radius: 20px;
      max-width: 290px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
      text-align: center;
      color: ${isDark ? '#FFFFFF' : '#111827'};
      animation: popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #modal-img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
    }
    #modal-info { padding: 16px; }
    #modal-title { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
    #modal-desc { font-size: 13px; color: ${isDark ? '#3ADFAB' : '#059669'}; font-weight: 500; }
    #modal-close {
      margin-top: 14px;
      padding: 9px 24px;
      background: ${isDark ? '#2E7D5B' : '#006C4F'};
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 600;
      border: none;
      border-radius: 999px;
      cursor: pointer;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  </style>
</head>
<body>
  <div id="sphere-root"></div>

  <div id="modal" onclick="closeModal()">
    <div id="modal-card" onclick="event.stopPropagation()">
      <img id="modal-img" src="" alt="" />
      <div id="modal-info">
        <div id="modal-title"></div>
        <div id="modal-desc"></div>
        <button id="modal-close" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <script>
    const images = ${imagesJson};
    const containerSize = ${containerSize};
    const sphereRadius = ${sphereRadius};
    const baseScale = 0.14;
    const baseImageSize = containerSize * baseScale;
    const dragSens = 0.65;
    const momentumDecay = 0.95;
    const autoSpeed = 0.22;

    let rotation = { x: 15, y: 15, z: 0 };
    let velocity = { x: 0, y: 0 };
    let isDragging = false;
    let lastPos = { x: 0, y: 0 };
    let startPos = { x: 0, y: 0 };
    let hasMoved = false;

    // Fibonacci sphere points
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleInc = 2 * Math.PI / goldenRatio;
    const positions = [];

    for (let i = 0; i < images.length; i++) {
      const t = i / images.length;
      const inc = Math.acos(1 - 2 * t);
      const az = angleInc * i;
      let phi = inc * (180 / Math.PI);
      let theta = (az * (180 / Math.PI)) % 360;

      const poleBonus = Math.pow(Math.abs(phi - 90) / 90, 0.6) * 35;
      if (phi < 90) phi = Math.max(5, phi - poleBonus);
      else phi = Math.min(175, phi + poleBonus);

      phi = 15 + (phi / 180) * 150;
      theta = (theta + (Math.random() - 0.5) * 18) % 360;

      positions.push({ theta, phi, radius: sphereRadius });
    }

    const root = document.getElementById('sphere-root');
    const nodes = [];

    images.forEach((img, idx) => {
      const el = document.createElement('div');
      el.className = 'node-img';
      el.innerHTML = '<img src="' + img.src + '" loading="lazy" />';
      el.onclick = () => {
        if (!hasMoved) openModal(img);
      };
      root.appendChild(el);
      nodes.push(el);
    });

    const degToRad = (d) => d * (Math.PI / 180);

    function render() {
      const rotXRad = degToRad(rotation.x);
      const rotYRad = degToRad(rotation.y);

      for (let i = 0; i < nodes.length; i++) {
        const pos = positions[i];
        const thetaRad = degToRad(pos.theta);
        const phiRad = degToRad(pos.phi);

        let x = pos.radius * Math.sin(phiRad) * Math.cos(thetaRad);
        let y = pos.radius * Math.cos(phiRad);
        let z = pos.radius * Math.sin(phiRad) * Math.sin(thetaRad);

        // Y-axis rotation
        const x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
        const z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
        x = x1; z = z1;

        // X-axis rotation
        const y2 = y * Math.cos(rotXRad) - z * Math.sin(rotXRad);
        const z2 = y * Math.sin(rotXRad) + z * Math.cos(rotXRad);
        y = y2; z = z2;

        const isVisible = z > -35;
        const el = nodes[i];

        if (!isVisible) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = 'block';

        let opacity = 1;
        if (z <= -10) {
          opacity = Math.max(0, (z - (-35)) / 25);
        }

        const depthScale = (z + sphereRadius) / (2 * sphereRadius);
        const scale = 0.45 + depthScale * 0.55;
        const size = baseImageSize * scale;

        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.left = (containerSize / 2 + x) + 'px';
        el.style.top = (containerSize / 2 + y) + 'px';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.zIndex = Math.round(1000 + z);
        el.style.opacity = opacity;
      }
    }

    function animate() {
      if (!isDragging) {
        velocity.x *= momentumDecay;
        velocity.y *= momentumDecay;

        rotation.y = (rotation.y + autoSpeed + velocity.y) % 360;
        rotation.x = Math.max(-60, Math.min(60, rotation.x + velocity.x));
      }

      render();
      requestAnimationFrame(animate);
    }

    // Touch Interaction
    root.addEventListener('touchstart', (e) => {
      isDragging = true;
      hasMoved = false;
      const t = e.touches[0];
      lastPos = { x: t.clientX, y: t.clientY };
      startPos = { x: t.clientX, y: t.clientY };
      velocity = { x: 0, y: 0 };
    }, { passive: true });

    root.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - lastPos.x;
      const dy = t.clientY - lastPos.y;

      if (Math.abs(t.clientX - startPos.x) > 6 || Math.abs(t.clientY - startPos.y) > 6) {
        hasMoved = true;
      }

      rotation.y = (rotation.y + dx * dragSens) % 360;
      rotation.x = Math.max(-60, Math.min(60, rotation.x - dy * dragSens));

      velocity = { x: -dy * dragSens * 0.4, y: dx * dragSens * 0.4 };
      lastPos = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    root.addEventListener('touchend', () => {
      isDragging = false;
    });

    function openModal(img) {
      document.getElementById('modal-img').src = img.src;
      document.getElementById('modal-title').innerText = img.title || 'Member';
      document.getElementById('modal-desc').innerText = img.description || 'Active Member';
      document.getElementById('modal').classList.add('active');

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_MEMBER', title: img.title }));
      }
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    animate();
  </script>
</body>
</html>`;
  }, [sphereImages, containerSize, sphereRadius, isDark]);

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ width: containerSize, height: containerSize, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'SELECT_MEMBER' && onSelectMember) {
              const matched = members.find(
                (m) => m.profile?.full_name?.toLowerCase() === data.title?.toLowerCase()
              );
              if (matched) onSelectMember(matched);
            }
          } catch (_) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 24,
  },
});
