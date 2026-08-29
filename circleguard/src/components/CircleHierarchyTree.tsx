import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import Svg, { Line, Circle as SvgCircle, Defs, LinearGradient, Stop } from 'react-native-svg';
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
  const { colors, isDark } = useThemeStore();

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

  // Celestial Hairline Connector with Luminous Micro-Dots
  const renderColumnBracket = (
    index: number,
    totalColumns: number,
    color: string,
    height: number = 22
  ) => {
    const strokeW = 1.3;
    const strokeAlpha = 0.55;

    if (totalColumns <= 1) {
      return (
        <View style={[styles.bracketBox, { height }]}>
          <Svg height={height} width="100%">
            <Line x1="50%" y1="0" x2="50%" y2={height} stroke={color} strokeOpacity={strokeAlpha} strokeWidth={strokeW} />
            <SvgCircle cx="50%" cy={height} r="2.2" fill={color} />
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
            <Line x1="50%" y1="0" x2="100%" y2="0" stroke={color} strokeOpacity={strokeAlpha} strokeWidth={strokeW} />
          )}
          {isLast && (
            <Line x1="0%" y1="0" x2="50%" y2="0" stroke={color} strokeOpacity={strokeAlpha} strokeWidth={strokeW} />
          )}
          {!isFirst && !isLast && (
            <Line x1="0%" y1="0" x2="100%" y2="0" stroke={color} strokeOpacity={strokeAlpha} strokeWidth={strokeW} />
          )}

          {/* Vertical Drop with Junction Micro-Star */}
          <Line x1="50%" y1="0" x2="50%" y2={height} stroke={color} strokeOpacity={strokeAlpha} strokeWidth={strokeW} />
          <SvgCircle cx="50%" cy={height} r="2.2" fill={color} />
        </Svg>
      </View>
    );
  };

  // Celestial Floating Gem Node Card
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
    const battery = member.batteryPct !== undefined && member.batteryPct !== null ? member.batteryPct : 95;

    return (
      <View key={member.user_id} style={styles.nodeContainer}>
        <SpringTouchable
          style={[
            styles.nodeCard,
            {
              backgroundColor: isDark ? 'rgba(21, 23, 30, 0.85)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: `${roleColor}40`,
            },
            isApex && {
              borderColor: `${roleColor}80`,
              shadowColor: roleColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 6,
            },
          ]}
          onPress={() => onSelectMember(member)}
          scaleTo={0.94}
        >
          {/* Glowing Avatar Orbit */}
          <View style={[styles.avatarOrbitRing, { borderColor: `${roleColor}30` }]}>
            <View style={[styles.avatarCircle, { borderColor: roleColor, backgroundColor: colors.background }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
              )}
              {/* Online Pulse Dot */}
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

          {/* Celestial Role Micro-Pill */}
          <View style={[styles.rolePill, { backgroundColor: `${roleColor}14` }]}>
            <Ionicons name={roleIcon} size={8} color={roleColor} />
            <Text style={[styles.rolePillText, { color: roleColor }]}>{roleTitle}</Text>
          </View>

          {isGhost && (
            <View style={[styles.rolePill, { backgroundColor: 'rgba(168, 85, 247, 0.15)', marginTop: 2 }]}>
              <Text style={[styles.rolePillText, { color: '#C084FC', fontSize: 7 }]}>👻 GHOST</Text>
            </View>
          )}

          {/* Member Name */}
          <Text style={[styles.nameText, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>

          {/* Minimalist Battery Indicator */}
          <View style={styles.batteryRow}>
            <Ionicons
              name={battery <= 20 ? 'battery-dead' : 'battery-charging-outline'}
              size={8}
              color={battery <= 20 ? '#EF4444' : colors.textMuted}
            />
            <Text
              style={[
                styles.batteryText,
                { color: battery <= 20 ? '#EF4444' : colors.textMuted },
              ]}
            >
              {battery}%
            </Text>
          </View>
        </SpringTouchable>

        {/* Move Action (if Leader) */}
        {canManageRanks && !isApex && (
          <TouchableOpacity
            style={[styles.moveBtn, { backgroundColor: `${roleColor}10`, borderColor: `${roleColor}30` }]}
            onPress={() => onMoveBranch && onMoveBranch(member)}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={8.5} color={roleColor} />
            <Text style={[styles.moveBtnText, { color: roleColor }]}>MOVE</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Helper for Member / Guardian node
  const renderGenericChild = (m: CircleMember) => {
    let color = '#34D399';
    let title = 'MEMBER';
    let icon: keyof typeof Ionicons.glyphMap = 'person-outline';

    if (m.role === 'guardian') {
      color = '#38BDF8';
      title = 'GUARDIAN';
      icon = 'shield-outline';
    } else if (m.role === 'co_leader') {
      color = '#C084FC';
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
      {/* Dual-Axis Scrollable Constellation Canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.canvasContent}
      >
        <View style={styles.graphCanvas}>
          {/* ========================================================================= */}
          {/* LAYER 1: CIRCLE LEADER / FOUNDER (ROOT APEX)                              */}
          {/* ========================================================================= */}
          <View style={styles.rootBox}>
            {founder && renderNode(founder, '#F5D061', 'FOUNDER', 'star-sharp', true)}
          </View>

          {/* Central Stem */}
          {topColumns.length > 0 && (
            <View style={styles.rootCenterStem}>
              <Svg height="18" width="100%">
                <Line x1="50%" y1="0" x2="50%" y2="18" stroke="#F5D061" strokeOpacity={0.6} strokeWidth="1.3" />
                <SvgCircle cx="50%" cy="18" r="2.4" fill="#F5D061" />
              </Svg>
            </View>
          )}

          {/* ========================================================================= */}
          {/* LAYER 2 & LAYER 3: CELESTIAL SQUAD BRANCHES                               */}
          {/* ========================================================================= */}
          <View style={styles.branchesRow}>
            {topColumns.map((col, idx) => {
              const totalCols = topColumns.length;

              if (col.type === 'co_leader' && col.coLeader) {
                const subMembers = col.subMembers || [];
                const colWidth = Math.max(105, subMembers.length * 102);

                return (
                  <View key={col.key} style={[styles.branchColumn, { width: colWidth }]}>
                    {/* Top Connector to Leader */}
                    {renderColumnBracket(idx, totalCols, '#F5D061', 20)}

                    {/* Layer 2: Co-Leader Node */}
                    {renderNode(col.coLeader, '#C084FC', 'CO-LEADER', 'shield-checkmark-sharp')}

                    {/* Subordinate Stem & Multi-Children Row */}
                    {subMembers.length > 0 && (
                      <View style={styles.subChildrenBlock}>
                        <View style={styles.coLeaderToChildrenStem}>
                          <Svg height="16" width="100%">
                            <Line x1="50%" y1="0" x2="50%" y2="16" stroke="#C084FC" strokeOpacity={0.6} strokeWidth="1.3" />
                            <SvgCircle cx="50%" cy="16" r="2.2" fill="#C084FC" />
                          </Svg>
                        </View>

                        <View style={styles.childrenRow}>
                          {subMembers.map((child, cIdx) => (
                            <View key={child.user_id} style={[styles.childColumn, { width: subMembers.length === 1 ? '100%' : 92 }]}>
                              {subMembers.length > 1 ? (
                                renderColumnBracket(cIdx, subMembers.length, '#C084FC', 16)
                              ) : (
                                <View style={{ height: 6 }} />
                              )}
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
              const availableWidth = SCREEN_WIDTH - 36;
              const autoChildWidth = directList.length > 0 && directList.length <= 4
                ? Math.max(78, Math.floor(availableWidth / directList.length))
                : 92;
              const directWidth = Math.max(105, directList.length * autoChildWidth);

              return (
                <View key={col.key} style={[styles.branchColumn, { width: directWidth }]}>
                  {renderColumnBracket(idx, totalCols, '#F5D061', 20)}

                  <View style={styles.childrenRow}>
                    {directList.map((child, dIdx) => (
                      <View key={child.user_id} style={[styles.childColumn, { width: autoChildWidth }]}>
                        {directList.length > 1 ? (
                          renderColumnBracket(dIdx, directList.length, '#F5D061', 16)
                        ) : (
                          <View style={{ height: 6 }} />
                        )}
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
    paddingTop: 4,
    marginBottom: 24,
  },
  canvasContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    height: 18,
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
    height: 16,
    alignItems: 'center',
    marginBottom: 0,
  },
  childrenRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  childColumn: {
    alignItems: 'center',
  },
  nodeContainer: {
    alignItems: 'center',
    marginHorizontal: 2,
  },
  nodeCard: {
    width: 82,
    paddingVertical: 9,
    paddingHorizontal: 5,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrbitRing: {
    padding: 2.5,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 5,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8.5,
    height: 8.5,
    borderRadius: 4.25,
    borderWidth: 1.5,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginBottom: 4,
    maxWidth: '96%',
  },
  rolePillText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  nameText: {
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3,
    maxWidth: 72,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  batteryText: {
    fontSize: 8,
    fontWeight: '600',
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  moveBtnText: {
    fontSize: 7.5,
    fontWeight: '700',
  },
});
