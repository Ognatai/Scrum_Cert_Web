let intervalId = null;

export function startTimer(seconds, onTick, onExpire) {
  stopTimer();
  let remaining = seconds;
  onTick(remaining);
  intervalId = setInterval(() => {
    remaining--;
    onTick(remaining);
    if (remaining <= 0) {
      stopTimer();
      onExpire();
    }
  }, 1000);
}

export function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
