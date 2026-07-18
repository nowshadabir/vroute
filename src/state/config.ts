import fs from 'fs';
import path from 'path';
import os from 'os';

export interface RouteConfig {
  port: number;
  ssl: boolean;
  cors: boolean;
}

export interface VRouteConfig {
  daemonPid?: number;
  routes: Record<string, RouteConfig>;
}

export const CONFIG_DIR = path.join(os.homedir(), '.vroute');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: VRouteConfig = {
  routes: {},
};

export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function readConfig(): VRouteConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    writeConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw) as any;
    
    // Migration: Convert { "app": 3000 } to { "app": { port: 3000, ssl: true, cors: true } }
    if (config.routes) {
      for (const domain of Object.keys(config.routes)) {
        if (typeof config.routes[domain] === 'number') {
          config.routes[domain] = {
            port: config.routes[domain],
            ssl: true,
            cors: true
          };
        }
      }
    }
    
    // Persist migration if changes occurred (optional, but good practice)
    return config as VRouteConfig;
  } catch (error) {
    console.error('Failed to parse config file, using default', error);
    return DEFAULT_CONFIG;
  }
}

export function writeConfig(config: VRouteConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function updateConfig(updater: (config: VRouteConfig) => void): VRouteConfig {
  const config = readConfig();
  updater(config);
  writeConfig(config);
  return config;
}
