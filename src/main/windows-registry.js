import Registry from 'winreg';

const ASPEL_REGISTRY_PATHS = [
  'HKLM\\SOFTWARE\\Aspel\\SAE\\10.00',
  'HKLM\\SOFTWARE\\Aspel\\SAE\\9.00',
  'HKLM\\SOFTWARE\\Aspel\\SAE\\8.00',
  'HKLM\\SOFTWARE\\Aspel\\SAE\\7.00',
  'HKLM\\SOFTWARE\\WOW6432Node\\Aspel\\SAE\\10.00',
];

export async function detectAspelInstallation() {
  for (const regPath of ASPEL_REGISTRY_PATHS) {
    try {
      const installPath = await readRegistryValue(regPath, 'InstallPath');
      const exportPath = `${installPath}\\Exportaciones`;
      const version = regPath.split('\\').pop();
      return { found: true, installPath, exportPath, version };
    } catch {
      continue;
    }
  }
  return { found: false };
}

function readRegistryValue(regPath, key) {
  return new Promise((resolve, reject) => {
    const reg = new Registry({
      hive: Registry.HKLM,
      key: regPath
    });
    reg.get(key, (err, item) => {
      if (err) reject(err);
      else resolve(item.value);
    });
  });
}
