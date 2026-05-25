import React from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TextInputProps, 
  ViewStyle 
} from 'react-native';
import { COLORS, COMMON_STYLES } from './Theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  ...textInputProps
}) => {
  return (
    <View style={[COMMON_STYLES.inputGroup, containerStyle]}>
      <Text style={COMMON_STYLES.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        {...textInputProps}
        style={[
          styles.input,
          error ? styles.inputError : null,
          textInputProps.style
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 4,
  },
});
