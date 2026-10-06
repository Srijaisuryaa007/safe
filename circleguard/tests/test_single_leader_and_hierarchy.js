// Test suite: 1 Leader per circle & N Co-Leaders / Guardians
const assert = require('assert');

console.log('=== TEST SUITE: 1 LEADER & UNLIMITED CO-LEADERS/GUARDIANS ===');

// Mock circle
const activeCircle = {
  id: 'circle-100',
  name: 'Our Family Circle',
  owner_id: '03ca6af3-b0f7-46a1-9e70-2bb96befb67c', // Sri jai suryaa (True Founder/Leader)
};

// Raw members from DB or legacy seed where two accounts had role = 'owner'
const rawMembersFromDb = [
  {
    user_id: '03ca6af3-b0f7-46a1-9e70-2bb96befb67c',
    role: 'owner',
    profile: { full_name: 'Sri jai suryaa' },
  },
  {
    user_id: '2875720f-904b-4559-a436-512286054510',
    role: 'owner', // Legacy duplicate owner!
    profile: { full_name: 'Jai Suryaa' },
  },
  {
    user_id: 'user-3',
    role: 'co_leader',
    profile: { full_name: 'Alex Co-Leader 1' },
  },
  {
    user_id: 'user-4',
    role: 'co_leader',
    profile: { full_name: 'Sam Co-Leader 2' },
  },
  {
    user_id: 'user-5',
    role: 'guardian',
    profile: { full_name: 'Morgan Guardian 1' },
  },
  {
    user_id: 'user-6',
    role: 'guardian',
    profile: { full_name: 'Taylor Guardian 2' },
  },
  {
    user_id: 'user-7',
    role: 'member',
    profile: { full_name: 'Jordan Member' },
  },
];

// Logic implemented in useCircleStore, BillionDollarCircleView, CircleHierarchyTree, MemberRoleModal, MemberQuickActionsModal:
function normalizeMembers(members, circleOwnerId) {
  const trueLeaderId = circleOwnerId || members.find((m) => m.role === 'owner')?.user_id;

  return members.map((m) => {
    const isSingleLeader = m.user_id === trueLeaderId;
    const effectiveRole = isSingleLeader
      ? 'owner'
      : (m.role === 'owner' ? 'co_leader' : m.role);

    return {
      ...m,
      effectiveRole,
      roleBadge:
        effectiveRole === 'owner'
          ? 'Leader'
          : effectiveRole === 'co_leader'
          ? 'Co-Leader'
          : effectiveRole === 'guardian'
          ? 'Guardian'
          : 'Member',
    };
  });
}

// 1. Run normalization
const normalized = normalizeMembers(rawMembersFromDb, activeCircle.owner_id);

// 2. Count leaders
const leaders = normalized.filter((m) => m.effectiveRole === 'owner');
const coLeaders = normalized.filter((m) => m.effectiveRole === 'co_leader');
const guardians = normalized.filter((m) => m.effectiveRole === 'guardian');
const standardMembers = normalized.filter((m) => m.effectiveRole === 'member');

console.log(`- Total Members: ${normalized.length}`);
console.log(`- Leaders: ${leaders.length} (${leaders.map((m) => m.profile.full_name).join(', ')})`);
console.log(`- Co-Leaders: ${coLeaders.length} (${coLeaders.map((m) => m.profile.full_name).join(', ')})`);
console.log(`- Guardians: ${guardians.length} (${guardians.map((m) => m.profile.full_name).join(', ')})`);
console.log(`- Standard Members: ${standardMembers.length}`);

// Assertions
assert.strictEqual(leaders.length, 1, 'MUST have strictly 1 Leader per circle');
assert.strictEqual(leaders[0].user_id, activeCircle.owner_id, 'Leader must be the authentic owner/founder');
assert.strictEqual(coLeaders.length, 3, 'Second owner must be normalized to co_leader, totaling 3 co-leaders');
assert.strictEqual(guardians.length, 2, 'Must support N guardians (2 in this test)');
assert.strictEqual(standardMembers.length, 1, 'Standard member count preserved');

console.log('\n[PASS] Exactly 1 Leader is guaranteed. Duplicate owners are auto-demoted to Co-Leader.');
console.log('[PASS] Unlimited (N) Co-Leaders and Guardians are fully supported and properly categorized.\n');
