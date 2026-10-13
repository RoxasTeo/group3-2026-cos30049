// React hooks: useState remembers changing values; useRef keeps a reference to an input.
import { useRef, useState } from 'react';
// React Native provides the layout, text, input, button, and scrolling components.
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
// Safe-area insets tell us how much space to leave for notches and system bars.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// SVG components draw scalable illustrations directly from coordinates.
import Svg, { Circle, G, Path } from 'react-native-svg';

// Shared colour palette. Reusing these values keeps the screen visually consistent.
const colors = { forest: '#173F35', cream: '#FAF9F4', ink: '#203C33', muted: '#64756C', lime: '#D8E8AD', border: '#DCE2D9' };

// Reusable icon: <Icon name="mail" /> draws an envelope.
// The TypeScript union ('leaf' | 'mail' | ...) limits name to these five choices.
// color is optional (color?: string); it defaults to colors.muted.
function Icon({ name, color = colors.muted }: { name: 'leaf' | 'mail' | 'lock' | 'eye' | 'arrow'; color?: string }) {
  // Each string describes a shape using SVG pen commands.
  // M = move, L = line, H/V = horizontal/vertical line, C/Q = curves,
  // S = smooth cubic curve, A = arc, Z = close shape.
  // Uppercase coordinates are absolute; lowercase coordinates are relative.
  const paths = {
    leaf: 'M5 20C5 12 9 6 20 3c1 10-3 16-10 15M5 20l9-10',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
    lock: 'M6 10h12v11H6zM8 10V6a4 4 0 018 0v4M12 14v3',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 11-6 0 3 3 0 016 0',
    arrow: 'M4 12h16M14 6l6 6-6 6',
  };
  // Display at 22 x 22 using a 24 x 24 coordinate grid. paths[name] selects the shape.
  // fill="none" leaves the inside empty; stroke sets the outline colour.
  // The icon is decorative; the surrounding button/input supplies an accessible label.
  return <Svg width={22} height={22} viewBox="0 0 24 24" aria-hidden={true}><Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

// Decorative plant illustration used in the green header; no image download is needed.
function BotanicalArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 220 280" aria-hidden={true}>
      {/* viewBox defines a 220 x 280 drawing grid; 100% fills the parent container. */}
      {/* cx/cy locate the circle centre; r is its radius. Opacity .09 means 9% opacity. */}
      <Circle cx="145" cy="132" r="94" fill="none" stroke="#FFFFFF" strokeOpacity=".09" />
      <Circle cx="145" cy="132" r="72" fill="none" stroke="#FFFFFF" strokeOpacity=".09" />
      {/* G groups the stem and leaves so they share an outline style. */}
      <G stroke="#A9BE85" strokeWidth="1.3" strokeLinejoin="round">
        {/* Stem: move to (67, 282), then curve to (157, 32) using control point (123, 164). */}
        <Path d="M67 282Q123 164 157 32" fill="none" />
        {/* Closed curved paths form the leaves; each fill supplies a different green. */}
        <Path d="M149 63Q117 31 158 9Q179 43 149 63Z" fill="#829C69" />
        <Path d="M139 96Q80 89 93 40Q139 51 139 96Z" fill="#6D8C60" />
        <Path d="M134 116Q194 110 202 60Q150 62 134 116Z" fill="#A9BE85" />
        <Path d="M120 151Q64 141 64 90Q117 98 120 151Z" fill="#729567" />
        <Path d="M110 175Q178 179 188 124Q134 122 110 175Z" fill="#94AD76" />
        <Path d="M94 211Q35 195 37 145Q88 151 94 211Z" fill="#5E855C" />
        <Path d="M83 237Q145 245 167 194Q114 179 83 237Z" fill="#7E9A67" />
      </G>
      {/* Thin, partially transparent lines draw the veins inside the leaves. */}
      <G stroke="#D3DDB6" strokeOpacity=".5" strokeWidth=".9" fill="none">
        <Path d="M149 63L158 18M139 96L99 49M134 116L194 71M120 151L70 100M110 175L180 135M94 211L44 154M83 237L156 201" />
      </G>
    </Svg>
  );
}

