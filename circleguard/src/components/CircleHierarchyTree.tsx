import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import SpringTouchable from './SpringTouchable';
import { CircleMember } from '../store/useCircleStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NODE_WIDTH = 116;
const SIBLING_GAP = 20;
const CONNECTOR_HEIGHT = 32;

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
  const { width: windowWidth } = useWindowDimensions();
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // 1. Resolve Founder / Apex Node
  const founder = useMemo(() => {
    if (!Array.isArray(members) || members.length === 0) return null;
    const owners = members.filter((m) => m.role === 'owner');
    return owners.length > 0 ? owners[0] : members[0];
  }, [members]);

  const toggleCollapse = (userId: string) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}
    setCollapsedNodes((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const expandAll = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}
    setCollapsedNodes({});
  };

  const collapseAll = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {}
    const newCollapsed: Record<string, boolean> = {};
    members.forEach((m) => {
      newCollapsed[m.user_id] = true;
    });
    setCollapsedNodes(newCollapsed);
  };

  // 2. Build Cycle-Proof, Mathematically Robust Tree Structure
  const treeRoot = useMemo<TreeNode | null>(() => {
    if (!founder || !Array.isArray(members) || members.length === 0) return null;

    const memberMap = new Map<string, CircleMember>();
    members.forEach((m) => memberMap.set(m.user_id, m));

    // Map parent user_id -> direct child CircleMembers
    const childrenMap = new Map<string, CircleMember[]>();
    members.forEach((m) => childrenMap.set(m.user_id, []));

    // Assign each member to their assigned supervisor, preserving full multi-level branches
    // (Leader -> Co-Leader -> Guardian -> Member)
    members.forEach((m) => {
      if (m.user_id === founder.user_id) return;

      const supId = m.supervisor_id;
      let hasCycle = false;

      if (supId && memberMap.has(supId) && supId !== m.user_id) {
        // Detect if following the supervisor chain from supId loops back to m.user_id
        let curr: string | null = supId;
        const seen = new Set<string>([m.user_id]);
        while (curr && memberMap.has(curr)) {
          if (seen.has(curr)) {
            hasCycle = true;
            break;
          }
          seen.add(curr);
          const parentMember = memberMap.get(curr);
          curr = parentMember?.supervisor_id ?? null;
        }
      }

      // If valid supervisor without circular loop, nest under supervisor; otherwise, default to founder
      const targetParentId = supId && memberMap.has(supId) && supId !== m.user_id && !hasCycle
        ? supId
        : founder.user_id;

      const list = childrenMap.get(targetParentId) || [];
      list.push(m);
      childrenMap.set(targetParentId, list);
    });

    const visited = new Set<string>([founder.user_id]);

    const buildSubtree = (parentMember: CircleMember): TreeNode => {
      const isCollapsed = !!collapsedNodes[parentMember.user_id];
      const rawChildren = childrenMap.get(parentMember.user_id) || [];

      // Sort priority: Co-Leaders -> Guardians -> Members
      const sortedChildren = [...rawChildren]
        .filter((c) => !visited.has(c.user_id))
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

      // Mark children visited as we descend to avoid re-entry
      sortedChildren.forEach((c) => visited.add(c.user_id));
      const builtChildren = sortedChildren.map((c) => buildSubtree(c));

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

    // Guaranteed inclusion fallback: attach any orphan not yet visited directly under root
    const missing = members.filter((m) => !visited.has(m.user_id));
    if (missing.length > 0) {
      missing.forEach((m) => visited.add(m.user_id));
      const extra = missing.map((m) => buildSubtree(m));
      root.children.push(...extra);
      root.totalDirectChildren += extra.length;

      const totalChildWidth = root.children.reduce((sum, ch) => sum + ch.subtreeWidth, 0);
      const gapsWidth = Math.max(0, (root.children.length - 1) * SIBLING_GAP);
      root.subtreeWidth = Math.max(NODE_WIDTH, totalChildWidth + gapsWidth);
    }

    return root;
  }, [members, founder, collapsedNodes]);

  const hasCollapsedBranches = useMemo(() => {
    return Object.values(collapsedNodes).some((v) => v);
  }, [collapsedNodes]);

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
  const renderCard = (
    m: CircleMember,
    isApex: boolean = false,
    childCount: number = 0,
    isCollapsed: boolean = false
  ) => {
    const isSelf = m.user_id === currentUserId;
    const name = m.profile?.full_name || (isSelf ? 'You' : 'Member');
    const initial = name.charAt(0).toUpperCase() || 'M';
    const avatarUrl = m.profile?.avatar_url;
    const isGhost = !!m.profile?.is_ghost_mode;
    const isHideOnline = !!m.profile?.hide_online_presence;
    const isOnline = isGhost || isHideOnline ? false : (m.isOnline ?? true);
    const battery = m.batteryPct !== undefined && m.batteryPct !== null ? m.batteryPct : 95;
    const { color: roleColor, title: roleTitle, icon: roleIcon } = getRoleInfo(m);

    return (
      <View style={styles.nodeWrapper}>
        <SpringTouchable
          style={[
            styles.nodeCard,
            {
              backgroundColor: isDark ? 'rgba(21, 23, 30, 0.94)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isCollapsed ? '#38BDF8' : `${roleColor}50`,
            },
            isApex && {
              borderColor: roleColor,
              shadowColor: roleColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 6,
            },
            isCollapsed && {
              borderColor: '#38BDF8',
              shadowColor: '#38BDF8',
              shadowOffset: { width: 0, height: 3 },
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
          scaleTo={0.95}
        >
          {/* Avatar with Status Dot */}
          <View style={[styles.avatarOrbitRing, { borderColor: `${roleColor}40` }]}>
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
            <Ionicons name={roleIcon} size={9} color={roleColor} />
            <Text style={[styles.rolePillText, { color: roleColor }]}>{roleTitle}</Text>
          </View>

          {/* Name */}
          <Text style={[styles.nameText, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>

          {/* Battery & Telemetry Row */}
          <View style={styles.batteryRow}>
            <Ionicons
              name={battery <= 20 ? 'battery-dead' : 'battery-charging-outline'}
              size={9}
              color={battery <= 20 ? '#EF4444' : colors.textMuted}
            />
            <Text style={[styles.batteryText, { color: battery <= 20 ? '#EF4444' : colors.textMuted }]}>
              {battery}%
            </Text>
            {isGhost && (
              <Ionicons name="eye-off" size={9} color="#C084FC" style={{ marginLeft: 2 }} />
            )}
          </View>
        </SpringTouchable>

        {/* Action Controls Row */}
        <View style={styles.actionsRow}>
          {canManageRanks && !isApex && (
            <TouchableOpacity
              style={[styles.moveBtn, { backgroundColor: `${roleColor}14`, borderColor: `${roleColor}40` }]}
              onPress={() => onMoveBranch && onMoveBranch(m)}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal" size={9} color={roleColor} />
              <Text style={[styles.moveBtnText, { color: roleColor }]}>MOVE</Text>
            </TouchableOpacity>
          )}

          {childCount > 0 && (
            <TouchableOpacity
              style={[
                styles.collapseBtn,
                {
                  backgroundColor: isCollapsed ? 'rgba(56, 189, 248, 0.18)' : `${roleColor}15`,
                  borderColor: isCollapsed ? '#38BDF8' : `${roleColor}40`,
                },
              ]}
              onPress={() => toggleCollapse(m.user_id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={9}
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
                {isCollapsed ? `+${childCount} HIDDEN` : `${childCount} ${childCount === 1 ? 'BRANCH' : 'BRANCHES'}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Mathematically Accurate Continuous SVG Connector
  const renderConnector = (parentWidth: number, children: TreeNode[], strokeColor: string) => {
    const parentCenterX = parentWidth / 2;
    const midY = CONNECTOR_HEIGHT / 2;

    let cumulativeLeft = 0;
    const childCenters: number[] = [];

    const totalRowWidth =
      children.reduce((s, c) => s + c.subtreeWidth, 0) + (children.length - 1) * SIBLING_GAP;
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
        <Svg
          width={parentWidth}
          height={CONNECTOR_HEIGHT}
          viewBox={`0 0 ${parentWidth} ${CONNECTOR_HEIGHT}`}
          style={{ width: parentWidth, height: CONNECTOR_HEIGHT }}
        >
          {children.length === 1 ? (
            // Single straight continuous vertical connection
            <>
              <Line
                x1={parentCenterX}
                y1={0}
                x2={firstChildX}
                y2={CONNECTOR_HEIGHT}
                stroke={strokeColor}
                strokeWidth={1.8}
                strokeOpacity={0.75}
              />
              <SvgCircle cx={parentCenterX} cy={2} r={2.2} fill={strokeColor} />
              <SvgCircle cx={firstChildX} cy={CONNECTOR_HEIGHT - 2} r={2.2} fill={strokeColor} />
            </>
          ) : (
            // Orthogonal Tree Bus Bar: Stem -> Bus Bar -> Child Drops
            <>
              {/* Stem from Parent */}
              <Line
                x1={parentCenterX}
                y1={0}
                x2={parentCenterX}
                y2={midY}
                stroke={strokeColor}
                strokeWidth={1.8}
                strokeOpacity={0.75}
              />
              <SvgCircle cx={parentCenterX} cy={2} r={2.2} fill={strokeColor} />
              <SvgCircle cx={parentCenterX} cy={midY} r={2.2} fill={strokeColor} />

              {/* Horizontal Bus Bar spanning across children */}
              <Line
                x1={Math.min(firstChildX, parentCenterX)}
                y1={midY}
                x2={Math.max(lastChildX, parentCenterX)}
                y2={midY}
                stroke={strokeColor}
                strokeWidth={1.8}
                strokeOpacity={0.75}
              />

              {/* Drop down to each child node */}
              {childCenters.map((cx, idx) => (
                <React.Fragment key={idx}>
                  <Line
                    x1={cx}
                    y1={midY}
                    x2={cx}
                    y2={CONNECTOR_HEIGHT}
                    stroke={strokeColor}
                    strokeWidth={1.8}
                    strokeOpacity={0.75}
                  />
                  <SvgCircle cx={cx} cy={CONNECTOR_HEIGHT - 2} r={2.2} fill={strokeColor} />
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

  // Empty state if no members
  if (!members || members.length === 0 || !treeRoot) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="git-network-outline" size={36} color={colors.accentGold} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>FAMILY COMMAND TREE</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No circle members to display in tree. Add members with your invite code to begin building your family protection hierarchy.
        </Text>
      </View>
    );
  }

  // Calculate dynamic canvas minimum width
  const canvasMinWidth = Math.max(windowWidth - 48, treeRoot.subtreeWidth + 48);

  return (
    <View style={styles.wrapper}>
      {/* Enterprise Guide Toolbar */}
      <View style={styles.toolbarRow}>
        <View style={styles.toolbarBadge}>
          <Ionicons name="git-network" size={12} color={colors.accentGold} />
          <Text style={[styles.toolbarText, { color: colors.accentGold }]}>FAMILY COMMAND TREE</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.expandAllBtn, hasCollapsedBranches && styles.expandAllBtnActive]}
            onPress={hasCollapsedBranches ? expandAll : collapseAll}
            activeOpacity={0.7}
          >
            <Ionicons
              name={hasCollapsedBranches ? 'eye-outline' : 'contract-outline'}
              size={11}
              color={hasCollapsedBranches ? '#38BDF8' : colors.accentGold}
            />
            <Text style={[styles.expandAllText, { color: hasCollapsedBranches ? '#38BDF8' : colors.accentGold }]}>
              {hasCollapsedBranches ? 'EXPAND ALL' : 'COLLAPSE ALL'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Legend Bar */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F5D061' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>FOUNDER</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#C084FC' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>CO-LEADER</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>GUARDIAN</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34D399' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>MEMBER</Text>
        </View>
      </View>

      {/* Dual-Axis Scrollable Canvas with Safe Centering */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.canvasContent, { minWidth: canvasMinWidth }]}
      >
        <View style={[styles.graphCanvas, { width: canvasMinWidth }]}>
          {renderSubtree(treeRoot, true)}

          {/* If Circle has only 1 member, show helpful growth guidance node */}
          {members.length === 1 && (
            <View style={styles.singleMemberHelpBox}>
              <View style={[styles.singleMemberHelpStem, { backgroundColor: `${colors.accentGold}50` }]} />
              <View
                style={[
                  styles.singleMemberCard,
                  { backgroundColor: isDark ? 'rgba(21, 23, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)', borderColor: `${colors.accentGold}40` },
                ]}
              >
                <Ionicons name="person-add-outline" size={16} color={colors.accentGold} />
                <Text style={[styles.singleMemberTitle, { color: colors.foreground }]}>GROW YOUR TREE</Text>
                <Text style={[styles.singleMemberSubtitle, { color: colors.textMuted }]}>
                  Share your circle invite code to add guardians and subordinates.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingTop: 4,
    marginBottom: 24,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  toolbarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  toolbarText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  canvasContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'center',
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
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrbitRing: {
    padding: 2,
    borderRadius: 24,
    borderWidth: 1.2,
    marginBottom: 5,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    maxWidth: '96%',
  },
  rolePillText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  nameText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3,
    maxWidth: NODE_WIDTH - 12,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  batteryText: {
    fontSize: 8.5,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    width: '100%',
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
    width: '90%',
  },
  moveBtnText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
    width: '90%',
  },
  collapseBtnText: {
    fontSize: 7.5,
    letterSpacing: 0.3,
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
  emptyContainer: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 17,
  },
  singleMemberHelpBox: {
    alignItems: 'center',
    marginTop: 0,
  },
  singleMemberHelpStem: {
    width: 1.5,
    height: 24,
  },
  singleMemberCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    maxWidth: 200,
  },
  singleMemberTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2,
  },
  singleMemberSubtitle: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12.5,
  },
});
