import { Children, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const colors = {
  paper: '#FAF8F4',
  sidebar: '#F0EDE6',
  ink: '#272B25',
  muted: '#696C61',
  line: '#E0DED5',
  white: '#FFFFFF',
  orange: '#A84621',
  orangeSoft: '#F8E9DE',
  green: '#3F6046',
  greenSoft: '#EAF0E7',
  red: '#AC3931',
};

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

type ButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ children, onPress, label, variant = 'secondary', disabled = false, style }: ButtonProps) {
  const [focus, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={({ pressed }) => [s.button, s[variant], style, focus && s.focus, pressed && !disabled && s.pressed, disabled && s.disabled]}
    >
      <View style={s.buttonContent}>
        {Children.map(children, (child) => typeof child === 'string' || typeof child === 'number'
          ? <Text style={[s.buttonText, (variant === 'primary' || variant === 'danger') && { color: colors.white }]}>{child}</Text>
          : child)}
      </View>
    </Pressable>
  );
}

export function Icon({ name, color = colors.ink, size = 20 }: { name: 'all' | 'today' | 'upcoming' | 'important' | 'completed' | 'search' | 'plus' | 'refresh' | 'close' | 'check'; color?: string; size?: number }) {
  const stroke = { backgroundColor: color, position: 'absolute' as const };
  const box = { borderColor: color, borderWidth: 1.6, position: 'absolute' as const };
  return (
    <View accessible={false} style={{ width: size, height: size, flexShrink: 0 }}>
      {name === 'plus' || name === 'close' ? <>
        <View style={[stroke, { width: size * .72, height: 1.7, left: size * .14, top: size * .46, transform: [{ rotate: name === 'close' ? '45deg' : '0deg' }] }]} />
        <View style={[stroke, { width: 1.7, height: size * .72, left: size * .46, top: size * .14, transform: [{ rotate: name === 'close' ? '45deg' : '0deg' }] }]} />
      </> : name === 'check' || name === 'completed' ? <View style={[box, { width: size * .65, height: size * .35, borderTopWidth: 0, borderRightWidth: 0, left: size * .17, top: size * .25, transform: [{ rotate: '-45deg' }] }]} /> : name === 'search' ? <>
        <View style={[box, { width: size * .58, height: size * .58, borderRadius: size, top: 1, left: 1 }]} />
        <View style={[stroke, { width: size * .42, height: 1.7, left: size * .5, top: size * .72, transform: [{ rotate: '45deg' }] }]} />
      </> : name === 'important' ? <>
        <View style={[stroke, { width: 1.7, height: size * .8, left: size * .18, top: size * .1 }]} />
        <View style={[box, { width: size * .57, height: size * .4, left: size * .2, top: size * .1, borderTopRightRadius: 3 }]} />
      </> : name === 'all' ? [0, 1, 2].map((i) => <View key={i} style={[stroke, { height: 1.7, width: size * .8, left: size * .1, top: size * (.18 + i * .28) }]} />) : name === 'refresh' ? <>
        <View style={[box, { width: size * .72, height: size * .72, borderRadius: size, top: size * .14, left: size * .14, borderRightColor: 'transparent' }]} />
        <View style={[box, { width: size * .28, height: size * .28, right: size * .03, top: size * .1, borderLeftWidth: 0, borderTopWidth: 0 }]} />
      </> : <>
        <View style={[box, { width: size * .77, height: size * .72, top: size * .19, left: size * .1, borderRadius: 3 }]} />
        <View style={[stroke, { width: size * .7, height: 1.7, left: size * .14, top: size * .4 }]} />
        {[.3, .65].map((x) => <View key={x} style={[stroke, { width: 1.7, height: size * .25, left: size * x, top: size * .08 }]} />)}
        {name === 'upcoming' && <View style={[stroke, { width: size * .22, height: 1.7, top: size * .61, left: size * .38 }]} />}
      </>}
    </View>
  );
}

const s = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  primary: { backgroundColor: colors.orange, borderColor: colors.orange },
  secondary: { backgroundColor: colors.white },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.red, borderColor: colors.red },
  buttonText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  focus: { borderColor: colors.orange, outlineColor: colors.orange, outlineWidth: 2, outlineOffset: 3 },
  pressed: { opacity: .78 },
  disabled: { opacity: .45 },
});
