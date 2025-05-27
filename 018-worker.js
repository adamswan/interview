setInterval(() => {
  // 发消息
  self.postMessage(new Date().toLocaleTimeString());
}, 1000);

// 收消息
self.onmessage = (e) => {
  console.log("收到js主线程的消息：", e.data);
};
