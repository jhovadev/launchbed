/** Strict, pure validation of read-only Android device properties before an instrumented run. */
export function parseDeviceReadiness({ bootCompleted, apiLevel, abi }, minSdk = 26) {
  if (String(bootCompleted).trim() !== '1') {
    throw new Error('Android is connected to ADB but has not completed boot (sys.boot_completed != 1).');
  }
  const api = String(apiLevel).trim();
  if (!/^\d{1,3}$/.test(api) || Number(api) < 1 || Number(api) > 99) {
    throw new Error('Device API level could not be read reliably.');
  }
  if (Number(api) < minSdk) {
    throw new Error(`Device API ${api} is below generated minSdk ${minSdk}.`);
  }
  const deviceAbi = String(abi).trim();
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(deviceAbi)) {
    throw new Error('Device ABI could not be read reliably.');
  }
  return { apiLevel: Number(api), abi: deviceAbi, bootCompleted: true };
}
