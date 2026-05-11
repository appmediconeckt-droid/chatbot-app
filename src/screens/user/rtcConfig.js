export const RTC_CONFIGURATION = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Metered free TURN — more reliable than openrelay
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "e8dd65f1f2c8d67f7d983861",
      credential: "uMQSCTbNX7bMTv3c",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "e8dd65f1f2c8d67f7d983861",
      credential: "uMQSCTbNX7bMTv3c",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "e8dd65f1f2c8d67f7d983861",
      credential: "uMQSCTbNX7bMTv3c",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "e8dd65f1f2c8d67f7d983861",
      credential: "uMQSCTbNX7bMTv3c",
    },
  ],
  iceCandidatePoolSize: 10,
};
