// Wi-Fi play for any game: transport, host and client sessions, and discovery. The native socket
// module lives in '@gamehub/lan/native' and the React hook in '@gamehub/lan/session', so this entry
// stays importable from Node (the LAN tests run the game code over Node's own sockets).
export * from './net';
export * from './protocol';
export * from './host';
export * from './client';
export * from './discovery';
