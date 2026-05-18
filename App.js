import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LiveClassPipProvider } from './src/contexts/LiveClassPipContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import ToastHost, { Toast } from './src/components/Toast';
import LiveClassMiniPip from './src/components/LiveClassMiniPip';
import { onForegroundMessage } from './src/services/notificationService';

// Auth Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';

// Admin Screens
import AdminDashboard from './src/screens/admin/AdminDashboard';
import BatchList from './src/screens/admin/BatchList';
import CreateBatch from './src/screens/admin/CreateBatch';
import StudentList from './src/screens/admin/StudentList';
import AddStudent from './src/screens/admin/AddStudent';
import AdminClasses from './src/screens/admin/AdminClasses';
import AddTeacher from './src/screens/admin/AddTeacher';
import TeacherList from './src/screens/admin/TeacherList';
import BatchDetail from './src/screens/admin/BatchDetail';
import CreateStudent from './src/screens/admin/CreateStudent';
import AddCourse from './src/screens/admin/AddCourse';

// Teacher Screens
import TeacherDashboard from './src/screens/teacher/TeacherDashboard';
import MyClasses from './src/screens/teacher/MyClasses';
import ScheduleClass from './src/screens/teacher/ScheduleClass';
import LiveClass from './src/screens/teacher/LiveClass';
import AttendanceScreen from './src/screens/teacher/AttendanceScreen';
import RecordingsScreen from './src/screens/teacher/RecordingsScreen';
import TeacherStudents from './src/screens/teacher/TeacherStudents';
import TeacherNotes from './src/screens/teacher/TeacherNotes';
import AddNote from './src/screens/teacher/AddNote';

// Student Screens
import StudentDashboard from './src/screens/student/StudentDashboard';
import JoinClass from './src/screens/student/JoinClass';
import StudentAttendance from './src/screens/student/StudentAttendance';
import AIChat from './src/screens/student/AIChat';
import StudentNotes from './src/screens/student/StudentNotes';
import StudentCourses from './src/screens/student/StudentCourses';
import CourseDetail from './src/screens/student/CourseDetail';
import Payment from './src/screens/student/Payment';

// Shared Screens
import NotificationsScreen from './src/screens/NotificationsScreen';
import VideoPlayer from './src/screens/VideoPlayer';
import NoteDetail from './src/screens/NoteDetail';
import WaitingScreen from './src/screens/WaitingScreen';
import Profile from './src/screens/Profile';
import EditProfileInfo from './src/screens/EditProfileInfo';
import ProfileInfoScreen from './src/screens/ProfileInfoScreen';
import ProfilePassword from './src/screens/ProfilePassword';
import ReportBug from './src/screens/ReportBug';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const NotificationListener = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onForegroundMessage(notification => {
      if (!notification?.title && !notification?.body) return;
      const screen = notification?.data?.screen;
      const noteId = notification?.data?.noteId;
      if (screen === 'NoteDetail' && noteId) {
        Toast.show({
          type: 'info',
          title: notification.title || 'New note',
          message: notification.body,
          duration: 7000,
          actionLabel: 'View',
          onAction: () => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('NoteDetail', { noteId });
            }
          },
        });
        return;
      }
      Toast.info(notification.body, notification.title || 'Notification');
    });
  }, [user?.uid]);

  return null;
};

export default function App() {
  return (
    <SafeAreaProvider>
    <ThemeProvider>
    <AuthProvider>
      <LiveClassPipProvider>
      <NavigationContainer ref={navigationRef}>
        <NotificationListener />
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          {/* Auth */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* Admin */}
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
          <Stack.Screen name="BatchList" component={BatchList} />
          <Stack.Screen name="CreateBatch" component={CreateBatch} />
          <Stack.Screen name="StudentList" component={StudentList} />
          <Stack.Screen name="AddStudent" component={AddStudent} />
          <Stack.Screen name="AdminClasses" component={AdminClasses} />
          <Stack.Screen name="AddTeacher" component={AddTeacher} />
          <Stack.Screen name="TeacherList" component={TeacherList} />
          <Stack.Screen name="BatchDetail" component={BatchDetail} />
          <Stack.Screen name="CreateStudent" component={CreateStudent} />
          <Stack.Screen name="AddCourse" component={AddCourse} />

          {/* Teacher */}
          <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
          <Stack.Screen name="MyClasses" component={MyClasses} />
          <Stack.Screen name="ScheduleClass" component={ScheduleClass} />
          <Stack.Screen name="LiveClass" component={LiveClass} options={{ animation: 'fade' }} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} />
          <Stack.Screen name="Recordings" component={RecordingsScreen} />
          <Stack.Screen name="TeacherStudents" component={TeacherStudents} />
          <Stack.Screen name="TeacherNotes" component={TeacherNotes} />
          <Stack.Screen name="AddNote" component={AddNote} />

          {/* Student */}
          <Stack.Screen name="StudentDashboard" component={StudentDashboard} />
          <Stack.Screen name="JoinClass" component={JoinClass} />
          <Stack.Screen name="AIChat" component={AIChat} />
          <Stack.Screen name="StudentRecordings">
            {(props) => <RecordingsScreen {...props} route={{ ...props.route, params: { ...props.route.params, role: 'student' } }} />}
          </Stack.Screen>
          <Stack.Screen name="StudentAttendance" component={StudentAttendance} />
          <Stack.Screen name="StudentNotes" component={StudentNotes} />
          <Stack.Screen name="StudentCourses" component={StudentCourses} />
          <Stack.Screen name="CourseDetail" component={CourseDetail} />
          <Stack.Screen name="Payment" component={Payment} options={{ animation: 'slide_from_bottom' }} />

          {/* Shared */}
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="VideoPlayer" component={VideoPlayer} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="NoteDetail" component={NoteDetail} />
          <Stack.Screen name="Waiting" component={WaitingScreen} />
          <Stack.Screen name="Profile" component={Profile} />
          <Stack.Screen name="EditProfileInfo" component={EditProfileInfo} />
          <Stack.Screen name="ProfilePassword" component={ProfilePassword} />
          <Stack.Screen name="ProfileInfo" component={ProfileInfoScreen} />
          <Stack.Screen name="ReportBug" component={ReportBug} />
        </Stack.Navigator>
        <LiveClassMiniPip navigationRef={navigationRef} />
      </NavigationContainer>
      <ToastHost />
      </LiveClassPipProvider>
    </AuthProvider>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}
