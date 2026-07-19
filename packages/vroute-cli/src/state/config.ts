import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ChaosRule {
  path: string;
  method: string;
  latency: number;
  failureRate: number;
  errorStatus: number;
}

export interface RouteConfig {
  port: number;
  ssl: boolean;
  cors: boolean;
  wildcard?: boolean;
  tenantHeader?: string;
  chaosEnabled?: boolean;
  chaosRules?: ChaosRule[];
}

export interface VRouteConfig {
  daemonPid?: number;
  routes: Record<string, RouteConfig>;
  shieldEnabled?: boolean;
  shieldRules?: string[];
}

export const CONFIG_DIR = path.join(os.homedir(), '.vroute');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: VRouteConfig = {
  routes: {},
  shieldEnabled: false,
  shieldRules: [
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
    "googleusercontent.com",
    "analytics.google.com",
    "gstatic.com",
    "facebook.com",
    "facebook.net",
    "connect.facebook.net",
    "facebookads.com",
    "meta.com",
    "instagram.com",
    "analytics.twitter.com",
    "ads-twitter.com",
    "t.co",
    "linkedin.com",
    "licdn.com",
    "snapchat.com",
    "sc-static.net",
    "tiktok.com",
    "analytics.tiktok.com",
    "pinterest.com",
    "pinimg.com",
    "reddit.com",
    "redditmedia.com",
    "bing.com",
    "bat.bing.com",
    "clarity.ms",
    "hotjar.com",
    "hotjar.io",
    "fullstory.com",
    "segment.com",
    "segment.io",
    "mixpanel.com",
    "amplitude.com",
    "heap.io",
    "newrelic.com",
    "nr-data.net",
    "datadoghq.com",
    "sentry.io",
    "bugsnag.com",
    "logrocket.com",
    "intercom.io",
    "intercomcdn.com",
    "zendesk.com",
    "drift.com",
    "crisp.chat",
    "hubspot.com",
    "hs-analytics.net",
    "hs-scripts.com",
    "hs-banner.com",
    "marketo.com",
    "pardot.com",
    "mailchimp.com",
    "mailchimpapp.com",
    "campaignmonitor.com",
    "adroll.com",
    "taboola.com",
    "outbrain.com",
    "criteo.com",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "quantserve.com",
    "scorecardresearch.com",
    "bluekai.com",
    "adsrvr.org",
    "mathtag.com",
    "demdex.net",
    "everesttech.net",
    "casalemedia.com",
    "yieldmo.com",
    "teads.tv",
    "smartadserver.com",
    "amazon-adsystem.com",
    "adsystem.amazon.com",
    "branch.io",
    "appsflyer.com",
    "adjust.com",
    "kochava.com",
    "singular.net",
    "firebase.google.com",
    "firebaseio.com",
    "googleapis.com",
    "app-measurement.com",
    "cdn.segment.com",
    "cdn.amplitude.com"
  ]
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

    // Migration: Ensure shield defaults exist
    if (config.shieldEnabled === undefined) {
      config.shieldEnabled = false;
    }
    if (!config.shieldRules) {
      config.shieldRules = [...DEFAULT_CONFIG.shieldRules!];
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
