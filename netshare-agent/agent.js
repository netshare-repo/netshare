// Retired: production tasks must use authorized WebRTC DataChannels and Android TUN routing.
// The secure executor modules remain only for explicit integration-test peers.
console.error('The legacy Socket.IO task daemon is retired. Use the Android secure-routing client.');
process.exitCode = 1;
