import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import SpringTouchable from './SpringTouchable';
import { CircleMember } from '../store/useCircleStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NODE_WIDTH = 84;
const SIBLING_GAP = 18;
const CONNECTOR_HEIGHT = 28;

interface CircleHierarchyTreeProps {
  members: CircleMember[];
  currentUserId?: string;
  isOwner?: boolean;
  canManageRanks?: boolean;
  onSelectMember: (member: CircleMember) => void;
  onMoveBranch?: (member: CircleMember) => void;
}

interface TreeNode {
  member: CircleMember;
  children: TreeNode[];
  subtreeWidth: number;
  totalDirectChildren: number;
}

export default function CircleHierarchyTree({
  members,
  currentUserId,
  isOwner,
  canManageRanks,
  onSelectMember,
  onMoveBranch,
}: CircleHierarchyTreeProps) {
  const { colors, isDark } = useThemeStore();
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // 1. Resolve Founder / Apex
  const founder = useMemo(() => {
    const owners = members.filter(m => m.role === 'owner');
    return owners.length > 0 ? owners[0] : members[0];
  }, [members]);

  const toggleCollapse = (userId: string) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}
    setCollapsedNodes(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const expandAll = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}
    setCollapsedNodes({});
  };

  // 2. Build N-Ary Tree Structure with 100% Guaranteed Member Inclusion
  const treeRoot = useMemo<TreeNode | null>(() => {
    if (!founder || !Array.isArray(members) || members.length === 0) return null;

    // Map parent -> direct children
    const childrenMap = new Map<string, CircleMember[]>();
    members.forEach(m => childrenMap.set(m.user_id, []));

    // Assign each member to their supervisor, or directly under Founder if unassigned/invalid
    members.forEach(m => {
      if (m.user_id === founder.user_id) return;

      const supId = m.supervisor_id;
      const hasValidSupervisor = supId && supId !== m.user_id && members.some(other => other.user_id === supId);

      if (hasValidSupervisor && supId) {
        const list = childrenMap.get(supId) || [];
        list.push(m);
        childrenMap.set(supId, list);
      } else {
        const list = childrenMap.get(founder.user_id) || [];
        list.push(m);
        childrenMap.set(founder.user_id, list);
      }
    });

    const visited = new Set<string>();
    visited.add(founder.user_id);

    const buildSubtree = (parentMember: CircleMember): TreeNode => {
      const isCollapsed = !!collapsedNodes[parentMember.user_id];
      const rawChildren = childrenMap.get(parentMember.user_id) || [];

      // Sort priority: Co-Leaders -> Guardians -> Members
      const sortedChildren = [...rawChildren]
        .filter(c => !visited.has(c.user_id))
        .sort((a, b) => {
          const weights: Record<string, number> = { co_leader: 1, guardian: 2, member: 3, owner: 4 };
          return (weights[a.role] || 9) - (weights[b.role] || 9);
        });

      const totalDirectChildren = sortedChildren.length;

      if (isCollapsed) {
        return {
          member: parentMember,
          children: [],
          subtreeWidth: NODE_WIDTH,
          totalDirectChildren,
        };
      }

      sortedChildren.forEach(c => visited.add(c.user_id));
      const builtChildren = sortedChildren.map(c => buildSubtree(c));

      const totalChildWidth = builtChildren.reduce((sum, ch) => sum + ch.subtreeWidth, 0);
      const gapsWidth = Math.max(0, (builtChildren.length - 1) * SIBLING_GAP);
      const subtreeWidth = Math.max(NODE_WIDTH, totalChildWidth + gapsWidth);

      return {
        member: parentMember,
        children: builtChildren,
        subtreeWidth,
        totalDirectChildren,
      };
    };

    const root = buildSubtree(founder);

    // Safety Catch: Guarantee that any member in the circle not yet visited is attached to the root
    const missingMembers = members.filter(m => !visited.has(m.user_id));
    if (missingMembers.length > 0) {
      missingMembers.forEach(m => visited.add(m.user_id));
      const extraChildren = missingMembers.map(m => buildSubtree(m));
      root.children.push(...extraChildren);
      root.totalDirectChildren += extraChildren.length;

      const totalChildWidth = root.children.reduce((sum, ch) => sum + ch.subtreeWidth, 0);
      const gapsWidth = Math.max(0, (root.children.length - 1) * SIBLING_GAP);
      root.subtreeWidth = Math.max(NODE_WIDTH, totalChildWidth + gapsWidth);
    }

    return root;
  }, [members, founder, collapsedNodes]);

  const hasCollapsedBranches = useMemo(() => {
    return Object.values(collapsedNodes).some(v => v);
  }, [collapsedNodes]);

  if (!treeRoot) return null;

  // Role Tokens
  const getRoleInfo = (m: CircleMember) => {
    switch (m.role) {
      case 'owner':
        return { color: '#F5D061', title: 'FOUNDER', icon: 'star-sharp' as keyof typeof Ionicons.glyphMap };
      case 'co_leader':
        return { color: '#C084FC', title: 'CO-LEADER', icon: 'shield-checkmark-sharp' as keyof typeof Ionicons.glyphMap };
      case 'guardian':
        return { color: '#38BDF8', title: 'GUARDIAN', icon: 'shield-outline' as keyof typeof Ionicons.glyphMap };
      default:
        return { color: '#34D399', title: 'MEMBER', icon: 'person-outline' as keyof typeof Ionicons.glyphMap };
    }
  };

  // Render Single Node Card
  const renderCard = (m: CircleMember, isApex: boolean = false, childCount: number = 0, isCollapsed: boolean = false) => {
    const isSelf = m.user_id === currentUserId;
    const name = m.profile?.full_name || (isSelf ? 'You' : 'Member');
    const initial = name.charAt(0).toUpperCase();
    const avatarUrl = m.profile?.avatar_url;
    const isGhost = !!m.profile?.is_ghost_mode;
    const isHideOnline = !!m.profile?.hide_online_presence;
    const isOnline = (isGhost || isHideOnline) ? false : (m.isOnline ?? true);
    const battery = m.batteryPct !== undefined && m.batteryPct !== null ? m.batteryPct : 95;
    const { color: roleColor, title: roleTitle, icon: roleIcon } = getRoleInfo(m);

    return (
      <View style={styles.nodeWrapper}>
        <SpringTouchable
          style={[
            styles.nodeCard,
            {
              backgroundColor: isDark ? 'rgba(21, 23, 30, 0.90)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isCollapsed ? '#38BDF8' : `${roleColor}45`,
            },
            isApex && {
              borderColor: `${roleColor}90`,
              shadowColor: roleColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
            },
            isCollapsed && {
              shadowColor: '#38BDF8',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 4,
            },
          ]}
          onPress={() => onSelectMember(m)}
          onLongPress={() => {
            if (canManageRanks && !isApex && onMoveBranch) {
              onMoveBranch(m);
            }
          }}
          scaleTo={0.94}
        >
          {/* Avatar with Status */}
          <View style={[styles.avatarOrbitRing, { borderColor: `${roleColor}30` }]}>
            <View style={[styles.avatarCircle, { borderColor: roleColor, backgroundColor: colors.background }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
              )}
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isOnline ? '#10B981' : '#6B7280',
                    borderColor: isDark ? '#15171E' : '#FFFFFF',
                  },
                ]}
              />
            </View>
          </View>

          {/* Role Pill */}
          <View style={[styles.rolePill, { backgroundColor: `${roleColor}18` }]}>
            <Ionicons name={roleIcon} size={7.5} color={roleColor} />
            <Text style={[styles.rolePillText, { color: roleColor }]}>{roleTitle}</Text>
          </View>

          {/* Name */}
          <Text style={[styles.nameText, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>

          {/* Battery */}
          <View style={styles.batteryRow}>
            <Ionicons
              name={battery <= 20 ? 'battery-dead' : 'battery-charging-outline'}
              size={7.5}
              color={battery <= 20 ? '#EF4444' : colors.textMuted}
            />
            <Text style={[styles.batteryText, { color: battery <= 20 ? '#EF4444' : colors.textMuted }]}>
              {battery}%
            </Text>
          </View>
        </SpringTouchable>

        {/* Action Controls Row (Move Button & Collapse Toggle) */}
        <View style={styles.actionsRow}>
          {canManageRanks && !isApex && (
            <TouchableOpacity
              style={[styles.moveBtn, { backgroundColor: `${roleColor}12`, borderColor: `${roleColor}35` }]}
              onPress={() => onMoveBranch && onMoveBranch(m)}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal" size={8.5} color={roleColor} />
              <Text style={[styles.moveBtnText, { color: roleColor }]}>MOVE</Text>
            </TouchableOpacity>
          )}

          {childCount > 0 && (
            <TouchableOpacity
              style={[
                styles.collapseBtn,
                {
                  backgroundColor: isCollapsed ? 'rgba(56, 189, 248, 0.22)' : `${roleColor}15`,
                  borderColor: isCollapsed ? '#38BDF8' : `${roleColor}40`,
                },
              ]}
              onPress={() => toggleCollapse(m.user_id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isCollapsed ? 'eye-outline' : 'chevron-up'}
                size={8.5}
                color={isCollapsed ? '#38BDF8' : roleColor}
              />
              <Text
                style={[
                  styles.collapseBtnText,
                  {
                    color: isCollapsed ? '#38BDF8' : roleColor,
                    fontWeight: isCollapsed ? '800' : '700',
                  },
                ]}
              >
                {isCollapsed ? `SHOW ${childCount} HIDDEN` : `${childCount} ${childCount === 1 ? 'branch' : 'branches'}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Mathematically Perfect Continuous SVG Connector
  const renderConnector = (parentWidth: number, children: TreeNode[], strokeColor: string) => {
    const parentCenterX = parentWidth / 2;
    const midY = CONNECTOR_HEIGHT / 2;

    // Calculate exact X center coordinate of each child inside the parent container
    let cumulativeLeft = 0;
    const childCenters: number[] = [];

    // Calculate total children row width to center children under parent if row < parentWidth
    const totalRowWidth = children.reduce((s, c) => s + c.subtreeWidth, 0) + (children.length - 1) * SIBLING_GAP;
    const rowOffset = Math.max(0, (parentWidth - totalRowWidth) / 2);

    children.forEach((c) => {
      const cCenterX = rowOffset + cumulativeLeft + c.subtreeWidth / 2;
      childCenters.push(cCenterX);
      cumulativeLeft += c.subtreeWidth + SIBLING_GAP;
    });

    const firstChildX = childCenters[0];
    const lastChildX = childCenters[childCenters.length - 1];

    return (
      <View style={[styles.connectorBox, { width: parentWidth, height: CONNECTOR_HEIGHT }]}>
        <Svg width={parentWidth} height={CONNECTOR_HEIGHT}>
          {children.length === 1 ? (
            // Single straight continuous stem from parent to child
            <>
              <Line
                x1={parentCenterX}
                y1={0}
                x2={firstChildX}
                y2={CONNECTOR_HEIGHT}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeOpacity={0.65}
              />
              <SvgCircle cx={firstChildX} cy={CONNECTOR_HEIGHT} r={2.5} fill={strokeColor} />
            </>
          ) : (
            // Enterprise Orthogonal Tree Routing (Stem -> Bus Bar -> Drops)
            <>
              {/* 1. Parent Center Drop to Horizontal Bus Bar */}
              <Line
                x1={parentCenterX}
                y1={0}
                x2={parentCenterX}
                y2={midY}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
              <SvgCircle cx={parentCenterX} cy={midY} r={2} fill={strokeColor} />

              {/* 2. Seamless Continuous Horizontal Bus Bar */}
              <Line
                x1={Math.min(firstChildX, parentCenterX)}
                y1={midY}
                x2={Math.max(lastChildX, parentCenterX)}
                y2={midY}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />

              {/* 3. Perpendicular Vertical Drop to Each Child with Terminal Micro-Star */}
              {childCenters.map((cx, idx) => (
                <React.Fragment key={idx}>
                  <Line
                    x1={cx}
                    y1={midY}
                    x2={cx}
                    y2={CONNECTOR_HEIGHT}
                    stroke={strokeColor}
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                  />
                  <SvgCircle cx={cx} cy={CONNECTOR_HEIGHT} r={2.4} fill={strokeColor} />
                </React.Fragment>
              ))}
            </>
          )}
        </Svg>
      </View>
    );
  };

  // Recursive Tree Node Renderer
  const renderSubtree = (node: TreeNode, isApex: boolean = false): React.ReactNode => {
    const isCollapsed = !!collapsedNodes[node.member.user_id];
    const { color: roleColor } = getRoleInfo(node.member);
    const hasChildren = node.children.length > 0;

    return (
      <View key={node.member.user_id} style={[styles.treeColumn, { width: node.subtreeWidth }]}>
        {/* Node Card */}
        {renderCard(node.member, isApex, node.totalDirectChildren, isCollapsed)}

        {/* Connector and Recursive Children */}
        {hasChildren && !isCollapsed && (
          <>
            {renderConnector(node.subtreeWidth, node.children, roleColor)}

            <View style={styles.childrenRow}>
              {node.children.map((child, idx) => (
                <React.Fragment key={child.member.user_id}>
                  {idx > 0 && <View style={{ width: SIBLING_GAP }} />}
                  {renderSubtree(child, false)}
                </React.Fragment>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Enterprise Guide Toolbar with Show All Hidden Button */}
      <View style={styles.toolbarRow}>
        <View style={styles.toolbarBadge}>
          <Ionicons name="git-network-outline" size={11} color={colors.accentGold} />
          <Text style={[styles.toolbarText, { color: colors.accentGold }]}>ENTERPRISE COMMAND TREE</Text>
        </View>

        <TouchableOpacity
          style={[styles.expandAllBtn, hasCollapsedBranches && styles.expandAllBtnActive]}
          onPress={expandAll}
          activeOpacity={0.7}
        >
          <Ionicons
            name={hasCollapsedBranches ? 'eye-outline' : 'git-branch-outline'}
            size={11}
            color={hasCollapsedBranches ? '#38BDF8' : colors.accentGold}
          />
          <Text style={[styles.expandAllText, { color: hasCollapsedBranches ? '#38BDF8' : colors.accentGold }]}>
            {hasCollapsedBranches ? 'SHOW ALL HIDDEN' : 'ALL BRANCHES VISIBLE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dual-Axis Scrollable Constellation Canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.canvasContent}
      >
        <View style={[styles.graphCanvas, { minWidth: Math.max(SCREEN_WIDTH - 32, treeRoot.subtreeWidth + 32) }]}>
          {renderSubtree(treeRoot, true)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingTop: 2,
    marginBottom: 24,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  toolbarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  toolbarText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  expandAllBtnActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  expandAllText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  canvasContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  graphCanvas: {
    alignItems: 'center',
  },
  treeColumn: {
    alignItems: 'center',
  },
  nodeWrapper: {
    alignItems: 'center',
    width: NODE_WIDTH,
  },
  nodeCard: {
    width: NODE_WIDTH,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrbitRing: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 4,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginBottom: 3,
    maxWidth: '96%',
  },
  rolePillText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  nameText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
    maxWidth: 76,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  batteryText: {
    fontSize: 7.5,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0.8,
  },
  moveBtnText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0.8,
  },
  collapseBtnText: {
    fontSize: 7,
  },
  connectorBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  childrenRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
