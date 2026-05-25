import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle 
} from 'react-native';
import { COLORS, TYPOGRAPHY, SHADOWS } from './Theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'outline' | 'danger';
  size?: 'normal' | 'large' | 'small';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon,
  style,
}) => {
  const getButtonStyles = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];
    
    // Size
    if (size === 'large') list.push(styles.large);
    else if (size === 'small') list.push(styles.small);
    else list.push(styles.normal);

    // Variant
    switch (variant) {
      case 'secondary':
        list.push(styles.secondary);
        break;
      case 'success':
        list.push(styles.success);
        break;
      case 'danger':
        list.push(styles.danger);
        break;
      case 'outline':
        list.push(styles.outline);
        break;
      case 'primary':
      default:
        list.push(styles.primary);
        break;
    }

    if (disabled) list.push(styles.disabled);
    if (style) list.push(style);

    return list;
  };

  const getTextStyles = (): TextStyle[] => {
    const list: TextStyle[] = [TYPOGRAPHY.buttonText];

    if (variant === 'outline') {
      list.push({ color: COLORS.secondary });
    } else {
      list.push({ color: COLORS.white });
    }

    if (size === 'large') {
      list.push({ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 });
    } else if (size === 'small') {
      list.push({ fontSize: 12 });
    }

    return list;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={getButtonStyles()}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.secondary : COLORS.white} />
      ) : (
        <React.Fragment>
          {icon && <React.Fragment>{icon}</React.Fragment>}
          <Text style={getTextStyles()}>{title}</Text>
        </React.Fragment>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 8,
  },
  // Sizes
  small: {
    height: 38,
    paddingHorizontal: 12,
  },
  normal: {
    height: 46,
    paddingHorizontal: 16,
  },
  large: {
    height: 52, // 52px high touch target - comfortable for plumbers, electricians, etc.
    paddingHorizontal: 24,
    ...SHADOWS.sm,
  },
  // Variants
  primary: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  secondary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  success: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  danger: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
    borderWidth: 1.5,
  },
  disabled: {
    backgroundColor: '#CBD5E1',
    borderColor: '#CBD5E1',
    opacity: 0.6,
  },
});
