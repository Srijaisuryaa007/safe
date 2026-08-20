import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import SpringTouchable from './SpringTouchable';
import { CircleMember } from '../store/useCircleStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CircleHierarchyTreeProps {
  members: CircleMember[];
  currentUserId?: string;
  isOwner?: boolean;
  canManageRanks?: boolean;
  onSelectMember: (member: CircleMember) => void;
  onMoveBranch?: (member: CircleMember) => void;
}

export default function CircleHierarchyTree({
  members,
  currentUserId,
  isOwner,
  canManageRanks,
  onSelectMember,
  onMoveBranch,
}: CircleHierarchyTreeProps) {
  const { colors } = useThemeStore();

  // 1. Layer 1: Circle Leader / Founder (Root)
  const owners = members.filter(m => m.role === 'owner');
  const founder = owners.length > 0 ? owners[0] : members[0];

  // Track rendered IDs to strictly guarantee single-instance nodes
  const renderedUserIds = new Set<string>();
  if (founder) renderedUserIds.add(founder.user_id);

  // 2. Layer 2: Top-level Co-Leaders (reporting directly to Leader / unassigned)
  const topCoLeaders = members.filter(
    m =>
      m.role === 'co_leader' &&
      m.user_id !== founder?.user_id &&
      (!m.supervisor_id || (founder && m.supervisor_id === founder.user_id))
  );

  // 3. Subordinates assigned to each top Co-Leader
  const getCoLeaderSubordinates = (coLeaderId: string) => {
    return members.filter(
      m => m.user_id !== coLeaderId && m.user_id !== founder?.user_id && m.supervisor_id === coLeaderId
    );
  };

  // Register all top co-leaders and their direct subordinates
  topCoLeaders.forEach(c => {
    renderedUserIds.add(c.user_id);
    getCoLeaderSubordinates(c.user_id).forEach(sub => renderedUserIds.add(sub.user_id));
  });

  // 4. Direct Leader Children: Any member or guardian not rendered under a Co-Leader
  const directLeaderSubordinates = members.filter(
    m => m.user_id !== founder?.user_id && !renderedUserIds.has(m.user_id)
  );

  // Precision Column-Matched Tree Bracket Connector (Zero-Gap Direct Connect)
  const renderColumnBracket = (
    index: number,
    totalColumns: number,
    color: string,
    height: number = 20
  ) => {
    if (totalColumns <= 1) {
      return (
        <View style={[styles.bracketBox, { height }]}>
          <Svg height={height} width="100%">
            <Line x1="50%" y1="0" x2="50%" y2={height} stroke={color} strokeWidth="2.5" />
          </Svg>
        </View>
      );
    }

    const isFirst = index === 0;
    const isLast = index === totalColumns - 1;

    return (
      <View style={[styles.bracketBox, { height }]}>
        <Svg height={height} width="100%">
          {/* Horizontal Beam */}
          {isFirst && (
            <Line x1="50%" y1="0" x2="100%" y2="0" stroke={color} strokeWidth="2.5" />
          )}
          {isLast && (
            <Line x1="0%" y1="0" x2="50%" y2="0" stroke={color} strokeWidth="2.5" />
          )}
          {!isFirst && !isLast && (
            <Line x1="0%" y1="0" x2="100%" y2="0" stroke={color} strokeWidth="2.5" />
          )}

          {/* Vertical Drop Connecting Directly to Card Top */}
          <Line x1="50%" y1="0" x2="50%" y2={height} stroke={color} strokeWidth="2.5" />
        </Svg>
      </View>
    );
  };

  // Compact Node Card
  const renderNode = (
    member: CircleMember,
    roleColor: string,
    roleTitle: string,
    roleIcon: keyof typeof Ionicons.glyphMap,
    isApex: boolean = false
  ) => {
    const isSelf = member.user_id === currentUserId;
    const name = member.profile?.full_name || (isSelf ? 'You' : 'Member');
    const initial = name.charAt(0).toUpperCase();
    const avatarUrl = member.profile?.avatar_url;
    const isGhost = !!member.profile?.is_ghost_mode;
    const isHideOnline = !!member.profile?.hide_online_presence;
    const isOnline = (isGhost || isHideOnline) ? false : (member.isOnline ?? true);

    return (
      <View key={member.user_id} style={styles.nodeContainer}>
        <SpringTouchable
          style={[
            styles.nodeCard,
            {
              backgroundColor: colors.surface,
              borderColor: roleColor,
              borderWidth: isApex ? 2 : 1.5,
            },
            isApex && {
              shadowColor: roleColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
              elevation: 8,
            },
          ]}
          onPress={() => onSelectMember(member)}
          scaleTo={0.93}
        >
          {/* Avatar Circle */}
          <View style={[styles.avatarCircle, { borderColor: roleColor, backgroundColor: colors.background }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
            )}
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF' }]} />
          </View>

          {/* Role Pill */}
          <View style={[styles.rolePill, { backgroundColor: `${roleColor}20`, borderColor: roleColor }]}>
            <Ionicons name={roleIcon} size={8} color={roleColor} />
            <Text style={[styles.rolePillText, { color: roleColor }]}>{roleTitle}</Text>
          </View>

          {isGhost && (
            <View style={[styles.rolePill, { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: '#A855F7', marginTop: 2 }]}>
              <Text style={[styles.rolePillText, { color: '#A855F7', fontSize: 7.5 }]}>👻 GHOST</Text>
            </View>
          )}

          {/* Name */}
          <Text style={[styles.nameText, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>

          {/* Battery */}
          <View style={styles.batteryRow}>
            <Ionicons name="battery-charging-outline" size={8.5} color={colors.textMuted} />
            <Text style={[styles.batteryText, { color: colors.textMuted }]}>
              {member.batteryPct ? `${member.batteryPct}%` : '100%'}
            </Text>
          </View>
        </SpringTouchable>

        {/* Move / Re-branch Action */}
        {canManageRanks && !isApex && (
          <TouchableOpacity
            style={[styles.moveBtn, { backgroundColor: `${roleColor}15`, borderColor: roleColor }]}
            onPress={() => onMoveBranch && onMoveBranch(member)}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={9} color={roleColor} />
            <Text style={[styles.moveBtnText, { color: roleColor }]}>MOVE</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Helper for Member / Guardian node
  const renderGenericChild = (m: CircleMember) => {
    let color = '#10B981';
    let title = 'MEMBER';
    let icon: keyof typeof Ionicons.glyphMap = 'person-outline';

    if (m.role === 'guardian') {
      color = '#3B82F6';
      title = 'GUARDIAN';
      icon = 'shield-outline';
    } else if (m.role === 'co_leader') {
      color = '#A855F7';
      title = 'CO-LEADER';
      icon = 'shield-checkmark-sharp';
    }

    return renderNode(m, color, title, icon);
  };

  // Build list of top columns (Top Co-Leaders + Direct Leader Group)
  const topColumns: Array<{
    type: 'co_leader' | 'direct_leader';
    key: string;
    coLeader?: CircleMember;
    subMembers?: CircleMember[];
  }> = [];

  topCoLeaders.forEach(coLeader => {
    topColumns.push({
      type: 'co_leader',
      key: coLeader.user_id,
      coLeader,
      subMembers: getCoLeaderSubordinates(coLeader.user_id),
    });
  });

  if (directLeaderSubordinates.length > 0) {
    topColumns.push({
      type: 'direct_leader',
      key: 'direct_leader_pool',
      subMembers: directLeaderSubordinates,
    });
  }

  return (
    <View style={styles.wrapper}>
      {/* Dual-Axis Scrollable Graph Tree Canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.canvasContent}
      >
        <View style={styles.graphCanvas}>
          {/* ========================================================================= */}
          {/* LAYER 1: CIRCLE LEADER / FOUNDER (ROOT APEX)                              */}
          {/* ========================================================================= */}
          <View style={styles.rootBox}>
            {founder && renderNode(founder, '#D4AF37', 'ROOT LEADER', 'star', true)}
          </View>

          {/* Root Central Output Stem */}
          {topColumns.length > 0 && (
            <View style={styles.rootCenterStem}>
              <Svg height="16" width="100%">
                <Line x1="50%" y1="0" x2="50%" y2="16" stroke="#D4AF37" strokeWidth="2.5" />
              </Svg>
            </View>
          )}

          {/* ========================================================================= */}
          {/* LAYER 2 & LAYER 3: TOP BRANCHES WITH SEAMLESS CONNECTORS                  */}
          {/* ========================================================================= */}
          <View style={styles.branchesRow}>
            {topColumns.map((col, idx) => {
              const totalCols = topColumns.length;

              if (col.type === 'co_leader' && col.coLeader) {
                const subMembers = col.subMembers || [];
                const colWidth = Math.max(105, subMembers.length * 105);

                return (
                  <View key={col.key} style={[styles.branchColumn, { width: colWidth }]}>
                    {/* Top Tree Bracket to Leader (Direct Touching Top of Card) */}
                    {renderColumnBracket(idx, totalCols, '#D4AF37', 20)}

                    {/* Layer 2: Co-Leader Node */}
                    {renderNode(col.coLeader, '#A855F7', 'CO-LEADER', 'shield-checkmark-sharp')}

                    {/* Subordinate Stem & Multi-Children Row */}
                    {subMembers.length > 0 && (
                      <View style={styles.subChildrenBlock}>
                        {/* Vertical Stem from Co-Leader to children bracket */}
                        <View style={styles.coLeaderToChildrenStem}>
                          <Svg height="14" width="100%">
                            <Line x1="50%" y1="0" x2="50%" y2="14" stroke="#A855F7" strokeWidth="2.5" />
                          </Svg>
                        </View>

                        {/* Children Row with exact column brackets */}
                        <View style={styles.childrenRow}>
                          {subMembers.map((child, cIdx) => (
                            <View key={child.user_id} style={styles.childColumn}>
                              {renderColumnBracket(cIdx, subMembers.length, '#A855F7', 16)}
                              {renderGenericChild(child)}
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              }

              // Direct Leader Children Column
              const directList = col.subMembers || [];
              const directWidth = Math.max(105, directList.length * 105);

              return (
                <View key={col.key} style={[styles.branchColumn, { width: directWidth }]}>
                  {renderColumnBracket(idx, totalCols, '#D4AF37', 20)}

                  <View style={styles.childrenRow}>
                    {directList.map((child, dIdx) => (
                      <View key={child.user_id} style={styles.childColumn}>
                        {directList.length > 1 && renderColumnBracket(dIdx, directList.length, '#D4AF37', 16)}
                        {renderGenericChild(child)}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingTop: 8,
    marginBottom: 20,
  },
  canvasContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  graphCanvas: {
    minWidth: Math.max(SCREEN_WIDTH - 28, 360),
    alignItems: 'center',
  },
  rootBox: {
    alignItems: 'center',
  },
  rootCenterStem: {
    width: '100%',
    height: 16,
    alignItems: 'center',
    marginBottom: 0,
  },
  branchesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  branchColumn: {
    alignItems: 'center',
  },
  bracketBox: {
    width: '100%',
    marginBottom: 0,
  },
  subChildrenBlock: {
    width: '100%',
    alignItems: 'center',
  },
  coLeaderToChildrenStem: {
    width: '100%',
    height: 14,
    alignItems: 'center',
    marginBottom: 0,
  },
  childrenRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  childColumn: {
    alignItems: 'center',
    width: 105,
  },
  nodeContainer: {
    alignItems: 'center',
  },
  nodeCard: {
    width: 90,
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderRadius: 14,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#0D0E12',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0.8,
    marginBottom: 3,
  },
  rolePillText: {
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  nameText: {
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
    maxWidth: 82,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  batteryText: {
    fontSize: 7.5,
    fontWeight: '600',
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.8,
    marginTop: 3,
  },
  moveBtnText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