// Main screen component. Updating its state causes React to render the changed UI.
export default function LoginScreen() {
  // Read device spacing and width so the layout can adapt to different phones.
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // This reference lets the email keyboard's Next action focus the password input.
  const passwordInput = useRef<TextInput>(null);
  // Controlled input values: setters update the text displayed in each field.
  // This component holds credentials in memory; it does not save or send them.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // false hides the password; true displays its characters.
  const [visible, setVisible] = useState(false);
  // Remember the selected field to highlight its border (null means neither field).
  const [focused, setFocused] = useState<string | null>(null);
  // Wait until the user tries Sign in before showing validation errors.
  const [submitted, setSubmitted] = useState(false);
  // Message displayed after sign-in preview or an account-help action.
  const [notice, setNotice] = useState('');
  // Basic email format check: non-whitespace text before/after @ and after a dot.
  // trim() ignores surrounding spaces. This does not verify that an account exists.
  const emailError = submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // A login password must be nonempty; its correctness needs backend verification.
  const passwordError = submitted && password.length === 0;

  // Called by the Sign in button or the password keyboard's Go action.
  // Currently this only validates the inputs and shows a preview message.
  // Future authentication must use the backend's verified role before navigating.
  function signIn() {
    setSubmitted(true);
    // condition ? message : "" selects a notice only when both fields pass validation.
    setNotice(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length > 0
      ? 'This is a design preview. Account sign-in will be available when the authentication service is connected.' : '');
  }

  return (
    // JSX describes the UI. KeyboardAvoidingView adjusts layout when the keyboard opens.
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Scrolling keeps content reachable on small screens and with the keyboard open. */}
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={s.screen}>
          {/* Header: keep at least 24 units of top padding, or more for the device inset. */}
          <View style={[s.hero, { paddingTop: Math.max(insets.top, 24) }]}>
            {/* Decorative art ignores taps and moves farther right on narrow screens. */}
            <View pointerEvents="none" style={[s.art, width < 360 && { right: -125 }]}><BotanicalArt /></View>
            <View style={s.brand}><View style={s.brandMark}><Icon name="leaf" color={colors.lime} /></View><View><Text style={s.brandName}>Niah</Text><Text style={s.brandSubtitle}>BIODIVERSITY</Text></View></View>
            <View style={s.heroCopy}><Text style={s.eyebrow}>FROM THE FIELD. FOR THE FUTURE.</Text><Text style={s.heroTitle}>Every plant.{'\n'}A story to protect.</Text><Text style={s.heroDescription}>Document discoveries.{'\n'}Preserve Sarawak’s biodiversity.</Text></View>
            <View style={s.park}><View style={s.dot} /><Text style={s.parkText}>NIAH NATIONAL PARK · SARAWAK</Text></View>
          </View>
          {/* Main form area: bottom padding also respects the device safe area. */}
          <View style={[s.body, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            {/* This is a visual role label, not an authorization check. */}
            <View style={s.role}><Icon name="leaf" color={colors.forest} /><Text style={s.roleText}>BOTANIST FIELD ACCESS</Text></View>
            <Text accessibilityRole="header" style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to your field workspace.</Text>
            <View style={s.form}>
              <Text style={s.label}>Email address</Text>
              {/* Combine the base style with focus/error borders when those conditions are true. */}
              <View style={[s.inputWrap, focused === 'email' && s.focused, emailError && s.invalid]}>
                <Icon name="mail" />
                {/* value reads state; onChangeText updates it and clears the previous notice.
                    Email keyboard options avoid automatic capitalization/correction.
                    Next focuses the password field; ?. only calls focus if the ref exists. */}
                <TextInput accessibilityLabel="Email address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@organisation.com" placeholderTextColor="#89938C" style={s.input} value={email} onChangeText={value => { setEmail(value); setNotice(''); }} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />
              </View>
              {/* condition && element renders this error only when the condition is true. */}
              {emailError && <Text accessibilityRole="alert" style={s.error}>Enter a valid email address.</Text>}
              {/* Password recovery currently shows guidance; it does not send a reset email. */}
              <View style={s.passwordLabel}><Text style={s.label}>Password</Text><Pressable accessibilityRole="button" onPress={() => setNotice('Please contact your project administrator for help resetting your password.')} style={s.helpLink}><Text style={s.link}>Forgot password?</Text></Pressable></View>
              <View style={[s.inputWrap, focused === 'password' && s.focused, passwordError && s.invalid]}>
                <Icon name="lock" />
                {/* secureTextEntry={!visible} masks the password until visibility is enabled.
                    ref connects this input to passwordInput; Go calls signIn(). */}
                <TextInput ref={passwordInput} accessibilityLabel="Password" autoComplete="current-password" textContentType="password" autoCapitalize="none" autoCorrect={false} placeholder="Enter your password" placeholderTextColor="#89938C" secureTextEntry={!visible} style={s.input} value={password} onChangeText={value => { setPassword(value); setNotice(''); }} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} returnKeyType="go" onSubmitEditing={signIn} />
                {/* Toggle visibility and change the accessible button label to match its action. */}
                <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} accessibilityState={{ checked: visible }} onPress={() => setVisible(!visible)} style={s.eye}><Icon name="eye" color={visible ? colors.forest : colors.muted} /></Pressable>
              </View>
              {passwordError && <Text accessibilityRole="alert" style={s.error}>Enter your password.</Text>}
              {/* Pressable calls signIn and applies a temporary style while being pressed. */}
              <Pressable accessibilityRole="button" onPress={signIn} style={({ pressed }) => [s.signIn, pressed && s.pressed]}><Text style={s.signInText}>Sign in</Text><Icon name="arrow" color="#FFFFFF" /></Pressable>
              {/* !! converts the message to a boolean; an empty message renders nothing.
                  The live region announces message changes to supported screen readers. */}
              {!!notice && <View style={s.notice}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.noticeText}>{notice}</Text></View>}
            </View>
            {/* Account access information and administrator-help action. */}
            <View style={s.accessNote}><Icon name="lock" /><Text style={s.accessText}>Access is assigned by your organisation.</Text></View>
            <View style={s.divider} />
            <View style={s.support}><Text style={s.supportText}>Need an account?</Text><Pressable accessibilityRole="button" onPress={() => setNotice('Ask your project administrator to create your account and assign your Botanist role.')} style={s.supportButton}><Text style={s.link}>Contact your administrator</Text></Pressable></View>
            <Text style={s.footer}>SMART GROUND-TRUTHING & BIODIVERSITY SYSTEM</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Named style objects are used above as style={s.title}, style={s.input}, etc.
