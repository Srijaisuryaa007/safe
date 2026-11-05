import { createNavigationContainerRef } from '@react-navigation/native';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  CreateCircle: undefined;
  JoinCircle: undefined;
  SOSAlert: undefined;
  SafePlaces: undefined;
  Activity: undefined;
  LocationHistory: { member?: any; memberId?: string; circleId?: string } | undefined;
  DrivingReports: { member?: any; memberId?: string; circleId?: string } | undefined;
  Chat: {
    member?: any;
    memberId?: string;
    memberName?: string;
    taggedMember?: any;
    initialText?: string;
    filterMemberId?: string;
    onlyFilter?: boolean;
    circle_id?: string;
  } | undefined;
  Profile: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

