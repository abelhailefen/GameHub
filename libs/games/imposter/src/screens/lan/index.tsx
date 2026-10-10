import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, colors, radius, Screen, SectionTitle, spacing } from '@gamehub/ui';
import { useGame } from '../../context/GameContext';
import { useLan } from '../../context/LanContext';
import type { FoundGame } from '../../lan/discovery';
import { routes } from '../../routes';

/** Forget games we haven't heard from in this long (the host probably closed it). */
const STALE_MS = 20_000;

type Listed = FoundGame & { seenAt: number };

const phaseLabel = (g: FoundGame) => (g.phase === 'lobby' || g.phase === 'result' ? 'waiting for players' : 'round in progress');

export default function LanHome() {
  const { lanName, setLanName } = useGame();
  const { hostGame, joinGame, discover } = useLan();
  const [name, setName] = useState(lanName);
  const [games, setGames] = useState<Listed[]>([]);
  const [myAddresses, setMyAddresses] = useState<string[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Keep looking for games the whole time this screen is open.
  useFocusEffect(
    useCallback(() => {
      setGames([]);
      setScanError(null);
      return discover(
        (game) => setGames((list) => [...list.filter((g) => g.host !== game.host), { ...game, seenAt: Date.now() }]),
        (status) => {
          setMyAddresses(status.addresses);
          setScanError(status.error ?? null);
        },
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const fresh = games.filter((g) => now - g.seenAt < STALE_MS);

  const checkName = () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Your name', 'Enter your name first so the others know who you are.');
      return null;
    }
    setLanName(n);
    return n;
  };

  const host = async () => {
    const n = checkName();
    if (!n || busy) return;
    setBusy(true);
    const error = await hostGame(n);
    setBusy(false);
    if (error) Alert.alert("Couldn't host", error);
    else router.push(routes.lanGame);
  };

  const join = (address: string) => {
    const n = checkName();
    if (!n) return;
    const host = address.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      Alert.alert('Address', 'Type the address shown on the host\'s phone, e.g. 192.168.1.23');
      return;
    }
    joinGame(host, n);
    router.push(routes.lanGame);
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Everyone plays on their own phone. Connect all phones to the same Wi-Fi, or turn on one phone's hotspot and
            join it. No internet needed.
          </Text>

          <SectionTitle>Your name</SectionTitle>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="words"
            maxLength={24}
          />

          <SectionTitle>Host</SectionTitle>
          <Button title={busy ? 'Starting…' : 'Host a new game'} onPress={host} disabled={busy} />

          <View style={styles.joinHead}>
            <SectionTitle>Join a game</SectionTitle>
            <ActivityIndicator color={colors.yellow} />
          </View>
          {fresh.map((g) => (
            <Pressable key={g.host} onPress={() => join(g.host)} style={({ pressed }) => [styles.game, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gameName}>{g.name}'s game</Text>
                <Text style={styles.gameSub}>
                  {g.players} player{g.players === 1 ? '' : 's'} · {phaseLabel(g)}
                </Text>
              </View>
              <Text style={styles.joinText}>Join ›</Text>
            </Pressable>
          ))}
          {fresh.length === 0 ? (
            <Text style={styles.help}>
              {scanError ??
                'Searching… Games appear here by themselves once the host taps "Host a new game" on the same Wi-Fi or hotspot.'}
            </Text>
          ) : null}
          {myAddresses.length > 0 ? (
            <Text style={styles.small}>This phone: {myAddresses.join(', ')}</Text>
          ) : null}

          <SectionTitle>Join by address</SectionTitle>
          <Text style={styles.help}>If the game doesn't show up, type the address shown on the host's phone.</Text>
          <View style={styles.row}>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="192.168.1.23"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <Button title="Join" variant="secondary" onPress={() => join(manual)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  intro: { color: colors.text, fontSize: 15, lineHeight: 22 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  game: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gameName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  gameSub: { color: colors.muted, fontSize: 14, marginTop: 2 },
  joinText: { color: colors.green, fontSize: 16, fontWeight: '700' },
  help: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  small: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
