import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.glowCircle} />

        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/carlogo.png')}
            style={styles.logo}
          />
        </View>

        <Text style={styles.title}>Welcome to Mo-Ride</Text>

        <Text style={styles.subtitle}>
          Continue with your Monash account to start riding or driving.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Choose how you want to continue</Text>

        <Text style={styles.cardDescription}>
          Create a new account if you are new here, or sign in to continue with your existing one.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Create New Account"
            onPress={() => router.push('/(auth)/register')}
            style={styles.primaryBtn}
          />

          <Button
            label="I already have an account"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
            style={styles.secondaryBtn}
          />
        </View>

        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.helperText}>
            Only Monash University (@monash.edu) email addresses are accepted.
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAF8',
    justifyContent: 'space-between',
  },

  topSection: {
    backgroundColor: '#43A047',
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 48,
    alignItems: 'center',
    overflow: 'hidden',
  },

  glowCircle: {
    position: 'absolute',
    top: -40,
    right: -10,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  logo: {
    width: 84,
    height: 84,
    resizeMode: 'contain',
    marginTop: 10,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.90)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 12,
  },

  card: {
    marginHorizontal: 20,
    marginTop: -24,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 8,
  },

  cardDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#5F6F65',
    marginBottom: 22,
  },

  actions: {
    gap: 12,
  },

  primaryBtn: {
    backgroundColor: '#34A853',
    borderRadius: 16,
  },

  secondaryBtn: {
    borderColor: '#34A853',
    borderRadius: 16,
  },

  helperText: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#7A8B81',
  },
});