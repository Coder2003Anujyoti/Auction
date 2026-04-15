import { io } from "socket.io-client";
export const socket = io("https://auction-e4c0.onrender.com", {
  reconnection: true,
  reconnectionAttempts: Infinity,   
  reconnectionDelay: 1000,         
  reconnectionDelayMax: 5000,     
  timeout: 20000,                  
  transports: ["websocket"],       
  autoConnect: true,
});