// Layout sizes are logical units, not necessarily physical screen pixels.
// flex: 1 fills available space; row arranges children horizontally; gap adds spacing.
const s = StyleSheet.create({
  // Outer layout: centre the screen and limit its width on larger displays.
  root: { flex: 1, backgroundColor: '#E8ECE5' },
  scroll: { flexGrow: 1, alignItems: 'center' },
  screen: { width: '100%', maxWidth: 480, flexGrow: 1, backgroundColor: colors.cream },
  // Header and illustration. Absolute positioning places the art behind the content.
  hero: { backgroundColor: colors.forest, paddingHorizontal: 28, paddingBottom: 25, overflow: 'hidden' },
  art: { position: 'absolute', right: -80, top: 44, width: 214, height: 282, opacity: 0.8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { height: 43, width: 43, borderWidth: 1, borderColor: '#6D8770', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 25, color: '#FFFFFF', fontWeight: '600', letterSpacing: -0.7 },
  brandSubtitle: { fontSize: 8, color: colors.lime, letterSpacing: 2.5, marginTop: 1 },
  heroCopy: { marginTop: 29 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '600', letterSpacing: 1.45 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 39, fontWeight: '500', letterSpacing: -1.4, marginTop: 12, fontFamily: Platform.OS === 'ios' ? 'Georgia' : Platform.OS === 'web' ? 'Georgia, serif' : 'serif' },
  heroDescription: { color: '#D0DDD1', fontSize: 13, lineHeight: 20, marginTop: 12 },
  park: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 25 },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: colors.lime },
  parkText: { fontSize: 8, letterSpacing: 1.3, fontWeight: '600', color: '#DAE5D5' },
  // Form heading and role label. Padding is inside an element; margin is outside it.
  body: { paddingTop: 25, paddingHorizontal: 28 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 15 },
  roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.forest },
  title: { fontSize: 29, lineHeight: 36, fontWeight: '600', letterSpacing: -0.8, color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5, lineHeight: 21 },
  // Input layout and visual feedback. minHeight keeps fields comfortable to tap.
  form: { marginTop: 25 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  inputWrap: { minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingLeft: 15, marginTop: 9 },
  focused: { borderColor: '#477C57', borderWidth: 2, paddingLeft: 14 },
  invalid: { borderColor: '#AD493A' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 11, paddingVertical: 16, fontSize: 14, color: colors.ink },
  eye: { minWidth: 46, minHeight: 50, justifyContent: 'center', alignItems: 'center' },
  passwordLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9, gap: 8 },
  helpLink: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#34664B', fontSize: 12, fontWeight: '600' },
  // Primary action; pressed slightly changes its colour and scale for feedback.
  signIn: { backgroundColor: colors.forest, borderRadius: 12, minHeight: 55, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 13, marginTop: 24 },
  pressed: { backgroundColor: '#2D5A45', transform: [{ scale: 0.99 }] },
  signInText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  // Validation errors, informational notices, and footer styling.
  error: { color: '#A1382C', fontSize: 12, marginTop: 6 },
  notice: { padding: 14, borderRadius: 10, backgroundColor: '#EAF0E1', marginTop: 14 },
  noticeText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  accessNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 },
  accessText: { flexShrink: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 24 },
  support: { alignItems: 'center', marginTop: 20 },
  supportText: { color: colors.muted, fontSize: 12 },
  supportButton: { minHeight: 44, justifyContent: 'center' },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 8, letterSpacing: 1.1, lineHeight: 14, marginTop: 12 },
});

