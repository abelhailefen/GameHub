// Transport helpers for Wi-Fi games. The native socket module lives in '@gamehub/lan/native' so this
// entry stays importable from Node (the LAN tests run the game code over Node's own sockets).
export * from './net';
