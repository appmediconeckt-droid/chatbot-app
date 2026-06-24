import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { API_BASE_URL } from "../../../../../../axiosConfig";

const ChatCallHistory = ({ userId, peerId }) => {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    let active = true;

    const loadCalls = async () => {
      if (!userId || !peerId) {
        if (active) setCalls([]);
        return;
      }
      try {
        const token =
          (await AsyncStorage.getItem("accessToken")) ||
          (await AsyncStorage.getItem("token"));
        const response = await axios.get(
          `${API_BASE_URL}/api/video/calls/history/${userId}`,
          {
            params: { page: 1, limit: 100 },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const matching = (response.data?.history || [])
          .filter((call) => String(call.withId) === String(peerId))
          .slice(0, 10);
        if (active) setCalls(matching);
      } catch {
        if (active) setCalls([]);
      }
    };

    void loadCalls();
    return () => { active = false; };
  }, [userId, peerId]);

  if (!calls.length) return null;

  const sorted = [...calls].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  const byDate = sorted.reduce((groups, call) => {
    const ts = new Date(call.timestamp);
    const key = Number.isNaN(ts.getTime())
      ? "Call history"
      : ts.toLocaleDateString([], {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
    groups[key] = groups[key] || [];
    groups[key].push(call);
    return groups;
  }, {});

  return (
    <View style={styles.container}>
      {Object.entries(byDate).map(([dateLabel, dailyCalls]) => (
        <View key={dateLabel} style={styles.dateGroup}>
          <View style={styles.dateSeparatorRow}>
            <View style={styles.dateLine} />
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <View style={styles.dateLine} />
          </View>
          {dailyCalls.map((call) => {
            const ts = new Date(call.timestamp);
            const isVideo = String(call.type).toLowerCase() === "video";
            const isOutgoing = call.role === "initiator";
            const direction = isOutgoing ? "Outgoing" : "Incoming";
            const time = Number.isNaN(ts.getTime())
              ? ""
              : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            return (
              <View
                key={call.id || `${call.timestamp}-${call.type}`}
                style={[
                  styles.callBubble,
                  isOutgoing ? styles.outgoing : styles.incoming,
                ]}
              >
                <Ionicons
                  name={isVideo ? "videocam" : "call"}
                  size={14}
                  color={isOutgoing ? "#2c50cd" : "#526071"}
                  style={styles.icon}
                />
                <Text style={styles.callText}>
                  {direction} {isVideo ? "video" : "voice"} call
                </Text>
                <Text style={styles.callMeta}>
                  {time}
                  {call.duration ? ` · ${call.duration}` : ""}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginBottom: 12,
  },
  dateGroup: {
    marginBottom: 12,
  },
  dateSeparatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dateLabel: {
    marginHorizontal: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  callBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: "85%",
    borderWidth: 1,
  },
  outgoing: {
    alignSelf: "flex-end",
    backgroundColor: "#e8eaff",
    borderColor: "#c7d2fe",
  },
  incoming: {
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  icon: {
    marginRight: 6,
  },
  callText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
  },
  callMeta: {
    fontSize: 11,
    color: "#64748b",
    marginLeft: 6,
  },
});

export default ChatCallHistory;
