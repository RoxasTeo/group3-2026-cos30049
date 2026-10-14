import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text,
  TextInput, View
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as SQLite from "expo-sqlite";

type Note = {
  id: number;
  title: string;
  body: string;
  updated_at: string;
  sync_status: "pending" | "synced";
};

const dbPromise = SQLite.openDatabaseAsync("offline-notes.db");
const colors = {
  bg: "#F7F7FC", card: "#FFFFFF", ink: "#20213A", muted: "#85879B",
  purple: "#6842F5", pale: "#EEE9FF", green: "#16845B", red: "#C74646",
  line: "#E8E8F1"
};

export default function HomeScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function loadNotes() {
    const db = await dbPromise;
    const rows = await db.getAllAsync<Note>(
      "SELECT id, title, body, updated_at, sync_status FROM notes ORDER BY updated_at DESC"
    );
    setNotes(rows);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const db = await dbPromise;
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending'
        );
      `);
      const count = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM notes"
      );
      if (count?.count === 0) {
        const now = new Date().toISOString();
        await db.runAsync(
          "INSERT INTO notes (title, body, updated_at, sync_status) VALUES (?, ?, ?, ?)",
          "Project Ideas", "Build a mobile app with offline support.\n\nUse SQLite for local storage and sync with a backend when online.", now, "pending"
        );
        await db.runAsync(
          "INSERT INTO notes (title, body, updated_at, sync_status) VALUES (?, ?, ?, ?)",
          "Shopping List", "Milk, eggs, bread, coffee", now, "pending"
        );
        await db.runAsync(
          "INSERT INTO notes (title, body, updated_at, sync_status) VALUES (?, ?, ?, ?)",
          "Meeting Notes", "Discuss API integration and database schema.", now, "synced"
        );
      }
      if (mounted) {
        await loadNotes();
        setReady(true);
      }
    })().catch((e) => Alert.alert("Database error", String(e)));

    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(q));
  }, [notes, search]);

  function startNew() {
    setEditing(null); setTitle(""); setBody(""); setEditorOpen(true);
  }

  function startEdit(note: Note) {
    setEditing(note); setTitle(note.title); setBody(note.body); setEditorOpen(true);
  }

  async function saveNote() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert("Add a title", "Please enter a title for your note.");
      return;
    }
    const db = await dbPromise;
    const now = new Date().toISOString();
    if (editing) {
      await db.runAsync(
        "UPDATE notes SET title = ?, body = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
        cleanTitle, body.trim(), now, editing.id
      );
    } else {
      await db.runAsync(
        "INSERT INTO notes (title, body, updated_at, sync_status) VALUES (?, ?, ?, 'pending')",
        cleanTitle, body.trim(), now
      );
    }
    await loadNotes();
    setEditorOpen(false);
  }

  function deleteNote(note: Note) {
    Alert.alert("Delete note?", `“${note.title}” will be removed from this device.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const db = await dbPromise;
        await db.runAsync("DELETE FROM notes WHERE id = ?", note.id);
        await loadNotes();
      }}
    ]);
  }

  async function demoSync() {
    if (!online) {
      Alert.alert("You're offline", "Your notes are saved on this device and can sync when you reconnect.");
      return;
    }
    // Demo only: this marks local notes as synced. Connect a real API before production.
    const db = await dbPromise;
    await db.runAsync("UPDATE notes SET sync_status = 'synced'");
    await loadNotes();
    Alert.alert("Demo sync complete", "Local notes are marked synced. No server upload has been configured yet.");
  }

  if (!ready) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.purple} /><Text style={styles.muted}>Preparing local database…</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR PERSONAL SPACE</Text>
          <Text style={styles.heading}>My Notes</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={demoSync} style={styles.syncButton}>
          <Text style={styles.syncIcon}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search your notes..." placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>

      <View style={[styles.statusBanner, !online && styles.offlineBanner]}>
        <View style={[styles.statusDot, { backgroundColor: online ? colors.green : colors.red }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, !online && { color: colors.red }]}>{online ? "You're online" : "You're offline"}</Text>
          <Text style={styles.statusSubtitle}>{online ? "Your notes are always available locally" : "Changes save on this device and wait to sync"}</Text>
        </View>
        <Text style={styles.lockIcon}>▣</Text>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>All notes <Text style={styles.count}>({filteredNotes.length})</Text></Text>
        <Text style={styles.localLabel}>● SAVED LOCALLY</Text>
      </View>

      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No notes found</Text><Text style={styles.muted}>Create a note or try another search.</Text></View>}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => startEdit(item)} onLongPress={() => deleteNote(item)} style={styles.noteCard}>
            <View style={[styles.noteIcon, { backgroundColor: [ "#EEE9FF", "#FFF1D9", "#E2F0FF", "#DDF7EA" ][index % 4] }]}>
              <Text style={styles.noteGlyph}>{["▤", "☷", "▧", "✎"][index % 4]}</Text>
            </View>
            <View style={styles.noteText}>
              <Text numberOfLines={1} style={styles.noteTitle}>{item.title}</Text>
              <Text numberOfLines={2} style={styles.noteBody}>{item.body || "No additional text"}</Text>
              <Text style={styles.noteDate}>{new Date(item.updated_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.noteRight}>
              <Text style={styles.more}>···</Text>
              <Text style={[styles.syncStatus, { color: item.sync_status === "synced" ? colors.green : "#D66A45" }]}>
                {item.sync_status === "synced" ? "✓ Synced" : "↑ Pending"}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.bottomBar}>
        <View style={styles.tabActive}><Text style={styles.tabIcon}>▤</Text><Text style={styles.tabActiveText}>Notes</Text></View>
        <View style={styles.tab}><Text style={styles.tabIconMuted}>☁</Text><Text style={styles.tabText}>Offline</Text></View>
        <View style={styles.tab}><Text style={styles.tabIconMuted}>⚙</Text><Text style={styles.tabText}>Settings</Text></View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Create note" onPress={startNew} style={styles.fab}><Text style={styles.fabText}>＋</Text></Pressable>

      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditorOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.editorHeader}>
              <Pressable onPress={() => setEditorOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
              <Text style={styles.editorHeading}>{editing ? "Edit Note" : "New Note"}</Text>
              <Pressable onPress={saveNote}><Text style={styles.save}>Save</Text></Pressable>
            </View>
            <View style={styles.editorBody}>
              <TextInput value={title} onChangeText={setTitle} placeholder="Note title" placeholderTextColor={colors.muted} style={styles.titleInput} maxLength={120} />
              <TextInput value={body} onChangeText={setBody} placeholder="Start writing… Your changes are saved to this device." placeholderTextColor={colors.muted} style={styles.bodyInput} multiline textAlignVertical="top" />
              <Text style={styles.savedHint}>▣  Saved locally on this device</Text>
              {editing && <Pressable onPress={() => { setEditorOpen(false); deleteNote(editing); }} style={styles.deleteButton}><Text style={styles.deleteText}>Delete note</Text></Pressable>}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.bg },
  muted: { color: colors.muted, fontSize: 13 },
  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 10, letterSpacing: 1.7, color: colors.purple, fontWeight: "800", marginBottom: 5 },
  heading: { fontSize: 30, color: colors.ink, fontWeight: "800", letterSpacing: -0.8 },
  syncButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  syncIcon: { fontSize: 26, color: colors.purple },
  searchBox: { marginHorizontal: 20, height: 48, borderRadius: 15, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  searchIcon: { fontSize: 25, color: colors.muted, marginRight: 9 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  statusBanner: { marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: "#E7F7EF", flexDirection: "row", alignItems: "center", gap: 10 },
  offlineBanner: { backgroundColor: "#FFF0F0" },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusTitle: { fontSize: 13, fontWeight: "800", color: colors.green },
  statusSubtitle: { fontSize: 11, color: "#72758A", marginTop: 3 },
  lockIcon: { fontSize: 20, color: colors.muted },
  sectionRow: { paddingHorizontal: 22, marginTop: 24, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  count: { color: colors.muted, fontWeight: "500" },
  localLabel: { fontSize: 9, letterSpacing: 0.7, color: colors.green, fontWeight: "800" },
  listContent: { paddingHorizontal: 20, paddingBottom: 110, gap: 10 },
  noteCard: { backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.line, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  noteIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  noteGlyph: { fontSize: 21, color: colors.purple, fontWeight: "700" },
  noteText: { flex: 1, paddingTop: 1 },
  noteTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginBottom: 5 },
  noteBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  noteDate: { color: "#A0A1B2", fontSize: 10, marginTop: 8 },
  noteRight: { alignItems: "flex-end", justifyContent: "space-between", minHeight: 55 },
  more: { color: colors.muted, fontSize: 23, lineHeight: 18 },
  syncStatus: { fontSize: 10, fontWeight: "700" },
  empty: { alignItems: "center", padding: 36, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 76, paddingBottom: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  tabActive: { alignItems: "center", gap: 4 },
  tab: { alignItems: "center", gap: 4 },
  tabIcon: { color: colors.purple, fontSize: 20 },
  tabIconMuted: { color: "#9698AD", fontSize: 20 },
  tabActiveText: { color: colors.purple, fontSize: 10, fontWeight: "800" },
  tabText: { color: "#9698AD", fontSize: 10 },
  fab: { position: "absolute", right: 23, bottom: 92, width: 58, height: 58, borderRadius: 20, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: colors.purple, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  fabText: { fontSize: 30, color: "#FFFFFF", lineHeight: 34 },
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  editorHeader: { height: 60, paddingHorizontal: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.card },
  cancel: { fontSize: 14, color: colors.muted },
  save: { fontSize: 14, color: colors.purple, fontWeight: "800" },
  editorHeading: { fontSize: 16, fontWeight: "800", color: colors.ink },
  editorBody: { flex: 1, padding: 20 },
  titleInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 15, fontSize: 17, fontWeight: "700", color: colors.ink },
  bodyInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 15, marginTop: 12, minHeight: 220, fontSize: 15, lineHeight: 23, color: colors.ink },
  savedHint: { color: colors.green, fontSize: 12, marginTop: 14, fontWeight: "600" },
  deleteButton: { marginTop: 30, alignSelf: "center", padding: 12 },
  deleteText: { color: colors.red, fontWeight: "700" }
});
