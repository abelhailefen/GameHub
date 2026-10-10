import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from './theme';

// How far (as a fraction of the card) the cover must be lifted to count as "seen".
const REVEAL_AT = 0.5;

/** A cover the player slides up to peek underneath. It springs shut as soon as they let go. */
export function SlideToReveal({
  cover,
  children,
  accent,
  onSeen,
}: {
  cover: ReactNode;
  children: ReactNode;
  accent: string;
  onSeen: () => void;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const height = useRef(0);
  const revealed = useRef(false);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;
  // The role is only rendered while the cover is being dragged, so it can never show through by accident.
  const [open, setOpen] = useState(false);

  const close = () =>
    Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start(({ finished }) => {
      if (finished) setOpen(false);
    });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        y.stopAnimation();
        revealed.current = false;
        setOpen(true);
      },
      onPanResponderMove: (_, g) => {
        const dy = Math.max(-height.current, Math.min(0, g.dy));
        y.setValue(dy);
        if (!revealed.current && -dy > height.current * REVEAL_AT) {
          revealed.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSeenRef.current();
        }
      },
      onPanResponderRelease: () => close(),
      onPanResponderTerminate: () => close(),
    }),
  ).current;

  return (
    <View
      style={[styles.revealBox, open && { borderColor: accent }]}
      onLayout={(e) => {
        height.current = e.nativeEvent.layout.height;
      }}
    >
      {open ? <View style={styles.revealContent}>{children}</View> : null}
      <Animated.View {...pan.panHandlers} style={[styles.cover, { transform: [{ translateY: y }] }]}>
        {cover}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  revealBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  revealContent: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    justifyContent: 'center',
    padding: spacing.md,
  },
});
