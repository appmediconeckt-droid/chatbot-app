import React, { useState } from "react";
import {
  View, Text, Modal, TouchableOpacity, Image,
  ScrollView, StyleSheet, Dimensions, FlatList,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const ITEM_SIZE = (SCREEN_W - 48 - 16) / 3; // 3 columns with padding

const REAL_AVATARS = [
  // Kids (10s) — illustrated cartoons (no real child photos available publicly)
  { id: "kb-1", label: "Kid Boy",  gender: "male",   age: "10s", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=kidboy1&backgroundColor=b6e3f4&radius=50" },
  { id: "kb-2", label: "Kid Boy",  gender: "male",   age: "10s", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=kidboy2&backgroundColor=c0aede&radius=50" },
  { id: "kb-3", label: "Kid Boy",  gender: "male",   age: "10s", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=kidboy3&backgroundColor=d1d4f9&radius=50" },
  { id: "kg-1", label: "Kid Girl", gender: "female", age: "10s", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=kidgirl1&backgroundColor=ffd5dc&radius=50" },
  { id: "kg-2", label: "Kid Girl", gender: "female", age: "10s", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=kidgirl2&backgroundColor=ffdfbf&radius=50" },
  { id: "kg-3", label: "Kid Girl", gender: "female", age: "10s", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=kidgirl3&backgroundColor=e8d5b7&radius=50" },
  // 20s
  { id: "m20-1", label: "20s Male",   gender: "male",   age: "20s", url: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: "m20-2", label: "20s Male",   gender: "male",   age: "20s", url: "https://randomuser.me/api/portraits/men/55.jpg" },
  { id: "m20-3", label: "20s Male",   gender: "male",   age: "20s", url: "https://randomuser.me/api/portraits/men/11.jpg" },
  { id: "f20-1", label: "20s Female", gender: "female", age: "20s", url: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: "f20-2", label: "20s Female", gender: "female", age: "20s", url: "https://randomuser.me/api/portraits/women/63.jpg" },
  { id: "f20-3", label: "20s Female", gender: "female", age: "20s", url: "https://randomuser.me/api/portraits/women/17.jpg" },
  // 30s
  { id: "m30-1", label: "30s Male",   gender: "male",   age: "30s", url: "https://randomuser.me/api/portraits/men/41.jpg" },
  { id: "m30-2", label: "30s Male",   gender: "male",   age: "30s", url: "https://randomuser.me/api/portraits/men/22.jpg" },
  { id: "m30-3", label: "30s Male",   gender: "male",   age: "30s", url: "https://randomuser.me/api/portraits/men/67.jpg" },
  { id: "f30-1", label: "30s Female", gender: "female", age: "30s", url: "https://randomuser.me/api/portraits/women/28.jpg" },
  { id: "f30-2", label: "30s Female", gender: "female", age: "30s", url: "https://randomuser.me/api/portraits/women/51.jpg" },
  { id: "f30-3", label: "30s Female", gender: "female", age: "30s", url: "https://randomuser.me/api/portraits/women/72.jpg" },
  // 40s
  { id: "m40-1", label: "40s Male",   gender: "male",   age: "40s", url: "https://randomuser.me/api/portraits/men/46.jpg" },
  { id: "m40-2", label: "40s Male",   gender: "male",   age: "40s", url: "https://randomuser.me/api/portraits/men/78.jpg" },
  { id: "m40-3", label: "40s Male",   gender: "male",   age: "40s", url: "https://randomuser.me/api/portraits/men/14.jpg" },
  { id: "f40-1", label: "40s Female", gender: "female", age: "40s", url: "https://randomuser.me/api/portraits/women/46.jpg" },
  { id: "f40-2", label: "40s Female", gender: "female", age: "40s", url: "https://randomuser.me/api/portraits/women/78.jpg" },
  { id: "f40-3", label: "40s Female", gender: "female", age: "40s", url: "https://randomuser.me/api/portraits/women/14.jpg" },
  // 50s
  { id: "m50-1", label: "50s Male",   gender: "male",   age: "50s", url: "https://randomuser.me/api/portraits/men/53.jpg" },
  { id: "m50-2", label: "50s Male",   gender: "male",   age: "50s", url: "https://randomuser.me/api/portraits/men/85.jpg" },
  { id: "m50-3", label: "50s Male",   gender: "male",   age: "50s", url: "https://randomuser.me/api/portraits/men/36.jpg" },
  { id: "f50-1", label: "50s Female", gender: "female", age: "50s", url: "https://randomuser.me/api/portraits/women/53.jpg" },
  { id: "f50-2", label: "50s Female", gender: "female", age: "50s", url: "https://randomuser.me/api/portraits/women/85.jpg" },
  { id: "f50-3", label: "50s Female", gender: "female", age: "50s", url: "https://randomuser.me/api/portraits/women/36.jpg" },
  // 60s — xsgames.co (visibly older real portraits)
  { id: "m60-1", label: "60s Male",   gender: "male",   age: "60s", url: "https://xsgames.co/randomusers/assets/avatars/male/60.jpg" },
  { id: "m60-2", label: "60s Male",   gender: "male",   age: "60s", url: "https://xsgames.co/randomusers/assets/avatars/male/61.jpg" },
  { id: "m60-3", label: "60s Male",   gender: "male",   age: "60s", url: "https://xsgames.co/randomusers/assets/avatars/male/62.jpg" },
  { id: "f60-1", label: "60s Female", gender: "female", age: "60s", url: "https://xsgames.co/randomusers/assets/avatars/female/60.jpg" },
  { id: "f60-2", label: "60s Female", gender: "female", age: "60s", url: "https://xsgames.co/randomusers/assets/avatars/female/61.jpg" },
  { id: "f60-3", label: "60s Female", gender: "female", age: "60s", url: "https://xsgames.co/randomusers/assets/avatars/female/62.jpg" },
  // 70s
  { id: "m70-1", label: "70s Male",   gender: "male",   age: "70s", url: "https://xsgames.co/randomusers/assets/avatars/male/63.jpg" },
  { id: "m70-2", label: "70s Male",   gender: "male",   age: "70s", url: "https://xsgames.co/randomusers/assets/avatars/male/64.jpg" },
  { id: "m70-3", label: "70s Male",   gender: "male",   age: "70s", url: "https://xsgames.co/randomusers/assets/avatars/male/65.jpg" },
  { id: "f70-1", label: "70s Female", gender: "female", age: "70s", url: "https://xsgames.co/randomusers/assets/avatars/female/63.jpg" },
  { id: "f70-2", label: "70s Female", gender: "female", age: "70s", url: "https://xsgames.co/randomusers/assets/avatars/female/64.jpg" },
  { id: "f70-3", label: "70s Female", gender: "female", age: "70s", url: "https://xsgames.co/randomusers/assets/avatars/female/65.jpg" },
  // 80s
  { id: "m80-1", label: "80s Male",   gender: "male",   age: "80s", url: "https://xsgames.co/randomusers/assets/avatars/male/66.jpg" },
  { id: "m80-2", label: "80s Male",   gender: "male",   age: "80s", url: "https://xsgames.co/randomusers/assets/avatars/male/67.jpg" },
  { id: "m80-3", label: "80s Male",   gender: "male",   age: "80s", url: "https://xsgames.co/randomusers/assets/avatars/male/68.jpg" },
  { id: "f80-1", label: "80s Female", gender: "female", age: "80s", url: "https://xsgames.co/randomusers/assets/avatars/female/66.jpg" },
  { id: "f80-2", label: "80s Female", gender: "female", age: "80s", url: "https://xsgames.co/randomusers/assets/avatars/female/67.jpg" },
  { id: "f80-3", label: "80s Female", gender: "female", age: "80s", url: "https://xsgames.co/randomusers/assets/avatars/female/68.jpg" },
  // 90s
  { id: "m90-1", label: "90s Male",   gender: "male",   age: "90s", url: "https://xsgames.co/randomusers/assets/avatars/male/69.jpg" },
  { id: "m90-2", label: "90s Male",   gender: "male",   age: "90s", url: "https://xsgames.co/randomusers/assets/avatars/male/70.jpg" },
  { id: "m90-3", label: "90s Male",   gender: "male",   age: "90s", url: "https://xsgames.co/randomusers/assets/avatars/male/71.jpg" },
  { id: "f90-1", label: "90s Female", gender: "female", age: "90s", url: "https://xsgames.co/randomusers/assets/avatars/female/69.jpg" },
  { id: "f90-2", label: "90s Female", gender: "female", age: "90s", url: "https://xsgames.co/randomusers/assets/avatars/female/70.jpg" },
  { id: "f90-3", label: "90s Female", gender: "female", age: "90s", url: "https://xsgames.co/randomusers/assets/avatars/female/71.jpg" },
  // 100s
  { id: "m100-1", label: "100s Male",   gender: "male",   age: "100s", url: "https://xsgames.co/randomusers/assets/avatars/male/72.jpg" },
  { id: "m100-2", label: "100s Male",   gender: "male",   age: "100s", url: "https://xsgames.co/randomusers/assets/avatars/male/73.jpg" },
  { id: "m100-3", label: "100s Male",   gender: "male",   age: "100s", url: "https://xsgames.co/randomusers/assets/avatars/male/74.jpg" },
  { id: "f100-1", label: "100s Female", gender: "female", age: "100s", url: "https://xsgames.co/randomusers/assets/avatars/female/72.jpg" },
  { id: "f100-2", label: "100s Female", gender: "female", age: "100s", url: "https://xsgames.co/randomusers/assets/avatars/female/73.jpg" },
  { id: "f100-3", label: "100s Female", gender: "female", age: "100s", url: "https://xsgames.co/randomusers/assets/avatars/female/74.jpg" },
];

const AGE_GROUPS    = ["all", "10s", "20s", "30s", "40s", "50s", "60s", "70s", "80s", "90s", "100s"];
const GENDERS       = ["all", "male", "female"];

const INITIALS_COLORS = [
  "#667eea", "#f093fb", "#4facfe", "#43e97b",
  "#fa709a", "#fcc419", "#ff6b6b", "#20c997",
  "#fd7e14", "#6f42c1", "#0dcaf0", "#d63384",
];

const DICEBEAR_BASE = "https://api.dicebear.com/7.x";
function getInitialsUrl(initials, color) {
  const enc = encodeURIComponent(initials.toUpperCase().slice(0, 2));
  const bg  = color.replace("#", "");
  return `${DICEBEAR_BASE}/initials/svg?seed=${enc}&backgroundColor=${bg}&radius=50&fontSize=40`;
}

const AvatarGenerator = ({ userName, onSelect, onClose }) => {
  const [tab, setTab]           = useState("real");
  const [selectedId, setSelectedId] = useState(null);
  const [gender, setGender]     = useState("all");
  const [age, setAge]           = useState("all");
  const [color, setColor]       = useState(INITIALS_COLORS[0]);

  const initials = (userName || "U")
    .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const filtered = REAL_AVATARS.filter(a =>
    (gender === "all" || a.gender === gender) &&
    (age    === "all" || a.age    === age)
  );

  const handleApply = () => {
    if (tab === "real") {
      const a = REAL_AVATARS.find(x => x.id === selectedId);
      if (a) { onSelect(a.url); onClose(); }
    } else {
      onSelect(getInitialsUrl(initials, color));
      onClose();
    }
  };

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View style={S.overlay}>
        <View style={S.sheet}>

          {/* Header */}
          <View style={S.header}>
            <Text style={S.headerTitle}>Choose Avatar</Text>
            <TouchableOpacity onPress={onClose} style={S.closeBtn}>
              <Text style={S.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={S.tabs}>
            {["real", "initials"].map(t => (
              <TouchableOpacity key={t} style={[S.tab, tab === t && S.tabActive]} onPress={() => setTab(t)}>
                <Text style={[S.tabText, tab === t && S.tabTextActive]}>
                  {t === "real" ? "Real Photos" : "Initials"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === "real" ? (
            <>
              {/* Gender filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.filterRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
                {GENDERS.map(g => (
                  <TouchableOpacity key={g} style={[S.pill, gender === g && S.pillActive]} onPress={() => setGender(g)}>
                    <Text style={[S.pillText, gender === g && S.pillTextActive]}>
                      {g === "all" ? "All" : g === "male" ? "Male" : "Female"}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={{ width: 12 }} />
                {AGE_GROUPS.map(a => (
                  <TouchableOpacity key={a} style={[S.pill, age === a && S.pillActive]} onPress={() => setAge(a)}>
                    <Text style={[S.pillText, age === a && S.pillTextActive]}>
                      {a === "all" ? "All Ages" : a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Photo grid */}
              <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                numColumns={3}
                style={{ flex: 1 }}
                contentContainerStyle={S.grid}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[S.gridItem, selectedId === item.id && S.gridItemSelected]}
                    onPress={() => setSelectedId(item.id)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.url }} style={S.gridImg} />
                    <Text style={S.gridLabel} numberOfLines={1}>{item.label}</Text>
                    {selectedId === item.id && (
                      <View style={S.checkBadge}><Text style={S.checkText}>✓</Text></View>
                    )}
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={S.initialsBody}>
              <Image source={{ uri: getInitialsUrl(initials, color) }} style={S.initialsPreview} />
              <Text style={S.initialsHint}>Your initials: <Text style={{ fontWeight: "700" }}>{initials}</Text></Text>
              <Text style={S.colorLabel}>Choose background color:</Text>
              <View style={S.colorGrid}>
                {INITIALS_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[S.swatch, { backgroundColor: c }, color === c && S.swatchSelected]}
                    onPress={() => setColor(c)}
                  >
                    {color === c && <Text style={S.swatchCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Footer */}
          <View style={S.footer}>
            <TouchableOpacity style={S.cancelBtn} onPress={onClose}>
              <Text style={S.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.applyBtn, (tab === "real" && !selectedId) && S.applyBtnDisabled]}
              onPress={handleApply}
              disabled={tab === "real" && !selectedId}
            >
              <Text style={S.applyText}>Use This Avatar</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingBottom: 24 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  headerTitle:   { fontSize: 17, fontWeight: "700", color: "#1a1a2e" },
  closeBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  closeX:        { fontSize: 14, color: "#64748b", fontWeight: "700" },
  tabs:          { flexDirection: "row", marginHorizontal: 16, marginTop: 12, backgroundColor: "#f1f5f9", borderRadius: 10, padding: 3 },
  tab:           { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive:     { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText:       { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  tabTextActive: { color: "#4f46e5" },
  filterRow:     { flexGrow: 0 },
  pill:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  pillActive:    { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  pillText:      { fontSize: 12, color: "#64748b", fontWeight: "600" },
  pillTextActive:{ color: "#fff" },
  grid:          { padding: 12, gap: 8 },
  gridItem:      { width: ITEM_SIZE, margin: 4, alignItems: "center", borderRadius: 12, borderWidth: 2, borderColor: "transparent", overflow: "hidden", backgroundColor: "#f8fafc" },
  gridItemSelected: { borderColor: "#4f46e5" },
  gridImg:       { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 10 },
  gridLabel:     { fontSize: 10, color: "#64748b", marginTop: 4, marginBottom: 4, textAlign: "center" },
  checkBadge:    { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  checkText:     { color: "#fff", fontSize: 11, fontWeight: "700" },
  initialsBody:  { alignItems: "center", padding: 24 },
  initialsPreview: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  initialsHint:  { fontSize: 14, color: "#64748b", marginBottom: 20 },
  colorLabel:    { fontSize: 13, color: "#1e293b", fontWeight: "600", marginBottom: 12, alignSelf: "flex-start" },
  colorGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch:        { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  swatchSelected:{ borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
  swatchCheck:   { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer:        { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center" },
  cancelText:    { fontSize: 15, color: "#64748b", fontWeight: "600" },
  applyBtn:      { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: "#4f46e5", alignItems: "center" },
  applyBtnDisabled: { backgroundColor: "#c7d2fe" },
  applyText:     { fontSize: 15, color: "#fff", fontWeight: "700" },
});

export default AvatarGenerator;
