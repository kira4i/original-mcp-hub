import {execFile} from 'node:child_process';
import os from 'node:os';
import process from 'node:process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);

const isWsl = () => {
  if (process.platform !== 'linux') {
    return false;
  }

  if ('WSL_DISTRO_NAME' in process.env || 'WSL_INTEROP' in process.env) {
    return true;
  }

  const release = os.release().toLowerCase();
  return release.includes('microsoft') || release.includes('wsl');
};

const commandCandidates = (url) => {
  if (process.platform === 'darwin') {
    return [
      {command: 'open', args: [url]},
    ];
  }

  if (process.platform === 'win32') {
    return [
      {command: 'cmd', args: ['/c', 'start', '', url]},
      {command: 'powershell', args: ['-NoProfile', '-Command', 'Start-Process', url]},
    ];
  }

  if (isWsl()) {
    return [
      {command: 'wslview', args: [url]},
      {command: 'powershell.exe', args: ['-NoProfile', '-Command', 'Start-Process', url]},
    ];
  }

  return [
    {command: 'xdg-open', args: [url]},
    {command: 'gio', args: ['open', url]},
    {command: 'gnome-open', args: [url]},
    {command: 'kde-open', args: [url]},
  ];
};

export const openUrl = async (url) => {
  const candidates = commandCandidates(url);
  let lastError;

  for (const {command, args} of candidates) {
    try {
      await execFileAsync(command, args, {windowsHide: true});
      return;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  const error = new Error('Unable to open URL in the default browser');
  error.cause = lastError;
  throw error;
};
