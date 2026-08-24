import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';

export default function ChallengeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Weekly Challenge</Text>
      <Text style={styles.sub}>This week's Hyrox-style bodyweight circuit</Text>

      <View style={styles.challengeCard}>
        <Text style={styles.challengeTitle}>Forge Circuit #12</Text>
        <Text style={styles.challengeMeta}>Ends in 4 days • 1,248 participants</Text>

        <View style={styles.exercises}>
          <Text style={styles.exercise}>• 40 Air Squats</Text>
          <Text style={styles.exercise}>• 30 Push-ups</Text>
          <Text style={styles.exercise}>• 40 Walking Lunges</Text>
          <Text style={styles.exercise}>• 20 Burpees</Text>
          <Text style={styles.exercise}>• 50 Mountain Climbers</Text>
          <Text style={styles.exercise}>• 1 min Plank</Text>
        </View>

        <Text style={styles.note}>
          Complete for time. Lower time = higher rank. Optional short video for verification.
        </Text>

        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Start Challenge</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Leaderboard (Top 5)</Text>
      <View style={styles.leaderboard}>
        {[1, 2, 3, 4, 5].map((rank) => (
          <View key={rank} style={styles.row}>
            <Text style={styles.rank}>#{rank}</Text>
            <Text style={styles.name}>Athlete {rank}</Text>
            <Text style={styles.time}>—:—</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20 },
  header: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 15, color: '#a3a3a3', marginBottom: 24 },
  challengeCard: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 28,
  },
  challengeTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  challengeMeta: { fontSize: 13, color: '#737373', marginBottom: 16 },
  exercises: { marginBottom: 16 },
  exercise: { fontSize: 15, color: '#e5e5e5', marginBottom: 6 },
  note: { fontSize: 13, color: '#a3a3a3', marginBottom: 20, lineHeight: 18 },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  leaderboard: {
    backgroundColor: '#171717',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  rank: { width: 36, fontWeight: '700', color: '#22c55e' },
  name: { flex: 1, color: '#e5e5e5' },
  time: { color: '#a3a3a3', fontVariant: ['tabular-nums'] },
});
