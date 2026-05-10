import React from 'react';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { COLORS } from '../theme';

const AppIcon = ({ name, size = 18, color = COLORS.white, solid = true, style }) => (
    <FontAwesome5 name={name} size={size} color={color} solid={solid} style={style} />
);

export default AppIcon;
