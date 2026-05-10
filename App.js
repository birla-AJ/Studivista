import React, { useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import { ToastHost } from './src/components/Toast';
import FloatingChatButton from './src/components/FloatingChatButton';
import Profile from './src/screens/Profile';

// Auth Screens
import SplashScreen from './src/screens/SplashScreen';
import RoleSelectScreen from './src/screens/RoleSelectScreen';
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

// Shared Screens
import NotificationsScreen from './src/screens/NotificationsScreen';
import VideoPlayer from './src/screens/VideoPlayer';
import NoteDetail from './src/screens/NoteDetail';
import WaitingScreen from './src/screens/WaitingScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState('');

  return (
    <ThemeProvider>
    <AuthProvider>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={() => {
          const r = navigationRef.current?.getCurrentRoute?.();
          setCurrentRoute(r?.name || '');
        }}
        onReady={() => {
          const r = navigationRef.current?.getCurrentRoute?.();
          setCurrentRoute(r?.name || '');
        }}
      >
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          {/* Auth */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* Admin — bottom-tab targets get animation: 'none' so tab switching is instant */}
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ animation: 'none' }} />
          <Stack.Screen name="BatchList" component={BatchList} options={{ animation: 'none' }} />
          <Stack.Screen name="CreateBatch" component={CreateBatch} />
          <Stack.Screen name="StudentList" component={StudentList} options={{ animation: 'none' }} />
          <Stack.Screen name="AddStudent" component={AddStudent} />
          <Stack.Screen name="AdminClasses" component={AdminClasses} options={{ animation: 'none' }} />
          <Stack.Screen name="AddTeacher" component={AddTeacher} />
          <Stack.Screen name="TeacherList" component={TeacherList} options={{ animation: 'none' }} />
          <Stack.Screen name="BatchDetail" component={BatchDetail} />
          <Stack.Screen name="CreateStudent" component={CreateStudent} />

          {/* Teacher — tab targets are animation: 'none' */}
          <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} options={{ animation: 'none' }} />
          <Stack.Screen name="MyClasses" component={MyClasses} options={{ animation: 'none' }} />
          <Stack.Screen name="ScheduleClass" component={ScheduleClass} />
          <Stack.Screen name="LiveClass" component={LiveClass} options={{ animation: 'fade' }} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="Recordings" component={RecordingsScreen} />
          <Stack.Screen name="TeacherStudents" component={TeacherStudents} options={{ animation: 'none' }} />
          <Stack.Screen name="TeacherNotes" component={TeacherNotes} />
          <Stack.Screen name="AddNote" component={AddNote} />

          {/* Student — tab targets are animation: 'none' */}
          <Stack.Screen name="StudentDashboard" component={StudentDashboard} options={{ animation: 'none' }} />
          <Stack.Screen name="JoinClass" component={JoinClass} options={{ animation: 'none' }} />
          <Stack.Screen name="AIChat" component={AIChat} options={{ animation: 'none' }} />
          <Stack.Screen name="StudentRecordings" options={{ animation: 'none' }}>
            {(props) => <RecordingsScreen {...props} route={{ ...props.route, params: { ...props.route.params, role: 'student' } }} />}
          </Stack.Screen>
          <Stack.Screen name="StudentAttendance" component={StudentAttendance} options={{ animation: 'none' }} />
          <Stack.Screen name="StudentNotes" component={StudentNotes} />

          {/* Shared */}
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="Profile" component={Profile} options={{ animation: 'none' }} />
          <Stack.Screen name="VideoPlayer" component={VideoPlayer} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="NoteDetail" component={NoteDetail} />
          <Stack.Screen name="Waiting" component={WaitingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <FloatingChatButton currentRoute={currentRoute} navigationRef={navigationRef} />
      <ToastHost />
    </AuthProvider>
    </ThemeProvider>
  );
}
