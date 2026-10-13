import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { ImageData } from './img-sphere';

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
  containerSize = Math.min(SCREEN_WIDTH - 32, 380),
  sphereRadius = Math.min((SCREEN_WIDTH - 32) * 0.36, 140),
  autoRotate = true,
  onSelectMember,
  isDark = true,
}: CircleMembersSphereProps) {
  // STRICT RULE: Only authentic circle members are included — NO dummy or stock profiles
  const memberNodes = useMemo(() => {
    return (members || []).map((m, idx) => {
      const name = m.profile?.full_name || 'Circle Member';
      const roleLabel =
        m.role === 'owner'
          ? 'Leader'
          : m.role === 'co_leader'
          ? 'Co-Leader'
          : m.role === 'guardian'
          ? 'Guardian'
          : 'Member';

      const batteryText = m.batteryPct != null ? `${m.batteryPct}% battery` : 'Active';
      const statusText = m.isDriving ? 'Driving' : batteryText;

      // Real avatar URL or dynamic personalized initial avatar (no stock photos)
      const avatarUrl =
        m.profile?.avatar_url && m.profile.avatar_url.trim().length > 0
          ? m.profile.avatar_url
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1B382B&color=3ADFAB&size=256&bold=true`;

      return {
        id: String(m.user_id || m.id || idx),
        src: avatarUrl,
        alt: name,
        title: name,
        description: `${roleLabel} • ${statusText}`,
        role: roleLabel,
        rawMember: m,
      };
    });
  }, [members]);

  // If circle has no members yet, show a clean informative card
  if (memberNodes.length === 0) {
    return (
      <View style={[styles.emptyContainer, isDark && { backgroundColor: '#141D18', borderColor: '#223027' }]}>
        <Text style={[styles.emptyTitle, isDark && { color: '#FFFFFF' }]}>No Members Yet</Text>
        <Text style={[styles.emptySubtitle, isDark && { color: '#8E9E94' }]}>
          Invite family members using your Circle Code to see them in the 3D Sphere.
        </Text>
      </View>
    );
  }

  // Dynamic scale calculation based purely on authentic member count
  const count = memberNodes.length;
  const baseScale = count <= 3 ? 0.28 : count <= 6 ? 0.23 : count <= 12 ? 0.18 : 0.14;
  const activeRadius = count <= 3 ? sphereRadius * 0.85 : sphereRadius;

  // Web Implementation: Renders directly with DOM if on web
  if (Platform.OS === 'web') {
    try {
      const SphereImageGrid = require('./img-sphere').default;
      const webImages: ImageData[] = memberNodes.map((n) => ({
        id: n.id,
        src: n.src,
        alt: n.alt,
        title: n.title,
        description: n.description,
      }));

      return (
        <View style={[styles.container, { width: containerSize, height: containerSize }]}>
          <SphereImageGrid
            images={webImages}
            containerSize={containerSize}
            sphereRadius={activeRadius}
            autoRotate={autoRotate}
            dragSensitivity={0.8}
            momentumDecay={0.96}
            maxRotationSpeed={6}
            baseImageScale={baseScale}
            hoverScale={1.25}
            perspective={1000}
            autoRotateSpeed={0.25}
          />
        </View>
      );
    } catch (_) {}
  }

  // Mobile Native (iOS / Android): Interactive 3D Sphere rendered in hardware-accelerated WebView
  const htmlContent = `<!DOCTYPE html>
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
    .node-wrapper {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.15s ease-out;
      transform-origin: center center;
    }
    .node-avatar {
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      border: 2px solid ${isDark ? '#3ADFAB' : '#059669'};
      background: ${isDark ? '#16201B' : '#E5E7EB'};
    }
    .node-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      pointer-events: none;
    }
    .node-label {
      margin-top: 4px;
      font-size: 11px;
      font-weight: 700;
      color: ${isDark ? '#FFFFFF' : '#111827'};
      background: ${isDark ? 'rgba(20, 29, 24, 0.9)' : 'rgba(255, 255, 255, 0.92)'};
      padding: 2px 7px;
      border-radius: 99px;
      white-space: nowrap;
      border: 1px solid ${isDark ? 'rgba(58, 223, 171, 0.35)' : 'rgba(0,0,0,0.1)'};
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    #modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    #modal.active { display: flex; animation: fadeIn 0.22s ease-out; }
    #modal-card {
      background: ${isDark ? '#1C2621' : '#FFFFFF'};
      border: 1px solid ${isDark ? '#2B3D34' : '#E5E7EB'};
      border-radius: 22px;
      max-width: 270px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0,0,0,0.55);
      text-align: center;
      color: ${isDark ? '#FFFFFF' : '#111827'};
      animation: popIn 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #modal-img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
      background: ${isDark ? '#131B17' : '#F3F4F6'};
    }
    #modal-info { padding: 16px; }
    #modal-title { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
    #modal-desc { font-size: 13px; color: ${isDark ? '#3ADFAB' : '#059669'}; font-weight: 600; }
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
    const members = ${JSON.stringify(memberNodes)};
    const containerSize = ${containerSize};
    const sphereRadius = ${activeRadius};
    const baseScale = ${baseScale};
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

    // Distribute actual circle members evenly across sphere
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleInc = 2 * Math.PI / goldenRatio;
    const positions = [];

    for (let i = 0; i < members.length; i++) {
      if (members.length === 1) {
        positions.push({ theta: 0, phi: 90, radius: sphereRadius * 0.4 });
        break;
      }
      const t = i / members.length;
      const inc = Math.acos(1 - 2 * t);
      const az = angleInc * i;
      let phi = inc * (180 / Math.PI);
      let theta = (az * (180 / Math.PI)) % 360;

      phi = 25 + (phi / 180) * 130;
      positions.push({ theta, phi, radius: sphereRadius });
    }

    const root = document.getElementById('sphere-root');
    const nodes = [];

    members.forEach((m, idx) => {
      const el = document.createElement('div');
      el.className = 'node-wrapper';
      el.innerHTML = '<div class="node-avatar"><img src="' + m.src + '" /></div><div class="node-label">' + m.title + '</div>';
      el.onclick = () => {
        if (!hasMoved) openModal(m);
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

        const el = nodes[i];
        const avatarEl = el.querySelector('.node-avatar');

        const depthScale = (z + sphereRadius) / (2 * sphereRadius);
        const scale = 0.55 + depthScale * 0.45;
        const size = baseImageSize * scale;

        avatarEl.style.width = size + 'px';
        avatarEl.style.height = size + 'px';

        el.style.left = (containerSize / 2 + x) + 'px';
        el.style.top = (containerSize / 2 + y) + 'px';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.zIndex = Math.round(1000 + z);
        el.style.opacity = Math.max(0.35, 0.45 + depthScale * 0.55);
      }
    }

    function animate() {
      if (!isDragging) {
        velocity.x *= momentumDecay;
        velocity.y *= momentumDecay;

        rotation.y = (rotation.y + autoSpeed + velocity.y) % 360;
        rotation.x = Math.max(-50, Math.min(50, rotation.x + velocity.x));
      }

      render();
      requestAnimationFrame(animate);
    }

    // Touch Handling
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
      rotation.x = Math.max(-50, Math.min(50, rotation.x - dy * dragSens));

      velocity = { x: -dy * dragSens * 0.35, y: dx * dragSens * 0.35 };
      lastPos = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    root.addEventListener('touchend', () => {
      isDragging = false;
    });

    function openModal(member) {
      document.getElementById('modal-img').src = member.src;
      document.getElementById('modal-title').innerText = member.title;
      document.getElementById('modal-desc').innerText = member.description;
      document.getElementById('modal').classList.add('active');

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_MEMBER', id: member.id }));
      }
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }

    animate();
  </script>
</body>
</html>`;

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
              const matched = members.find((m) => String(m.user_id || m.id) === String(data.id));
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
  emptyContainer: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#151C27',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
