import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../../src/components/ui/Button';

export default function IntroScreen() {
  const bubble1Y = useRef(new Animated.Value(0)).current;
  const bubble2Y = useRef(new Animated.Value(0)).current;
  const bubble1Scale = useRef(new Animated.Value(1)).current;
  const bubble2Scale = useRef(new Animated.Value(1)).current;

  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(18)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslate = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const float = (
      translate: Animated.Value,
      scale: Animated.Value,
      delay: number
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(translate, {
              toValue: -18,
              duration: 2200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.08,
              duration: 2200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translate, {
              toValue: 0,
              duration: 2200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 2200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );

    const bubbleAnim1 = float(bubble1Y, bubble1Scale, 0);
    const bubbleAnim2 = float(bubble2Y, bubble2Scale, 600);

    bubbleAnim1.start();
    bubbleAnim2.start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(buttonTranslate, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => {
      bubbleAnim1.stop();
      bubbleAnim2.stop();
    };
  }, [
    bubble1Y,
    bubble2Y,
    bubble1Scale,
    bubble2Scale,
    logoScale,
    logoOpacity,
    textOpacity,
    textTranslate,
    buttonOpacity,
    buttonTranslate,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.bgGlowOne,
            {
              transform: [{ translateY: bubble1Y }, { scale: bubble1Scale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.bgGlowTwo,
            {
              transform: [{ translateY: bubble2Y }, { scale: bubble2Scale }],
            },
          ]}
        />

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.logoWrap,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../../assets/carlogo.png')}
              style={styles.logo}
            />
          </Animated.View>

          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslate }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.title}>Mo-Ride</Text>

            <Text style={styles.subtitle}>
              Smarter, greener travel for the Monash community.
            </Text>
          </Animated.View>

          <Animated.View
            style={{
              width: '100%',
              opacity: buttonOpacity,
              transform: [{ translateY: buttonTranslate }],
            }}
          >
            <Button
              label="Get Started"
              onPress={() => router.push('/(auth)/welcome')}
              style={styles.primaryBtn}
            />
          </Animated.View>
        </View>

        <Text style={styles.footerText}>
          Built for Monash students and staff
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7FAF8',
  },

  container: {
    flex: 1,
    backgroundColor: '#F7FAF8',
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  bgGlowOne: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(52,168,83,0.18)',
    top: -60,
    right: -80,
  },

  bgGlowTwo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(67,160,71,0.14)',
    bottom: 60,
    left: -90,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoWrap: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#34A853',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },

  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginTop: 10,
  },

  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#17321F',
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  subtitle: {
    fontSize: 17,
    lineHeight: 26,
    color: '#5F6F65',
    textAlign: 'center',
    paddingHorizontal: 14,
    marginBottom: 34,
  },

  primaryBtn: {
    backgroundColor: '#34A853',
    borderRadius: 16,
    shadowColor: '#34A853',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
    width: '100%',
  },

  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#7A8B81',
    fontWeight: '500',
  },
});