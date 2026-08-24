import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function WelcomeScreen() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>VYRN</Text>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>VYRN</Text>
      <Text style={styles.tagline}>Show up. Put in the work.</Text>
      <Text style={styles.subtitle}>
        Equipment-free training + weekly challenges
      </Text>

      <View style={styles.buttons}>
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
        </Link>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 56,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 8,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 20,
    color: '#a3a3a3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#737373',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  secondaryButtonText: {
    color: '#a3a3a3',
    fontSize: 16,
  },
});
