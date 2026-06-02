function load() {
  console.log('[agora-rtc] extension loaded');
}

function unload() {
  console.log('[agora-rtc] extension unloaded');
}

module.exports = {
  load,
  unload,
};
